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
  refreshClients: () => Promise<void>;
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
          // Achado desta rodada (UI-E2E-VALIDATION.md): sem isto, trocar de
          // conta (logout → login de outro tenant) na MESMA aba, sem F5,
          // deixava `clients`/`units` com o snapshot da conta anterior —
          // tenantAllowsModuleKey() não achava o tenant novo na lista velha
          // e caía no fallback "sem config = não filtra", mostrando módulos
          // que o tenant novo não tinha contratado (ex.: Caixas pro Grupo
          // Zaffari, que só tem Carrinhos+Ativos).
          setClients([]);
          setUnits([]);
        }
        return;
      }
      const profile = await resolveUserProfile(session);
      if (!cancelled) {
        setUser(profile);
        setIsAuthenticated(true);
        await loadClientsAndUnits();
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
  // de página, dropdowns de formulário como DeviceFormModal) e o Gerenciador
  // de Tenants (src/pages/admin/ClientsPage.tsx).
  const loadClientsAndUnits = async () => {
    const [clientsRes, unitsRes] = await Promise.all([
      supabase.from('company_clients').select('*').order('name'),
      supabase.from('company_units').select('*').order('name'),
    ]);
    if (clientsRes.error) console.error('[AuthContext] Failed to load clients:', clientsRes.error.message);
    if (unitsRes.error) console.error('[AuthContext] Failed to load units:', unitsRes.error.message);
    setClients((clientsRes.data ?? []).map(rowToClient));
    setUnits((unitsRes.data ?? []).map(rowToUnit));
  };

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

  // Módulos habilitados do tenant do usuário logado (company_clients.
  // enabled_modules — Gerenciador de Tenants). ATHOS_ADMIN não é filtrado
  // por isso (administra múltiplos tenants, cada um com módulos diferentes).
  // Só os 3 módulos configuráveis hoje (carts/boxes/assets) têm chave de
  // sidebar 1:1 conhecida — os demais itens (frotas/cargas/empilhadeiras/
  // bicicletas/agro/tags/dispositivos) continuam sem gating por módulo,
  // como já estavam, pra não mudar comportamento de tenants que nunca
  // configuraram isso.
  const TENANT_MODULE_TO_SIDEBAR_KEY: Record<string, string> = {
    carts: 'carrinhos',
    assets: 'ativos',
    boxes: 'caixas',
  };

  const tenantAllowsModuleKey = (moduleKey: string): boolean => {
    if (!user || user.role === 'ATHOS_ADMIN') return true;
    const tenant = clients.find((c) => c.id === user.clientId);
    if (!tenant || !tenant.enabledModules) return true; // sem config = não filtra (comportamento anterior)
    const gatedKeys = Object.entries(TENANT_MODULE_TO_SIDEBAR_KEY)
      .filter(([mod]) => !tenant.enabledModules!.includes(mod))
      .map(([, key]) => key);
    return !gatedKeys.includes(moduleKey);
  };

  const canAccessModule = (moduleKey: string): boolean => {
    if (!user) return false;
    if (!tenantAllowsModuleKey(moduleKey)) return false;
    if (user.role === 'ATHOS_ADMIN') return true;

    // RBAC Rules Matrix
    //
    // Achado desta rodada (UI-E2E-VALIDATION.md): todas as listas abaixo
    // usavam a chave 'map', mas a chave real do item de menu (Sidebar.tsx)
    // sempre foi 'mapa' — nenhum papel além de CLIENT_ADMIN/ATHOS_ADMIN
    // (que não passam por este switch) conseguia ver "Mapa ao Vivo" no
    // menu. Corrigido pra 'mapa'; também incluí 'historico' (Histórico —
    // outra página que existia mas não tinha entrada nenhuma de menu,
    // mesmo achado) nos mesmos papéis que já viam 'mapa', por serem a
    // mesma família de funcionalidade (posição atual vs. posição passada).
    //
    // Achado desta rodada (FINAL-END-TO-END-VALIDATION-REPORT.md): as 4
    // listas abaixo também citavam 'recuperacao_campo' — chave sem NENHUM
    // item de menu, NENHUM `case` em App.tsx e NENHUM componente ligado
    // (só um `FieldRecoveryContext.tsx` órfão, nunca montado na árvore de
    // providers). Era um link morto: clicar em "Central de Recuperação de
    // Campo" no menu caía no `default` do switch de App.tsx e mostrava o
    // Dashboard silenciosamente. Removido o item de menu (Sidebar.tsx) e a
    // referência aqui; `FieldRecoveryContext.tsx` deixado como está
    // (código morto, mas sem risco — não apagado por poder representar
    // trabalho planejado, ver pendências do relatório).
    switch (user.role) {
      case 'CLIENT_ADMIN':
        return true; // accesses all modules for their client
      case 'FLEET_MANAGER':
        return ['dashboard', 'mapa', 'historico', 'frotas', 'cargas', 'alertas', 'relatorios'].includes(moduleKey);
      case 'CART_MANAGER':
        return ['dashboard', 'mapa', 'historico', 'carrinhos', 'tags', 'alertas', 'relatorios'].includes(moduleKey);
      case 'ASSET_MANAGER':
        return ['dashboard', 'mapa', 'historico', 'ativos', 'empilhadeiras', 'tags', 'alertas', 'relatorios'].includes(moduleKey);
      case 'OPERATOR':
        return ['dashboard', 'mapa', 'historico', 'carrinhos', 'ativos', 'frotas', 'empilhadeiras', 'alertas'].includes(moduleKey);
      case 'VIEWER':
        return ['dashboard', 'mapa', 'historico', 'relatorios'].includes(moduleKey);
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
        refreshClients: loadClientsAndUnits,
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
