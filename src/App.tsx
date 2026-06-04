import { useState } from 'react';
import { Trophy, User, Sliders, Shield, Award, LogOut } from 'lucide-react';
import { Leaderboard } from './components/Leaderboard';
import { PlayerPortal } from './components/PlayerPortal';
import { AdminPanel } from './components/AdminPanel';
import { AuthPortal } from './components/AuthPortal';
import { ToastContainer } from './components/Toast';
import type { ToastMessage, ToastType } from './components/Toast';
import type { Jogador } from './services/api';

type TabType = 'leaderboard' | 'player_portal' | 'admin';

function App() {
  const [currentUser, setCurrentUser] = useState<Jogador | null>(() => {
    const userJson = localStorage.getItem('currentUser');
    if (userJson) {
      try { return JSON.parse(userJson); } catch (e) { return null; }
    }
    return null;
  });

  const [activeTab, setActiveTab] = useState<TabType>(() => {
    if (currentUser) {
      return currentUser.is_admin ? 'admin' : 'player_portal';
    }
    return 'leaderboard';
  });
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const handleAddToast = (type: ToastType, title: string, description?: string) => {
    const id = Date.now().toString() + Math.random().toString(36).substr(2, 9);
    setToasts((prev) => [...prev, { id, type, title, description }]);
  };

  const handleRemoveToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const handleLogout = () => {
    localStorage.removeItem('currentUser');
    localStorage.removeItem('access_token');
    setCurrentUser(null);
    setActiveTab('leaderboard');
    handleAddToast('info', 'Sessao encerrada', 'Voce saiu da sua conta.');
  };

  const tabClasses = (tabName: TabType) => {
    const base = 'flex items-center gap-2 px-5 py-3 rounded-xl font-bold text-sm transition-all duration-200 cursor-pointer ';
    if (activeTab === tabName) {
      return base + 'bg-gradient-to-r from-primary to-primary-dark text-white shadow-[0_0_15px_rgba(139,92,246,0.3)]';
    }
    return base + 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/60';
  };

  return (
    <div className="min-h-screen bg-body-bg text-zinc-100 flex flex-col selection:bg-primary selection:text-white relative overflow-x-hidden">
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-primary/5 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-accent-cyan/5 blur-[120px] pointer-events-none" />

      {/* Header */}
      <header className="border-b border-zinc-900 bg-panel-bg/40 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-primary via-primary-dark to-accent-orange flex items-center justify-center text-white font-black text-xl shadow-[0_0_15px_rgba(139,92,246,0.4)] border border-primary/20">
              FF
            </div>
            <div>
              <h1 className="text-lg font-black tracking-wider text-white uppercase flex items-center gap-1.5 leading-none">
                CAMP. SOLO
                <span className="text-[10px] font-bold tracking-widest text-accent-orange bg-accent-orange/10 border border-accent-orange/20 px-1.5 py-0.5 rounded-md">
                  PRO
                </span>
              </h1>
              <span className="text-[10px] text-zinc-500 font-bold tracking-wider uppercase block mt-1">
                Free Fire Arena • Modo Partida
              </span>
            </div>
          </div>

          <nav className="hidden md:flex items-center gap-2">
            <button onClick={() => setActiveTab('leaderboard')} className={tabClasses('leaderboard')}>
              <Trophy className="w-4 h-4" />
              Leaderboard
            </button>
            <button onClick={() => setActiveTab('player_portal')} className={tabClasses('player_portal')}>
              <User className="w-4 h-4" />
              Portal do Jogador
            </button>
            <button onClick={() => setActiveTab('admin')} className={tabClasses('admin')}>
              <Sliders className="w-4 h-4" />
              Painel Admin
            </button>
          </nav>

          <div className="flex items-center gap-4">
            {currentUser ? (
              <div className="flex items-center gap-3.5">
                <div className="text-right hidden sm:block">
                  <p className="text-sm font-bold text-white leading-tight">{currentUser.nome}</p>
                  <p className="text-xs text-zinc-500 font-semibold">{currentUser.nick} {currentUser.is_admin ? '(Admin)' : ''}</p>
                </div>
                <button onClick={handleLogout} title="Sair da Conta"
                  className="flex items-center justify-center p-2 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 hover:text-rose-300 hover:bg-rose-500/20 transition-all cursor-pointer">
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-xs font-bold text-zinc-500 bg-zinc-950/50 border border-zinc-900 px-3.5 py-2 rounded-xl">
                <Shield className="w-3.5 h-3.5 text-accent-cyan" />
                <span>MODO SOLO</span>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Mobile Bottom Nav */}
      <div className="md:hidden fixed bottom-4 left-4 right-4 z-40 bg-panel-bg/95 border border-zinc-800 rounded-2xl p-1.5 flex justify-around shadow-2xl backdrop-blur-md">
        <button onClick={() => setActiveTab('leaderboard')}
          className={`flex flex-col items-center gap-1 py-2 px-3 rounded-xl flex-1 transition-all ${activeTab === 'leaderboard' ? 'text-primary font-black' : 'text-zinc-500 font-medium'}`}>
          <Trophy className="w-5 h-5" />
          <span className="text-[10px]">Leaderboard</span>
        </button>
        <button onClick={() => setActiveTab('player_portal')}
          className={`flex flex-col items-center gap-1 py-2 px-3 rounded-xl flex-1 transition-all ${activeTab === 'player_portal' ? 'text-primary font-black' : 'text-zinc-500 font-medium'}`}>
          <User className="w-5 h-5" />
          <span className="text-[10px]">Portal</span>
        </button>
        <button onClick={() => setActiveTab('admin')}
          className={`flex flex-col items-center gap-1 py-2 px-3 rounded-xl flex-1 transition-all ${activeTab === 'admin' ? 'text-primary font-black' : 'text-zinc-500 font-medium'}`}>
          <Sliders className="w-5 h-5" />
          <span className="text-[10px]">Admin</span>
        </button>
      </div>

      {/* Main Content */}
      <main className="flex-grow max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-28 md:pb-8">
        <div className="animate-in fade-in slide-in-from-bottom-3 duration-300">
          {activeTab === 'leaderboard' && (
            <Leaderboard onAddToast={handleAddToast} />
          )}

          {activeTab === 'player_portal' && (
            currentUser ? (
              <PlayerPortal
                onAddToast={handleAddToast}
                currentUser={currentUser}
                onUpdateUser={(updatedUser) => setCurrentUser(updatedUser)}
              />
            ) : (
              <AuthPortal
                onAuthSuccess={(user) => {
                  setCurrentUser(user);
                  setActiveTab(user.is_admin ? 'admin' : 'player_portal');
                  if (user.is_admin) {
                    handleAddToast('info', 'Painel de Administrador', 'Voce foi direcionado para o painel de administracao.');
                  }
                }}
                onAddToast={handleAddToast}
              />
            )
          )}

          {activeTab === 'admin' && (
            currentUser ? (
              currentUser.is_admin ? (
                <AdminPanel onAddToast={handleAddToast} currentUser={currentUser} />
              ) : (
                <div className="max-w-xl mx-auto mt-12 bg-panel-bg rounded-2xl border border-zinc-800 p-8 shadow-2xl text-center">
                  <div className="inline-flex p-4 bg-rose-500/10 rounded-2xl border border-rose-500/20 text-rose-400 mb-6">
                    <Shield className="w-10 h-10" />
                  </div>
                  <h2 className="text-xl font-bold text-white mb-2">Acesso Restrito</h2>
                  <p className="text-zinc-400 text-sm leading-relaxed mb-6">
                    Esta area e exclusiva para administradores do campeonato.
                  </p>
                  <button onClick={handleLogout}
                    className="px-6 py-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-sm font-bold text-zinc-300 hover:text-white transition-colors cursor-pointer">
                    Fazer Login com Outra Conta
                  </button>
                </div>
              )
            ) : (
              <AuthPortal
                onAuthSuccess={(user) => {
                  setCurrentUser(user);
                  setActiveTab(user.is_admin ? 'admin' : 'player_portal');
                  if (!user.is_admin) {
                    handleAddToast('warning', 'Redirecionado', 'Voce foi direcionado para o Portal do Jogador pois sua conta nao e administradora.');
                  }
                }}
                onAddToast={handleAddToast}
              />
            )
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-zinc-900 bg-zinc-950/20 py-6 text-center text-xs text-zinc-600 hidden md:block">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row justify-between items-center gap-2">
          <p>© 2026 Camp. Solo Free Fire. Todos os direitos reservados.</p>
          <p className="flex items-center gap-1.5">
            Desenvolvido com <Award className="w-3.5 h-3.5 text-primary" /> React, TS & Tailwind CSS
          </p>
        </div>
      </footer>

      <ToastContainer messages={toasts} onClose={handleRemoveToast} />
    </div>
  );
}

export default App;
