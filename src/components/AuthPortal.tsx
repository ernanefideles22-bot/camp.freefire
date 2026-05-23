import React, { useState } from 'react';
import { apiService } from '../services/api';
import type { Jogador } from '../services/api';
import { Gamepad2, User, Lock, ChevronRight, LogIn, AlertCircle } from 'lucide-react';

interface AuthPortalProps {
  onAuthSuccess: (user: Jogador) => void;
  addToast: (title: string, desc?: string, type?: 'success' | 'error' | 'warning' | 'info') => void;
}

export const AuthPortal: React.FC<AuthPortalProps> = ({ onAuthSuccess, addToast }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [nome, setNome] = useState('');
  const [nick, setNick] = useState('');
  const [senha, setSenha] = useState('');
  const [confirmSenha, setConfirmSenha] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!nick.trim() || !senha.trim()) {
      setError('Por favor, preencha todos os campos obrigatórios.');
      return;
    }

    if (!isLogin && !nome.trim()) {
      setError('Por favor, preencha seu nome completo.');
      return;
    }

    if (!isLogin && senha !== confirmSenha) {
      setError('As senhas não coincidem.');
      return;
    }

    setLoading(true);
    try {
      if (isLogin) {
        const user = await apiService.loginJogador(nick.trim(), senha);
        addToast('Sucesso!', `Bem-vindo de volta, ${user.nome}!`, 'success');
        // Save to localStorage
        localStorage.setItem('currentUser', JSON.stringify(user));
        onAuthSuccess(user);
      } else {
        const user = await apiService.cadastrarJogador(nome.trim(), nick.trim(), senha);
        addToast('Conta Criada!', `Jogador ${user.nick} cadastrado com sucesso!`, 'success');
        // Auto-login after register
        localStorage.setItem('currentUser', JSON.stringify(user));
        onAuthSuccess(user);
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Ocorreu um erro ao processar sua solicitação.');
      addToast('Erro no portal', err.message || 'Verifique seus dados e tente novamente.', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center py-12 px-4 relative overflow-hidden" style={{ minHeight: 'calc(100vh - 12rem)' }}>
      {/* Background Neon Elements */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-primary/10 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-accent-cyan/10 blur-[120px] pointer-events-none" />

      <div className="w-full max-w-md bg-panel-bg rounded-2xl border border-zinc-800/80 p-8 shadow-2xl relative z-10 overflow-hidden">
        {/* Neon top line */}
        <div className={`absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r ${isLogin ? 'from-primary to-accent-cyan' : 'from-accent-cyan to-accent-orange'}`} />

        <div className="text-center mb-8 mt-2">
          <div className="inline-flex items-center justify-center p-3 rounded-2xl bg-zinc-900 border border-zinc-800 text-primary glow-purple mb-4 animate-neon">
            <Gamepad2 className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-white">
            Solo Championship
          </h2>
          <p className="text-sm text-zinc-400 mt-1">
            {isLogin ? 'Acesse sua conta para entrar nas salas' : 'Crie sua conta para começar a jogar'}
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 flex items-start gap-3 text-sm">
            <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {!isLogin && (
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Nome Completo</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-zinc-500">
                  <User className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  required
                  placeholder="Seu nome"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-800 text-white pl-10 pr-4 py-3 rounded-xl focus:border-primary focus:shadow-[0_0_15px_rgba(139,92,246,0.15)] focus:outline-none transition-all duration-200"
                />
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Nickname do Jogo</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-zinc-500">
                <Gamepad2 className="w-4 h-4" />
              </div>
              <input
                type="text"
                required
                placeholder="Ex: Nobru_apelão"
                value={nick}
                onChange={(e) => setNick(e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-800 text-white pl-10 pr-4 py-3 rounded-xl focus:border-accent-cyan focus:shadow-[0_0_15px_rgba(0,240,255,0.15)] focus:outline-none transition-all duration-200"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Senha</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-zinc-500">
                <Lock className="w-4 h-4" />
              </div>
              <input
                type="password"
                required
                placeholder="••••••••"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-800 text-white pl-10 pr-4 py-3 rounded-xl focus:border-primary focus:shadow-[0_0_15px_rgba(139,92,246,0.15)] focus:outline-none transition-all duration-200"
              />
            </div>
          </div>

          {!isLogin && (
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Confirmar Senha</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-zinc-500">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={confirmSenha}
                  onChange={(e) => setConfirmSenha(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-800 text-white pl-10 pr-4 py-3 rounded-xl focus:border-primary focus:shadow-[0_0_15px_rgba(139,92,246,0.15)] focus:outline-none transition-all duration-200"
                />
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className={`w-full flex items-center justify-center gap-2 py-3.5 px-4 rounded-xl text-white font-bold transition-all duration-300 select-none ${
              loading
                ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
                : isLogin
                ? 'bg-primary hover:bg-primary-dark shadow-[0_4px_20px_rgba(139,92,246,0.25)] hover:shadow-[0_4px_25px_rgba(139,92,246,0.4)]'
                : 'bg-accent-cyan text-zinc-950 hover:bg-cyan-400 shadow-[0_4px_20px_rgba(0,240,255,0.25)] hover:shadow-[0_4px_25px_rgba(0,240,255,0.4)]'
            }`}
          >
            {loading ? (
              <span>Processando...</span>
            ) : (
              <>
                <span>{isLogin ? 'Entrar' : 'Cadastrar'}</span>
                {isLogin ? <LogIn className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              </>
            )}
          </button>
        </form>

        <div className="mt-8 text-center">
          <button
            onClick={() => {
              setIsLogin(!isLogin);
              setError('');
            }}
            className="text-sm font-semibold text-zinc-400 hover:text-white transition-colors"
          >
            {isLogin ? 'Não tem uma conta? Cadastre-se' : 'Já tem uma conta? Faça Login'}
          </button>
        </div>
      </div>
    </div>
  );
};
