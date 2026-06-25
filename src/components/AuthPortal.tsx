import React, { useState, useEffect, useRef } from 'react';
import { apiService } from '../services/api';
import type { Jogador } from '../services/api';
import { Gamepad2, User, Lock, ChevronRight, LogIn, AlertCircle } from 'lucide-react';
import Termos from './Termos';

interface AuthPortalProps {
  onAuthSuccess: (user: Jogador) => void;
  onAddToast: (type: 'success' | 'error' | 'warning' | 'info', title: string, desc?: string) => void;
}

const GOOGLE_CLIENT_ID = (import.meta as any).env?.VITE_GOOGLE_CLIENT_ID as string | undefined;

export const AuthPortal: React.FC<AuthPortalProps> = ({ onAuthSuccess, onAddToast }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [nome, setNome] = useState('');
  const [nick, setNick] = useState('');
  const [senha, setSenha] = useState('');
  const [confirmSenha, setConfirmSenha] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [aceito, setAceito] = useState(false);
  const [maior, setMaior] = useState(false);
  const [dataNascimento, setDataNascimento] = useState('');
  const [termosOpen, setTermosOpen] = useState(false);

  // Fluxo Google: quando a conta e nova, o backend pede o nick do Free Fire.
  const [pendingGoogleToken, setPendingGoogleToken] = useState<string | null>(null);
  const [googleNick, setGoogleNick] = useState('');
  const googleBtnRef = useRef<HTMLDivElement>(null);

  const handleGoogle = async (idToken: string, ffNick?: string, ac = false, mi = false, dn = '') => {
    setLoading(true); setError('');
    try {
      const data = await apiService.loginGoogle(idToken, ffNick, ac, mi, dn);
      if (data.precisa_nick) {
        setPendingGoogleToken(idToken);
        onAddToast('info', 'Quase la', 'Escolha seu nick do Free Fire para concluir o cadastro.');
      } else if (data.jogador) {
        onAddToast('success', 'Bem-vindo!', `Ola, ${data.jogador.nome}!`);
        onAuthSuccess(data.jogador);
      }
    } catch (err: any) {
      const msg = err.message || 'Falha ao entrar com o Google.';
      setError(msg); onAddToast('error', 'Erro no login Google', msg);
    } finally { setLoading(false); }
  };

  // Carrega o Google Identity Services e renderiza o botao oficial.
  useEffect(() => {
    if (!GOOGLE_CLIENT_ID || pendingGoogleToken) return;
    const init = () => {
      const g = (window as any).google;
      if (!g?.accounts?.id || !googleBtnRef.current) return;
      g.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: (resp: any) => handleGoogle(resp.credential),
      });
      g.accounts.id.renderButton(googleBtnRef.current, {
        theme: 'filled_black', size: 'large', shape: 'pill', text: 'continue_with', width: 320,
      });
    };
    if ((window as any).google?.accounts?.id) { init(); return; }
    const SID = 'gsi-client';
    let s = document.getElementById(SID) as HTMLScriptElement | null;
    if (!s) {
      s = document.createElement('script');
      s.src = 'https://accounts.google.com/gsi/client';
      s.async = true; s.defer = true; s.id = SID;
      document.body.appendChild(s);
    }
    s.addEventListener('load', init);
    return () => s?.removeEventListener('load', init);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingGoogleToken, isLogin]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!nick.trim() || !senha.trim()) {
      setError('Por favor, preencha todos os campos obrigatorios.');
      return;
    }
    if (!isLogin && !nome.trim()) {
      setError('Por favor, preencha seu nome completo.');
      return;
    }
    if (!isLogin && senha !== confirmSenha) {
      setError('As senhas nao coincidem.');
      return;
    }
    if (!isLogin && (!aceito || !maior)) {
      setError('Voce precisa aceitar os Termos e confirmar que tem 18 anos ou mais.');
      return;
    }
    setLoading(true);
    try {
      if (isLogin) {
        const user = await apiService.loginJogador(nick.trim(), senha);
        onAddToast('success', 'Bem-vindo!', `Bem-vindo de volta, ${user.nome}!`);
        onAuthSuccess(user);
      } else {
        const user = await apiService.cadastrarJogador(nome.trim(), nick.trim(), senha, aceito, maior, dataNascimento);
        localStorage.setItem('currentUser', JSON.stringify(user));
        onAddToast('success', 'Conta Criada!', `Jogador ${user.nick} cadastrado com sucesso!`);
        onAuthSuccess(user);
      }
    } catch (err: any) {
      const msg = err.message || 'Ocorreu um erro ao processar sua solicitacao.';
      setError(msg);
      onAddToast('error', 'Erro no portal', msg);
    } finally {
      setLoading(false);
    }
  };

  const handleConcluirGoogle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pendingGoogleToken) return;
    if (!googleNick.trim()) { setError('Informe seu nick do Free Fire.'); return; }
    if (!aceito || !maior) { setError('Voce precisa aceitar os Termos e confirmar que tem 18 anos ou mais.'); return; }
    await handleGoogle(pendingGoogleToken, googleNick.trim(), aceito, maior, dataNascimento);
  };

  const aceiteBlock = (
    <div className="space-y-2 pt-1">
      <label className="flex items-start gap-2 text-xs text-zinc-300 cursor-pointer">
        <input type="checkbox" checked={aceito} onChange={e => setAceito(e.target.checked)} className="mt-0.5 accent-primary w-4 h-4" />
        <span>Li e aceito os <button type="button" onClick={() => setTermosOpen(true)} className="text-accent-cyan underline hover:text-cyan-300">Termos de Uso e Politica de Privacidade</button>.</span>
      </label>
      <label className="flex items-start gap-2 text-xs text-zinc-300 cursor-pointer">
        <input type="checkbox" checked={maior} onChange={e => setMaior(e.target.checked)} className="mt-0.5 accent-primary w-4 h-4" />
        <span>Confirmo que tenho <strong>18 anos ou mais</strong>.</span>
      </label>
    </div>
  );

  return (
    <div className="flex items-center justify-center py-12 px-4 relative overflow-hidden" style={{ minHeight: 'calc(100vh - 12rem)' }}>
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-primary/10 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-accent-cyan/10 blur-[120px] pointer-events-none" />
      <Termos open={termosOpen} onClose={() => setTermosOpen(false)} />

      <div className="w-full max-w-md ff-card p-8 relative z-10 overflow-hidden">
        <div className={`absolute top-0 left-0 right-0 h-1 ff-topbar ${isLogin ? '' : 'opacity-90'}`} />

        <div className="text-center mb-8 mt-2">
          <div className="inline-flex items-center justify-center mb-4 animate-float">
            <img src="/flowfire-logo.png" alt="Flow Fire Champions" className="w-20 h-20 object-contain drop-shadow-[0_0_18px_rgba(139,92,246,0.45)]" />
          </div>
          <h2 className="text-2xl font-black tracking-tight text-gradient-neon">Flow Fire Champions</h2>
          <p className="text-sm text-zinc-400 mt-1">
            {pendingGoogleToken ? 'Escolha seu nick para concluir' : isLogin ? 'Acesse sua conta para entrar nas salas' : 'Crie sua conta para comecar a jogar'}
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 flex items-start gap-3 text-sm">
            <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {pendingGoogleToken ? (
          <form onSubmit={handleConcluirGoogle} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Nickname do Jogo</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-zinc-500">
                  <Gamepad2 className="w-4 h-4" />
                </div>
                <input style={{ fontSize: '16px' }} type="text" required placeholder="Ex: Nobru" value={googleNick}
                  onChange={(e) => setGoogleNick(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-800 text-white pl-10 pr-4 py-3 rounded-xl focus:border-accent-cyan focus:outline-none transition-all" />
              </div>
            </div>
            <div className="space-y-1.5">
                  <label className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Data de Nascimento</label>
                  <input style={{ fontSize: '16px' }} type="date" required value={dataNascimento} onChange={(e) => setDataNascimento(e.target.value)} className="w-full bg-zinc-900 border border-zinc-800 text-white px-4 py-3 rounded-xl focus:border-accent-cyan focus:outline-none transition-all" />
                </div>
                {aceiteBlock}
            <button type="submit" disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-3.5 px-4 rounded-xl text-zinc-950 font-bold bg-accent-cyan hover:bg-cyan-400 transition-all disabled:opacity-60">
              {loading ? 'Concluindo...' : 'Concluir cadastro'}<ChevronRight className="w-4 h-4" />
            </button>
            <button type="button" onClick={() => { setPendingGoogleToken(null); setGoogleNick(''); }}
              className="w-full text-sm font-semibold text-zinc-400 hover:text-white transition-colors">
              Cancelar
            </button>
          </form>
        ) : (
        <>
        <form onSubmit={handleSubmit} className="space-y-4">
          {!isLogin && (
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Nome Completo</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-zinc-500">
                  <User className="w-4 h-4" />
                </div>
                <input style={{ fontSize: '16px' }} type="text" required placeholder="Seu nome" value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-800 text-white pl-10 pr-4 py-3 rounded-xl focus:border-primary focus:outline-none transition-all" />
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Nickname do Jogo</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-zinc-500">
                <Gamepad2 className="w-4 h-4" />
              </div>
              <input style={{ fontSize: '16px' }} type="text" required placeholder="Ex: Nobru" value={nick}
                onChange={(e) => setNick(e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-800 text-white pl-10 pr-4 py-3 rounded-xl focus:border-accent-cyan focus:outline-none transition-all" />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Senha</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-zinc-500">
                <Lock className="w-4 h-4" />
              </div>
              <input style={{ fontSize: '16px' }} type="password" required placeholder="********" value={senha}
                onChange={(e) => setSenha(e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-800 text-white pl-10 pr-4 py-3 rounded-xl focus:border-primary focus:outline-none transition-all" />
            </div>
          </div>

          {!isLogin && (
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Confirmar Senha</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-zinc-500">
                  <Lock className="w-4 h-4" />
                </div>
                <input style={{ fontSize: '16px' }} type="password" required placeholder="********" value={confirmSenha}
                  onChange={(e) => setConfirmSenha(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-800 text-white pl-10 pr-4 py-3 rounded-xl focus:border-primary focus:outline-none transition-all" />
              </div>
            </div>
          )}

          {!isLogin && (
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Data de Nascimento</label>
                    <input style={{ fontSize: '16px' }} type="date" required value={dataNascimento} onChange={(e) => setDataNascimento(e.target.value)} className="w-full bg-zinc-900 border border-zinc-800 text-white px-4 py-3 rounded-xl focus:border-primary focus:outline-none transition-all" />
                  </div>
                )}
                {!isLogin && aceiteBlock}
          <button style={{ minHeight: '44px', touchAction: 'manipulation' }} type="submit" disabled={loading}
            className={`w-full flex items-center justify-center gap-2 py-3.5 px-4 rounded-xl text-white font-bold transition-all duration-300 select-none ${ loading ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed' : isLogin ? 'bg-primary hover:bg-primary-dark shadow-[0_4px_20px_rgba(139,92,246,0.25)]' : 'bg-accent-cyan text-zinc-950 hover:bg-cyan-400 shadow-[0_4px_20px_rgba(0,240,255,0.25)]'}`}>
            {loading ? <span>Processando...</span> : (<><span>{isLogin ? 'Entrar' : 'Cadastrar'}</span>{isLogin ? <LogIn className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}</>)}
          </button>
        </form>

        {GOOGLE_CLIENT_ID && (
          <div className="mt-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex-1 h-px bg-zinc-800" />
              <span className="text-[10px] uppercase tracking-wider text-zinc-500 font-bold">ou</span>
              <div className="flex-1 h-px bg-zinc-800" />
            </div>
            <div ref={googleBtnRef} className="flex justify-center" />
          </div>
        )}

        <div className="mt-8 text-center">
          <button style={{ minHeight: '44px', touchAction: 'manipulation' }}
            onClick={() => { setIsLogin(!isLogin); setError(''); }}
            className="text-sm font-semibold text-zinc-400 hover:text-white transition-colors">
            {isLogin ? 'Nao tem uma conta? Cadastre-se' : 'Ja tem uma conta? Faca Login'}
          </button>
        </div>
        </>
        )}
      </div>
    </div>
  );
};
