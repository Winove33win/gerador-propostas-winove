
import React, { useState, useEffect } from 'react';
import { 
  LayoutDashboard, 
  Users, 
  Building2, 
  Briefcase, 
  PlusCircle, 
  Settings, 
  FileText, 
  Layers, 
  FileSignature, 
  BookOpen, 
  Info,
  ChevronRight,
  TrendingUp,
  Files,
  Hexagon,
  LogOut
} from 'lucide-react';
import DashboardView from './views/DashboardView';
import EntityListView from './views/EntityListView';
import ProposalWizard from './views/ProposalWizard';
import DocumentationView from './views/DocumentationView';
import LoginView from './views/LoginView';
import { api } from './api';
import { User } from './types';

type ViewType = 'dashboard' | 'companies' | 'clients' | 'services' | 'optionals' | 'terms' | 'proposals' | 'new-proposal' | 'doc';

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [currentView, setCurrentView] = useState<ViewType>('dashboard');
  const [editId, setEditId] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);

  useEffect(() => {
    const user = api.auth.getCurrentUser();
    if (user) {
      setCurrentUser(user);
    }
    setIsInitializing(false);
  }, []);

  const handleLogout = () => {
    api.auth.logout();
    setCurrentUser(null);
  };

  const navigateTo = (view: ViewType, id: string | null = null) => {
    setCurrentView(view);
    setEditId(id);
  };

  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'proposals', label: 'Propostas', icon: Files },
    { id: 'companies', label: 'Empresas', icon: Building2 },
    { id: 'clients', label: 'Clientes', icon: Users },
    { id: 'services', label: 'Serviços', icon: Briefcase },
    { id: 'optionals', label: 'Opcionais', icon: Layers },
    { id: 'terms', label: 'Termos', icon: FileSignature },
    { id: 'doc', label: 'Documentação API', icon: Info },
  ];

  if (isInitializing) return null;

  if (!currentUser) {
    return <LoginView onLoginSuccess={(user) => setCurrentUser(user)} />;
  }

  return (
    <div className="flex min-h-screen bg-slate-50 text-slate-900 animate-in fade-in duration-700">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-slate-200 hidden md:flex flex-col sticky top-0 h-screen">
        <div className="p-6 border-b border-slate-100 flex items-center gap-3">
          <div className="relative">
            <Hexagon size={32} className="text-blue-600 fill-blue-50" />
            <div className="absolute inset-0 flex items-center justify-center text-[10px] font-black text-blue-700">W</div>
          </div>
          <div>
            <h1 className="text-lg font-black leading-tight tracking-tighter text-slate-800">WINOVE</h1>
            <p className="text-[8px] font-bold text-blue-500 uppercase tracking-[0.2em]">O seu mundo</p>
          </div>
        </div>
        
        <nav className="flex-1 p-4 space-y-1">
          {menuItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => navigateTo(item.id as ViewType)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${
                  currentView === item.id 
                    ? 'bg-blue-50 text-blue-700 shadow-sm' 
                    : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'
                }`}
              >
                <Icon size={20} />
                {item.label}
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-100 space-y-2">
          <button 
            onClick={() => navigateTo('new-proposal')}
            className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl font-semibold shadow-md shadow-blue-100 transition-all"
          >
            <PlusCircle size={20} />
            Nova Proposta
          </button>
          
          <button 
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 text-rose-500 hover:bg-rose-50 py-3 rounded-xl font-semibold transition-all"
          >
            <LogOut size={18} />
            Sair do Painel
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0">
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-8 sticky top-0 z-10">
          <div className="flex items-center gap-2 text-slate-500 text-sm">
            <span>Sistema Winove</span>
            <ChevronRight size={14} />
            <span className="text-slate-900 font-medium capitalize">{currentView.replace('-', ' ')}</span>
          </div>
          <div className="flex items-center gap-4">
             <div className="flex flex-col items-end">
                <span className="text-sm font-semibold text-slate-900">{currentUser.name}</span>
                <span className="text-[10px] text-blue-500 font-black uppercase tracking-widest">{currentUser.role}</span>
             </div>
             <div className="w-10 h-10 rounded-full bg-blue-600 border border-blue-100 flex items-center justify-center text-white font-bold shadow-lg shadow-blue-100 uppercase">
               {currentUser.name.charAt(0)}
             </div>
          </div>
        </header>

        <div className="p-8 max-w-7xl mx-auto w-full">
          {currentView === 'dashboard' && <DashboardView navigateTo={navigateTo} />}
          {currentView === 'companies' && <EntityListView entity="company" onEdit={(id) => navigateTo('new-proposal', id)} />}
          {currentView === 'clients' && <EntityListView entity="client" onEdit={(id) => navigateTo('new-proposal', id)} />}
          {currentView === 'services' && <EntityListView entity="service" onEdit={(id) => navigateTo('new-proposal', id)} />}
          {currentView === 'optionals' && <EntityListView entity="optional" onEdit={(id) => navigateTo('new-proposal', id)} />}
          {currentView === 'terms' && <EntityListView entity="term" onEdit={(id) => navigateTo('new-proposal', id)} />}
          {currentView === 'proposals' && <EntityListView entity="proposal" onEdit={(id) => navigateTo('new-proposal', id)} />}
          {currentView === 'new-proposal' && <ProposalWizard id={editId} onComplete={() => navigateTo('proposals')} onCancel={() => navigateTo('proposals')} />}
          {currentView === 'doc' && <DocumentationView />}
        </div>
      </main>
    </div>
  );
};

export default App;
