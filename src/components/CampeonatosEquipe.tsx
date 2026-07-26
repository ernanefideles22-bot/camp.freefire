import { useCallback, useEffect, useState } from 'react';
import { Check, ChevronDown, ChevronUp, ImagePlus, Shield, Swords, Users, Trophy, RefreshCw } from 'lucide-react';
import { apiService } from '../services/api';
import type { CampeonatoEquipe, EquipeCampeonato, Jogador, JogadorEquipeDisponivel } from '../services/api';
import { Spinner } from './Spinner';

interface Props {
  currentUser: Jogador | null;
  onAddToast: (type: 'success' | 'error' | 'warning' | 'info', title: string, desc?: string) => void;
}

const moeda = (valor: number) => `R$ ${valor.toFixed(2).replace('.', ',')}`;
const formato = (ev: CampeonatoEquipe) => ev.tipo === 'cs_4x4' ? `CS ${ev.tamanho_equipe}x${ev.tamanho_equipe}` : `BR ${ev.modo[0].toUpperCase()}${ev.modo.slice(1)}`;

export function CampeonatosEquipe({ currentUser, onAddToast }: Props) {
  const [campeonatos, setCampeonatos] = useState<CampeonatoEquipe[]>([]);
  const [minhasEquipes, setMinhasEquipes] = useState<Record<number, EquipeCampeonato | null>>({});
  const [loading, setLoading] = useState(true);
  const [abrir, setAbrir] = useState<number | null>(null);
  const [nomeEquipe, setNomeEquipe] = useState('');
  const [nomeGuilda, setNomeGuilda] = useState('');
  const [logoData, setLogoData] = useState('');
  const [nicks, setNicks] = useState('');
  const [jogadores, setJogadores] = useState<JogadorEquipeDisponivel[]>([]);
  const [membrosSelecionados, setMembrosSelecionados] = useState<string[]>([]);
  const [listaAberta, setListaAberta] = useState(false);
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
    setAbrir(eventoId); setNomeEquipe(''); setNomeGuilda(''); setLogoData(''); setNicks(''); setMembrosSelecionados([]); setListaAberta(false);
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

  const inscrever = async (ev: CampeonatoEquipe) => {
    if (!currentUser) { onAddToast('warning', 'Faça login', 'Entre para criar sua equipe.'); return; }
    setBusy(true);
    try {
      const membros = membrosInformados();
      await apiService.inscreverEquipe(ev.id, nomeEquipe, membros, nomeGuilda, logoData || undefined);
      onAddToast('success', 'Equipe inscrita', `A inscrição de ${nomeEquipe} foi confirmada.`);
      setAbrir(null); setNomeEquipe(''); setNomeGuilda(''); setLogoData(''); setNicks(''); setMembrosSelecionados([]); await carregar();
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
        {minha ? <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/5 p-3 text-xs space-y-2"><div className="flex items-center gap-2">{minha.guilda?.logo_url && <img src={minha.guilda.logo_url} alt="Logo da guilda" className="w-8 h-8 rounded-lg object-cover border border-primary/40" />}<div><b className="text-emerald-400">Sua equipe: {minha.nome}</b>{minha.guilda?.nome && <span className="ml-1 text-primary">· {minha.guilda.nome}</span>}<span className="text-zinc-400"> — {minha.membros.map(m => m.nick).join(', ')}</span></div></div>{(minha.salas?.length ?? 0) > 0 && <div className="flex flex-wrap gap-2">{minha.salas!.map(sala => <span key={sala.ordem} className="px-2 py-1 rounded bg-zinc-950 border border-zinc-800 text-zinc-300">R{sala.ordem}: <b>{sala.sala_id}</b> · {sala.senha}</span>)}</div>}</div> : emInscricao && <>{abrir === ev.id ? <div className="rounded-xl border border-zinc-800 bg-zinc-950/40 p-4 space-y-3"><input value={nomeEquipe} onChange={e => setNomeEquipe(e.target.value)} placeholder="Nome da equipe" className="w-full rounded-lg bg-zinc-950 border border-zinc-800 px-3 py-2 text-sm text-white" />
          <div className="grid sm:grid-cols-[1fr_auto] gap-2"><input value={nomeGuilda} onChange={e => setNomeGuilda(e.target.value)} placeholder="Nome da guilda (opcional)" className="w-full rounded-lg bg-zinc-950 border border-zinc-800 px-3 py-2 text-sm text-white" /><label className="flex items-center justify-center gap-2 rounded-lg border border-dashed border-primary/45 bg-primary/5 px-3 py-2 text-xs font-bold text-primary cursor-pointer"><ImagePlus className="w-4 h-4" />{logoData ? 'Trocar emblema' : 'Logo da guilda'}<input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={e => selecionarLogo(e.target.files?.[0])} /></label></div>
          {logoData && <div className="flex items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-950/50 p-2"><img src={logoData} alt="Prévia do emblema" className="w-10 h-10 rounded-lg object-cover" /><span className="text-[11px] text-zinc-400">Este emblema aparecerá nos campeonatos e no ranking da guilda.</span><button type="button" onClick={() => setLogoData('')} className="ml-auto text-[10px] font-bold text-rose-400 cursor-pointer">Remover</button></div>}
          {ev.tamanho_equipe > 1 && <div className="rounded-xl border border-zinc-800 bg-zinc-950/30 overflow-hidden"><button type="button" onClick={() => setListaAberta(valor => !valor)} className="w-full flex items-center justify-between gap-3 px-3 py-3 text-left cursor-pointer"><span><b className="block text-sm text-white">Selecionar jogadores cadastrados</b><small className="text-zinc-500">{membros.length}/{ev.tamanho_equipe - 1} integrante(s) além do capitão</small></span>{listaAberta ? <ChevronUp className="w-4 h-4 text-primary" /> : <ChevronDown className="w-4 h-4 text-zinc-400" />}</button>
            {listaAberta && <div className="border-t border-zinc-800 max-h-60 overflow-y-auto p-2 space-y-1">{carregandoJogadores ? <div className="py-5 flex justify-center"><Spinner size="sm" /></div> : jogadores.filter(jogador => jogador.nick.toLowerCase() !== currentUser?.nick.toLowerCase()).map(jogador => { const selecionado = membrosSelecionados.some(nick => nick.toLowerCase() === jogador.nick.toLowerCase()); return <button type="button" key={jogador.id} onClick={() => alternarMembro(jogador, ev)} className={`w-full flex items-center gap-3 rounded-lg px-3 py-2 text-left cursor-pointer ${selecionado ? 'bg-primary/15 text-white' : 'text-zinc-300 hover:bg-zinc-900'}`}><span className={`grid place-items-center w-5 h-5 rounded border ${selecionado ? 'border-primary bg-primary text-white' : 'border-zinc-700'}`}>{selecionado && <Check className="w-3.5 h-3.5" />}</span><span className="min-w-0"><b className="block text-sm truncate">{jogador.nick}</b><small className="block text-[10px] text-zinc-500 truncate">{jogador.nome}</small></span></button>; })}</div>}</div>}
          <input value={nicks} onChange={e => setNicks(e.target.value)} placeholder={ev.tamanho_equipe === 1 ? 'Não precisa informar outros nicks' : 'Ou digite outros nicks, separados por vírgula (opcional)'} className="w-full rounded-lg bg-zinc-950 border border-zinc-800 px-3 py-2 text-sm text-white" />
          {membros.length > 0 && <div className="flex flex-wrap gap-1.5">{membros.map(nick => <span key={nick} className="rounded-full border border-primary/30 bg-primary/10 px-2 py-1 text-[11px] text-primary">{nick}</span>)}</div>}<p className="text-[10px] text-zinc-500">Você é o capitão e entra automaticamente. A taxa é cobrada uma vez do capitão.</p><button disabled={busy} onClick={() => inscrever(ev)} className="w-full rounded-lg bg-primary py-2.5 text-sm font-bold text-white disabled:opacity-50 cursor-pointer">{busy ? 'Inscrevendo...' : 'Confirmar inscrição da equipe'}</button></div> : <button onClick={() => abrirInscricao(ev.id)} className="w-full rounded-xl bg-primary py-3 text-sm font-bold text-white cursor-pointer">Criar e inscrever equipe</button>}</>}
        {ev.placar.length > 0 && <div className="border-t border-zinc-800 pt-3 space-y-1"><p className="text-[10px] font-bold uppercase text-zinc-500"><Trophy className="inline w-3 h-3 mr-1" />Placar</p>{ev.placar.map(item => <div key={item.equipe_id} className="flex items-center text-xs py-1"><span className="w-8 text-zinc-500">{item.posicao}º</span>{item.guilda?.logo_url && <img src={item.guilda.logo_url} alt="" className="mr-2 w-6 h-6 rounded object-cover border border-primary/35" />}<span className="flex-1 font-bold text-white">{item.equipe}{item.guilda?.nome && <small className="ml-1 text-[9px] text-primary">· {item.guilda.nome}</small>}</span><span className="text-zinc-400">{item.pontos} pts · {item.abates} abates</span></div>)}</div>}
      </section>;
    })}
    <p className="text-center text-[10px] text-zinc-600"><Shield className="inline w-3 h-3 mr-1" />A premiação da equipe é dividida igualmente e creditada aos integrantes após a revisão.</p>
  </div>;
}
