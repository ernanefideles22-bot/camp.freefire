import React, { useState, useEffect, useCallback } from 'react';
import { Gift, Trophy, Users, Check, Copy, RefreshCw, Crown, Lock } from 'lucide-react';
import { apiService } from '../services/api';
import type { Jogador, EventoBonus, PlacarBonusItem, MinhaInscricaoBonus, HistoricoBonusItem } from '../services/api';
import { Spinner } from './Spinner';

interface QuedaBonusProps {
  currentUser: Jogador | null;
  onAddToast: (type: 'success' | 'error' | 'warning' | 'info', title: string, desc?: string) => void;
  tipo?: 'bonus' | 'pago';
}

const brl = (v: number) => `R$ ${v.toFixed(2).replace('.', ',')}`;

function deviceHash(): string {
  try {
    const s = [navigator.userAgent, navigator.language, `${screen.width}x${screen.height}`, String(new Date().getTimezoneOffset())].join('|');
    let h = 0;
    for (let i = 0; i < s.length; i++) { h = (h * 31 + s.charCodeAt(i)) | 0; }
    return 'd' + (h >>> 0).toString(16);
  } catch { return 'd0'; }
}

const statusLabel: Record<string, string> = {
  inscricao: 'Inscrições abertas',
  em_andamento: 'Em andamento',
  aguardando_revisao: 'Apurando prêmios',
  pago: 'Encerrado',
  cancelado: 'Cancelado',
};

export const QuedaBonus: React.FC<QuedaBonusProps> = ({ currentUser, onAddToast, tipo = 'bonus' }) => {
  const [evento, setEvento] = useState<EventoBonus | null>(null);
  const [placar, setPlacar] = useState<PlacarBonusItem[]>([]);
  const [minha, setMinha] = useState<MinhaInscricaoBonus | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [busy, setBusy] = useState<boolean>(false);
  const [copied, setCopied] = useState<string>('');
  const [historico, setHistorico] = useState<HistoricoBonusItem[]>([]);
  const [rankingAberto, setRankingAberto] = useState<number | null>(null);
  const [rankings, setRankings] = useState<Record<number, PlacarBonusItem[]>>({});
  const pago = tipo === 'pago';

  const fetchAll = useCallback(async () => {
    try {
      const ev = pago ? await apiService.obterPagoAtual() : await apiService.obterBonusAtual();
      setEvento(ev);
      if (ev) {
        const plc = await (pago ? apiService.obterPlacarPago(ev.id) : apiService.obterPlacarBonus(ev.id)).catch(() => null);
        if (plc) setPlacar(plc.jogadores);
        if (currentUser) {
          const mi = await (pago ? apiService.obterMinhaInscricaoPaga(ev.id) : apiService.obterMinhaInscricaoBonus(ev.id)).catch(() => null);
          setMinha(mi);
        } else { setMinha(null); }
      } else { setPlacar([]); setMinha(null); }
    } catch { /* silencioso */ }
    finally { setLoading(false); }
  }, [currentUser]);

  useEffect(() => {
    fetchAll();
    const t = setInterval(fetchAll, 15000);
    return () => clearInterval(t);
  }, [fetchAll]);

  useEffect(() => {
    if (pago) setHistorico([]); else apiService.obterHistoricoBonus().then(setHistorico).catch(() => {});
  }, []);

  const handleParticipar = async () => {
    if (!currentUser) { onAddToast('warning', 'Faça login', 'Entre na sua conta para participar do evento bônus.'); return; }
    if (!evento) return;
    setBusy(true);
    try {
      const r = await (pago ? apiService.inscreverPago(evento.id) : apiService.inscreverBonus(evento.id, deviceHash()));
      onAddToast('success', 'Você está dentro!', r?.message || 'Inscrição confirmada. Boa sorte!');
      await fetchAll();
    } catch (e: any) { onAddToast('error', 'Não foi possível entrar', e.message || 'Falha ao inscrever.'); }
    finally { setBusy(false); }
  };

  const copy = (text: string, label: string) => {
    navigator.clipboard?.writeText(text).then(() => {
      setCopied(label); setTimeout(() => setCopied(''), 1500);
      onAddToast('info', 'Copiado', label);
    }).catch(() => {});
  };

  const verRanking = async (id: number) => {
    if (rankingAberto === id) { setRankingAberto(null); return; }
    setRankingAberto(id);
    if (!rankings[id]) {
      try { const p = await (pago ? apiService.obterPlacarPago(id) : apiService.obterPlacarBonus(id)); setRankings(r => ({ ...r, [id]: p.jogadores })); }
      catch { /* silencioso */ }
    }
  };

  const historicoSection = historico.length === 0 ? null : (
    <div className="max-w-3xl mx-auto p-4 rounded-2xl border border-zinc-800 bg-zinc-950/40 space-y-3">
      <span className="text-xs font-bold uppercase tracking-wider text-zinc-500 flex items-center gap-1.5"><Trophy className="w-4 h-4 text-zinc-400" />Histórico de eventos bônus</span>
      <div className="space-y-3">
        {historico.map(ev => (
          <div key={ev.id} className="p-3 rounded-xl border border-zinc-800 bg-zinc-950/60 space-y-2">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <span className="text-sm font-bold text-white">{ev.nome} <span className="text-zinc-600">#{ev.id}</span></span>
              <div className="flex items-center gap-2">
                {ev.data_hora && <span className="text-[10px] text-zinc-500">{ev.data_hora}</span>}
                <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${ev.status === 'pago' ? 'text-emerald-400 bg-emerald-500/10' : 'text-zinc-400 bg-zinc-800'}`}>{ev.status === 'pago' ? 'pago' : 'cancelado'}</span>
              </div>
            </div>
            {ev.vencedores.length === 0 ? (
              <p className="text-[11px] text-zinc-500">Sem vencedores (cancelado ou sem elegíveis).</p>
            ) : (
              <div className="space-y-1">
                {ev.vencedores.map(v => (
                  <div key={v.colocacao} className="flex items-center gap-2 text-xs">
                    <span className={`w-7 text-center font-black ${v.colocacao === 1 ? 'text-amber-400' : 'text-zinc-500'}`}>{v.colocacao}º</span>
                    <span className="flex-1 min-w-0 truncate text-white font-bold">{v.nick ?? '—'}</span>
                    <span className="text-emerald-400 font-bold">{brl(v.valor)}</span>
                    {v.status === 'rejeitado' && <span className="text-[9px] text-rose-400">rejeitado</span>}
                  </div>
                ))}
              </div>
            )}
            <span className="text-[10px] text-zinc-600">{ev.inscritos} inscritos · total {brl(ev.premio_total)}</span>
            <button onClick={() => verRanking(ev.id)} className="text-[10px] font-bold text-primary hover:underline cursor-pointer">{rankingAberto === ev.id ? 'Ocultar ranking' : 'Ver ranking completo'}</button>
            {rankingAberto === ev.id && (
              <div className="mt-1 space-y-0.5 border-t border-zinc-800 pt-2 max-h-64 overflow-y-auto pr-1">
                {!rankings[ev.id] ? (
                  <span className="text-[10px] text-zinc-500">Carregando...</span>
                ) : rankings[ev.id].length === 0 ? (
                  <span className="text-[10px] text-zinc-500">Sem participantes.</span>
                ) : rankings[ev.id].map(l => (
                  <div key={l.jogador_id} className="flex items-center gap-2 text-[11px]">
                    <span className="w-6 text-center text-zinc-500 font-bold">{l.posicao}</span>
                    <span className="flex-1 min-w-0 truncate text-zinc-200">{l.nick}</span>
                    <span className="text-zinc-400">{l.pontos} pts</span>
                    <span className="text-zinc-600 w-10 text-right">{l.kills}k</span>
                    {l.elegivel ? <span className="text-[8px] font-bold text-emerald-400">3/3</span> : <span className="text-[8px] font-bold text-amber-400">{l.quedas_jogadas}/3</span>}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );

  if (loading) return (<div className="flex justify-center py-16"><Spinner size="md" className="text-primary" /></div>);

  if (!evento) {
    return (
      <div className="space-y-5">
        <div className="max-w-2xl mx-auto p-8 rounded-2xl border border-dashed border-zinc-800 bg-zinc-950/30 text-center space-y-2">
          <Gift className="w-10 h-10 text-zinc-700 mx-auto" />
          <h2 className="text-sm font-bold text-white">Nenhuma Queda Bônus no momento</h2>
          <p className="text-xs text-zinc-500">Fique de olho: eventos bônus têm entrada grátis e prêmio garantido ao top 5.</p>
        </div>
        {historicoSection}
      </div>
    );
  }

  const premio = evento.premio_top5 ?? [50, 20, 15, 10, 5];
  const inscrito = !!minha?.inscrito;
  const podeParticipar = evento.status === 'inscricao' && !inscrito;

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      {/* Header / prêmio */}
      <div className="p-5 rounded-2xl border border-primary/20 bg-gradient-to-b from-primary/10 to-transparent space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-black text-white flex items-center gap-2"><Gift className="w-5 h-5 text-primary" />{evento.nome}</h2>
            <span className="text-[11px] font-bold uppercase tracking-wider text-primary">{statusLabel[evento.status] || evento.status}</span>
            {evento.data_hora && <span className="text-[11px] text-zinc-400 ml-2">· {evento.data_hora}</span>}
          </div>
          <button onClick={fetchAll} className="p-2 text-zinc-500 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors cursor-pointer" title="Atualizar"><RefreshCw className="w-4 h-4" /></button>
        </div>
        <div className="flex items-center gap-3 text-xs text-zinc-300">
          <span className="px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-bold">Entrada grátis</span>
          <span className="px-2.5 py-1 rounded-lg bg-zinc-950 border border-zinc-800 font-bold">{brl(evento.premio_total)} garantidos • melhor de 3</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {premio.map((v, i) => (
            <span key={i} className="text-[11px] font-bold px-2.5 py-1 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-300 flex items-center gap-1">
              {i === 0 && <Crown className="w-3 h-3 text-amber-400" />}{i + 1}º <b className="text-emerald-400">{brl(v)}</b>
            </span>
          ))}
        </div>
        <div className="flex items-center gap-2 text-xs text-zinc-400">
          <Users className="w-4 h-4 text-primary" />
          <b className="text-white">{evento.inscritos}</b> inscritos
          {evento.status === 'inscricao' && <span className="text-zinc-500">• precisa de {evento.min_jogadores} para começar</span>}
        </div>
        <p className="text-[11px] text-zinc-500">Elegível ao prêmio quem jogar as <b className="text-zinc-300">3 quedas</b>. Prêmios passam por revisão antes de virar sacável.</p>

        {/* Ação de participar */}
        {podeParticipar && (
          <button disabled={busy} onClick={handleParticipar} className="w-full py-3 rounded-xl bg-primary text-white font-black text-sm hover:opacity-90 transition-all cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2">
            {busy ? <Spinner size="sm" /> : <Gift className="w-4 h-4" />}Participar grátis
          </button>
        )}
        {inscrito && (
          <div className="w-full py-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-bold text-sm text-center flex items-center justify-center gap-2"><Check className="w-4 h-4" />Você está participando</div>
        )}
        {evento.status === 'inscricao' && !currentUser && (
          <p className="text-[11px] text-amber-400 text-center">Faça login para participar.</p>
        )}
      </div>

      {/* Salas (só p/ inscrito) */}
      {inscrito && (minha?.salas?.length ?? 0) > 0 && (
        <div className="p-4 rounded-2xl border border-zinc-800 bg-zinc-950/40 space-y-3">
          <span className="text-xs font-bold uppercase tracking-wider text-zinc-500">Suas salas</span>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {minha!.salas.map(sala => (
              <div key={sala.ordem} className="p-3 rounded-xl border border-zinc-800 bg-zinc-950/60 space-y-2">
                <span className="text-[10px] font-bold uppercase text-primary">Queda {sala.ordem}{sala.horario ? ` • ${sala.horario}` : ''}</span>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-black text-white font-mono truncate">{sala.sala_id}</span>
                  <button onClick={() => copy(sala.sala_id, `ID queda ${sala.ordem}`)} className="p-1.5 text-zinc-400 hover:text-white rounded-lg cursor-pointer">{copied === `ID queda ${sala.ordem}` ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}</button>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-black text-white font-mono truncate">{sala.senha}</span>
                  <button onClick={() => copy(sala.senha, `Senha queda ${sala.ordem}`)} className="p-1.5 text-zinc-400 hover:text-white rounded-lg cursor-pointer">{copied === `Senha queda ${sala.ordem}` ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Placar ao vivo */}
      <div className="p-4 rounded-2xl border border-zinc-800 bg-zinc-950/40 space-y-2">
        <span className="text-xs font-bold uppercase tracking-wider text-zinc-500 flex items-center gap-1.5"><Trophy className="w-4 h-4 text-amber-400" />Placar ao vivo (soma das 3 quedas)</span>
        {placar.length === 0 ? (
          <div className="text-xs text-zinc-500 py-6 text-center">O placar aparece quando as quedas começarem.</div>
        ) : (
          <div className="max-h-96 overflow-y-auto pr-1 space-y-1">
            {placar.map(l => {
              const isMe = !!currentUser && l.jogador_id === currentUser.id;
              const top5 = l.elegivel && l.posicao <= 5;
              return (
                <div key={l.jogador_id} className={`flex items-center gap-3 p-2.5 rounded-lg border ${isMe ? 'border-primary/50 bg-primary/10' : top5 ? 'border-emerald-500/20 bg-emerald-500/5' : 'border-zinc-800 bg-zinc-950/40'} ${!l.elegivel ? 'opacity-70' : ''}`}>
                  <span className={`text-sm font-black w-7 text-center ${top5 ? 'text-emerald-400' : 'text-zinc-500'}`}>{l.posicao}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-bold text-white truncate">{l.nick}{isMe && <span className="text-[10px] text-primary ml-1">(você)</span>}</div>
                  </div>
                  <span className="text-xs text-zinc-300"><b className="text-white">{l.pontos}</b> pts</span>
                  <span className="text-[11px] text-zinc-500 w-12 text-right">{l.kills}k</span>
                  {l.elegivel
                    ? <span className="text-[9px] font-bold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded flex items-center gap-0.5"><Check className="w-2.5 h-2.5" />3/3</span>
                    : <span className="text-[9px] font-bold text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded">{l.quedas_jogadas}/3</span>}
                </div>
              );
            })}
          </div>
        )}
        <p className="text-[10px] text-zinc-600 flex items-center gap-1"><Lock className="w-3 h-3" />Só quem joga as 3 quedas concorre ao prêmio.</p>
      </div>
      {historicoSection}
    </div>
  );
};
