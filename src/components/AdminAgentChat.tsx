import React, { useState, useRef, useEffect } from 'react';
import { Sparkles, Send, HelpCircle, Bot, User, Trash2 } from 'lucide-react';
import { apiService } from '../services/api';
import type { AgenteResposta } from '../services/api';
import { Spinner } from './Spinner';

interface Message {
  id: string;
  sender: 'user' | 'agent';
  text: string;
  timestamp: Date;
}

interface AdminAgentChatProps {
  onAddToast: (type: 'success' | 'error' | 'warning' | 'info', title: string, desc?: string) => void;
  onRefreshData?: () => void; // Callback to trigger data refresh on success
}

export const AdminAgentChat: React.FC<AdminAgentChatProps> = ({ onAddToast, onRefreshData }) => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      sender: 'agent',
      text: 'Olá! Sou o seu Agente de IA. Posso te ajudar a gerenciar o campeonato. Diga coisas como: "cadastre o jogador João nick Baiano", "libere a sala 54890 senha 999 para a queda 2" ou "lançar o resultado da queda 1: Baiano ficou em 3º lugar com 4 abates".',
      timestamp: new Date()
    }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [proposta, setProposta] = useState<AgenteResposta | null>(null);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);



  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userText = input.trim();
    setInput('');

    // Add user message
    const userMsg: Message = {
      id: Date.now().toString(),
      sender: 'user',
      text: userText,
      timestamp: new Date()
    };
    setMessages(prev => [...prev, userMsg]);
    setLoading(true);

    try {
      const response = await apiService.enviarComandoAgente(userText);

      let text = '';
      if (response.tipo === 'proposta') {
        text = `Proposta: ${response.resumo || response.acao}\n${response.aviso || ''}`.trim();
        setProposta(response);
      } else {
        text = response.resposta || 'Sem resposta.';
        setProposta(null);
      }
      const agentMsg: Message = {
        id: (Date.now() + 1).toString(),
        sender: 'agent',
        text,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, agentMsg]);
    } catch (err: any) {
      const errorMsg: Message = {
        id: (Date.now() + 1).toString(),
        sender: 'agent',
        text: `Erro ao executar comando: ${err.message || 'Erro interno na comunicação com o agente.'}`,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMsg]);
      onAddToast('error', 'Falha do Agente', err.message || 'Não foi possível processar seu comando.');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmarProposta = async () => {
    if (!proposta || !proposta.acao || loading) return;
    setLoading(true);
    try {
      const r = await apiService.executarAcaoAgente(proposta.acao, proposta.dados);
      setMessages(prev => [...prev, {
        id: Date.now().toString(), sender: 'agent',
        text: r.message || 'Acao executada com sucesso.', timestamp: new Date(),
      }]);
      onAddToast('success', 'Acao executada', r.message);
      setProposta(null);
      if (onRefreshData) onRefreshData();
    } catch (err: any) {
      setMessages(prev => [...prev, {
        id: Date.now().toString(), sender: 'agent',
        text: `Erro ao executar: ${err.message || 'falha na execucao.'}`, timestamp: new Date(),
      }]);
      onAddToast('error', 'Falha ao executar', err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCancelarProposta = () => {
    setProposta(null);
    setMessages(prev => [...prev, {
      id: Date.now().toString(), sender: 'agent',
      text: 'Proposta cancelada. Nada foi alterado.', timestamp: new Date(),
    }]);
  };

  const handleClearHistory = () => {
    setMessages([
      {
        id: 'welcome',
        sender: 'agent',
        text: 'Histórico limpo. Como posso te ajudar a administrar o campeonato agora?',
        timestamp: new Date()
      }
    ]);
  };

  const applyTemplate = (template: string) => {
    setInput(template);
  };

  return (
    <div className="p-6 ff-card flex flex-col h-[520px]">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-zinc-900">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-primary/10 border border-primary/20 text-primary glow-purple animate-neon">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white tracking-tight">Agente Administrador IA</h2>
            <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">Orquestração por Linguagem Natural</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button 
            type="button"
            onClick={() => setShowHelp(!showHelp)}
            className={`p-2 rounded-lg border transition-colors cursor-pointer ${showHelp ? 'bg-zinc-800 border-zinc-700 text-white' : 'border-zinc-900 text-zinc-500 hover:text-zinc-300'}`}
            title="Mostrar Exemplos"
          >
            <HelpCircle className="w-4.5 h-4.5" />
          </button>
          
          <button 
            type="button"
            onClick={handleClearHistory}
            className="p-2 rounded-lg border border-zinc-900 text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
            title="Limpar Histórico"
          >
            <Trash2 className="w-4.5 h-4.5" />
          </button>
        </div>
      </div>

      {/* Help Panel (Collapsible) */}
      {showHelp && (
        <div className="p-3 bg-zinc-950/80 border-b border-zinc-900 text-xs text-zinc-400 space-y-2 max-h-[160px] overflow-y-auto">
          <p className="font-bold text-zinc-300">💡 Sugestões de comandos para clicar e testar:</p>
          <div className="flex flex-wrap gap-1.5">
            <button 
              type="button"
              onClick={() => applyTemplate("Me dê a lista de todos os competidores cadastrados")}
              className="px-2 py-1 rounded bg-zinc-900 border border-zinc-800 text-[10px] hover:border-primary text-zinc-300 cursor-pointer"
            >
              👥 Listar Jogadores
            </button>
            <button 
              type="button"
              onClick={() => applyTemplate("Quem está liderando o campeonato atualmente?")}
              className="px-2 py-1 rounded bg-zinc-900 border border-zinc-800 text-[10px] hover:border-primary text-zinc-300 cursor-pointer"
            >
              🏆 Ver Leaderboard
            </button>
            <button 
              type="button"
              onClick={() => applyTemplate("cadastre os seguintes jogadores de uma vez: João Silva com nick Baiano, Pedro Henrique com nick Nobru, Bruno Silva com nick Nobru2")}
              className="px-2 py-1 rounded bg-zinc-900 border border-zinc-800 text-[10px] hover:border-primary text-zinc-300 cursor-pointer"
            >
              ➕ Cadastrar Lote
            </button>
            <button 
              type="button"
              onClick={() => applyTemplate("libere a sala 482930 senha 888 para a queda 1")}
              className="px-2 py-1 rounded bg-zinc-900 border border-zinc-800 text-[10px] hover:border-primary text-zinc-300 cursor-pointer"
            >
              🔑 Liberar Sala
            </button>
            <button 
              type="button"
              onClick={() => applyTemplate("Registrar resultados da Queda 1:\n1º Baiano com 8 abates\n2º Nobru com 3 abates\n3º Nobru2 com 0 abates")}
              className="px-2 py-1 rounded bg-zinc-900 border border-zinc-800 text-[10px] hover:border-primary text-zinc-300 cursor-pointer"
            >
              📊 Lançar Queda Lote
            </button>
          </div>
        </div>
      )}

      {/* Messages Window */}
      <div className="flex-grow overflow-y-auto p-4 space-y-4">
        {messages.map((m) => (
          <div 
            key={m.id} 
            className={`flex items-start gap-3 max-w-[85%] ${m.sender === 'user' ? 'ml-auto flex-row-reverse' : ''}`}
          >
            <div className={`p-2 rounded-xl flex items-center justify-center ${m.sender === 'user' ? 'bg-zinc-900 border border-zinc-800 text-zinc-300' : 'bg-primary/10 border border-primary/20 text-primary glow-purple'}`}>
              {m.sender === 'user' ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
            </div>
            
            <div className={`p-3.5 rounded-2xl text-sm leading-relaxed ${m.sender === 'user' ? 'bg-zinc-900 text-zinc-200 rounded-tr-none' : 'bg-zinc-950/60 border border-zinc-900 text-zinc-300 rounded-tl-none'}`}>
              {m.text}
              <span className="block text-[9px] text-zinc-600 mt-1 text-right font-mono">
                {m.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex items-start gap-3 max-w-[80%]">
            <div className="p-2 rounded-xl bg-primary/10 border border-primary/20 text-primary glow-purple animate-pulse">
              <Bot className="w-4 h-4 animate-neon" />
            </div>
            <div className="p-3.5 rounded-2xl bg-zinc-950/60 border border-zinc-900 text-zinc-500 text-sm rounded-tl-none flex items-center gap-2">
              <Spinner size="sm" />
              <span>O Agente está processando seu comando e atualizando o banco...</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Field */}
      <div className="pt-3 border-t border-zinc-900 space-y-2">

        {proposta && proposta.acao && (
          <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 space-y-2">
            <p className="text-xs text-amber-300 font-bold">Confirmar acao do agente: {proposta.acao}</p>
            <pre className="text-[10px] text-zinc-400 whitespace-pre-wrap break-words max-h-32 overflow-y-auto">{JSON.stringify(proposta.dados, null, 2)}</pre>
            <div className="flex gap-2">
              <button type="button" onClick={handleConfirmarProposta} disabled={loading}
                className="px-3 py-1.5 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-bold hover:bg-emerald-500 hover:text-zinc-950 cursor-pointer disabled:opacity-50">Confirmar e executar</button>
              <button type="button" onClick={handleCancelarProposta} disabled={loading}
                className="px-3 py-1.5 rounded-lg bg-rose-500/10 text-rose-300 border border-rose-500/30 text-xs font-bold hover:bg-rose-500 hover:text-zinc-950 cursor-pointer disabled:opacity-50">Cancelar</button>
            </div>
          </div>
        )}

        {/* Chat submit form */}
        <form onSubmit={handleSendMessage} className="flex gap-2">
          <input
            type="text"
            placeholder="Digite sua instrução (ex: cadastre o jogador João nick Baiano)..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={loading}
            className="flex-grow px-4 py-3 rounded-xl bg-zinc-950 border border-zinc-800 text-sm text-white placeholder-zinc-600 focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none transition-all disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="px-5 rounded-xl bg-primary hover:bg-primary-dark text-white font-bold flex items-center justify-center hover:shadow-[0_0_15px_rgba(139,92,246,0.35)] transition-all active:scale-95 disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
};
