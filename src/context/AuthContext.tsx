import React, { createContext, useContext, useState, useEffect } from 'react';
import { UserProfile, UserRole, ThemeMode, CompanyClient, CompanyUnit } from '../types';
import { MOCK_USERS, MOCK_CLIENTS, MOCK_UNITS } from '../mock';

interface AuthContextType {
  isAuthenticated: boolean;
  user: UserProfile | null;
  theme: ThemeMode;
  selectedClientId: string; // 'all' or client ID
  selectedUnitId: string; // 'all' or unit ID
  availableClients: CompanyClient[];
  availableUnits: CompanyUnit[];
  toggleTheme: () => void;
  setTheme: (theme: ThemeMode) => void;
  login: (email: string, pass: string) => boolean;
  logout: () => void;
  setRole: (role: UserRole) => void;
  setSelectedClientId: (id: string) => void;
  setSelectedUnitId: (id: string) => void;
  canAccessModule: (moduleKey: string) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(true); // Default logged in for demo
  const [user, setUser] = useState<UserProfile | null>(MOCK_USERS[0]);
  const [theme, setThemeState] = useState<ThemeMode>(() => {
    const saved = localStorage.getItem('athos_theme_mode');
    return (saved === 'light' || saved === 'dark') ? saved : 'dark';
  });
  const [selectedClientId, setSelectedClientId] = useState<string>('all');
  const [selectedUnitId, setSelectedUnitId] = useState<string>('all');

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

  const login = (email: string, pass: string) => {
    if (email === 'demo@athostrack.com' && pass === 'demo') {
      setIsAuthenticated(true);
      setUser(MOCK_USERS[0]);
      return true;
    }
    // Allow any non-empty standard login for demo testing
    if (email.trim().length > 0 && pass.trim().length > 0) {
      setIsAuthenticated(true);
      setUser({
        id: 'usr_custom',
        name: email.split('@')[0].toUpperCase(),
        email: email,
        role: 'ATHOS_ADMIN',
      });
      return true;
    }
    return false;
  };

  const logout = () => {
    setIsAuthenticated(false);
    setUser(null);
  };

  const setRole = (role: UserRole) => {
    if (user) {
      setUser({ ...user, role });
    }
  };

  const availableClients = MOCK_CLIENTS;
  const availableUnits =
    selectedClientId === 'all'
      ? MOCK_UNITS
      : MOCK_UNITS.filter((u) => u.clientId === selectedClientId);

  const canAccessModule = (moduleKey: string): boolean => {
    if (!user) return false;
    if (user.role === 'ATHOS_ADMIN') return true;

    // RBAC Rules Matrix
    switch (user.role) {
      case 'CLIENT_ADMIN':
        return true; // accesses all modules for their client
      case 'FLEET_MANAGER':
        return ['dashboard', 'map', 'frotas', 'cargas', 'alertas', 'relatorios'].includes(moduleKey);
      case 'CART_MANAGER':
        return ['dashboard', 'map', 'carrinhos', 'tags', 'alertas', 'relatorios'].includes(moduleKey);
      case 'ASSET_MANAGER':
        return ['dashboard', 'map', 'ativos', 'empilhadeiras', 'tags', 'alertas', 'relatorios'].includes(moduleKey);
      case 'OPERATOR':
        return ['dashboard', 'map', 'carrinhos', 'ativos', 'frotas', 'empilhadeiras', 'alertas'].includes(moduleKey);
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
