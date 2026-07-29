import { useCallback, useEffect, useRef, useState } from 'react';
import { CalendarDays, Check, ChevronDown, ChevronUp, Crown, ImagePlus, Link, Play, RefreshCw, Share2, Shield, Trophy, Upload, Users } from 'lucide-react';
import { apiService } from '../services/api';
import type { CampeonatoCriador, CriadorPerfil, CriadorRanking, Jogador, JogadorEquipeDisponivel } from '../services/api';
import { Spinner } from './Spinner';

interface Props {
  currentUser: Jogador | null;
  onAddToast: (type: 'success' | 'error' | 'warning' | 'info', title: string, desc?: string) => void;
}

const formatos = ['BR Solo', 'BR Duo', 'BR Squad', 'CS 1x1', 'CS 2x2', 'CS 3x3', 'CS 4x4'];
const brl = (valor: number) => `R$ ${(valor || 0).toFixed(2).replace('.', ',')}`;
const slugDoNome = (valor: string) => valor.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
const linkCriador = (slug: string, eventoSlug?: string) => `${window.location.origin}/#criador/${slug}${eventoSlug ? `/evento/${eventoSlug}` : ''}`;

async function compartilhar(titulo: string, texto: string, url: string, onOk: () => void) {
  if (navigator.share) { await navigator.share({ title: titulo, text: texto, url }); return; }
  await navigator.clipboard.writeText(url);
  onOk();
}

function InscricaoEquipeCriador({ evento, currentUser, onAddToast, aoConcluir }: { evento: CampeonatoCriador; currentUser: Jogador | null; onAddToast: Props['onAddToast']; aoConcluir: () => Promise<void> }) {
  const [aberto, setAberto] = useState(false); const [jogadores, setJogadores] = useState<JogadorEquipeDisponivel[]>([]);
  const [nome, setNome] = useState(''); const [guilda, setGuilda] = useState(''); const [logo, setLogo] = useState('');
  const [titulares, setTitulares] = useState<string[]>([]); const [reservas, setReservas] = useState<string[]>([]);
  const [listaTitulares, setListaTitulares] = useState(false); const [listaReservas, setListaReservas] = useState(false); const [busy, setBusy] = useState(false);
  const tamanho = evento.tamanho_equipe ?? 2;
  const abrir = async () => { setAberto(true); if (!jogadores.length) try { setJogadores(await apiService.listarJogadoresParaEquipe()); } catch { onAddToast('error', 'Lista indisponível', 'Não foi possível carregar os jogadores cadastrados.'); } };
  const alternar = (nick: string, reserva = false) => {
    if (!currentUser || nick.toLowerCase() === currentUser.nick.toLowerCase()) return;
    const atualizar = reserva ? setReservas : setTitulares; const atual = reserva ? reservas : titulares;
    if ((!reserva && reservas.some(item => item.toLowerCase() === nick.toLowerCase())) || (reserva && titulares.some(item => item.toLowerCase() === nick.toLowerCase()))) return;
    if (atual.includes(nick)) { atualizar(atual.filter(item => item !== nick)); return; }
    if (atual.length >= (reserva ? 2 : tamanho - 1)) { onAddToast('warning', 'Limite atingido', reserva ? 'Escolha no máximo 2 reservas.' : `Essa equipe precisa de ${tamanho} titulares contando o capitão.`); return; }
    atualizar([...atual, nick]);
  };
  const enviar = async () => { if (!currentUser) return; setBusy(true); try { const resposta = await apiService.inscreverEquipeEventoCriador(evento.id, nome, titulares, reservas, guilda, logo || undefined); onAddToast('success', 'Equipe inscrita', resposta.message); setAberto(false); await aoConcluir(); } catch (erro: any) { onAddToast('error', 'Não foi possível inscrever', erro.message); } finally { setBusy(false); } };
  const escolherLogo = (arquivo?: File) => { if (!arquivo) return; if (!['image/png', 'image/jpeg', 'image/webp'].includes(arquivo.type) || arquivo.size > 500 * 1024) { onAddToast('warning', 'Logo inválida', 'Use PNG, JPG ou WEBP de até 500 KB.'); return; } const leitor = new FileReader(); leitor.onload = () => setLogo(String(leitor.result ?? '')); leitor.readAsDataURL(arquivo); };
  if (!aberto) return <button disabled={!currentUser || evento.status !== 'inscricao'} onClick={abrir} className="rounded-lg bg-primary px-3 py-2 text-xs font-bold text-white disabled:opacity-40 cursor-pointer">Inscrever equipe</button>;
  const Lista = ({ reserva = false }: { reserva?: boolean }) => <div className="max-h-44 overflow-y-auto rounded-lg border border-zinc-800 bg-zinc-950/70 p-2 space-y-1">{jogadores.filter(j => j.nick.toLowerCase() !== currentUser?.nick.toLowerCase()).map(j => { const selecionado = (reserva ? reservas : titulares).includes(j.nick); const bloqueado = reserva ? titulares.includes(j.nick) : reservas.includes(j.nick); return <button key={j.id} type="button" disabled={bloqueado} onClick={() => alternar(j.nick, reserva)} className={`w-full flex items-center gap-2 rounded px-2 py-1.5 text-left text-xs disabled:opacity-30 ${selecionado ? 'bg-primary/15 text-white' : 'text-zinc-300 hover:bg-zinc-900'}`}><span className={`grid h-4 w-4 place-items-center rounded border ${selecionado ? 'border-primary bg-primary' : 'border-zinc-700'}`}>{selecionado && <Check className="w-3 h-3" />}</span><b>{j.nick}</b><small className="text-zinc-500">{j.nome}</small></button>; })}</div>;
  return <div className="w-full rounded-xl border border-primary/35 bg-primary/5 p-3 space-y-2"><p className="text-[10px] font-black uppercase tracking-wider text-primary">Monte sua equipe · {tamanho} titulares{tamanho === 4 ? ' + até 2 reservas' : ''}</p><input value={nome} onChange={e => setNome(e.target.value)} placeholder="Nome da equipe" className="ff-input w-full px-3 py-2 text-xs text-white" /><div className="grid sm:grid-cols-2 gap-2"><input value={guilda} onChange={e => setGuilda(e.target.value)} placeholder="Nome da guilda (opcional)" className="ff-input w-full px-3 py-2 text-xs text-white" /><label className="flex items-center justify-center gap-1 rounded-lg border border-dashed border-primary/40 px-3 py-2 text-xs font-bold text-primary cursor-pointer"><ImagePlus className="w-3.5 h-3.5" />{logo ? 'Emblema escolhido' : 'Logo da guilda'}<input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={e => escolherLogo(e.target.files?.[0])} /></label></div><button type="button" onClick={() => setListaTitulares(!listaTitulares)} className="w-full flex justify-between rounded-lg border border-zinc-800 px-3 py-2 text-left text-xs font-bold text-white cursor-pointer">Selecionar titulares ({titulares.length}/{tamanho - 1}) {listaTitulares ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}</button>{listaTitulares && <Lista />}{tamanho === 4 && <><button type="button" onClick={() => setListaReservas(!listaReservas)} className="w-full flex justify-between rounded-lg border border-accent-cyan/30 px-3 py-2 text-left text-xs font-bold text-accent-cyan cursor-pointer">Selecionar reservas ({reservas.length}/2) {listaReservas ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}</button>{listaReservas && <Lista reserva />}</>}<div className="flex flex-wrap gap-1">{titulares.map(nick => <span key={nick} className="rounded-full bg-primary/15 px-2 py-1 text-[10px] text-primary">{nick}</span>)}{reservas.map(nick => <span key={nick} className="rounded-full bg-accent-cyan/10 px-2 py-1 text-[10px] text-accent-cyan">{nick} · reserva</span>)}</div><button disabled={busy || !nome || titulares.length !== tamanho - 1} onClick={enviar} className="w-full rounded-lg bg-primary py-2 text-xs font-black text-white disabled:opacity-40 cursor-pointer">{busy ? 'Inscrevendo...' : 'Confirmar inscrição da equipe'}</button></div>;
}

function OperacaoEvento({ evento, aoAtualizar, onAddToast }: { evento: CampeonatoCriador; aoAtualizar: () => Promise<void>; onAddToast: Props['onAddToast'] }) {
  const [salaId, setSalaId] = useState(evento.sala_id ?? '');
  const [senha, setSenha] = useState(evento.sala_senha ?? '');
  const [linhas, setLinhas] = useState<Record<number, { colocacao: string; abates: string }>>({});
  const [busy, setBusy] = useState(false);
  const [ocr, setOcr] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const executar = async (acao: () => Promise<any>, titulo: string) => {
    setBusy(true);
    try { const resposta = await acao(); onAddToast('success', titulo, resposta?.message); await aoAtualizar(); }
    catch (erro: any) { onAddToast('error', 'Erro', erro.message); }
    finally { setBusy(false); }
  };
  const salvarResultado = () => {
    const equipes = evento.tipo_inscricao === 'equipe';
    const resultados = (equipes ? (evento.inscritos_equipes ?? []) : (evento.inscritos_jogadores ?? [])).map(item => ({
      ...(equipes ? { equipe_id: item.id } : { jogador_id: item.id }),
      colocacao: Number(linhas[item.id]?.colocacao),
      abates: Number(linhas[item.id]?.abates || 0),
    }));
    if (resultados.some(item => !item.colocacao) || new Set(resultados.map(item => item.colocacao)).size !== resultados.length) {
      onAddToast('warning', 'Placar incompleto', 'Informe posições diferentes para todos os inscritos.');
      return;
    }
    executar(() => apiService.salvarResultadoCriador(evento.id, resultados), 'Placar salvo');
  };
  const lerOcr = async (arquivo: File) => {
    setOcr(true);
    try {
      const resposta = await apiService.ocrEventoCriador(evento.id, arquivo);
      const novo: Record<number, { colocacao: string; abates: string }> = {};
      for (const item of resposta.resultados ?? []) {
        const id = item.equipe_id ?? item.jogador_id;
        if (id) novo[id] = { colocacao: String(item.colocacao || ''), abates: String(item.abates || 0) };
      }
      setLinhas(atual => ({ ...atual, ...novo }));
      onAddToast('success', 'OCR concluído', 'Revise o placar antes de salvar.');
    } catch (erro: any) { onAddToast('error', 'Erro no OCR', erro.message); }
    finally { setOcr(false); if (inputRef.current) inputRef.current.value = ''; }
  };

  if (evento.status !== 'em_andamento') return null;
  return <div className="mt-4 rounded-xl border border-primary/25 bg-primary/5 p-4 space-y-4">
    {evento.formato.startsWith('BR ') && <div className="rounded-xl border border-primary/35 bg-zinc-950/45 p-3"><p className="ff-kicker">Slots do lobby Free Fire</p><p className="mt-1 text-[10px] text-zinc-400">No Solo, cada jogador recebe um slot. Em Duo e Squad, a equipe entra junta no mesmo número.</p><div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{[...(evento.tipo_inscricao === 'equipe' ? (evento.inscritos_equipes ?? []) : (evento.inscritos_jogadores ?? []))].sort((a, b) => (a.slot_ff ?? 999) - (b.slot_ff ?? 999)).map(item => <div key={item.id} className="flex items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-950/60 px-2.5 py-2"><span className="grid h-7 w-7 place-items-center rounded bg-primary text-[11px] font-black text-white">{String(item.slot_ff ?? 0).padStart(2, '0')}</span><b className="truncate text-xs text-white">{'nome' in item ? item.nome : item.nick}</b></div>)}</div></div>}
    <div><p className="ff-kicker">Operação do campeonato</p><p className="text-xs text-zinc-400 mt-1">Libere a sala, use OCR para ler o print e envie o resultado para revisão.</p></div>
    <div className="grid sm:grid-cols-2 gap-2"><input value={salaId} onChange={e => setSalaId(e.target.value)} placeholder="ID da sala" className="ff-input px-3 py-2 text-sm text-white" /><input value={senha} onChange={e => setSenha(e.target.value)} placeholder="Senha da sala" className="ff-input px-3 py-2 text-sm text-white" /></div>
    <button disabled={busy} onClick={() => executar(() => apiService.definirSalaCriador(evento.id, salaId, senha), 'Sala liberada')} className="rounded-lg bg-zinc-800 px-3 py-2 text-xs font-bold text-white cursor-pointer">Salvar sala</button>
    <div className="rounded-xl border border-dashed border-zinc-700 p-3"><input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={e => e.target.files?.[0] && lerOcr(e.target.files[0])} /><button type="button" onClick={() => inputRef.current?.click()} className="flex items-center gap-2 text-xs font-bold text-zinc-200 cursor-pointer"><Upload className="w-4 h-4 text-primary" />{ocr ? 'OCR analisando print...' : evento.tipo_inscricao === 'equipe' ? 'Ler nicks FF e vincular às equipes' : 'Ler placar por OCR com IA'}</button>{evento.tipo_inscricao === 'equipe' && <p className="mt-2 text-[10px] text-zinc-500">O Free Fire mostra o nick do jogador. A IA usa os nicks abaixo para localizar a equipe; revise antes de salvar.</p>}</div>
    {evento.tipo_inscricao === 'equipe' && <div className="rounded-xl border border-zinc-800 bg-zinc-950/30 p-3"><p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Equipes e nicks usados pelo OCR</p><div className="mt-2 space-y-1.5">{(evento.inscritos_equipes ?? []).map(equipe => <div key={equipe.id} className="text-xs"><b className="text-white">{equipe.nome}</b><span className="ml-2 text-zinc-500">Nicks FF: {equipe.membros.map(membro => membro.nick).join(' · ')}</span>{(equipe.reservas?.length ?? 0) > 0 && <span className="ml-2 text-accent-cyan">Reservas: {equipe.reservas!.map(membro => membro.nick).join(' · ')}</span>}</div>)}</div></div>}
    <div className="space-y-2">{(evento.tipo_inscricao === 'equipe' ? (evento.inscritos_equipes ?? []) : (evento.inscritos_jogadores ?? [])).map(item => <div key={item.id} className="grid grid-cols-[1fr_76px_76px] gap-2 items-center"><span className="flex min-w-0 items-center gap-2 truncate text-xs font-bold text-white">{item.guilda?.logo_url && <img src={item.guilda.logo_url} alt="" className="h-6 w-6 rounded object-cover border border-primary/35" />}<span className="truncate">{'nome' in item ? item.nome : item.nick}{item.guilda?.nome && <small className="ml-1 text-[9px] text-primary">· {item.guilda.nome}</small>}</span></span><input type="number" min="1" placeholder="Pos." value={linhas[item.id]?.colocacao ?? ''} onChange={e => setLinhas(atual => ({ ...atual, [item.id]: { ...atual[item.id], colocacao: e.target.value } }))} className="ff-input w-full px-2 py-1.5 text-xs text-white" /><input type="number" min="0" placeholder="Abates" value={linhas[item.id]?.abates ?? ''} onChange={e => setLinhas(atual => ({ ...atual, [item.id]: { ...atual[item.id], abates: e.target.value } }))} className="ff-input w-full px-2 py-1.5 text-xs text-white" /></div>)}</div>
    <div className="flex flex-wrap gap-2"><button disabled={busy} onClick={salvarResultado} className="rounded-lg bg-primary px-3 py-2 text-xs font-bold text-white cursor-pointer">Salvar placar</button><button disabled={busy} onClick={() => executar(() => apiService.enviarCriadorParaRevisao(evento.id), 'Enviado para revisão')} className="rounded-lg bg-amber-400 px-3 py-2 text-xs font-bold text-zinc-950 cursor-pointer">Enviar ao FlowFire</button></div>
  </div>;
}

export function Criadores({ currentUser, onAddToast }: Props) {
  const [aba, setAba] = useState<'descobrir' | 'painel'>('descobrir');
  const [ranking, setRanking] = useState<CriadorRanking[]>([]);
  const [eventos, setEventos] = useState<CampeonatoCriador[]>([]);
  const [meu, setMeu] = useState<{ criador: CriadorPerfil | null; eventos: CampeonatoCriador[] }>({ criador: null, eventos: [] });
  const [perfilVisitado, setPerfilVisitado] = useState<{ criador: CriadorPerfil; eventos: CampeonatoCriador[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [slug, setSlug] = useState('');
  const [bio, setBio] = useState('');
  const [nome, setNome] = useState('');
  const [formato, setFormato] = useState('BR Solo');
  const [descricao, setDescricao] = useState('');
  const [vagas, setVagas] = useState('48');
  const [taxa, setTaxa] = useState('3');
  const [premios, setPremios] = useState('60, 30');
  const [parteCriador, setParteCriador] = useState('10');
  const [dataHora, setDataHora] = useState('');

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const partes = window.location.hash.split('/');
      const slugVisitado = partes[1] === 'criador' ? partes[2] : '';
      const [rank, abertos, dados, perfil] = await Promise.all([
        apiService.rankingCriadores(), apiService.eventosCriadoresAbertos(),
        currentUser ? apiService.meuCriador() : Promise.resolve({ criador: null, eventos: [] }),
        slugVisitado ? apiService.perfilCriador(slugVisitado).catch(() => null) : Promise.resolve(null),
      ]);
      setRanking(rank); setEventos(abertos); setMeu(dados); setPerfilVisitado(perfil);
      if (dados.criador) { setSlug(dados.criador.slug); setBio(dados.criador.bio ?? ''); }
    } catch (erro: any) { onAddToast('error', 'Erro ao carregar criadores', erro.message); }
    finally { setLoading(false); }
  }, [currentUser, onAddToast]);

  useEffect(() => { carregar(); }, [carregar]);

  const executar = async (acao: () => Promise<any>, titulo: string) => {
    setBusy(true);
    try { const resposta = await acao(); onAddToast('success', titulo, resposta?.message); await carregar(); }
    catch (erro: any) { onAddToast('error', 'Não foi possível concluir', erro.message); }
    finally { setBusy(false); }
  };
  const criar = () => {
    const percentuais = premios.split(',').map(item => Number(item.trim())).filter(valor => valor > 0);
    executar(() => apiService.criarEventoCriador({ nome, slug: slugDoNome(nome), formato, descricao, max_jogadores: Number(vagas), taxa_inscricao: Number(taxa), premios_percentuais: percentuais, percentual_criador: Number(parteCriador), data_hora: dataHora }), 'Campeonato criado como rascunho');
  };
  const compartilharEvento = (evento: CampeonatoCriador) => compartilhar(evento.nome, `Confira o ranking do campeonato ${evento.nome} no FlowFire.`, linkCriador(evento.criador.slug, evento.slug), () => onAddToast('success', 'Link copiado', 'Envie o resultado onde quiser.'));
  const copiarPerfil = () => navigator.clipboard.writeText(linkCriador(meu.criador?.slug ?? slug)).then(() => onAddToast('success', 'Link copiado', 'Seu link personalizado está pronto para divulgar.'));

  if (loading) return <div className="py-16 flex justify-center"><Spinner size="md" className="text-primary" /></div>;

  const formatoEmEquipe = formato === 'BR Duo' || formato === 'BR Squad' || /^CS [2-4]x[2-4]$/.test(formato);
  const tamanhoDaEquipe = formato === 'BR Duo' ? 2 : formato === 'BR Squad' ? 4 : Number(formato.match(/CS (\d)x/)?.[1] ?? 1);
  const painelCriador = !currentUser ? <div className="ff-card p-7 text-center"><Shield className="w-9 h-9 text-primary mx-auto mb-3" /><h2 className="font-black text-white">Entre para criar campeonatos</h2><p className="text-xs text-zinc-500 mt-2">Faça login e solicite seu perfil de criador.</p></div>
    : !meu.criador ? <div className="ff-card p-5 max-w-xl"><p className="ff-kicker">Primeiro passo</p><h2 className="text-xl font-black text-white mt-1">SOLICITAR PERFIL DE CRIADOR</h2><p className="text-xs text-zinc-400 mt-2">O FlowFire revisa seu perfil antes de liberar a publicação de campeonatos.</p><div className="space-y-3 mt-4"><input value={slug} onChange={e => setSlug(e.target.value)} placeholder="seu-link-personalizado" className="ff-input w-full px-3 py-2 text-sm text-white" /><textarea value={bio} onChange={e => setBio(e.target.value)} placeholder="Conte sobre seus campeonatos" className="ff-input w-full px-3 py-2 text-sm text-white min-h-24" /><button disabled={busy} onClick={() => executar(() => apiService.solicitarCriador({ slug, bio }), 'Solicitação enviada')} className="ff-btn-primary rounded-lg px-4 py-2.5 text-sm font-bold cursor-pointer">Enviar para aprovação</button></div></div>
    : meu.criador.status !== 'aprovado' ? <div className="ff-card p-7 text-center"><Crown className="w-9 h-9 text-amber-400 mx-auto mb-3" /><h2 className="font-black text-white">Perfil em análise</h2><p className="text-xs text-zinc-500 mt-2">Seu link @{meu.criador.slug} será liberado após a aprovação do FlowFire.</p></div>
    : <>
      <div className="ff-card p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4"><div><p className="ff-kicker">Criador aprovado</p><h2 className="text-xl font-black text-white">@{meu.criador.slug}</h2><p className="text-xs text-zinc-400 mt-1">{meu.criador.bio || 'Seu perfil público de criador.'}</p></div><button onClick={copiarPerfil} className="rounded-lg border border-primary/40 bg-primary/10 px-4 py-2 text-xs font-bold text-primary cursor-pointer"><Link className="inline w-3.5 h-3.5 mr-1" />Copiar link</button></div>
      <section className="ff-card ff-creator-create p-5 space-y-4">
        <div className="flex items-center justify-between gap-3 border-b border-zinc-800 pb-3"><div><p className="ff-kicker">Nenhum campeonato ativo</p><h2 className="text-lg font-black text-white mt-1">CRIE SEU CAMP</h2></div><Crown className="w-6 h-6 text-primary" /></div>
        <p className="text-xs text-primary font-bold">Seu link FlowFire: {linkCriador(meu.criador.slug, slugDoNome(nome || 'nome-do-campeonato'))}</p>
        <div className="grid md:grid-cols-3 gap-3">
          <label><span>NOME</span><input value={nome} onChange={e => setNome(e.target.value)} placeholder="Crie seu camp" className="ff-input w-full px-3 py-2 text-sm text-white" /></label>
          <label><span>MODALIDADE</span><select value={formato} onChange={e => setFormato(e.target.value)} className="ff-input w-full px-3 py-2 text-sm text-white">{formatos.map(item => <option key={item}>{item}</option>)}</select></label>
          <label><span>{formatoEmEquipe ? 'VAGAS DE EQUIPES' : 'VAGAS DE JOGADORES'}</span><input value={vagas} onChange={e => setVagas(e.target.value)} type="number" min="2" placeholder="48" className="ff-input w-full px-3 py-2 text-sm text-white" /></label>
          <label><span>DATA E HORA</span><input value={dataHora} onChange={e => setDataHora(e.target.value)} placeholder="Ex.: 15/07 às 20:00" className="ff-input w-full px-3 py-2 text-sm text-white" /></label>
          <label><span>{formatoEmEquipe ? 'ENTRADA POR EQUIPE (R$)' : 'ENTRADA POR JOGADOR (R$)'}</span><input value={taxa} onChange={e => setTaxa(e.target.value)} type="number" min="0" step="0.01" placeholder="3,00" className="ff-input w-full px-3 py-2 text-sm text-white" /></label>
          <div className="ff-creator-info"><Users className="w-4 h-4" /><span>{formatoEmEquipe ? `Inscrição por equipe: capitão escolhe ${tamanhoDaEquipe - 1} titular(es) cadastrado(s)${tamanhoDaEquipe === 4 ? ' e até 2 reservas' : ''}.` : 'Inscrição individual: cada jogador entra com sua própria conta.'}</span></div>
        </div>
        <label><span>DESCRIÇÃO E REGRAS</span><textarea value={descricao} onChange={e => setDescricao(e.target.value)} placeholder="Informe mapa, horário, regras, pontuação e proibições." className="ff-input w-full px-3 py-2 text-sm text-white min-h-24" /></label>
        <div className="ff-creator-notice"><CalendarDays className="w-4 h-4" /> Defina os prêmios abaixo. Os vencedores e sua parte devem dividir os 88% guardados no cofre.</div>
        <div className="grid sm:grid-cols-2 gap-3"><label><span>PRÊMIOS EM %</span><input value={premios} onChange={e => setPremios(e.target.value)} placeholder="Ex.: 60, 30" className="ff-input w-full px-3 py-2 text-sm text-white" /></label><label><span>SUA PARTE EM %</span><input value={parteCriador} onChange={e => setParteCriador(e.target.value)} type="number" min="0" placeholder="10" className="ff-input w-full px-3 py-2 text-sm text-white" /></label></div>
        <p className="text-[10px] text-zinc-400">Exemplo: prêmios 60, 30 e sua parte 10. Juntos, eles formam 100% dos 88% do cofre. O FlowFire retém 12% da arrecadação.</p>
        <button disabled={busy} onClick={criar} className="w-full flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-primary text-white font-bold text-sm hover:opacity-90 transition-all cursor-pointer disabled:opacity-50"><Crown className="w-4 h-4" />Criar meu campeonato</button>
      </section>
      <section className="space-y-3"><h2 className="text-lg font-black text-white">MEUS CAMPEONATOS</h2>{meu.eventos.length ? meu.eventos.map(evento => <article key={evento.id} className="ff-card p-5"><div className="flex flex-wrap justify-between gap-3"><div><span className="ff-kicker">{evento.status.replaceAll('_', ' ')}</span><h3 className="font-black text-white">{evento.nome}</h3><p className="text-xs text-zinc-500">{evento.inscritos} inscritos · cofre {brl(evento.cofre_evento)} · FlowFire {brl(evento.taxa_flowfire)}</p></div><div className="flex flex-wrap gap-2 items-start">{evento.status === 'rascunho' && <button disabled={busy} onClick={() => executar(() => apiService.publicarEventoCriador(evento.id), 'Campeonato publicado')} className="rounded-lg bg-primary px-3 py-2 text-xs font-bold text-white cursor-pointer">Publicar</button>}{evento.status === 'inscricao' && <><button onClick={() => compartilharEvento(evento)} className="rounded-lg border border-primary/40 bg-primary/10 px-3 py-2 text-xs font-bold text-primary cursor-pointer"><Share2 className="inline w-3.5 h-3.5 mr-1" />Compartilhar</button><button disabled={busy} onClick={() => executar(() => apiService.iniciarEventoCriador(evento.id), 'Campeonato iniciado')} className="rounded-lg bg-emerald-500 px-3 py-2 text-xs font-bold text-zinc-950 cursor-pointer"><Play className="inline w-3.5 h-3.5 mr-1" />Iniciar</button><button disabled={busy} onClick={() => executar(() => apiService.cancelarEventoCriador(evento.id), 'Campeonato cancelado')} className="rounded-lg border border-rose-500/40 px-3 py-2 text-xs font-bold text-rose-400 cursor-pointer">Cancelar</button></>}</div></div><OperacaoEvento evento={evento} aoAtualizar={carregar} onAddToast={onAddToast} /></article>) : <p className="text-sm text-zinc-500">Crie seu primeiro campeonato para aparecer aqui.</p>}</section>
    </>;

  return <div className="max-w-6xl mx-auto space-y-6">
    <div className="ff-hero ff-ranking-hero"><div className="relative z-10"><p className="ff-kicker">FlowFire Creator Hub</p><h1 className="text-3xl sm:text-5xl font-black text-white mt-2">CAMPEONATOS CRIADOS<br /><span className="text-primary">PELA COMUNIDADE.</span></h1><p className="text-sm text-zinc-300 mt-3 max-w-xl">Crie, divulgue e administre seus próprios campeonatos com cofre protegido, OCR por IA e revisão do FlowFire.</p></div></div>
    <div className="ff-command-tabs max-w-md"><button onClick={() => setAba('descobrir')} className={`flex-1 px-3 py-2 text-xs font-black uppercase cursor-pointer ${aba === 'descobrir' ? 'is-active' : ''}`}>Descobrir</button><button onClick={() => setAba('painel')} className={`flex-1 px-3 py-2 text-xs font-black uppercase cursor-pointer ${aba === 'painel' ? 'is-active' : ''}`}>Meu painel</button></div>
    {aba === 'descobrir' ? <>
      {perfilVisitado && <section className="ff-card p-5 border-primary/35"><p className="ff-kicker">Perfil compartilhado</p><h2 className="text-2xl font-black text-white">@{perfilVisitado.criador.slug}</h2><p className="text-xs text-zinc-400 mt-1">{perfilVisitado.criador.bio || 'Criador oficial FlowFire'}</p><div className="mt-3 flex flex-wrap gap-2">{perfilVisitado.eventos.map(evento => <span key={evento.id} className="rounded-lg border border-zinc-700 px-2.5 py-1.5 text-xs text-zinc-300">{evento.nome} · {evento.status.replaceAll('_', ' ')}</span>)}</div></section>}
      <div className="grid lg:grid-cols-[1.25fr_.75fr] gap-5"><section className="space-y-4"><div className="flex items-center justify-between"><h2 className="text-xl font-black text-white">Eventos abertos</h2><button onClick={carregar} className="p-2 text-zinc-400 cursor-pointer"><RefreshCw className="w-4 h-4" /></button></div>{eventos.length ? eventos.map(evento => <article key={evento.id} className="ff-card p-5 space-y-3"><div className="flex justify-between gap-3"><div><span className="ff-kicker">por @{evento.criador.slug}</span><h3 className="text-lg font-black text-white">{evento.nome}</h3><p className="text-xs text-zinc-400">{evento.formato} · {evento.inscritos}/{evento.max_jogadores} {evento.tipo_inscricao === 'equipe' ? 'equipes' : 'jogadores'}</p></div><div className="text-right"><b className="text-emerald-400">{brl(evento.taxa_inscricao)}</b><p className="text-[10px] text-zinc-500">por {evento.tipo_inscricao === 'equipe' ? 'equipe' : 'jogador'}</p></div></div><div className="flex flex-wrap gap-2 text-[10px]"><span className="px-2 py-1 rounded bg-primary/10 text-primary">88% no cofre</span>{evento.tipo_inscricao === 'equipe' && <span className="px-2 py-1 rounded bg-accent-cyan/10 text-accent-cyan">{evento.tamanho_equipe} por equipe</span>}<span className="px-2 py-1 rounded bg-zinc-950 border border-zinc-800 text-zinc-400">{evento.status.replaceAll('_', ' ')}</span></div><div className="flex flex-wrap gap-2">{evento.tipo_inscricao === 'equipe' ? <InscricaoEquipeCriador evento={evento} currentUser={currentUser} onAddToast={onAddToast} aoConcluir={carregar} /> : <button disabled={!currentUser || evento.status !== 'inscricao'} onClick={() => executar(() => apiService.inscreverEventoCriador(evento.id), 'Inscrição confirmada')} className="rounded-lg bg-primary px-3 py-2 text-xs font-bold text-white disabled:opacity-40 cursor-pointer">Inscrever-se</button>}<button onClick={() => compartilharEvento(evento)} className="rounded-lg border border-zinc-700 px-3 py-2 text-xs font-bold text-zinc-200 cursor-pointer"><Share2 className="inline w-3.5 h-3.5 mr-1" />Compartilhar</button></div>{evento.tipo_inscricao === 'equipe' ? (evento.placar_equipes?.length ?? 0) > 0 && <div className="border-t border-zinc-800 pt-2 space-y-1">{evento.placar_equipes!.slice(0, 3).map(item => <div key={item.equipe_id} className="text-xs text-zinc-300"><b className="text-accent-cyan">{item.colocacao}º</b> {item.equipe} · {item.abates} abates</div>)}</div> : evento.placar.length > 0 && <div className="border-t border-zinc-800 pt-2 space-y-1">{evento.placar.slice(0, 3).map(item => <div key={item.jogador_id} className="text-xs text-zinc-300"><b className="text-accent-cyan">{item.colocacao}º</b> {item.nick} · {item.abates} abates</div>)}</div>}</article>) : <div className="ff-card p-8 text-center text-sm text-zinc-500">Nenhum evento de criador aberto agora.</div>}</section><aside className="ff-card p-5"><p className="ff-kicker">Ranking de criadores</p><h2 className="text-xl font-black text-white mt-2 mb-4">CRIADORES EM ALTA</h2><div className="space-y-2">{ranking.length ? ranking.slice(0, 10).map(item => <div key={item.slug} className="flex items-center gap-3 rounded-lg border border-zinc-800 bg-zinc-950/35 p-3"><b className="text-primary w-5">#{item.posicao}</b><div className="min-w-0 flex-1"><b className="block text-sm text-white truncate">{item.nick}</b><span className="text-[10px] text-zinc-500">{item.eventos_concluidos} eventos · {item.participantes} jogadores</span></div><Trophy className="w-4 h-4 text-accent-cyan" /></div>) : <p className="text-xs text-zinc-500">O ranking começa quando os primeiros criadores concluírem eventos.</p>}</div></aside></div>
    </> : <section className="space-y-5">{painelCriador}</section>}
  </div>;
}
