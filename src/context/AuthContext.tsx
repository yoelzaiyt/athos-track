import React, { createContext, useContext, useState, useEffect } from 'react';
import { UserProfile, UserRole, ThemeMode, CompanyClient, CompanyUnit } from '../types';
import { supabase, type Session } from '../lib/supabaseClient';
import { rowToClient, rowToUnit } from '../lib/mappers';

interface AuthContextType {
  isAuthenticated: boolean;
  isAuthLoading: boolean;
  user: UserProfile | null;
  theme: ThemeMode;
  selectedClientId: string; // 'all' or client ID
  selectedUnitId: string; // 'all' or unit ID
  availableClients: CompanyClient[];
  availableUnits: CompanyUnit[];
  toggleTheme: () => void;
  setTheme: (theme: ThemeMode) => void;
  login: (email: string, pass: string) => Promise<boolean>;
  logout: () => void;
  setRole: (role: UserRole) => void;
  setSelectedClientId: (id: string) => void;
  setSelectedUnitId: (id: string) => void;
  canAccessModule: (moduleKey: string) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Deriva o UserProfile do app a partir da sessão do Supabase Auth: procura uma
// linha em user_profiles pelo e-mail (nem toda conta de auth tem uma linha
// vinculada ainda — a seed não preenche auth_user_id) e, se achar e ainda não
// estiver vinculada, faz o bind oportunista de auth_user_id nessa primeira vez.
// Sem match, cai num perfil mínimo derivado só da sessão (papel VIEWER, o mais
// restrito, em vez de assumir permissão).
async function resolveUserProfile(session: Session): Promise<UserProfile> {
  const authUser = session.user;
  const { data: row, error } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('email', authUser.email)
    .maybeSingle();

  if (error) {
    console.error('[AuthContext] Failed to resolve user profile:', error.message);
  }

  if (row) {
    if (!row.auth_user_id) {
      supabase.from('user_profiles').update({ auth_user_id: authUser.id }).eq('id', row.id);
    }
    return {
      id: row.id,
      name: row.name,
      email: row.email,
      role: row.role,
      avatarUrl: row.avatar_url ?? undefined,
      clientId: row.client_id ?? undefined,
      unitId: row.unit_id ?? undefined,
    };
  }

  return {
    id: authUser.id,
    name: (authUser.email || 'Usuário').split('@')[0],
    email: authUser.email || '',
    role: 'VIEWER',
  };
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isAuthLoading, setIsAuthLoading] = useState<boolean>(true);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [theme, setThemeState] = useState<ThemeMode>(() => {
    const saved = localStorage.getItem('athos_theme_mode');
    return (saved === 'light' || saved === 'dark') ? saved : 'dark';
  });
  const [selectedClientId, setSelectedClientId] = useState<string>('all');
  const [selectedUnitId, setSelectedUnitId] = useState<string>('all');
  const [clients, setClients] = useState<CompanyClient[]>([]);
  const [units, setUnits] = useState<CompanyUnit[]>([]);

  // Sessão real do Supabase Auth: checa a sessão existente no boot (localStorage,
  // gerenciado pelo próprio supabase-js) e escuta mudanças (login/logout/refresh
  // de token) para manter isAuthenticated/user sempre em sincronia com a sessão real.
  useEffect(() => {
    let cancelled = false;

    const applySession = async (session: Session | null) => {
      if (!session) {
        if (!cancelled) {
          setIsAuthenticated(false);
          setUser(null);
        }
        return;
      }
      const profile = await resolveUserProfile(session);
      if (!cancelled) {
        setUser(profile);
        setIsAuthenticated(true);
      }
    };

    supabase.auth.getSession().then(({ data: { session } }) => {
      applySession(session).finally(() => {
        if (!cancelled) setIsAuthLoading(false);
      });
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      applySession(session);
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  // Clientes/unidades reais do Supabase — alimentam os seletores (TopBar, filtros
  // de página, dropdowns de formulário como DeviceFormModal).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [clientsRes, unitsRes] = await Promise.all([
        supabase.from('company_clients').select('*').order('name'),
        supabase.from('company_units').select('*').order('name'),
      ]);
      if (cancelled) return;
      if (clientsRes.error) console.error('[AuthContext] Failed to load clients:', clientsRes.error.message);
      if (unitsRes.error) console.error('[AuthContext] Failed to load units:', unitsRes.error.message);
      setClients((clientsRes.data ?? []).map(rowToClient));
      setUnits((unitsRes.data ?? []).map(rowToUnit));
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
      document.documentElement.classList.remove('light');
    } else {
      document.documentElement.classList.remove('dark');
      document.documentElement.classList.add('light');
    }
    localStorage.setItem('athos_theme_mode', theme);
  }, [theme]);

  const toggleTheme = () => {
    setThemeState((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  const setTheme = (mode: ThemeMode) => {
    setThemeState(mode);
  };

  const login = async (email: string, pass: string): Promise<boolean> => {
    const { error } = await supabase.auth.signInWithPassword({ email, password: pass });
    if (error) {
      console.error('[AuthContext] login failed:', error.message);
      return false;
    }
    // isAuthenticated/user são atualizados pelo listener onAuthStateChange acima.
    return true;
  };

  const logout = () => {
    supabase.auth.signOut();
  };

  // Preview local de papel (RBAC) para testar a UI sob outras permissões — não
  // grava no banco. Só faz sentido enquanto o RLS não distingue papéis (hoje é
  // por sessão autenticada ou não, não por role); virar "de verdade" exigiria
  // policies por role, o que é um projeto à parte.
  const setRole = (role: UserRole) => {
    if (user) {
      setUser({ ...user, role });
    }
  };

  const availableClients = clients;
  const availableUnits =
    selectedClientId === 'all' ? units : units.filter((u) => u.clientId === selectedClientId);

  const canAccessModule = (moduleKey: string): boolean => {
    if (!user) return false;
    if (user.role === 'ATHOS_ADMIN') return true;

    // RBAC Rules Matrix
    switch (user.role) {
      case 'CLIENT_ADMIN':
        return true; // accesses all modules for their client
      case 'FLEET_MANAGER':
        return ['dashboard', 'map', 'frotas', 'cargas', 'alertas', 'relatorios', 'recuperacao_campo'].includes(moduleKey);
      case 'CART_MANAGER':
        return ['dashboard', 'map', 'carrinhos', 'tags', 'alertas', 'relatorios', 'recuperacao_campo'].includes(moduleKey);
      case 'ASSET_MANAGER':
        return ['dashboard', 'map', 'ativos', 'empilhadeiras', 'tags', 'alertas', 'relatorios', 'recuperacao_campo'].includes(moduleKey);
      case 'OPERATOR':
        return ['dashboard', 'map', 'carrinhos', 'ativos', 'frotas', 'empilhadeiras', 'alertas', 'recuperacao_campo'].includes(moduleKey);
      case 'VIEWER':
        return ['dashboard', 'map', 'relatorios'].includes(moduleKey);
      default:
        return true;
    }
  };

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated,
        isAuthLoading,
        user,
        theme,
        selectedClientId,
        selectedUnitId,
        availableClients,
        availableUnits,
        toggleTheme,
        setTheme,
        login,
        logout,
        setRole,
        setSelectedClientId,
        setSelectedUnitId,
        canAccessModule,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
