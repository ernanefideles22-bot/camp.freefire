import { useCallback, useEffect, useState } from 'react';
import { Check, ChevronDown, ChevronUp, Crown, Crosshair, Flame, ImagePlus, Medal, Shield, Swords, Users, Trophy, RefreshCw } from 'lucide-react';
import { apiService } from '../services/api';
import type { CampeonatoEquipe, EquipeCampeonato, Jogador, JogadorEquipeDisponivel } from '../services/api';
import { Spinner } from './Spinner';

interface Props {
  currentUser: Jogador | null;
  onAddToast: (type: 'success' | 'error' | 'warning' | 'info', title: string, desc?: string) => void;
}

const moeda = (valor: number) => `R$ ${valor.toFixed(2).replace('.', ',')}`;
const formato = (ev: CampeonatoEquipe) => ev.tipo === 'cs_4x4' ? `CS ${ev.tamanho_equipe}x${ev.tamanho_equipe}` : `BR ${ev.modo[0].toUpperCase()}${ev.modo.slice(1)}`;

function ChaveCsPublica({ evento }: { evento: CampeonatoEquipe }) {
  const fases = Array.from(new Set((evento.confrontos_cs ?? []).map(confronto => confronto.fase)));
  if (!fases.length) return null;
  return <div className="rounded-xl border border-primary/25 bg-primary/5 p-3"><div className="flex items-center gap-2"><Swords className="w-4 h-4 text-primary" /><b className="text-xs text-white">Chave CS</b><span className="text-[10px] text-zinc-500">os vencedores avançam automaticamente</span></div><div className="mt-3 grid gap-3 lg:grid-cols-3">{fases.map(fase => <div key={fase} className="space-y-2"><p className="text-[10px] font-black uppercase tracking-wider text-primary">Fase {fase}</p>{(evento.confrontos_cs ?? []).filter(confronto => confronto.fase === fase).map(confronto => <div key={confronto.id} className="rounded-lg border border-zinc-800 bg-zinc-950/70 p-2 text-xs"><div className={`flex justify-between gap-2 ${confronto.vencedor_id === confronto.equipe_a?.id ? 'text-emerald-400 font-bold' : 'text-zinc-300'}`}><span className="truncate">{confronto.equipe_a?.nome}</span><span>{confronto.abates_a}</span></div>{confronto.equipe_b ? <div className={`mt-1 flex justify-between gap-2 ${confronto.vencedor_id === confronto.equipe_b.id ? 'text-emerald-400 font-bold' : 'text-zinc-300'}`}><span className="truncate">{confronto.equipe_b.nome}</span><span>{confronto.abates_b}</span></div> : <p className="mt-1 text-[10px] text-amber-400">Avanço automático</p>}{confronto.status === 'aguardando' && <p className="mt-2 text-[9px] uppercase text-amber-400">Aguardando resultado</p>}</div>)}</div>)}</div></div>;
}

function PlacarArena({ itens }: { itens: CampeonatoEquipe['placar'] }) {
  if (!itens.length) return null;
  const destaque = itens.slice(0, 3);
  const medalha = (posicao: number) => posicao === 1 ? <Crown /> : <Medal />;
  return <section className="ff-event-ranking">
    <div className="ff-event-ranking-hero"><div><span className="ff-kicker">Classificação em tempo real</span><h4><Trophy /> MURAL DA ARENA</h4><p>Quem domina a queda sobe no ranking.</p></div><span className="ff-event-ranking-live"><i />PLACAR ATUALIZADO</span></div>
    <div className="ff-event-podium">{destaque.map((item, indice) => <article key={item.equipe_id} className={`ff-event-podium-card rank-${item.posicao}`}><div className="ff-event-podium-place">{medalha(item.posicao)}<b>#{item.posicao}</b></div>{item.guilda?.logo_url ? <img src={item.guilda.logo_url} alt={`Emblema de ${item.equipe}`} className="ff-event-podium-logo" /> : <div className="ff-event-podium-logo ff-event-podium-fallback">FF</div>}<div className="min-w-0 flex-1"><small>{indice === 0 ? 'Líder da arena' : item.posicao === 2 ? 'Na perseguição' : 'Zona de pódio'}</small><b>{item.equipe}</b>{item.guilda?.nome && <em>{item.guilda.nome}</em>}</div><div className="ff-event-podium-score"><b>{item.pontos}</b><span>PTS</span></div></article>)}</div>
    <div className="ff-event-ranking-list"><div className="ff-event-ranking-labels"><span>POS</span><span>EQUIPE</span><span><Crosshair /> ABATES</span><span>PONTOS</span></div>{itens.map(item => <div key={item.equipe_id} className={`ff-event-ranking-row ${item.posicao <= 3 ? `is-top-${item.posicao}` : ''}`}><span className="ff-event-ranking-position">{String(item.posicao).padStart(2, '0')}</span><span className="ff-event-ranking-team">{item.guilda?.logo_url && <img src={item.guilda.logo_url} alt="" />}<span><b>{item.equipe}</b>{item.guilda?.nome && <small>{item.guilda.nome}</small>}</span></span><span className="ff-event-ranking-kills"><Flame />{item.abates}</span><span className="ff-event-ranking-points"><b>{item.pontos}</b><small>PTS</small></span></div>)}</div>
  </section>;
}

export function CampeonatosEquipe({ currentUser, onAddToast }: Props) {
  const [campeonatos, setCampeonatos] = useState<CampeonatoEquipe[]>([]);
  const [minhasEquipes, setMinhasEquipes] = useState<Record<number, EquipeCampeonato | null>>({});
  const [loading, setLoading] = useState(true);
  const [abrir, setAbrir] = useState<number | null>(null);
  const [nomeEquipe, setNomeEquipe] = useState('');
  const [nomeGuilda, setNomeGuilda] = useState('');
  const [logoData, setLogoData] = useState('');
  const [nicks, setNicks] = useState('');
  const [reservasNicks, setReservasNicks] = useState('');
  const [jogadores, setJogadores] = useState<JogadorEquipeDisponivel[]>([]);
  const [membrosSelecionados, setMembrosSelecionados] = useState<string[]>([]);
  const [reservasSelecionados, setReservasSelecionados] = useState<string[]>([]);
  const [listaAberta, setListaAberta] = useState(false);
  const [listaReservasAberta, setListaReservasAberta] = useState(false);
  const [carregandoJogadores, setCarregandoJogadores] = useState(false);
  const [busy, setBusy] = useState(false);

  const carregar = useCallback(async () => {
    try {
      const [abertos, historico] = await Promise.all([apiService.obterCampeonatosEquipe(), apiService.obterHistoricoCampeonatosEquipe()]);
      const eventos = [...abertos, ...historico];
      setCampeonatos(eventos);
      if (currentUser) {
        const pares = await Promise.all(eventos.map(async ev => [ev.id, await apiService.obterMinhaEquipe(ev.id).catch(() => null)] as const));
        setMinhasEquipes(Object.fromEntries(pares));
      } else setMinhasEquipes({});
    } catch { onAddToast('error', 'Erro ao carregar', 'Não foi possível buscar os campeonatos por equipe.'); }
    finally { setLoading(false); }
  }, [currentUser, onAddToast]);

  useEffect(() => { carregar(); }, [carregar]);

  const abrirInscricao = async (eventoId: number) => {
    setAbrir(eventoId); setNomeEquipe(''); setNomeGuilda(''); setLogoData(''); setNicks(''); setReservasNicks(''); setMembrosSelecionados([]); setReservasSelecionados([]); setListaAberta(false); setListaReservasAberta(false);
    if (!currentUser || jogadores.length) return;
    setCarregandoJogadores(true);
    try { setJogadores(await apiService.listarJogadoresParaEquipe()); }
    catch { onAddToast('warning', 'Lista indisponível', 'Você ainda pode informar os nicks manualmente.'); }
    finally { setCarregandoJogadores(false); }
  };

  const membrosInformados = () => Array.from(new Set([
    ...nicks.split(',').map(nick => nick.trim()).filter(Boolean),
    ...membrosSelecionados,
  ].filter(nick => nick.toLowerCase() !== currentUser?.nick.toLowerCase())));

  const reservasInformados = () => Array.from(new Set([
    ...reservasNicks.split(',').map(nick => nick.trim()).filter(Boolean),
    ...reservasSelecionados,
  ]))
    .filter(nick => nick.toLowerCase() !== currentUser?.nick.toLowerCase() && !membrosInformados().some(titular => titular.toLowerCase() === nick.toLowerCase()));

  const alternarMembro = (jogador: JogadorEquipeDisponivel, evento: CampeonatoEquipe) => {
    if (jogador.nick.toLowerCase() === currentUser?.nick.toLowerCase()) return;
    setMembrosSelecionados(atual => {
      if (atual.some(nick => nick.toLowerCase() === jogador.nick.toLowerCase())) return atual.filter(nick => nick.toLowerCase() !== jogador.nick.toLowerCase());
      if (membrosInformados().length >= evento.tamanho_equipe - 1) {
        onAddToast('warning', 'Equipe completa', `Esse formato aceita ${evento.tamanho_equipe} jogador(es), contando você como capitão.`);
        return atual;
      }
      return [...atual, jogador.nick];
    });
  };

  const alternarReserva = (jogador: JogadorEquipeDisponivel) => {
    if (jogador.nick.toLowerCase() === currentUser?.nick.toLowerCase() || membrosInformados().some(titular => titular.toLowerCase() === jogador.nick.toLowerCase())) return;
    setReservasSelecionados(atual => {
      if (atual.some(nick => nick.toLowerCase() === jogador.nick.toLowerCase())) return atual.filter(nick => nick.toLowerCase() !== jogador.nick.toLowerCase());
      if (reservasInformados().length >= 2) {
        onAddToast('warning', 'Limite de reservas', 'Cada equipe pode cadastrar até 2 reservas.');
        return atual;
      }
      return [...atual, jogador.nick];
    });
  };

  const inscrever = async (ev: CampeonatoEquipe) => {
    if (!currentUser) { onAddToast('warning', 'Faça login', 'Entre para criar sua equipe.'); return; }
    setBusy(true);
    try {
      const membros = membrosInformados();
      const reservas = reservasInformados();
      await apiService.inscreverEquipe(ev.id, nomeEquipe, membros, reservas, nomeGuilda, logoData || undefined);
      onAddToast('success', 'Equipe inscrita', `A inscrição de ${nomeEquipe} foi confirmada.`);
      setAbrir(null); setNomeEquipe(''); setNomeGuilda(''); setLogoData(''); setNicks(''); setReservasNicks(''); setMembrosSelecionados([]); setReservasSelecionados([]); await carregar();
    } catch (erro: any) { onAddToast('error', 'Não foi possível inscrever', erro.message); }
    finally { setBusy(false); }
  };

  const selecionarLogo = (arquivo?: File) => {
    if (!arquivo) return;
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(arquivo.type) || arquivo.size > 500 * 1024) {
      onAddToast('warning', 'Logo inválida', 'Use PNG, JPG ou WEBP de até 500 KB.');
      return;
    }
    const leitor = new FileReader();
    leitor.onload = () => setLogoData(String(leitor.result || ''));
    leitor.readAsDataURL(arquivo);
  };

  if (loading) return <div className="py-16 flex justify-center"><Spinner size="md" className="text-primary" /></div>;
  if (!campeonatos.length) return <div className="max-w-2xl mx-auto text-center rounded-2xl border border-dashed border-zinc-800 bg-zinc-950/30 py-14 px-6"><Swords className="w-10 h-10 text-zinc-700 mx-auto mb-3" /><h2 className="font-bold text-white">Nenhum campeonato por equipe aberto</h2><p className="text-xs text-zinc-500 mt-2">Os próximos campeonatos CS e BR aparecerão aqui.</p></div>;

  return <div className="max-w-4xl mx-auto space-y-4">
    <div className="flex items-center justify-between"><div><h2 className="text-lg font-black text-white">Campeonatos por equipe</h2><p className="text-xs text-zinc-500">CS configurável e BR Solo, Duo ou Squad. Ranking fica salvo em cada evento.</p></div><button onClick={carregar} className="p-2 text-zinc-500 hover:text-white cursor-pointer"><RefreshCw className="w-4 h-4" /></button></div>
    {campeonatos.map(ev => {
      const minha = minhasEquipes[ev.id]; const emInscricao = ev.status === 'inscricao'; const membros = abrir === ev.id ? membrosInformados() : [];
      return <section key={ev.id} className="rounded-2xl border border-zinc-800 bg-panel-bg p-5 space-y-4">
        <div className="flex flex-wrap justify-between gap-3"><div><div className="flex items-center gap-2"><Swords className="w-5 h-5 text-primary" /><h3 className="font-black text-white">{ev.nome}</h3></div><div className="mt-2 flex flex-wrap gap-2 text-[11px] font-bold"><span className="px-2 py-1 rounded bg-primary/15 text-primary">{formato(ev)}</span><span className="px-2 py-1 rounded bg-zinc-900 text-zinc-300">{ev.tamanho_equipe} por equipe</span>{ev.data_hora && <span className="px-2 py-1 rounded bg-zinc-900 text-zinc-400">{ev.data_hora}</span>}</div></div><div className="text-right"><p className="text-lg font-black text-emerald-400">{moeda(ev.taxa_inscricao)}</p><p className="text-[10px] text-zinc-500">por equipe</p></div></div>
        <div className="flex flex-wrap gap-2 text-xs"><span className="flex items-center gap-1 text-zinc-400"><Users className="w-4 h-4" /> {ev.equipes}/{ev.max_equipes} equipes</span><span className="text-zinc-600">mín. {ev.min_equipes}</span><span className="px-2 py-1 rounded bg-zinc-950 border border-zinc-800 text-zinc-400">{ev.total_rodadas ?? 3} rodada(s)</span>{ev.inicio && <span className="px-2 py-1 rounded bg-zinc-950 border border-zinc-800 text-zinc-400">Início: {ev.inicio}</span>}{ev.fim && <span className="px-2 py-1 rounded bg-zinc-950 border border-zinc-800 text-zinc-400">Até: {ev.fim}</span>}{ev.premios.map((p, i) => <span key={i} className="px-2 py-1 rounded bg-zinc-950 border border-zinc-800 text-zinc-300">{i + 1}º {moeda(p)}</span>)}</div>
        {minha ? <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/5 p-3 text-xs space-y-2"><div className="flex items-center gap-2">{minha.guilda?.logo_url && <img src={minha.guilda.logo_url} alt="Logo da guilda" className="w-8 h-8 rounded-lg object-cover border border-primary/40" />}<div><b className="text-emerald-400">Sua equipe: {minha.nome}</b>{minha.guilda?.nome && <span className="ml-1 text-primary">· {minha.guilda.nome}</span>}<span className="text-zinc-400"> — titulares: {minha.membros.map(m => m.nick).join(', ')}</span></div></div>{(minha.reservas?.length ?? 0) > 0 && <div className="rounded-lg border border-accent-cyan/20 bg-accent-cyan/5 px-2.5 py-2 text-[11px]"><b className="text-accent-cyan">Reservas:</b> <span className="text-zinc-300">{minha.reservas!.map(m => m.nick).join(', ')}</span></div>}{(minha.salas?.length ?? 0) > 0 && <div className="flex flex-wrap gap-2">{minha.salas!.map(sala => <span key={sala.ordem} className="px-2 py-1 rounded bg-zinc-950 border border-zinc-800 text-zinc-300">R{sala.ordem}: <b>{sala.sala_id}</b> · {sala.senha}</span>)}</div>}</div> : emInscricao && <>{abrir === ev.id ? <div className="rounded-xl border border-zinc-800 bg-zinc-950/40 p-4 space-y-3"><input value={nomeEquipe} onChange={e => setNomeEquipe(e.target.value)} placeholder="Nome da equipe" className="w-full rounded-lg bg-zinc-950 border border-zinc-800 px-3 py-2 text-sm text-white" />
          <div className="grid sm:grid-cols-[1fr_auto] gap-2"><input value={nomeGuilda} onChange={e => setNomeGuilda(e.target.value)} placeholder="Nome da guilda (opcional)" className="w-full rounded-lg bg-zinc-950 border border-zinc-800 px-3 py-2 text-sm text-white" /><label className="flex items-center justify-center gap-2 rounded-lg border border-dashed border-primary/45 bg-primary/5 px-3 py-2 text-xs font-bold text-primary cursor-pointer"><ImagePlus className="w-4 h-4" />{logoData ? 'Trocar emblema' : 'Logo da guilda'}<input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={e => selecionarLogo(e.target.files?.[0])} /></label></div>
          {logoData && <div className="flex items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-950/50 p-2"><img src={logoData} alt="Prévia do emblema" className="w-10 h-10 rounded-lg object-cover" /><span className="text-[11px] text-zinc-400">Este emblema aparecerá nos campeonatos e no ranking da guilda.</span><button type="button" onClick={() => setLogoData('')} className="ml-auto text-[10px] font-bold text-rose-400 cursor-pointer">Remover</button></div>}
          {ev.tamanho_equipe > 1 && <div className="rounded-xl border border-zinc-800 bg-zinc-950/30 overflow-hidden"><button type="button" onClick={() => setListaAberta(valor => !valor)} className="w-full flex items-center justify-between gap-3 px-3 py-3 text-left cursor-pointer"><span><b className="block text-sm text-white">Selecionar jogadores cadastrados</b><small className="text-zinc-500">{membros.length}/{ev.tamanho_equipe - 1} integrante(s) além do capitão</small></span>{listaAberta ? <ChevronUp className="w-4 h-4 text-primary" /> : <ChevronDown className="w-4 h-4 text-zinc-400" />}</button>
            {listaAberta && <div className="border-t border-zinc-800 max-h-60 overflow-y-auto p-2 space-y-1">{carregandoJogadores ? <div className="py-5 flex justify-center"><Spinner size="sm" /></div> : jogadores.filter(jogador => jogador.nick.toLowerCase() !== currentUser?.nick.toLowerCase()).map(jogador => { const selecionado = membrosSelecionados.some(nick => nick.toLowerCase() === jogador.nick.toLowerCase()); return <button type="button" key={jogador.id} onClick={() => alternarMembro(jogador, ev)} className={`w-full flex items-center gap-3 rounded-lg px-3 py-2 text-left cursor-pointer ${selecionado ? 'bg-primary/15 text-white' : 'text-zinc-300 hover:bg-zinc-900'}`}><span className={`grid place-items-center w-5 h-5 rounded border ${selecionado ? 'border-primary bg-primary text-white' : 'border-zinc-700'}`}>{selecionado && <Check className="w-3.5 h-3.5" />}</span><span className="min-w-0"><b className="block text-sm truncate">{jogador.nick}</b><small className="block text-[10px] text-zinc-500 truncate">{jogador.nome}</small></span></button>; })}</div>}</div>}
          <input value={nicks} onChange={e => setNicks(e.target.value)} placeholder={ev.tamanho_equipe === 1 ? 'Não precisa informar outros nicks' : 'Ou digite outros titulares, separados por vírgula (opcional)'} className="w-full rounded-lg bg-zinc-950 border border-zinc-800 px-3 py-2 text-sm text-white" />
          {ev.tamanho_equipe === 4 && <div className="rounded-xl border border-dashed border-accent-cyan/35 bg-accent-cyan/5 p-3 space-y-2"><div className="flex items-center justify-between gap-3"><span><b className="block text-xs text-white">Reservas da equipe</b><small className="text-[10px] text-zinc-400">Até 2 jogadores para CS 4x4 ou BR Squad. Eles não ocupam vaga titular.</small></span><span className="text-xs font-black text-accent-cyan">{reservasInformados().length}/2</span></div><button type="button" onClick={() => setListaReservasAberta(valor => !valor)} className="w-full flex items-center justify-between rounded-lg border border-accent-cyan/25 bg-zinc-950/55 px-3 py-2 text-left cursor-pointer"><span><b className="block text-xs text-white">Selecionar reservas cadastrados</b><small className="text-[10px] text-zinc-500">Abra a lista e escolha até dois jogadores.</small></span>{listaReservasAberta ? <ChevronUp className="w-4 h-4 text-accent-cyan" /> : <ChevronDown className="w-4 h-4 text-zinc-400" />}</button>{listaReservasAberta && <div className="max-h-52 overflow-y-auto rounded-lg border border-accent-cyan/20 bg-zinc-950/60 p-2 space-y-1">{carregandoJogadores ? <div className="py-4 flex justify-center"><Spinner size="sm" /></div> : jogadores.filter(jogador => jogador.nick.toLowerCase() !== currentUser?.nick.toLowerCase() && !membrosInformados().some(titular => titular.toLowerCase() === jogador.nick.toLowerCase())).map(jogador => { const selecionado = reservasSelecionados.some(nick => nick.toLowerCase() === jogador.nick.toLowerCase()); return <button type="button" key={jogador.id} onClick={() => alternarReserva(jogador)} className={`w-full flex items-center gap-3 rounded-lg px-3 py-2 text-left cursor-pointer ${selecionado ? 'bg-accent-cyan/15 text-white' : 'text-zinc-300 hover:bg-zinc-900'}`}><span className={`grid place-items-center w-5 h-5 rounded border ${selecionado ? 'border-accent-cyan bg-accent-cyan text-zinc-950' : 'border-zinc-700'}`}>{selecionado && <Check className="w-3.5 h-3.5" />}</span><span className="min-w-0"><b className="block text-sm truncate">{jogador.nick}</b><small className="block text-[10px] text-zinc-500 truncate">{jogador.nome}</small></span></button>; })}</div>}<input value={reservasNicks} onChange={e => setReservasNicks(e.target.value)} placeholder="Ou digite nicks dos reservas, separados por vírgula" className="w-full rounded-lg bg-zinc-950 border border-zinc-800 px-3 py-2 text-sm text-white" />{reservasInformados().length > 0 && <div className="flex flex-wrap gap-1.5">{reservasInformados().map(nick => <span key={nick} className="rounded-full border border-accent-cyan/30 bg-accent-cyan/10 px-2 py-1 text-[11px] text-accent-cyan">{nick}</span>)}</div>}</div>}
          {membros.length > 0 && <div className="flex flex-wrap gap-1.5">{membros.map(nick => <span key={nick} className="rounded-full border border-primary/30 bg-primary/10 px-2 py-1 text-[11px] text-primary">{nick}</span>)}</div>}<p className="text-[10px] text-zinc-500">Você é o capitão e entra automaticamente. A taxa é cobrada uma vez do capitão.</p><button disabled={busy} onClick={() => inscrever(ev)} className="w-full rounded-lg bg-primary py-2.5 text-sm font-bold text-white disabled:opacity-50 cursor-pointer">{busy ? 'Inscrevendo...' : 'Confirmar inscrição da equipe'}</button></div> : <button onClick={() => abrirInscricao(ev.id)} className="w-full rounded-xl bg-primary py-3 text-sm font-bold text-white cursor-pointer">Criar e inscrever equipe</button>}</>}
        <PlacarArena itens={ev.placar} />
        {ev.tipo === 'br' && minha?.slot_ff && <div className="rounded-xl border border-primary/35 bg-primary/5 p-3"><div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-lg bg-primary text-sm font-black text-white">{String(minha.slot_ff).padStart(2, '0')}</span><div><b className="block text-sm text-white">Seu slot no Free Fire</b><p className="text-[11px] text-zinc-400">Entre na sala usando este mesmo slot com toda a sua equipe.</p></div></div></div>}
        {ev.tipo === 'cs_4x4' && <ChaveCsPublica evento={ev} />}
      </section>;
    })}
    <p className="text-center text-[10px] text-zinc-600"><Shield className="inline w-3 h-3 mr-1" />A premiação da equipe é dividida igualmente e creditada aos integrantes após a revisão.</p>
  </div>;
}
