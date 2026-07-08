import React, { useState, useEffect, useCallback } from 'react';
import { Gift, Trophy, Users, Play, Check, X, RefreshCw, AlertTriangle, Plus, Trash2, Send, Ban } from 'lucide-react';
import { apiService } from '../services/api';
import type { EventoBonus, BonusInscrito, PlacarBonusItem, PagamentoBonus, BonusResultadoInput } from '../services/api';
import { Spinner } from './Spinner';

interface AdminBonusProps {
  onAddToast: (type: 'success' | 'error' | 'warning' | 'info', title: string, desc?: string) => void;
}
interface SalaForm { sala_id: string; senha: string; horario: string; }
interface LinhaBonus { tempId: string; jogadorId: string; colocacao: string; abates: string; }

const brl = (v: number) => `R$ ${v.toFixed(2).replace('.', ',')}`;

export const AdminBonus: React.FC<AdminBonusProps> = ({ onAddToast }) => {
  const [evento, setEvento] = useState<EventoBonus | null>(null);
  const [inscritos, setInscritos] = useState<BonusInscrito[]>([]);
  const [placar, setPlacar] = useState<PlacarBonusItem[]>([]);
  const [pagamentos, setPagamentos] = useState<PagamentoBonus[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [busy, setBusy] = useState<boolean>(false);
  const [nome, setNome] = useState<string>('Queda Bônus');
  const [ordemSel, setOrdemSel] = useState<number>(1);
  const [salaForms, setSalaForms] = useState<Record<number, SalaForm>>({
    1: { sala_id: '', senha: '', horario: '' },
    2: { sala_id: '', senha: '', horario: '' },
    3: { sala_id: '', senha: '', horario: '' },
  });
  const [linhas, setLinhas] = useState<LinhaBonus[]>([{ tempId: '1', jogadorId: '', colocacao: '', abates: '0' }]);

  const fetchAll = useCallback(async () => {
    try {
      const ev = await apiService.obterBonusAtual();
      setEvento(ev);
      if (ev) {
        const [ins, plc] = await Promise.all([
          apiService.listarInscritosBonus(ev.id).catch(() => null),
          apiService.obterPlacarBonus(ev.id).catch(() => null),
        ]);
        if (ins) setInscritos(ins.jogadores);
        if (plc) setPlacar(plc.jogadores);
        if (ev.status === 'aguardando_revisao' || ev.status === 'pago') {
          const pg = await apiService.listarPagamentosBonus(ev.id).catch(() => null);
          if (pg) setPagamentos(pg.pagamentos);
        } else { setPagamentos([]); }
      } else { setInscritos([]); setPlacar([]); setPagamentos([]); }
    } catch { /* silencioso */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    fetchAll();
    const t = setInterval(fetchAll, 15000);
    return () => clearInterval(t);
  }, [fetchAll]);

  const guard = async (fn: () => Promise<any>, okMsg?: string) => {
    setBusy(true);
    try { const r = await fn(); if (okMsg) onAddToast('success', okMsg, r?.message || ''); await fetchAll(); return r; }
    catch (e: any) { onAddToast('error', 'Erro', e.message || 'Falha na operação.'); }
    finally { setBusy(false); }
  };

  const setSala = (ordem: number, field: keyof SalaForm, value: string) =>
    setSalaForms(prev => ({ ...prev, [ordem]: { ...prev[ordem], [field]: value } }));
  const addLinha = () => setLinhas([...linhas, { tempId: String(Date.now()), jogadorId: '', colocacao: '', abates: '0' }]);
  const rmLinha = (id: string) => setLinhas(linhas.length > 1 ? linhas.filter(l => l.tempId !== id) : linhas);
  const updLinha = (id: string, f: keyof LinhaBonus, v: string) => setLinhas(linhas.map(l => l.tempId === id ? { ...l, [f]: v } : l));

  const handleLancar = () => {
    if (!evento) return;
    const resultados: BonusResultadoInput[] = [];
    for (const l of linhas) {
      const jid = parseInt(l.jogadorId), col = parseInt(l.colocacao), ab = parseInt(l.abates);
      if (isNaN(jid)) { onAddToast('warning', 'Jogador pendente', 'Selecione o jogador em todas as linhas.'); return; }
      if (isNaN(col) || col < 1) { onAddToast('warning', 'Colocação inválida', 'Informe a colocação em todas as linhas.'); return; }
      resultados.push({ jogador_id: jid, colocacao: col, abates: isNaN(ab) ? 0 : ab });
    }
    guard(async () => {
      const r = await apiService.lancarResultadoBonus(evento.id, ordemSel, resultados);
      setLinhas([{ tempId: '1', jogadorId: '', colocacao: '', abates: '0' }]);
      return r;
    }, `Resultado da queda ${ordemSel} salvo`);
  };

  if (loading) return (<div className="ff-card p-8 flex justify-center"><Spinner size="md" className="text-primary" /></div>);

  const premioTop5 = evento?.premio_top5 ?? [50, 20, 15, 10, 5];
  const podeIniciar = !!evento && evento.status === 'inscricao' && evento.inscritos >= evento.min_jogadores;

  // Cabeçalho da tabela de prêmios (reutilizado)
  const TabelaPremio = () => (
    <div className="flex flex-wrap gap-2">
      {premioTop5.map((v, i) => (
        <span key={i} className="text-[11px] font-bold px-2.5 py-1 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-300">
          {i + 1}º <b className="text-emerald-400">{brl(v)}</b>
        </span>
      ))}
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="ff-card p-5 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-bold text-white flex items-center gap-2"><Gift className="w-4 h-4 text-primary" />Queda Bônus — melhor de 3 (entrada grátis)</h2>
          <button onClick={fetchAll} className="p-1.5 text-zinc-500 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors cursor-pointer" title="Atualizar"><RefreshCw className="w-3.5 h-3.5" /></button>
        </div>
        <p className="text-xs text-zinc-400">Prêmio fixo da casa, R$ 100 garantidos ao top 5 (elegível quem joga as 3 quedas). Prêmio fica retido até você liberar.</p>
        <TabelaPremio />
      </div>

      {/* Sem evento -> criar */}
      {!evento && (
        <div className="ff-card p-5 space-y-3">
          <span className="text-xs font-bold uppercase tracking-wider text-zinc-500">Nenhum evento ativo</span>
          <div className="flex flex-col sm:flex-row gap-3">
            <input value={nome} onChange={e => setNome(e.target.value)} placeholder="Nome do evento" className="flex-1 px-4 py-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-white text-sm focus:border-primary focus:outline-none" />
            <button disabled={busy} onClick={() => guard(() => apiService.criarBonus(nome.trim() || 'Queda Bônus'), 'Evento criado')} className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-white font-bold text-sm hover:opacity-90 transition-all cursor-pointer disabled:opacity-50"><Plus className="w-4 h-4" />Criar evento bônus</button>
          </div>
        </div>
      )}

      {/* Evento existente */}
      {evento && (
        <div className="ff-card p-5 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-black text-white">{evento.nome} <span className="text-zinc-500">#{evento.id}</span></h3>
              <span className="text-[10px] font-bold uppercase tracking-wider text-primary">{evento.status.replace('_', ' ')}</span>
            </div>
            <div className="flex items-center gap-2 bg-zinc-950 border border-zinc-800 px-3 py-1.5 rounded-xl">
              <Users className="w-4 h-4 text-primary" />
              <span className="text-sm font-black text-white">{evento.inscritos}</span>
              <span className="text-[10px] text-zinc-500">/ mín. {evento.min_jogadores}</span>
            </div>
          </div>

          {/* INSCRIÇÃO */}
          {evento.status === 'inscricao' && (
            <div className="space-y-4">
              {evento.inscritos < evento.min_jogadores && (
                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-400 flex items-center gap-2"><AlertTriangle className="w-4 h-4" />Faltam {evento.min_jogadores - evento.inscritos} inscritos para poder iniciar.</div>
              )}
              <div className="flex gap-2">
                <button disabled={!podeIniciar || busy} onClick={() => guard(() => apiService.iniciarBonus(evento.id), 'Evento iniciado')} className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-500 text-zinc-950 font-bold text-sm hover:opacity-90 transition-all cursor-pointer disabled:opacity-40 disabled:pointer-events-none"><Play className="w-4 h-4" />Iniciar evento ({evento.inscritos}/{evento.min_jogadores})</button>
                <button disabled={busy} onClick={() => window.confirm('Cancelar este evento?') && guard(() => apiService.cancelarBonus(evento.id), 'Evento cancelado')} className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-zinc-800 text-zinc-400 hover:text-rose-400 hover:border-rose-500/40 text-sm font-bold transition-all cursor-pointer"><Ban className="w-4 h-4" />Cancelar</button>
              </div>
              <InscritosLista inscritos={inscritos} />
            </div>
          )}

          {/* EM ANDAMENTO */}
          {evento.status === 'em_andamento' && (
            <div className="space-y-6">
              {/* Salas das 3 quedas */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {[1, 2, 3].map(o => (
                  <div key={o} className="p-3 rounded-xl border border-zinc-800 bg-zinc-950/40 space-y-2">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">Sala da queda {o}</span>
                    <input value={salaForms[o].sala_id} onChange={e => setSala(o, 'sala_id', e.target.value)} placeholder="ID da sala" className="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-white text-sm focus:border-primary focus:outline-none" />
                    <input value={salaForms[o].senha} onChange={e => setSala(o, 'senha', e.target.value)} placeholder="Senha" className="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-white text-sm focus:border-primary focus:outline-none" />
                    <input value={salaForms[o].horario} onChange={e => setSala(o, 'horario', e.target.value)} placeholder="Horário (opcional)" className="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-white text-sm focus:border-primary focus:outline-none" />
                    <button disabled={busy} onClick={() => guard(() => apiService.definirSalaBonus(evento.id, o, salaForms[o].sala_id.trim(), salaForms[o].senha.trim(), salaForms[o].horario.trim() || undefined), `Sala da queda ${o} salva`)} className="w-full py-2 rounded-lg bg-zinc-800 text-white text-xs font-bold hover:bg-zinc-700 transition-all cursor-pointer disabled:opacity-50">Salvar sala {o}</button>
                  </div>
                ))}
              </div>

              {/* Lançar resultado de uma queda */}
              <div className="p-4 rounded-xl border border-dashed border-zinc-800 bg-zinc-950/20 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-zinc-400">Lançar resultado da queda</span>
                  <div className="flex gap-1">
                    {[1, 2, 3].map(o => (
                      <button key={o} onClick={() => setOrdemSel(o)} className={`w-8 h-8 rounded-lg text-xs font-black transition-all cursor-pointer ${ordemSel === o ? 'bg-primary text-white' : 'bg-zinc-950 border border-zinc-800 text-zinc-400'}`}>{o}</button>
                    ))}
                  </div>
                </div>
                <div className="space-y-2 max-h-[320px] overflow-y-auto pr-1">
                  {linhas.map((l, i) => (
                    <div key={l.tempId} className="flex items-center gap-2">
                      <span className="text-[10px] text-zinc-600 w-5 text-center">#{i + 1}</span>
                      <select value={l.jogadorId} onChange={e => updLinha(l.tempId, 'jogadorId', e.target.value)} className="flex-1 min-w-0 px-2 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-200 text-sm focus:border-primary focus:outline-none">
                        <option value="">-- jogador --</option>
                        {inscritos.map(j => (<option key={j.jogador_id} value={j.jogador_id}>{j.nick}</option>))}
                      </select>
                      <input type="number" min="1" max="48" placeholder="Col." value={l.colocacao} onChange={e => updLinha(l.tempId, 'colocacao', e.target.value)} className="w-16 px-2 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-200 text-sm focus:border-primary focus:outline-none" />
                      <input type="number" min="0" placeholder="Kills" value={l.abates} onChange={e => updLinha(l.tempId, 'abates', e.target.value)} className="w-16 px-2 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-200 text-sm focus:border-primary focus:outline-none" />
                      <button onClick={() => rmLinha(l.tempId)} className="p-2 text-zinc-600 hover:text-rose-400 rounded-lg cursor-pointer"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <button onClick={addLinha} className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-dashed border-zinc-700 text-zinc-300 hover:border-primary text-xs font-bold cursor-pointer"><Plus className="w-3.5 h-3.5" />Linha</button>
                  <button disabled={busy} onClick={handleLancar} className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg bg-primary text-white text-sm font-bold hover:opacity-90 transition-all cursor-pointer disabled:opacity-50"><Send className="w-4 h-4" />Salvar resultado da queda {ordemSel}</button>
                </div>
              </div>

              <PlacarTabela placar={placar} />

              <div className="flex gap-2">
                <button disabled={busy} onClick={() => window.confirm('Apurar o top 5 agora? Encerra o lançamento.') && guard(() => apiService.apurarBonus(evento.id), 'Apuração concluída')} className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-500 text-zinc-950 font-bold text-sm hover:opacity-90 transition-all cursor-pointer disabled:opacity-50"><Trophy className="w-4 h-4" />Apurar top 5</button>
                <button disabled={busy} onClick={() => window.confirm('Cancelar este evento?') && guard(() => apiService.cancelarBonus(evento.id), 'Evento cancelado')} className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-zinc-800 text-zinc-400 hover:text-rose-400 hover:border-rose-500/40 text-sm font-bold transition-all cursor-pointer"><Ban className="w-4 h-4" />Cancelar</button>
              </div>
            </div>
          )}

          {/* AGUARDANDO REVISÃO / PAGO */}
          {(evento.status === 'aguardando_revisao' || evento.status === 'pago') && (
            <div className="space-y-3">
              <span className="text-xs font-bold uppercase tracking-wider text-zinc-500">Prêmios do top 5 {evento.status === 'aguardando_revisao' ? '— revise e libere' : '(evento pago)'}</span>
              {pagamentos.length === 0 && (<div className="text-xs text-zinc-500 py-4 text-center">Nenhum prêmio (ninguém elegível).</div>)}
              {pagamentos.map(p => (
                <div key={p.id} className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl border border-zinc-800 bg-zinc-950/40">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-sm font-black text-white w-8">{p.colocacao}º</span>
                    <div className="min-w-0">
                      <div className="text-sm font-bold text-white truncate">{p.nick} <span className="text-emerald-400">{brl(p.valor)}</span></div>
                      <div className="text-[11px] text-zinc-500">{p.pontos} pts
                        {p.ip_compartilhado && <span className="ml-2 text-amber-400 font-bold">⚠ IP compartilhado</span>}
                        {p.device_compartilhado && <span className="ml-2 text-amber-400 font-bold">⚠ mesmo dispositivo</span>}
                      </div>
                    </div>
                  </div>
                  {p.status === 'pendente' ? (
                    <div className="flex items-center gap-1.5">
                      <button disabled={busy} onClick={() => window.confirm('Liberar este prêmio (vira sacável)?') && guard(() => apiService.liberarPagamentoBonus(p.id), 'Prêmio liberado')} className="p-2 rounded-lg bg-emerald-500/10 hover:bg-emerald-500 text-emerald-400 hover:text-zinc-950 border border-emerald-500/20 transition-all cursor-pointer" title="Liberar"><Check className="w-4 h-4" /></button>
                      <button disabled={busy} onClick={() => window.confirm('Rejeitar este prêmio (não paga)?') && guard(() => apiService.rejeitarPagamentoBonus(p.id), 'Prêmio rejeitado')} className="p-2 rounded-lg bg-rose-500/10 hover:bg-rose-500 text-rose-400 hover:text-zinc-950 border border-rose-500/20 transition-all cursor-pointer" title="Rejeitar"><X className="w-4 h-4" /></button>
                    </div>
                  ) : (
                    <span className={`text-[11px] font-bold px-2 py-1 rounded-lg ${p.status === 'liberado' ? 'text-emerald-400 bg-emerald-500/10' : 'text-rose-400 bg-rose-500/10'}`}>{p.status}</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const InscritosLista: React.FC<{ inscritos: BonusInscrito[] }> = ({ inscritos }) => (
  <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
    {inscritos.length === 0 ? (<div className="text-xs text-zinc-500 py-3 text-center">Nenhum inscrito ainda.</div>) :
      inscritos.map((j, i) => (
        <div key={j.jogador_id} className="flex items-center gap-3 p-2 rounded-lg bg-zinc-950/40 border border-zinc-800">
          <span className="text-[10px] text-zinc-600 w-5 text-center">#{i + 1}</span>
          <div className="flex-1 min-w-0"><div className="text-sm font-bold text-white truncate">{j.nick}</div></div>
          <span className="text-[10px] text-zinc-500">{j.entrou_em}</span>
        </div>
      ))}
  </div>
);

const PlacarTabela: React.FC<{ placar: PlacarBonusItem[] }> = ({ placar }) => (
  <div className="space-y-1.5">
    <span className="text-xs font-bold uppercase tracking-wider text-zinc-500">Placar ao vivo (soma das 3)</span>
    <div className="max-h-72 overflow-y-auto pr-1 space-y-1">
      {placar.length === 0 ? (<div className="text-xs text-zinc-500 py-3 text-center">Sem resultados ainda.</div>) :
        placar.map(l => (
          <div key={l.jogador_id} className={`flex items-center gap-3 p-2 rounded-lg border ${l.elegivel ? 'border-zinc-800 bg-zinc-950/40' : 'border-zinc-900 bg-zinc-950/20 opacity-70'}`}>
            <span className="text-xs font-black text-zinc-400 w-6 text-center">{l.posicao}</span>
            <div className="flex-1 min-w-0"><div className="text-sm font-bold text-white truncate">{l.nick}</div></div>
            <span className="text-xs text-zinc-300"><b className="text-white">{l.pontos}</b> pts</span>
            <span className="text-[11px] text-zinc-500 w-14 text-right">{l.kills} kills</span>
            {l.elegivel
              ? <span className="text-[9px] font-bold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">3/3</span>
              : <span className="text-[9px] font-bold text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded">{l.quedas_jogadas}/3</span>}
          </div>
        ))}
    </div>
  </div>
);
