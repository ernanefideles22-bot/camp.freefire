import { useEffect, useState } from 'react';
import { Trophy, User, Sliders, Shield, Award, LogOut, Swords, House, Crown, Megaphone } from 'lucide-react';
import { Leaderboard } from './components/Leaderboard';
import { PlayerPortal } from './components/PlayerPortal';
import { AdminPanel } from './components/AdminPanel';
import { AuthPortal } from './components/AuthPortal';
import { Campeonatos } from './components/Campeonatos';
import { Inicio } from './components/Inicio';
import { GuildaFlowFire } from './components/GuildaFlowFire';
import { Criadores } from './components/Criadores';
import { ToastContainer } from './components/Toast';
import type { ToastMessage, ToastType } from './components/Toast';
import type { Jogador } from './services/api';

type TabType = 'home' | 'leaderboard' | 'player_portal' | 'admin' | 'campeonatos' | 'guilda' | 'criadores';

const abaDoLink = (usuario: Jogador | null): TabType => {
  if (window.location.hash.startsWith('#criador/')) return 'criadores';
  if (window.location.hash.startsWith('#campeonatos/')) return 'campeonatos';
  return usuario ? (usuario.is_admin ? 'admin' : 'player_portal') : 'home';
};

function App() {
  const [currentUser, setCurrentUser] = useState<Jogador | null>(() => {
    const userJson = localStorage.getItem('currentUser');
    const token = localStorage.getItem('access_token');
    if (userJson && token) { try { return JSON.parse(userJson); } catch { return null; } }
    return null;
  });
  const [activeTab, setActiveTab] = useState<TabType>(() => abaDoLink(currentUser));
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  useEffect(() => {
    const abrirLink = () => setActiveTab(abaDoLink(currentUser));
    window.addEventListener('hashchange', abrirLink);
    return () => window.removeEventListener('hashchange', abrirLink);
  }, [currentUser]);

  const handleAddToast = (type: ToastType, title: string, description?: string) => {
    setToasts(prev => [...prev, { id: Date.now().toString() + Math.random().toString(36).slice(2), type, title, description }]);
  };
  const handleLogout = () => {
    localStorage.removeItem('currentUser'); localStorage.removeItem('access_token');
    setCurrentUser(null); setActiveTab('home');
    handleAddToast('info', 'Sessao encerrada', 'Voce saiu da sua conta.');
  };
  const tabClasses = (tab: TabType) => `ff-nav-item cursor-pointer ${activeTab === tab ? 'is-active' : ''}`;

  const portal = currentUser ? <PlayerPortal onAddToast={handleAddToast} currentUser={currentUser} onUpdateUser={setCurrentUser} /> : <AuthPortal onAuthSuccess={user => { setCurrentUser(user); setActiveTab(user.is_admin ? 'admin' : 'player_portal'); }} onAddToast={handleAddToast} />;

  return <div className="ff-shell min-h-screen bg-body-bg text-zinc-100 flex flex-col selection:bg-primary selection:text-white relative overflow-x-hidden">
    <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-primary/5 blur-[120px] pointer-events-none" />
    <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-accent-cyan/5 blur-[120px] pointer-events-none" />
    <div className="ff-statusbar relative z-40"><div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between text-[9px] font-bold uppercase tracking-[.16em] text-zinc-500"><span>FlowFire // Arena competitiva</span><span className="text-emerald-400 flex items-center gap-1"><i className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />Servidores online</span></div></div>
    <header className="border-b border-zinc-800/80 bg-[#0d1015]/90 backdrop-blur-xl sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 min-h-[82px] flex items-center gap-5">
        <button onClick={() => setActiveTab('home')} className="flex items-center gap-2.5 shrink-0 cursor-pointer text-left" title="Ir para o início">
          <img src="/flowfire-logo.png" alt="Flow Fire Champions" className="ff-brand-mark" />
          <span className="hidden xl:block"><strong className="block text-sm leading-none tracking-tight text-white">FLOWFIRE</strong><small className="block mt-1 text-[9px] font-black tracking-[.18em] text-primary">CHAMPIONS</small></span>
        </button>
        <nav className="hidden md:flex items-center self-stretch gap-1 flex-1">
          <button onClick={() => setActiveTab('home')} className={tabClasses('home')}><House className="w-4 h-4" />Início</button>
          <button onClick={() => setActiveTab('leaderboard')} className={tabClasses('leaderboard')}><Trophy className="w-4 h-4" />Leaderboard</button>
          <button onClick={() => setActiveTab('campeonatos')} className={tabClasses('campeonatos')}><Swords className="w-4 h-4" />Campeonatos</button>
          <button onClick={() => setActiveTab('guilda')} className={tabClasses('guilda')}><Crown className="w-4 h-4" />Guilda</button>
          <button onClick={() => setActiveTab('criadores')} className={tabClasses('criadores')}><Megaphone className="w-4 h-4" />Criadores</button>
          <button onClick={() => setActiveTab('player_portal')} className={tabClasses('player_portal')}><User className="w-4 h-4" />Portal do Jogador</button>
          {currentUser?.is_admin && <button onClick={() => setActiveTab('admin')} className={tabClasses('admin')}><Sliders className="w-4 h-4" />Painel Admin</button>}
        </nav>
        <div className="flex items-center gap-3 ml-auto">
          {currentUser ? <div className="flex items-center gap-3"><div className="text-right hidden sm:block"><p className="text-sm font-bold text-white leading-tight">{currentUser.nome}</p><p className="text-[10px] text-primary font-black uppercase tracking-wider">{currentUser.nick} {currentUser.is_admin ? '• Admin' : ''}</p></div><button onClick={handleLogout} title="Sair da Conta" className="flex items-center justify-center p-2 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 hover:text-rose-300 hover:bg-rose-500/20 transition-all cursor-pointer"><LogOut className="w-4 h-4" /></button></div> : <div className="flex items-center gap-2 text-[10px] font-black tracking-wider text-zinc-400 bg-zinc-950/50 border border-zinc-800 px-3 py-2 rounded-lg"><Shield className="w-3.5 h-3.5 text-accent-cyan" /><span className="hidden sm:inline">FREE FIRE</span></div>}
        </div>
      </div>
    </header>
    <div className="md:hidden fixed bottom-4 left-4 right-4 z-40 bg-[#12161d]/95 border border-zinc-700 rounded-xl p-1.5 flex justify-around shadow-2xl backdrop-blur-md">
      <button onClick={() => setActiveTab('home')} className={`flex flex-col items-center gap-1 py-2 px-3 rounded-xl flex-1 transition-all ${activeTab === 'home' ? 'text-primary font-black' : 'text-zinc-500 font-medium'}`}><House className="w-5 h-5" /><span className="text-[10px]">Início</span></button>
      <button onClick={() => setActiveTab('leaderboard')} className={`flex flex-col items-center gap-1 py-2 px-3 rounded-xl flex-1 transition-all ${activeTab === 'leaderboard' ? 'text-primary font-black' : 'text-zinc-500 font-medium'}`}><Trophy className="w-5 h-5" /><span className="text-[10px]">Ranking</span></button>
      <button onClick={() => setActiveTab('campeonatos')} className={`flex flex-col items-center gap-1 py-2 px-3 rounded-xl flex-1 transition-all ${activeTab === 'campeonatos' ? 'text-primary font-black' : 'text-zinc-500 font-medium'}`}><Swords className="w-5 h-5" /><span className="text-[10px]">Campeonatos</span></button>
      <button onClick={() => setActiveTab('player_portal')} className={`flex flex-col items-center gap-1 py-2 px-3 rounded-xl flex-1 transition-all ${activeTab === 'player_portal' ? 'text-primary font-black' : 'text-zinc-500 font-medium'}`}><User className="w-5 h-5" /><span className="text-[10px]">Portal</span></button>
      <button onClick={() => setActiveTab('criadores')} className={`flex flex-col items-center gap-1 py-2 px-3 rounded-xl flex-1 transition-all ${activeTab === 'criadores' ? 'text-primary font-black' : 'text-zinc-500 font-medium'}`}><Megaphone className="w-5 h-5" /><span className="text-[10px]">Criar</span></button>
      {currentUser?.is_admin && <button onClick={() => setActiveTab('admin')} className={`flex flex-col items-center gap-1 py-2 px-3 rounded-xl flex-1 transition-all ${activeTab === 'admin' ? 'text-primary font-black' : 'text-zinc-500 font-medium'}`}><Sliders className="w-5 h-5" /><span className="text-[10px]">Admin</span></button>}
    </div>
    <main className="flex-grow max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-7 pb-28 md:pb-9"><div className="ff-page-frame animate-in fade-in slide-in-from-bottom-3 duration-300">
      {activeTab === 'home' && <Inicio onAbrirCampeonatos={() => setActiveTab('campeonatos')} onAbrirRanking={() => setActiveTab('leaderboard')} onAbrirGuilda={() => setActiveTab('guilda')} onAbrirCriadores={() => setActiveTab('criadores')} />}
      {activeTab === 'leaderboard' && <Leaderboard onAddToast={handleAddToast} />}
      {activeTab === 'campeonatos' && <Campeonatos currentUser={currentUser} onAddToast={handleAddToast} />}
      {activeTab === 'guilda' && <GuildaFlowFire />}
      {activeTab === 'criadores' && <Criadores currentUser={currentUser} onAddToast={handleAddToast} />}
      {activeTab === 'player_portal' && portal}
      {activeTab === 'admin' && (currentUser?.is_admin ? <AdminPanel onAddToast={handleAddToast} currentUser={currentUser} /> : portal)}
    </div></main>
    <footer className="border-t border-zinc-800 bg-[#090b0f]/70 py-6 text-center text-xs text-zinc-600 hidden md:block"><div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row justify-between items-center gap-2"><p>2026 FlowFire Champions. Todos os direitos reservados.</p><p className="flex items-center gap-1.5"><Award className="w-3.5 h-3.5 text-primary" /> Jogue. Suba no ranking. Domine a arena.</p></div></footer>
    <ToastContainer messages={toasts} onClose={id => setToasts(prev => prev.filter(t => t.id !== id))} />
  </div>;
}

export default App;
