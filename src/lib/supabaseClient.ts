// Cliente HTTP fino que imita o subconjunto do supabase-js realmente usado
// pelo app (.from(table).select().order().eq().single()/.maybeSingle(),
// .insert(), .update(), .delete(), .channel(...).on('postgres_changes', ...),
// supabase.auth.signInWithPassword/getSession/onAuthStateChange/signOut).
// Existe pra que a migração Supabase -> API própria (server/api) não exigisse
// reescrever AssetContext.tsx/AuthContext.tsx/mappers.ts inteiros — eles
// continuam chamando exatamente os mesmos métodos em cima de `supabase`.
//
// Backend real: server/api (Express + Postgres do Railway). Ver
// docs/deploy/RAILWAY_VERCEL.md.

import { io, type Socket } from 'socket.io-client';

const API_URL = import.meta.env.VITE_API_URL as string;
if (!API_URL) {
  throw new Error('Missing VITE_API_URL — set it in .env (URL da API Express, ex: https://sua-api.up.railway.app).');
}

const TOKEN_STORAGE_KEY = 'athos_auth_token';

export interface AuthUser {
  id: string;
  email: string;
}

export interface Session {
  access_token: string;
  user: AuthUser;
}

type AuthEvent = 'SIGNED_IN' | 'SIGNED_OUT';
type AuthListener = (event: AuthEvent, session: Session | null) => void;

let authToken: string | null = localStorage.getItem(TOKEN_STORAGE_KEY);
let currentUser: AuthUser | null = null;
const authListeners: AuthListener[] = [];

let socket: Socket | null = null;
function getSocket(): Socket {
  if (!socket) socket = io(API_URL, { transports: ['websocket'] });
  return socket;
}

function currentSession(): Session | null {
  return authToken && currentUser ? { access_token: authToken, user: currentUser } : null;
}

function setSession(token: string | null, user: AuthUser | null) {
  authToken = token;
  currentUser = user;
  if (token) localStorage.setItem(TOKEN_STORAGE_KEY, token);
  else localStorage.removeItem(TOKEN_STORAGE_KEY);
}

interface ApiResult<T> {
  data: T | null;
  error: { message: string } | null;
}

async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<ApiResult<T>> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
        ...(options.headers || {}),
      },
    });
  } catch (err) {
    return { data: null, error: { message: (err as Error).message } };
  }

  if (res.status === 204) return { data: null, error: null };

  const body = await res.json().catch(() => null);
  if (!res.ok) {
    return { data: null, error: { message: body?.error || res.statusText } };
  }
  return { data: body as T, error: null };
}

type Op = 'select' | 'insert' | 'update' | 'delete';

type FilterOp = 'eq' | 'gte' | 'lte';

class QueryBuilder<T = any> implements PromiseLike<ApiResult<T>> {
  private filters: [FilterOp, string, string][] = [];
  private orderCol?: string;
  private ascending = true;
  private op: Op = 'select';
  private payload: unknown;
  private wantSingle = false;

  constructor(private table: string) {}

  select(_columns = '*'): this {
    return this;
  }

  order(col: string, opts?: { ascending?: boolean }): this {
    this.orderCol = col;
    this.ascending = opts?.ascending ?? true;
    return this;
  }

  eq(col: string, value: unknown): this {
    this.filters.push(['eq', col, String(value)]);
    return this;
  }

  gte(col: string, value: unknown): this {
    this.filters.push(['gte', col, String(value)]);
    return this;
  }

  lte(col: string, value: unknown): this {
    this.filters.push(['lte', col, String(value)]);
    return this;
  }

  insert(row: unknown): this {
    this.op = 'insert';
    this.payload = row;
    return this;
  }

  update(row: unknown): this {
    this.op = 'update';
    this.payload = row;
    return this;
  }

  delete(): this {
    this.op = 'delete';
    return this;
  }

  single(): Promise<ApiResult<T>> {
    this.wantSingle = true;
    return this.execute();
  }

  maybeSingle(): Promise<ApiResult<T>> {
    this.wantSingle = true;
    return this.execute();
  }

  then<R1 = ApiResult<T>, R2 = never>(
    onfulfilled?: ((value: ApiResult<T>) => R1 | PromiseLike<R1>) | null,
    onrejected?: ((reason: unknown) => R2 | PromiseLike<R2>) | null
  ): PromiseLike<R1 | R2> {
    return this.execute().then(onfulfilled, onrejected);
  }

  private buildQueryString(): string {
    const params = new URLSearchParams();
    for (const [op, col, value] of this.filters) params.set(`${op}_${col}`, value);
    if (this.orderCol) {
      params.set('order', this.orderCol);
      params.set('ascending', String(this.ascending));
    }
    if (this.wantSingle) params.set('single', 'true');
    const qs = params.toString();
    return qs ? `?${qs}` : '';
  }

  async execute(): Promise<ApiResult<T>> {
    const qs = this.buildQueryString();
    if (this.op === 'select') {
      return apiFetch<T>(`/rest/${this.table}${qs}`);
    }
    if (this.op === 'insert') {
      return apiFetch<T>(`/rest/${this.table}${qs}`, { method: 'POST', body: JSON.stringify(this.payload) });
    }
    if (this.op === 'update') {
      const result = await apiFetch<unknown[]>(`/rest/${this.table}${qs}`, {
        method: 'PATCH',
        body: JSON.stringify(this.payload),
      });
      return { data: (this.wantSingle ? result.data?.[0] : result.data) as T, error: result.error };
    }
    return apiFetch<T>(`/rest/${this.table}${qs}`, { method: 'DELETE' });
  }
}

interface RealtimeFilter {
  event: string;
  schema?: string;
  table: string;
}

export interface RealtimePayload {
  eventType: string;
  new: Record<string, unknown> | null;
  old: Record<string, unknown> | null;
}

function channel(_name: string) {
  const subs: { filter: RealtimeFilter; cb: (payload: RealtimePayload) => void }[] = [];
  const api = {
    on(_type: 'postgres_changes', filter: RealtimeFilter, cb: (payload: RealtimePayload) => void) {
      subs.push({ filter, cb });
      return api;
    },
    subscribe() {
      const s = getSocket();
      for (const { filter, cb } of subs) {
        s.on(`postgres_changes:${filter.table}`, (payload: RealtimePayload) => {
          if (filter.event === '*' || payload.eventType === filter.event) cb(payload);
        });
      }
      return api;
    },
    unsubscribe() {
      const s = getSocket();
      for (const { filter, cb } of subs) s.off(`postgres_changes:${filter.table}`, cb as any);
    },
  };
  return api;
}

export const supabase = {
  from<T = any>(table: string) {
    return new QueryBuilder<T>(table);
  },
  channel,
  removeChannel(ch: ReturnType<typeof channel>) {
    ch.unsubscribe();
  },
  auth: {
    async signInWithPassword({ email, password }: { email: string; password: string }) {
      const result = await apiFetch<{ token: string; user: AuthUser }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      if (result.error || !result.data) {
        return { data: { session: null }, error: result.error || { message: 'Login failed' } };
      }
      setSession(result.data.token, result.data.user);
      const session = currentSession();
      authListeners.forEach((l) => l('SIGNED_IN', session));
      return { data: { session }, error: null };
    },

    async getSession() {
      if (!authToken) return { data: { session: null } };
      const result = await apiFetch<{ user: AuthUser }>('/auth/session');
      if (result.error || !result.data) {
        setSession(null, null);
        return { data: { session: null } };
      }
      currentUser = result.data.user;
      return { data: { session: currentSession() } };
    },

    onAuthStateChange(cb: AuthListener) {
      authListeners.push(cb);
      return {
        data: {
          subscription: {
            unsubscribe() {
              const i = authListeners.indexOf(cb);
              if (i >= 0) authListeners.splice(i, 1);
            },
          },
        },
      };
    },

    async signOut() {
      setSession(null, null);
      authListeners.forEach((l) => l('SIGNED_OUT', null));
      return { error: null };
    },
  },
};
