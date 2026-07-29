import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle, Ban, Check, Play, Plus, RefreshCw, RotateCcw, Share2, Swords, Trophy, Upload, Users } from 'lucide-react';
import { apiService } from '../services/api';
import type { CampeonatoEquipe, EquipeCampeonato, PagamentoEquipe } from '../services/api';
import { Spinner } from './Spinner';
import { compartilharCampeonato } from '../utils/compartilhar';

interface Props { onAddToast: (type: 'success' | 'error' | 'warning' | 'info', title: string, desc?: string) => void; }
const brl = (v: number) => `R$ ${v.toFixed(2).replace('.', ',')}`;

export function AdminEquipes({ onAddToast }: Props) {
  const [eventos, setEventos] = useState<CampeonatoEquipe[]>([]);
  const [equipes, setEquipes] = useState<EquipeCampeonato[]>([]);
  const [pagamentos, setPagamentos] = useState<PagamentoEquipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [loadingOcr, setLoadingOcr] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [tipo, setTipo] = useState<'cs_4x4' | 'br'>('cs_4x4');
  const [modo, setModo] = useState<'solo' | 'duo' | 'squad'>('solo');
  const [tamanhoCs, setTamanhoCs] = useState('4');
  const [nome, setNome] = useState('CS 4x4');
  const [dataHora, setDataHora] = useState('');
  const [rodadas, setRodadas] = useState('3');
  const [inicio, setInicio] = useState('');
  const [fim, setFim] = useState('');
  const [regraPontos, setRegraPontos] = useState<'lbff' | 'cs'>('cs');
  const [pontosVitoria, setPontosVitoria] = useState('1');
  const [pontosAbate, setPontosAbate] = useState('1');
  const [ordemSel, setOrdemSel] = useState(1);
  const [salas, setSalas] = useState<Record<number, { id: string; senha: string; horario: string }>>({});
  const [minimo, setMinimo] = useState('2');
  const [maximo, setMaximo] = useState('12');
  const [taxa, setTaxa] = useState('10');
  const [numPos, setNumPos] = useState('3');
  const [valores, setValores] = useState(['50', '30', '20']);
  const [resultados, setResultados] = useState<Record<number, { colocacao: string; abates: string; ocrNick?: string }>>({});

  const carregar = useCallback(async () => {
    try {
      const lista = await apiService.obterCampeonatosEquipe();
      setEventos(lista);
      const atual = lista[0];
      if (!atual) { setEquipes([]); setPagamentos([]); return; }
      const [inscritas, premios] = await Promise.all([
        apiService.listarEquipesInscritas(atual.id),
        atual.status === 'aguardando_revisao' ? apiService.listarPagamentosEquipe(atual.id) : Promise.resolve([]),
      ]);
      setEquipes(inscritas); setPagamentos(premios);
    } catch { onAddToast('error', 'Erro ao carregar', 'Nao foi possivel buscar os campeonatos por equipe.'); }
    finally { setLoading(false); }
  }, [onAddToast]);
  useEffect(() => { carregar(); const timer = setInterval(carregar, 15000); return () => clearInterval(timer); }, [carregar]);

  const evento = eventos[0];
  useEffect(() => {
    if (evento?.status === 'inscricao') {
      setTipo(evento.tipo); setModo(evento.modo === '4x4' ? 'solo' : evento.modo); setTamanhoCs(String(evento.tamanho_equipe));
      setNome(evento.nome); setDataHora(evento.data_hora ?? ''); setMinimo(String(evento.min_equipes)); setMaximo(String(evento.max_equipes));
      setTaxa(String(evento.taxa_inscricao)); setNumPos(String(evento.premios.length)); setValores(evento.premios.map(String));
      setRodadas(String(evento.total_rodadas ?? 3)); setInicio(evento.inicio ?? ''); setFim(evento.fim ?? '');
      setRegraPontos(evento.regra_pontos ?? (evento.tipo === 'cs_4x4' ? 'cs' : 'lbff'));
      setPontosVitoria(String(evento.pontos_vitoria ?? 1)); setPontosAbate(String(evento.pontos_abate ?? 1));
    }
  }, [evento?.id, evento?.status]);
  const executar = async (acao: () => Promise<any>, titulo: string) => {
    setBusy(true);
    try { const resposta = await acao(); onAddToast('success', titulo, resposta?.message); await carregar(); }
    catch (e: any) { onAddToast('error', 'Erro', e.message || 'Falha na operacao.'); }
    finally { setBusy(false); }
  };
  const nPos = Math.max(1, Math.min(20, Number(numPos) || 1));
  const premios = Array.from({ length: nPos }, (_, i) => Math.max(0, Number(valores[i] || 0)));
  const setValor = (indice: number, valor: string) => setValores(prev => { const proximo = [...prev]; proximo[indice] = valor; return proximo; });
  const campo = 'w-full px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-white text-sm focus:border-primary focus:outline-none';
  const label = 'text-[10px] font-bold uppercase tracking-wider text-zinc-500 block mb-1';

  const configEvento = () => ({ nome: nome.trim() || 'Campeonato por equipes', tipo, modo, tamanho_equipe: tipo === 'cs_4x4' ? Number(tamanhoCs) : undefined, data_hora: dataHora.trim() || undefined, min_equipes: Number(minimo) || 2, max_equipes: Number(maximo) || 12, taxa_inscricao: Number(taxa) || 0.01, premios, total_rodadas: Math.max(1, Math.min(100, Number(rodadas) || 1)), inicio: inicio.trim() || undefined, fim: fim.trim() || undefined, regra_pontos: regraPontos, pontos_vitoria: Math.max(0, Number(pontosVitoria) || 0), pontos_abate: Math.max(0, Number(pontosAbate) || 0) });
  const criar = () => executar(() => apiService.criarCampeonatoEquipe(configEvento()), 'Campeonato criado');
  const salvarResultado = () => {
    if (!evento) return;
    const linhas = equipes.map(equipe => ({ equipe_id: equipe.id, colocacao: Number(resultados[equipe.id]?.colocacao), abates: Number(resultados[equipe.id]?.abates || 0) }));
    if (linhas.some(linha => !linha.colocacao)) { onAddToast('warning', 'Resultado incompleto', 'Informe a colocacao de todas as equipes.'); return; }
    if (new Set(linhas.map(linha => linha.colocacao)).size !== linhas.length) { onAddToast('warning', 'Colocacoes repetidas', 'Cada equipe precisa ter uma colocacao diferente.'); return; }
    executar(() => apiService.lancarResultadoEquipe(evento.id, ordemSel, linhas), `Resultado da rodada ${ordemSel} salvo`);
  };
  const processarOcr = async (arquivo: File) => {
    if (!evento) return;
    setLoadingOcr(true);
    try {
      const data = await apiService.processarOcrEquipe(evento.id, arquivo);
      const detectadas: Record<number, { colocacao: string; abates: string; ocrNick?: string }> = {};
      for (const resultado of data?.resultados ?? []) {
        const equipe = equipes.find(item => item.id === resultado.equipe_id);
        if (equipe && !detectadas[equipe.id]) detectadas[equipe.id] = { colocacao: String(resultado.colocacao), abates: String(resultado.abates ?? 0), ocrNick: resultado.nick_cadastrado || resultado.nick_detectado };
      }
      if (!Object.keys(detectadas).length) { onAddToast('warning', 'OCR sem vínculo', 'Não encontrei nicks das equipes no print. Confira os nicks cadastrados ou preencha manualmente.'); return; }
      setResultados(prev => ({ ...prev, ...detectadas }));
      const pendentes = data?.nao_vinculados?.length ?? 0;
      onAddToast('success', 'Print lido por OCR', `${Object.keys(detectadas).length} equipe(s) vinculada(s) por nick${pendentes ? ` · ${pendentes} linha(s) para revisar` : ''}.`);
    } catch (e: any) { onAddToast('error', 'Erro no OCR', e.message || 'Nao foi possivel ler o print.'); }
    finally { setLoadingOcr(false); if (fileInputRef.current) fileInputRef.current.value = ''; }
  };

  if (loading) return <div className="ff-card p-8 flex justify-center"><Spinner size="md" className="text-primary" /></div>;
  const formato = evento?.tipo === 'cs_4x4' ? `CS ${evento.tamanho_equipe}x${evento.tamanho_equipe}` : `BR ${evento?.modo || ''}`;
  const podeIniciar = !!evento && evento.status === 'inscricao' && equipes.length >= evento.min_equipes;
  const compartilharLink = async () => {
    if (!evento) return;
    try { await compartilharCampeonato(evento.nome, 'equipes', evento.id); onAddToast('success', 'Link pronto', 'Envie o campeonato para os capitães das equipes.'); }
    catch { /* compartilhamento cancelado */ }
  };

  const configCampos = <div className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      <div><label className={label}>Nome</label><input value={nome} onChange={e => setNome(e.target.value)} className={campo} /></div>
      <div><label className={label}>Formato</label><select value={tipo} onChange={e => { const novo = e.target.value as 'cs_4x4' | 'br'; setTipo(novo); setNome(novo === 'cs_4x4' ? `CS ${tamanhoCs}x${tamanhoCs}` : 'BR'); }} className={campo}><option value="cs_4x4">Contra Squad</option><option value="br">Battle Royale</option></select></div>
      {tipo === 'br' ? <div><label className={label}>Modo BR</label><select value={modo} onChange={e => setModo(e.target.value as typeof modo)} className={campo}><option value="solo">Solo</option><option value="duo">Duo</option><option value="squad">Squad</option></select></div> : <div><label className={label}>Formato CS</label><select value={tamanhoCs} onChange={e => { setTamanhoCs(e.target.value); setNome(`CS ${e.target.value}x${e.target.value}`); }} className={campo}><option value="1">1x1</option><option value="2">2x2</option><option value="3">3x3</option><option value="4">4x4</option></select></div>}
      <div><label className={label}>Data e hora</label><input value={dataHora} onChange={e => setDataHora(e.target.value)} placeholder="ex: 15/07 20:00" className={campo} /></div>
      <div><label className={label}>Minimo de equipes</label><input type="number" min="2" value={minimo} onChange={e => setMinimo(e.target.value)} className={campo} /></div>
      <div><label className={label}>Maximo de equipes</label><input type="number" min="2" value={maximo} onChange={e => setMaximo(e.target.value)} className={campo} /></div>
      <div><label className={label}>Entrada por equipe (R$)</label><input type="number" min="0.01" step="0.01" value={taxa} onChange={e => setTaxa(e.target.value)} className={campo} /></div>
      <div><label className={label}>Posicoes premiadas</label><input type="number" min="1" max="20" value={numPos} onChange={e => setNumPos(e.target.value)} className={campo} /></div>
      <div><label className={label}>Rodadas</label><input type="number" min="1" max="100" value={rodadas} onChange={e => setRodadas(e.target.value)} className={campo} /></div>
      <div><label className={label}>Inicio do evento</label><input value={inicio} onChange={e => setInicio(e.target.value)} placeholder="ex: 15/07 20:00" className={campo} /></div>
      <div><label className={label}>Fim / prazo</label><input value={fim} onChange={e => setFim(e.target.value)} placeholder="ex: 20/07 23:59" className={campo} /></div>
      <div><label className={label}>Regra de pontuacao</label><select value={regraPontos} onChange={e => setRegraPontos(e.target.value as 'lbff' | 'cs')} className={campo}><option value="cs">CS: vitorias + abates</option><option value="lbff">BR: colocacao LBFF + abates</option></select></div>
      {regraPontos === 'cs' && <><div><label className={label}>Pontos por vitoria</label><input type="number" min="0" step="0.1" value={pontosVitoria} onChange={e => setPontosVitoria(e.target.value)} className={campo} /></div><div><label className={label}>Pontos por abate</label><input type="number" min="0" step="0.1" value={pontosAbate} onChange={e => setPontosAbate(e.target.value)} className={campo} /></div></>}
    </div>
    <div><label className={label}>Premio por colocacao (R$)</label><div className="grid grid-cols-4 sm:grid-cols-6 gap-2">{Array.from({ length: nPos }, (_, i) => <div key={i}><span className="text-[9px] text-zinc-500 block text-center mb-1">{i + 1}o</span><input type="number" min="0" step="0.01" value={valores[i] || ''} onChange={e => setValor(i, e.target.value)} className={`${campo} text-center px-1`} /></div>)}</div><p className="text-[10px] text-zinc-500 mt-1">Total: <b className="text-emerald-400">{brl(premios.reduce((soma, valor) => soma + valor, 0))}</b></p></div>
  </div>;

  return <div className="space-y-6">
    <div className="ff-card p-5 space-y-3"><div className="flex items-center justify-between gap-3"><h2 className="text-sm font-bold text-white flex items-center gap-2"><Swords className="w-4 h-4 text-primary" />Campeonatos por equipe</h2><button onClick={carregar} className="p-1.5 text-zinc-500 hover:text-white rounded-lg cursor-pointer" title="Atualizar"><RefreshCw className="w-3.5 h-3.5" /></button></div><p className="text-xs text-zinc-400">Crie CS de 1x1 a 4x4 ou BR Solo, Duo e Squad. Inscricao e premio sao por equipe.</p>{evento && <div className="flex flex-wrap gap-2">{evento.premios.map((premio, i) => <span key={i} className="text-[11px] font-bold px-2.5 py-1 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-300">{i + 1}o <b className="text-emerald-400">{brl(premio)}</b></span>)}</div>}</div>
    {!evento && <div className="ff-card p-5 space-y-4"><span className="text-xs font-bold uppercase tracking-wider text-zinc-500">Nenhum campeonato ativo</span>{configCampos}<button disabled={busy} onClick={criar} className="w-full flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-white font-bold text-sm disabled:opacity-50 cursor-pointer"><Plus className="w-4 h-4" />Criar campeonato por equipe</button></div>}
    {evento && <div className="ff-card p-5 space-y-5"><div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="text-sm font-black text-white">{evento.nome} <span className="text-zinc-500">#{evento.id}</span></h3><span className="text-[10px] font-bold uppercase tracking-wider text-primary">{formato} - {evento.tamanho_equipe} por equipe - {evento.status.replace('_', ' ')}</span></div><div className="flex items-center gap-2 bg-zinc-950 border border-zinc-800 px-3 py-1.5 rounded-xl"><Users className="w-4 h-4 text-primary" /><span className="text-sm font-black text-white">{equipes.length}</span><span className="text-[10px] text-zinc-500">/ min. {evento.min_equipes}</span></div></div>{evento.status === 'inscricao' && <button onClick={compartilharLink} className="flex items-center gap-2 rounded-lg border border-primary/40 bg-primary/10 px-3 py-2 text-xs font-bold text-primary hover:bg-primary/15 cursor-pointer"><Share2 className="w-3.5 h-3.5" />Compartilhar campeonato</button>}
      {evento.status === 'inscricao' && <div className="space-y-4"><div className="p-4 rounded-xl border border-zinc-800 bg-zinc-950/30 space-y-3"><span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Configuracao do evento</span>{configCampos}<button disabled={busy} onClick={() => executar(() => apiService.configurarCampeonatoEquipe(evento.id, configEvento()), 'Configuracao salva')} className="px-4 py-2 rounded-lg bg-zinc-800 text-white text-xs font-bold cursor-pointer">Salvar configuracao</button></div><div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-400 flex items-center gap-2"><AlertTriangle className="w-4 h-4" />{podeIniciar ? 'Minimo atingido. O campeonato pode ser iniciado.' : `Faltam ${Math.max(0, evento.min_equipes - equipes.length)} equipe(s) para iniciar.`}</div><div className="flex gap-2"><button disabled={busy || !podeIniciar} onClick={() => executar(() => apiService.iniciarCampeonatoEquipe(evento.id), 'Campeonato iniciado')} className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-500 text-zinc-950 font-bold text-sm disabled:opacity-40 cursor-pointer"><Play className="w-4 h-4" />Iniciar</button><button disabled={busy} onClick={() => window.confirm('Cancelar este campeonato? As inscricoes serao reembolsadas.') && executar(() => apiService.cancelarCampeonatoEquipe(evento.id), 'Campeonato cancelado')} className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-rose-500/40 text-rose-400 text-sm font-bold cursor-pointer"><Ban className="w-4 h-4" />Cancelar</button></div></div>}
      <div className="space-y-2"><span className="text-xs font-bold uppercase tracking-wider text-zinc-500">Equipes inscritas e nicks no Free Fire</span>{equipes.length ? equipes.map(equipe => <div key={equipe.id} className="p-3 rounded-xl border border-zinc-800 bg-zinc-950/40 text-xs"><b className="text-white">{equipe.nome}</b><span className="block mt-1 text-zinc-400">Nicks FF: {equipe.membros.map(membro => membro.nick).join(' · ')}</span>{(equipe.reservas?.length ?? 0) > 0 && <span className="block mt-1 text-accent-cyan">Reservas: {equipe.reservas!.map(membro => membro.nick).join(' · ')}</span>}</div>) : <p className="text-xs text-zinc-600 py-3 text-center">Nenhuma equipe inscrita.</p>}</div>
      {evento.status === 'em_andamento' && <div className="space-y-4 border-t border-zinc-800 pt-5">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-500/30 bg-amber-500/5 p-3"><p className="text-xs text-amber-200">Fechou as inscrições por engano? Volte para a criação antes de liberar uma sala ou lançar resultados.</p><button disabled={busy} onClick={() => window.confirm('Reabrir as inscrições deste campeonato?') && executar(() => apiService.reabrirInscricoesCampeonatoEquipe(evento.id), 'Inscrições reabertas')} className="flex items-center gap-2 rounded-lg border border-amber-500/50 px-3 py-2 text-xs font-bold text-amber-300 hover:bg-amber-500/10 cursor-pointer disabled:opacity-40"><RotateCcw className="w-3.5 h-3.5" />Voltar às inscrições</button></div>
        <div className="space-y-2"><span className="text-xs font-bold uppercase tracking-wider text-zinc-400">Salas por rodada</span><div className="grid grid-cols-1 md:grid-cols-3 gap-2">{Array.from({ length: evento.total_rodadas ?? 3 }, (_, i) => i + 1).map(ordem => <div key={ordem} className="rounded-xl border border-zinc-800 p-3 space-y-2"><b className="text-xs text-white">Rodada {ordem}</b><input value={salas[ordem]?.id ?? ''} onChange={e => setSalas(prev => ({ ...prev, [ordem]: { ...(prev[ordem] ?? { id: '', senha: '', horario: '' }), id: e.target.value } }))} placeholder="ID da sala" className={campo} /><input value={salas[ordem]?.senha ?? ''} onChange={e => setSalas(prev => ({ ...prev, [ordem]: { ...(prev[ordem] ?? { id: '', senha: '', horario: '' }), senha: e.target.value } }))} placeholder="Senha" className={campo} /><input value={salas[ordem]?.horario ?? ''} onChange={e => setSalas(prev => ({ ...prev, [ordem]: { ...(prev[ordem] ?? { id: '', senha: '', horario: '' }), horario: e.target.value } }))} placeholder="Horario" className={campo} /><button disabled={busy} onClick={() => executar(() => apiService.definirSalaEquipe(evento.id, ordem, salas[ordem]?.id ?? '', salas[ordem]?.senha ?? '', salas[ordem]?.horario || undefined), `Sala ${ordem} salva`)} className="w-full rounded-lg bg-zinc-800 py-2 text-xs font-bold text-white cursor-pointer">Salvar sala</button></div>)}</div></div>
        <div className="flex items-center justify-between gap-3"><span className="text-xs font-bold uppercase tracking-wider text-zinc-400">Lançar resultado da rodada</span><div className="flex flex-wrap gap-1">{Array.from({ length: evento.total_rodadas ?? 3 }, (_, i) => i + 1).map(ordem => <button key={ordem} onClick={() => setOrdemSel(ordem)} className={`w-8 h-8 rounded-lg text-xs font-black cursor-pointer ${ordemSel === ordem ? 'bg-primary text-white' : 'bg-zinc-950 border border-zinc-800 text-zinc-400'}`}>{ordem}</button>)}</div></div>
        <div className="p-4 rounded-xl border border-dashed border-zinc-800 bg-zinc-950/20 space-y-3"><div className="flex items-center justify-between"><span className="text-xs font-bold text-zinc-400 flex items-center gap-1.5"><Upload className="w-4 h-4 text-primary" />Carregar print de placar (OCR)</span><span className="text-[9px] text-zinc-500">lê nick FF e vincula à equipe</span></div><div onClick={() => fileInputRef.current?.click()} onDragOver={e => e.preventDefault()} onDrop={async e => { e.preventDefault(); if (e.dataTransfer.files[0]) await processarOcr(e.dataTransfer.files[0]); }} className="border border-dashed border-zinc-800 hover:border-primary/50 rounded-xl p-5 text-center cursor-pointer bg-zinc-950/40"><input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={async e => { if (e.target.files?.[0]) await processarOcr(e.target.files[0]); }} />{loadingOcr ? <Spinner size="md" className="mx-auto text-primary" /> : <><Upload className="w-7 h-7 text-zinc-600 mx-auto mb-2" /><p className="text-xs text-zinc-300"><b className="text-primary">Arraste o print</b> ou clique para selecionar</p><p className="text-[10px] text-zinc-500">A IA lê o nick exibido no Free Fire e encontra a equipe cadastrada</p></>}</div></div><div className="space-y-2">{equipes.map(equipe => <div key={equipe.id} className="grid grid-cols-[1fr_82px_82px] gap-2 items-center p-2 rounded-lg border border-zinc-900 bg-zinc-950/20"><div><span className="text-sm font-bold text-white">{equipe.nome}</span><span className="block text-[9px] text-zinc-500">Nicks FF: {equipe.membros.map(membro => membro.nick).join(' · ')}</span>{resultados[equipe.id]?.ocrNick && <span className="block text-[9px] text-amber-400">OCR vinculou: {resultados[equipe.id].ocrNick}</span>}</div><input type="number" min="1" placeholder="Pos." value={resultados[equipe.id]?.colocacao || ''} onChange={e => setResultados(prev => ({ ...prev, [equipe.id]: { ...prev[equipe.id], colocacao: e.target.value } }))} className={campo} /><input type="number" min="0" placeholder="Abates" value={resultados[equipe.id]?.abates || ''} onChange={e => setResultados(prev => ({ ...prev, [equipe.id]: { ...prev[equipe.id], abates: e.target.value } }))} className={campo} /></div>)}</div><div className="flex flex-wrap gap-2"><button disabled={busy} onClick={salvarResultado} className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-white text-sm font-bold cursor-pointer"><Check className="w-4 h-4" />Salvar rodada {ordemSel}</button><button disabled={busy || evento.placar.length === 0} onClick={() => executar(() => apiService.apurarCampeonatoEquipe(evento.id), 'Premios apurados')} className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-500 text-zinc-950 text-sm font-bold disabled:opacity-40 cursor-pointer"><Trophy className="w-4 h-4" />Apurar premios</button></div></div>}
      {evento.status === 'aguardando_revisao' && <div className="space-y-2 border-t border-zinc-800 pt-5"><span className="text-xs font-bold uppercase tracking-wider text-zinc-500">Premiacao por equipe</span>{pagamentos.map(pagamento => <div key={pagamento.id} className="flex items-center gap-3 rounded-xl border border-zinc-800 p-3 text-xs"><span className="font-bold text-white flex-1">{pagamento.colocacao}o - {pagamento.equipe}</span><span className="text-emerald-400 font-bold">{brl(pagamento.valor)}</span><button disabled={busy || pagamento.status !== 'pendente'} onClick={() => executar(() => apiService.processarPagamentoEquipe(pagamento.id, 'liberar'), 'Premio distribuido')} className="px-3 py-1.5 rounded-lg bg-emerald-500 text-zinc-950 font-bold disabled:opacity-40 cursor-pointer"><Check className="w-3 h-3 inline mr-1" />Liberar</button></div>)}</div>}
    </div>}
  </div>;
}
