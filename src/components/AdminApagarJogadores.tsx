import React, { useState, useEffect, useCallback } from 'react';
import { Trash2, UserX, Search, RefreshCw } from 'lucide-react';
import { apiService } from '../services/api';
import type { Jogador } from '../services/api';
import { Spinner } from './Spinner';

interface AdminApagarJogadoresProps {
  onAddToast: (type: 'success' | 'error' | 'warning' | 'info', title: string, desc?: string) => void;
}

const brl = (v: number) => `R$ ${(v ?? 0).toFixed(2).replace('.', ',')}`;

export const AdminApagarJogadores: React.FC<AdminApagarJogadoresProps> = ({ onAddToast }) => {
  const [players, setPlayers] = useState<Jogador[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [busy, setBusy] = useState<number | null>(null);
  const [q, setQ] = useState<string>('');

  const carregar = useCallback(async () => {
    setLoading(true);
    try { setPlayers(await apiService.listarJogadores()); }
    catch { /* silencioso */ }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { carregar(); }, [carregar]);

  const apagar = async (p: Jogador) => {
    if (!window.confirm(`Apagar o jogador "${p.nick}" definitivamente? Remove a conta e todo o histórico dele. Não dá pra desfazer.`)) return;
    setBusy(p.id);
    try {
      await apiService.apagarJogador(p.id);
      onAddToast('success', 'Jogador apagado', `${p.nick} foi removido.`);
      setPlayers(prev => prev.filter(x => x.id !== p.id));
    } catch (e: any) {
      onAddToast('error', 'Não foi possível apagar', e.message || 'Falha ao apagar.');
    } finally { setBusy(null); }
  };

  const filtrados = players.filter(p =>
    (p.nick || '').toLowerCase().includes(q.toLowerCase()) ||
    (p.nome || '').toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="p-5 rounded-2xl border border-rose-500/20 bg-panel-bg/40 backdrop-blur-md shadow-xl space-y-4 md:col-span-2">
      <div className="space-y-1">
        <h2 className="text-lg font-bold text-white flex items-center gap-2"><UserX className="w-5 h-5 text-rose-500" />Apagar Jogadores</h2>
        <p className="text-xs text-zinc-400">Remove uma conta e todo o histórico dela. <b className="text-rose-400">Ação irreversível.</b> Bloqueado para admins e para quem tem saldo ou saque em andamento.</p>
      </div>
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar por nick ou nome" className="w-full pl-9 pr-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-white text-sm focus:border-primary focus:outline-none" />
        </div>
        <button onClick={carregar} className="p-2 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-400 hover:text-white cursor-pointer transition-colors" title="Atualizar"><RefreshCw className="w-4 h-4" /></button>
      </div>
      {loading ? (
        <div className="flex justify-center py-6"><Spinner size="md" className="text-rose-400" /></div>
      ) : (
        <div className="space-y-1.5 max-h-96 overflow-y-auto pr-1">
          {filtrados.length === 0 ? (
            <p className="text-xs text-zinc-500 text-center py-4">Nenhum jogador encontrado.</p>
          ) : filtrados.map(p => (
            <div key={p.id} className="flex items-center gap-3 p-2.5 rounded-lg bg-zinc-950/50 border border-zinc-800">
              <div className="flex-1 min-w-0">
                <div className="text-sm font-bold text-white truncate">{p.nick}{p.is_admin && <span className="text-[9px] text-amber-400 bg-amber-500/10 px-1 py-0.5 rounded ml-1">admin</span>}</div>
                <div className="text-[11px] text-zinc-500 truncate">{p.nome} · saldo {brl(p.saldo)}</div>
              </div>
              {p.is_admin ? (
                <span className="text-[10px] text-zinc-600 px-2">protegido</span>
              ) : (
                <button disabled={busy === p.id} onClick={() => apagar(p)} className="p-2 rounded-lg bg-rose-500/10 hover:bg-rose-500 text-rose-400 hover:text-white border border-rose-500/20 transition-all cursor-pointer disabled:opacity-50" title={`Apagar ${p.nick}`}>
                  {busy === p.id ? <Spinner size="sm" /> : <Trash2 className="w-4 h-4" />}
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
