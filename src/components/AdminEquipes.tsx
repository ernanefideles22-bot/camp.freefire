import { useCallback, useEffect, useState } from 'react';
import { Check, Play, Plus, Trophy, Users } from 'lucide-react';
import { apiService } from '../services/api';
import type { CampeonatoEquipe, EquipeCampeonato, PagamentoEquipe } from '../services/api';
import { Spinner } from './Spinner';

interface Props { onAddToast: (type: 'success' | 'error' | 'warning' | 'info', title: string, desc?: string) => void; }

export function AdminEquipes({ onAddToast }: Props) {
  const [eventos, setEventos] = useState<CampeonatoEquipe[]>([]);
  const [equipes, setEquipes] = useState<EquipeCampeonato[]>([]);
  const [pagamentos, setPagamentos] = useState<PagamentoEquipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [tipo, setTipo] = useState<'cs_4x4' | 'br'>('cs_4x4');
  const [modo, setModo] = useState<'solo' | 'duo' | 'squad'>('solo');
  const [nome, setNome] = useState('CS 4x4');
  const [dataHora, setDataHora] = useState('');
  const [minimo, setMinimo] = useState('2'); const [maximo, setMaximo] = useState('12'); const [taxa, setTaxa] = useState('10');
  const [premios, setPremios] = useState('50,30,20');
  const [resultados, setResultados] = useState<Record<number, { colocacao: string; abates: string }>>({});

  const carregar = useCallback(async () => {
    try {
      const lista = await apiService.obterCampeonatosEquipe(); setEventos(lista);
      const evento = lista[0];
      if (evento) {
        setEquipes(await apiService.listarEquipesInscritas(evento.id));
        if (evento.status === 'aguardando_revisao') setPagamentos(await apiService.listarPagamentosEquipe(evento.id)); else setPagamentos([]);
      } else { setEquipes([]); setPagamentos([]); }
    } catch { onAddToast('error', 'Erro ao carregar', 'Não foi possível buscar os campeonatos por equipe.'); }
    finally { setLoading(false); }
  }, [onAddToast]);
  useEffect(() => { carregar(); }, [carregar]);
  const evento = eventos[0];
  const executar = async (acao: () => Promise<any>, mensagem: string) => { setBusy(true); try { const r = await acao(); onAddToast('success', mensagem, r?.message); await carregar(); } catch (e: any) { onAddToast('error', 'Erro', e.message); } finally { setBusy(false); } };

  const criar = () => executar(() => apiService.criarCampeonatoEquipe({ nome, tipo, modo, data_hora: dataHora || undefined, min_equipes: Number(minimo), max_equipes: Number(maximo), taxa_inscricao: Number(taxa), premios: premios.split(',').map(v => Number(v.trim())).filter(v => !Number.isNaN(v)) }), 'Campeonato criado');
  const salvarResultado = () => {
    if (!evento) return;
    const itens = equipes.map(e => ({ equipe_id: e.id, colocacao: Number(resultados[e.id]?.colocacao), abates: Number(resultados[e.id]?.abates || 0) }));
    if (itens.some(i => !i.colocacao)) { onAddToast('warning', 'Resultado incompleto', 'Informe a colocação de cada equipe.'); return; }
    executar(() => apiService.lancarResultadoEquipe(evento.id, itens), 'Resultados salvos');
  };

  const campo = 'w-full rounded-lg bg-zinc-950 border border-zinc-800 px-3 py-2 text-sm text-white';
  if (loading) return <div className="py-8 flex justify-center"><Spinner size="md" /></div>;
  return <div className="space-y-5">
    {!evento && <section className="ff-card p-5 space-y-4"><h2 className="text-sm font-black text-white flex gap-2 items-center"><Plus className="w-4 h-4 text-primary" />Novo campeonato por equipe</h2><div className="grid grid-cols-1 sm:grid-cols-3 gap-3"><input value={nome} onChange={e => setNome(e.target.value)} className={campo} placeholder="Nome" /><select value={tipo} onChange={e => { const v = e.target.value as 'cs_4x4' | 'br'; setTipo(v); setNome(v === 'cs_4x4' ? 'CS 4x4' : 'BR'); }} className={campo}><option value="cs_4x4">CS 4x4</option><option value="br">BR</option></select>{tipo === 'br' && <select value={modo} onChange={e => setModo(e.target.value as any)} className={campo}><option value="solo">BR Solo</option><option value="duo">BR Duo</option><option value="squad">BR Squad</option></select>}<input value={dataHora} onChange={e => setDataHora(e.target.value)} className={campo} placeholder="Data e hora" /><input type="number" value={minimo} onChange={e => setMinimo(e.target.value)} className={campo} placeholder="Mínimo de equipes" /><input type="number" value={maximo} onChange={e => setMaximo(e.target.value)} className={campo} placeholder="Máximo de equipes" /><input type="number" step="0.01" value={taxa} onChange={e => setTaxa(e.target.value)} className={campo} placeholder="Taxa por equipe" /><input value={premios} onChange={e => setPremios(e.target.value)} className={campo} placeholder="Prêmios: 50,30,20" /></div><p className="text-[11px] text-zinc-500">Informe os prêmios por posição separados por vírgula. A inscrição é cobrada uma vez do capitão da equipe.</p><button disabled={busy} onClick={criar} className="w-full rounded-xl bg-primary py-3 text-sm font-bold text-white disabled:opacity-50 cursor-pointer">Criar campeonato</button></section>}
    {evento && <section className="ff-card p-5 space-y-5"><div className="flex flex-wrap justify-between gap-3"><div><h2 className="font-black text-white">{evento.nome}</h2><p className="text-xs text-primary font-bold uppercase">{evento.tipo === 'cs_4x4' ? 'CS 4x4' : `BR ${evento.modo}`} · {evento.tamanho_equipe} por equipe</p></div><span className="text-xs text-zinc-400">{equipes.length}/{evento.max_equipes} equipes</span></div>{evento.status === 'inscricao' && <button disabled={busy || equipes.length < evento.min_equipes} onClick={() => executar(() => apiService.iniciarCampeonatoEquipe(evento.id), 'Campeonato iniciado')} className="rounded-xl bg-emerald-500 px-5 py-2.5 text-sm font-bold text-zinc-950 disabled:opacity-40 cursor-pointer flex items-center gap-2"><Play className="w-4 h-4" />Iniciar ({equipes.length}/{evento.min_equipes})</button>}
      <div className="space-y-2"><h3 className="text-xs font-bold uppercase text-zinc-500 flex items-center gap-1"><Users className="w-4 h-4" />Equipes inscritas</h3>{equipes.length ? equipes.map(e => <div key={e.id} className="rounded-lg bg-zinc-950/60 border border-zinc-800 px-3 py-2 text-xs"><b className="text-white">{e.nome}</b><span className="text-zinc-500"> — {e.membros.map(m => m.nick).join(', ')}</span></div>) : <p className="text-xs text-zinc-600">Nenhuma equipe inscrita.</p>}</div>
      {evento.status === 'em_andamento' && <div className="space-y-3 border-t border-zinc-800 pt-4"><h3 className="text-xs font-bold uppercase text-zinc-500">Lançar resultado final</h3>{equipes.map(e => <div key={e.id} className="grid grid-cols-[1fr_90px_90px] gap-2 items-center"><span className="text-sm font-bold text-white">{e.nome}</span><input type="number" min="1" placeholder="Posição" value={resultados[e.id]?.colocacao ?? ''} onChange={x => setResultados(v => ({ ...v, [e.id]: { ...v[e.id], colocacao: x.target.value } }))} className={campo} /><input type="number" min="0" placeholder="Abates" value={resultados[e.id]?.abates ?? ''} onChange={x => setResultados(v => ({ ...v, [e.id]: { ...v[e.id], abates: x.target.value } }))} className={campo} /></div>)}<button disabled={busy} onClick={salvarResultado} className="rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-white cursor-pointer">Salvar resultado</button><button disabled={busy} onClick={() => executar(() => apiService.apurarCampeonatoEquipe(evento.id), 'Prêmios apurados')} className="ml-2 rounded-xl border border-amber-500/40 px-4 py-2.5 text-sm font-bold text-amber-400 cursor-pointer">Apurar prêmios</button></div>}
      {evento.status === 'aguardando_revisao' && <div className="space-y-2 border-t border-zinc-800 pt-4"><h3 className="text-xs font-bold uppercase text-zinc-500 flex gap-1"><Trophy className="w-4 h-4" />Premiação por equipe</h3>{pagamentos.map(p => <div key={p.id} className="flex items-center gap-3 rounded-lg border border-zinc-800 p-3 text-xs"><span className="font-bold text-white flex-1">{p.colocacao}º · {p.equipe}</span><span className="text-emerald-400 font-bold">R$ {p.valor.toFixed(2)}</span><button disabled={busy || p.status !== 'pendente'} onClick={() => executar(() => apiService.processarPagamentoEquipe(p.id, 'liberar'), 'Prêmio distribuído')} className="px-3 py-1.5 rounded bg-emerald-500 text-zinc-950 font-bold disabled:opacity-40 cursor-pointer"><Check className="w-3 h-3 inline mr-1" />Liberar</button></div>)}</div>}
    </section>}
  </div>;
}
