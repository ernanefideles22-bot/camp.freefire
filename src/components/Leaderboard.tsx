import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Crown, RefreshCw, Share2, ShieldAlert, Swords, Trophy, Users } from 'lucide-react';
import { apiService } from '../services/api';
import type { LinhaMuralRanking, MuralRanking } from '../services/api';
import { Spinner } from './Spinner';

interface LeaderboardProps {
  onAddToast: (type: 'success' | 'error' | 'warning' | 'info', title: string, desc?: string) => void;
}

type Area = 'individual' | 'equipes' | 'criadores';

const areas: { id: Area; titulo: string; descricao: string; icone: typeof Trophy }[] = [
  { id: 'individual', titulo: 'Individual', descricao: 'BR Solo, quedas e eventos individuais', icone: Trophy },
  { id: 'equipes', titulo: 'Equipes / CS', descricao: 'Times de 1x1 até 4x4', icone: Swords },
  { id: 'criadores', titulo: 'Criadores', descricao: 'Eventos aprovados pela comunidade', icone: Crown },
];

const dinheiro = (valor: number) => `R$ ${(valor || 0).toFixed(2).replace('.', ',')}`;

export const Leaderboard: React.FC<LeaderboardProps> = ({ onAddToast }) => {
  const [mural, setMural] = useState<MuralRanking | null>(null);
  const [area, setArea] = useState<Area>('individual');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [connected, setConnected] = useState(true);
  const [countdown, setCountdown] = useState(30);

  const carregar = useCallback(async (manual = false) => {
    if (manual) setRefreshing(true); else setLoading(true);
    try {
      setMural(await apiService.obterMuralRanking());
      setConnected(true); setCountdown(30);
      if (manual) onAddToast('success', 'Mural atualizado', 'O ranking da temporada foi atualizado.');
    } catch {
      setConnected(false);
      if (manual) onAddToast('error', 'Não foi possível atualizar', 'Tente novamente em alguns instantes.');
    } finally { setLoading(false); setRefreshing(false); }
  }, [onAddToast]);

  useEffect(() => { carregar(); }, [carregar]);
  useEffect(() => {
    const relogio = window.setInterval(() => setCountdown(anterior => anterior <= 1 ? 30 : anterior - 1), 1000);
    const atualizador = window.setInterval(() => carregar(), 30000);
    return () => { window.clearInterval(relogio); window.clearInterval(atualizador); };
  }, [carregar]);

  const linhas = mural?.[area] ?? [];
  const configuracao = useMemo(() => areas.find(item => item.id === area)!, [area]);
  const nomeLinha = (linha: LinhaMuralRanking) => linha.jogador || linha.equipe || linha.criador || linha.nick || 'Participante';
  const primeiro = area === 'criadores' ? 'Eventos' : 'Pontos';
  const segundo = area === 'criadores' ? 'Participantes' : 'Abates';
  const terceiro = area === 'criadores' ? 'Situação' : 'Partidas';

  const compartilhar = async () => {
    const texto = `Confira o Mural dos Campeões da ${mural?.temporada.nome ?? 'temporada'} no FlowFire.`;
    try {
      if (navigator.share) await navigator.share({ title: 'FlowFire Champions', text: texto, url: window.location.href });
      else { await navigator.clipboard.writeText(window.location.href); onAddToast('success', 'Link copiado', 'Envie o ranking para sua equipe.'); }
    } catch { /* compartilhamento cancelado pelo jogador */ }
  };

  const medalha = (posicao: number) => <span className={`ff-rank-medal rank-${Math.min(posicao, 4)}`}>{posicao <= 3 ? `${posicao}º` : `${posicao}º`}</span>;

  if (loading && !mural) return <div className="min-h-[400px] grid place-items-center"><div className="text-center"><Spinner size="lg" /><p className="mt-4 text-sm text-zinc-400">Preparando o Mural dos Campeões...</p></div></div>;

  return <div className="space-y-6 ff-ranking-shell">
    <section className="ff-hero ff-ranking-hero ff-mural-hero flex flex-col lg:flex-row lg:items-end lg:justify-between gap-5">
      <div className="relative z-10"><p className="ff-kicker">FlowFire // Arena competitiva</p><h2 className="mt-2 flex items-center gap-2 text-3xl font-black tracking-tight text-white"><Trophy className="w-7 h-7 text-primary animate-neon" />MURAL DOS CAMPEÕES</h2><p className="mt-2 text-sm text-zinc-300">Ranking oficial por área. Resultados em revisão aparecem como provisórios.</p></div>
      <div className="relative z-10 flex flex-wrap items-center gap-2"><span className="ff-season-pill"><span />{mural?.temporada.nome ?? 'Nova temporada'}</span><span className={`ff-api-pill ${connected ? 'is-online' : 'is-offline'}`}>{connected ? 'Ranking conectado' : <><ShieldAlert className="w-3.5 h-3.5" /> Sem conexão</>}</span><span className="hidden sm:inline text-[11px] text-zinc-500 font-mono">Atualiza em {countdown}s</span><button onClick={() => carregar(true)} disabled={refreshing} className="ff-mural-action"><RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />Atualizar</button></div>
    </section>

    <section className="ff-ranking-tabs" aria-label="Área do ranking">{areas.map(item => { const Icone = item.icone; return <button key={item.id} onClick={() => setArea(item.id)} className={area === item.id ? 'is-active' : ''}><Icone className="w-4 h-4" /><span><b>{item.titulo}</b><small>{item.descricao}</small></span></button>; })}</section>

    <section className="ff-card overflow-hidden ff-mural-table">
      <div className="ff-mural-table-head"><div><p className="ff-kicker">{configuracao.titulo}</p><h3>{mural?.temporada.nome ?? 'Temporada em preparação'}</h3></div><button onClick={compartilhar} className="ff-mural-share"><Share2 className="w-4 h-4" />Compartilhar ranking</button></div>
      {linhas.length === 0 ? <div className="ff-mural-empty"><Trophy className="w-11 h-11" /><h3>O placar está zerado.</h3><p>A nova temporada começou agora. O primeiro resultado aprovado será o primeiro registro do Mural dos Campeões.</p></div> : <div className="overflow-x-auto"><table className="w-full text-left border-collapse"><thead><tr><th>Pos</th><th>{area === 'equipes' ? 'Equipe' : area === 'criadores' ? 'Criador' : 'Jogador'}</th><th className="text-right">{primeiro}</th><th className="text-right">{segundo}</th><th className="text-right hidden sm:table-cell">{terceiro}</th><th className="text-right">Ganhos (R$)</th></tr></thead><tbody>{linhas.map(linha => <tr key={`${area}-${linha.posicao}-${nomeLinha(linha)}`}><td>{medalha(linha.posicao)}</td><td><b className="text-white">{nomeLinha(linha)}</b>{linha.status === 'provisorio' && <span className="ff-provisional">provisório</span>}</td><td className="text-right text-white font-bold">{linha.pontos}{area !== 'criadores' && ' pts'}</td><td className="text-right text-zinc-300">{area === 'criadores' ? linha.partidas : linha.abates}</td><td className="text-right hidden sm:table-cell text-zinc-400">{area === 'criadores' ? (linha.status === 'oficial' ? 'Oficial' : 'Em revisão') : linha.partidas}</td><td className="text-right font-black text-accent-cyan">{dinheiro(linha.ganhos)}</td></tr>)}</tbody></table></div>}
    </section>

    <section className="ff-ranking-rules"><Users className="w-5 h-5 text-primary" /><p><b>Como o ranking funciona:</b> cada campeonato tem seu placar próprio. Quando o resultado é lançado, ele aparece como provisório; após a revisão do FlowFire, entra oficialmente na temporada certa.</p><span>Histórico preservado · temporada atual separada</span></section>
  </div>;
};
