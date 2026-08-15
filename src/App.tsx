import React, { useState } from 'react';
import { Routes, Route } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AssetProvider } from './context/AssetContext';
import { Header } from './components/layout/Header';
import { Sidebar } from './components/layout/Sidebar';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { LiveMapPage } from './pages/LiveMapPage';
import { CartsModule } from './pages/CartsModule';
import { AssetsModule } from './pages/AssetsModule';
import { FleetModule } from './pages/FleetModule';
import { CargoModule } from './pages/CargoModule';
import { ForkliftsModule } from './pages/ForkliftsModule';
import { BicyclesModule } from './pages/BicyclesModule';
import { TagsModule } from './pages/TagsModule';
import { AgroModule } from './pages/AgroModule';
import { AlertsPage } from './pages/AlertsPage';
import { HistoryPage } from './pages/HistoryPage';
import { ReportsPage } from './pages/ReportsPage';
import { GeofencesPage } from './pages/GeofencesPage';
import { WorkOrdersModule } from './pages/WorkOrdersModule';
import { AssetRecoveryModule } from './pages/AssetRecoveryModule';
import { ClientsPage } from './pages/admin/ClientsPage';
import { UnitsPage } from './pages/admin/UnitsPage';
import { UsersPage } from './pages/admin/UsersPage';
import { IntegrationsPage } from './pages/admin/IntegrationsPage';
import { SettingsPage } from './pages/admin/SettingsPage';
import { HomologationAdminPage } from './pages/admin/HomologationAdminPage';
import { HomologationPortalPage } from './pages/public/HomologationPortalPage';

const AuthenticatedShell: React.FC = () => {
  const [currentModule, setCurrentModule] = useState<string>('dashboard');

  const renderModuleContent = () => {
    switch (currentModule) {
      case 'dashboard':
        return <Dashboard onNavigate={(m) => setCurrentModule(m)} />;
      case 'mapa':
        return <LiveMapPage />;
      case 'carrinhos':
        return <CartsModule />;
      case 'ativos':
        return <AssetsModule />;
      case 'frotas':
        return <FleetModule />;
      case 'cargas':
        return <CargoModule />;
      case 'empilhadeiras':
        return <ForkliftsModule />;
      case 'bicicletas':
        return <BicyclesModule />;
      case 'dispositivos':
      case 'tags':
        return <TagsModule />;
      case 'agro':
        return <AgroModule />;
      case 'alertas':
        return <AlertsPage />;
      case 'historico':
        return <HistoryPage />;
      case 'relatorios':
        return <ReportsPage />;
      case 'cercas':
        return <GeofencesPage />;
      case 'ordens_servico':
        return <WorkOrdersModule />;
      case 'recuperacao_ativos':
        return <AssetRecoveryModule />;
      case 'clientes':
        return <ClientsPage />;
      case 'unidades':
        return <UnitsPage />;
      case 'usuarios':
      case 'permissoes':
        return <UsersPage />;
      case 'integracoes':
        return <IntegrationsPage />;
      case 'configuracoes':
        return <SettingsPage />;
      case 'homologacao_gt06':
        return <HomologationAdminPage />;
      default:
        return <Dashboard onNavigate={(m) => setCurrentModule(m)} />;
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col font-sans antialiased selection:bg-cyan-500 selection:text-white transition-colors duration-200">
      <Header onNavigate={(m) => setCurrentModule(m)} />
      <div className="flex-1 flex overflow-hidden">
        <Sidebar currentModule={currentModule} onSelectModule={(m) => setCurrentModule(m)} />
        <main className="flex-1 overflow-y-auto custom-scrollbar">
          {renderModuleContent()}
        </main>
      </div>
    </div>
  );
};

const AppGate: React.FC = () => {
  const { isAuthenticated, isAuthLoading } = useAuth();

  if (isAuthLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100 dark:bg-slate-950 text-slate-400 dark:text-slate-600 text-xs font-mono">
        Verificando sessão...
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Login />;
  }

  // AssetProvider só monta depois que a sessão real do Supabase Auth existe,
  // pra buscar os dados já com o JWT autenticado anexado (o RLS exige sessão
  // autenticada) e pra recarregar do zero a cada novo login.
  return (
    <AssetProvider>
      <AuthenticatedShell />
    </AssetProvider>
  );
};

export default function App() {
  return (
    <Routes>
      {/* Rota pública: sem AuthProvider/gate — fornecedores homologam sem login. */}
      <Route path="/homologacao/*" element={<HomologationPortalPage />} />
      <Route
        path="*"
        element={
          <AuthProvider>
            <AppGate />
          </AuthProvider>
        }
      />
    </Routes>
  );
}
