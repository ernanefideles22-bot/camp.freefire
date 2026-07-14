import { useState, useEffect } from 'react';
import { Gamepad2, Wallet, Trophy, Users, Check, Copy, RefreshCw, Crown, Clock, DollarSign } from 'lucide-react';
import { apiService } from '../services/api';
import type { Jogador, SalaData, StatusQueda, PremiacaoQueda, QuedaAberta, MeuConvite } from '../services/api';
import { Spinner } from './Spinner';
import PixDeposito from './PixDeposito';
import PixSaque from './PixSaque';

interface PlayerPortalProps {
  currentUser: Jogador;
  onUpdateUser: (user: Jogador) => void;
  onAddToast: (type: 'success' | 'error' | 'warning' | 'info', title: string, desc?: string) => void;
}

const brl = (v: number) => `R$ ${(v || 0).toFixed(2).replace('.', ',')}`;

export const PlayerPortal = ({ currentUser, onUpdateUser, onAddToast }: PlayerPortalProps) => {
  const [aba, setAba] = useState<'arena' | 'carteira'>('arena');
  const [selectedQueda, setSelectedQueda] = useState<number>(1);
  const [historyData, setHistoryData] = useState<any>(null);
  const [loadingHistory, setLoadingHistory] = useState<boolean>(false);
  const [statusQueda, setStatusQueda] = useState<StatusQueda | null>(null);
  const [quedasAbertas, setQuedasAbertas] = useState<QuedaAberta[]>([]);
  const [convite, setConvite] = useState<MeuConvite | null>(null);
  const [copiedConvite, setCopiedConvite] = useState<boolean>(false);
  const [premiacao, setPremiacao] = useState<PremiacaoQueda | null>(null);
  const [salaInfo, setSalaInfo] = useState<SalaData | null>(null);
  const [loadingStatus, setLoadingStatus] = useState<boolean>(false);
  const [loadingInscricao, setLoadingInscricao] = useState<boolean>(false);
  const [copied, setCopied] = useState<string>('');

  const fetchPlayerStats = async () => {
    setLoadingHistory(true);
    try {
      const res = await apiService.getPlayerHistory(currentUser.nick);
      if (res) {
        setHistoryData(res);
        onUpdateUser({ ...currentUser, saldo: res.jogador.saldo });
      }
    } catch (err) {
      console.error('Erro ao buscar historico:', err);
    } finally {
      setLoadingHistory(false);
    }
  };

  const fetchQuedaStatus = async (silent = false) => {
    if (!silent) setLoadingStatus(true);
    try {
      const status = await apiService.obterStatusQueda(selectedQueda);
      setStatusQueda(status);
      apiService.obterPremiacaoQueda(selectedQueda).then(setPremiacao).catch(() => setPremiacao(null));
      apiService.listarQuedasAbertas().then((qs) => {
        setQuedasAbertas(qs);
        if (qs.length > 0 && !qs.some(q => q.numero_queda === selectedQueda)) {
          setSelectedQueda(qs[0].numero_queda);
          setSalaInfo(null);
        }
      }).catch(() => {});
      if (status.esta_inscrito && status.sala_liberada) {
        const room = await apiService.obterInfoSala(selectedQueda);
        setSalaInfo(room);
      } else {
        setSalaInfo(null);
      }
    } catch (err) {
      console.error('Erro ao buscar status da queda:', err);
    } finally {
      if (!silent) setLoadingStatus(false);
    }
  };

  useEffect(() => {
    fetchPlayerStats();
    fetchQuedaStatus();
    const interval = setInterval(() => { fetchQuedaStatus(true); }, 6000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedQueda, currentUser.id]);

  useEffect(() => {
    apiService.obterMeuConvite().then(setConvite).catch(() => {});
  }, [currentUser.id]);

  const taxa = premiacao?.taxa_inscricao ?? 3;

  const handleInscricao = async () => {
    setLoadingInscricao(true);
    try {
      await apiService.inscreverNaQueda(selectedQueda);
      onAddToast('success', 'Inscricao confirmada!', `${brl(taxa)} foram debitados do seu saldo.`);
      const updatedUser = { ...currentUser, saldo: (currentUser.saldo || 0) - taxa };
      onUpdateUser(updatedUser);
      localStorage.setItem('currentUser', JSON.stringify(updatedUser));
      fetchQuedaStatus();
      fetchPlayerStats();
    } catch (err: any) {
      onAddToast('error', 'Erro na inscricao', err.message || 'Verifique seu saldo e tente novamente.');
    } finally {
      setLoadingInscricao(false);
    }
  };

  const copy = (text: string, label: string) => {
    navigator.clipboard?.writeText(text).then(() => {
      setCopied(label); setTimeout(() => setCopied(''), 1500);
      onAddToast('info', 'Copiado', label);
    }).catch(() => {});
  };

  const placementColor = (colocacao: number) => {
    if (colocacao === 1) return 'text-amber-400';
    if (colocacao <= 3) return 'text-zinc-300';
    return 'text-zinc-500';
  };

  const saldo = currentUser.saldo || 0;
  const inscrito = !!statusQueda?.esta_inscrito;
  const premios = premiacao ? ['1', '2', '3', '4', '5'].map(p => premiacao.premios_colocacao[p] ?? 0) : [];

  // ---------- ARENA ----------
  const arena = (
    <div className="space-y-5">
      {/* Seletor de queda */}
      {quedasAbertas.length > 0 && (
        <div className="flex flex-wrap gap-2 justify-center">
          {quedasAbertas.map((q) => (
            <button key={q.numero_queda} onClick={() => { setSelectedQueda(q.numero_queda); setSalaInfo(null); }}
              className={`py-2 px-4 rounded-xl font-bold text-sm border transition-all cursor-pointer ${selectedQueda === q.numero_queda ? 'bg-primary border-primary text-white shadow-[0_0_12px_rgba(255,90,31,0.25)]' : 'bg-zinc-900/60 border-zinc-800 text-zinc-400 hover:text-zinc-200'}`}>
              Queda #{q.numero_queda}
              <span className="block text-[10px] font-semibold opacity-80">{q.inscritos_count}/{q.limite}{q.horario ? ` • ${q.horario}` : ''}</span>
            </button>
          ))}
        </div>
      )}

      {loadingStatus && !statusQueda ? (
        <div className="flex justify-center py-16"><Spinner size="md" className="text-primary" /></div>
      ) : quedasAbertas.length === 0 ? (
        <div className="max-w-2xl mx-auto p-8 rounded-2xl border border-dashed border-zinc-800 bg-zinc-950/30 text-center space-y-2">
          <Gamepad2 className="w-10 h-10 text-zinc-700 mx-auto" />
          <h2 className="text-sm font-bold text-white">Nenhuma queda aberta no momento</h2>
          <p className="text-xs text-zinc-500">O organizador abre as quedas do dia às 19h, 20h e 21h. Fica ligado!</p>
        </div>
      ) : statusQueda && (
        <>
          {/* Card principal da queda */}
          <div className="p-5 rounded-2xl border border-primary/20 bg-gradient-to-b from-primary/10 to-transparent space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-black text-white flex items-center gap-2"><Gamepad2 className="w-5 h-5 text-primary" />Queda #{statusQueda.numero_queda}</h2>
                <span className="text-[11px] font-bold uppercase tracking-wider text-primary">{inscrito ? 'Você está dentro' : 'Inscrições abertas'}</span>
              </div>
              <button onClick={() => { fetchPlayerStats(); fetchQuedaStatus(); }} className="p-2 text-zinc-500 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors cursor-pointer" title="Atualizar"><RefreshCw className="w-4 h-4" /></button>
            </div>

            {/* Badges: entrada PAGA (dinheiro explícito) + pote */}
            <div className="flex flex-wrap items-center gap-3 text-xs text-zinc-300">
              <span className="px-2.5 py-1 rounded-lg bg-accent-orange/10 border border-accent-orange/30 text-accent-orange font-bold flex items-center gap-1"><DollarSign className="w-3.5 h-3.5" />Entrada {brl(taxa)}</span>
              {premiacao && <span className="px-2.5 py-1 rounded-lg bg-zinc-950 border border-zinc-800 font-bold">Pote {brl(premiacao.premiacao_total)} <span className="text-zinc-500">• cresce a cada inscrito</span></span>}
            </div>

            {/* Grade de prêmios top5 + bolo kills */}
            {premiacao && (
              <div className="flex flex-wrap gap-2">
                {premios.map((v, i) => (
                  <span key={i} className="text-[11px] font-bold px-2.5 py-1 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-300 flex items-center gap-1">
                    {i === 0 && <Crown className="w-3 h-3 text-amber-400" />}{i + 1}º <b className="text-emerald-400">{brl(v)}</b>
                  </span>
                ))}
                <span className="text-[11px] font-bold px-2.5 py-1 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-300 flex items-center gap-1">
                  Kills <b className="text-accent-cyan">{brl(premiacao.bolo_abates)}</b>
                </span>
              </div>
            )}

            {/* Inscritos + barra */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs text-zinc-400">
                <Users className="w-4 h-4 text-primary" />
                <b className="text-white">{statusQueda.inscritos_count}</b> / {statusQueda.limite} inscritos
              </div>
              <div className="w-full bg-zinc-900 rounded-full h-2 overflow-hidden border border-zinc-800/80">
                <div className={`h-full rounded-full transition-all duration-500 ${statusQueda.inscritos_count >= statusQueda.limite ? 'bg-accent-orange' : 'bg-primary'}`}
                  style={{ width: `${Math.min(100, (statusQueda.inscritos_count / statusQueda.limite) * 100)}%` }} />
              </div>
            </div>

            <p className="text-[11px] text-zinc-500">Top 5 divide o pote por colocação e o bolo de kills é rateado entre todos que fragarem. Colocação + abates viram pontos no ranking da semana.</p>

            {/* Ação */}
            {!inscrito ? (
              saldo < taxa ? (
                <div className="space-y-2">
                  <button disabled className="w-full py-3 rounded-xl bg-zinc-800 text-zinc-500 border border-zinc-700/50 font-black text-sm cursor-not-allowed">Saldo insuficiente ({brl(saldo)})</button>
                  <button onClick={() => setAba('carteira')} className="w-full py-2.5 rounded-xl bg-accent-cyan/90 text-zinc-950 font-black text-sm hover:bg-accent-cyan transition-all cursor-pointer flex items-center justify-center gap-2"><Wallet className="w-4 h-4" />Adicionar saldo via PIX</button>
                </div>
              ) : (
                <button disabled={loadingInscricao} onClick={handleInscricao} className="w-full py-3 rounded-xl bg-primary text-white font-black text-sm hover:opacity-90 transition-all cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2">
                  {loadingInscricao ? <Spinner size="sm" /> : <Gamepad2 className="w-4 h-4" />}{loadingInscricao ? 'Confirmando...' : `Entrar na sala • ${brl(taxa)}`}
                </button>
              )
            ) : (
              <div className="w-full py-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-bold text-sm text-center flex items-center justify-center gap-2"><Check className="w-4 h-4" />Inscrito & pago — boa sorte!</div>
            )}
          </div>

          {/* Sala (só inscrito) */}
          {inscrito && (
            <div className="p-4 rounded-2xl border border-zinc-800 bg-zinc-950/40 space-y-3">
              <span className="text-xs font-bold uppercase tracking-wider text-zinc-500">Sua sala</span>
              {salaInfo ? (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="p-3 rounded-xl border border-zinc-800 bg-zinc-950/60 space-y-1">
                      <span className="text-[10px] font-bold uppercase text-primary">ID da sala</span>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-black text-white font-mono truncate">{salaInfo.sala_id}</span>
                        <button onClick={() => copy(salaInfo.sala_id, 'ID da sala')} className="p-1.5 text-zinc-400 hover:text-white rounded-lg cursor-pointer">{copied === 'ID da sala' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}</button>
                      </div>
                    </div>
                    <div className="p-3 rounded-xl border border-zinc-800 bg-zinc-950/60 space-y-1">
                      <span className="text-[10px] font-bold uppercase text-primary">Senha</span>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-black text-white font-mono truncate">{salaInfo.senha}</span>
                        <button onClick={() => copy(salaInfo.senha, 'Senha da sala')} className="p-1.5 text-zinc-400 hover:text-white rounded-lg cursor-pointer">{copied === 'Senha da sala' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}</button>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-3 rounded-xl border border-zinc-800 bg-zinc-950/60">
                    <Clock className="w-5 h-5 text-primary" />
                    <span className="text-xs text-zinc-400 flex-grow">Entre na sala antes do horário. O adm inicia no horário marcado.</span>
                    <span className="text-lg font-mono font-black text-primary">{salaInfo.horario || '--:--'}</span>
                  </div>
                </>
              ) : (
                <div className="p-5 rounded-xl border border-dashed border-zinc-800 bg-zinc-950/20 text-center space-y-2">
                  <Gamepad2 className="w-8 h-8 text-zinc-600 mx-auto" />
                  <p className="text-xs text-zinc-500 max-w-sm mx-auto">Você já está inscrito! O organizador libera o ID e a senha assim que a queda estiver pronta.</p>
                </div>
              )}
            </div>
          )}

          {/* Estatísticas */}
          {historyData && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { l: 'Ganhos', v: brl(historyData.totalEarnings), c: 'text-emerald-400' },
                { l: 'Kills', v: historyData.totalKills, c: 'text-accent-orange' },
                { l: 'Quedas', v: historyData.totalMatches, c: 'text-primary' },
                { l: 'Rank médio', v: historyData.averagePlacement > 0 ? `${historyData.averagePlacement}º` : '-', c: 'text-amber-400' },
              ].map((s) => (
                <div key={s.l} className="p-3 rounded-xl border border-zinc-800 bg-zinc-950/40 space-y-0.5">
                  <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">{s.l}</span>
                  <h4 className={`text-lg font-black font-mono ${s.c}`}>{s.v}</h4>
                </div>
              ))}
            </div>
          )}

          {/* Histórico */}
          <div className="p-4 rounded-2xl border border-zinc-800 bg-zinc-950/40 space-y-2">
            <span className="text-xs font-bold uppercase tracking-wider text-zinc-500 flex items-center gap-1.5"><Trophy className="w-4 h-4 text-amber-400" />Suas pontuações anteriores</span>
            {loadingHistory ? (
              <div className="py-6 flex justify-center"><Spinner size="sm" /></div>
            ) : historyData && historyData.history.length > 0 ? (
              <div className="max-h-80 overflow-y-auto pr-1 space-y-1">
                {historyData.history.map((h: any) => (
                  <div key={h.numero_queda} className="flex items-center gap-3 p-2.5 rounded-lg border border-zinc-800 bg-zinc-950/40">
                    <span className={`text-sm font-black w-9 text-center ${placementColor(h.colocacao)}`}>{h.colocacao}º</span>
                    <span className="flex-1 min-w-0 truncate text-sm font-bold text-white">Queda {h.numero_queda}</span>
                    <span className="text-[11px] text-zinc-500 w-12 text-right">{h.abates}k</span>
                    <span className={`text-xs font-bold font-mono w-24 text-right ${h.premio > 0 ? 'text-emerald-400' : 'text-zinc-500'}`}>{h.premio > 0 ? `+ ${brl(h.premio)}` : brl(0)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-6 text-center text-zinc-500 text-xs">Você ainda não tem quedas pontuadas neste campeonato.</div>
            )}
          </div>
        </>
      )}
    </div>
  );

  // ---------- CARTEIRA ----------
  const carteira = (
    <div className="space-y-5">
      <div className="p-5 rounded-2xl border border-primary/20 bg-gradient-to-b from-primary/10 to-transparent space-y-1 text-center relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-0.5 ff-topbar" />
        <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">Saldo total</span>
        <h3 className="text-3xl font-black font-mono text-gradient-neon">{brl(saldo)}</h3>
        <p className="text-[11px] text-zinc-500">Disponível p/ saque: <span className="text-emerald-400 font-bold font-mono">{brl(currentUser.saldo_sacavel || 0)}</span></p>
      </div>

      <div className="p-4 rounded-2xl border border-zinc-800 bg-zinc-950/40">
        <PixDeposito jogadorId={currentUser.id} />
      </div>

      {convite && (
        <div className="p-4 rounded-2xl border border-emerald-500/20 bg-zinc-950/40 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-emerald-400">Convide e ganhe</span>
            <span className="text-[10px] text-zinc-500 font-bold">{convite.restante_semana} restantes na semana</span>
          </div>
          <p className="text-xs text-zinc-400 leading-relaxed">Ganhe <b className="text-emerald-400">{brl(convite.valor_por_convite)}</b> por amigo que jogar a 1ª queda. Seu amigo também ganha <b className="text-emerald-400">{brl(convite.bonus_convidado)}</b>!</p>
          <div className="flex items-center gap-2">
            <a href={convite.link} target="_blank" rel="noopener noreferrer" className="flex-1 px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-xs text-amber-400 font-mono truncate underline decoration-amber-400/40 hover:text-amber-300 transition-colors">{convite.link}</a>
            <button onClick={() => { navigator.clipboard.writeText(convite.link); setCopiedConvite(true); setTimeout(() => setCopiedConvite(false), 2000); }} title="Copiar link" className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-900 rounded-lg transition-colors cursor-pointer">{copiedConvite ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}</button>
          </div>
          <a href={`https://wa.me/?text=${encodeURIComponent(`Cola no FLOW FIRE CHAMPIONS! Camp de Free Fire com premio em dinheiro via Pix. Se cadastra pelo meu link: ${convite.link}`)}`} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-sm font-bold text-emerald-400 hover:bg-emerald-500/25 transition-all cursor-pointer">Convidar pelo WhatsApp</a>
          <p className="text-[10px] text-zinc-500">{convite.convidados_que_jogaram}/{convite.convidados_total} convidados jogaram • você já ganhou {brl(convite.ganhos_total)}</p>
        </div>
      )}

      <div className="p-4 rounded-2xl border border-zinc-800 bg-zinc-950/40">
        <PixSaque saldoSacavel={currentUser.saldo_sacavel || 0} saldo={saldo} />
      </div>
    </div>
  );

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      {/* Segmented control Arena / Carteira */}
      <div className="flex items-center gap-1 p-1 rounded-2xl border border-zinc-800 bg-zinc-950/40 max-w-md mx-auto">
        <button onClick={() => setAba('arena')} className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold transition-all cursor-pointer ${aba === 'arena' ? 'bg-primary text-white shadow-[0_0_12px_rgba(255,90,31,0.25)]' : 'text-zinc-400 hover:text-zinc-200'}`}><Gamepad2 className="w-4 h-4" />Arena</button>
        <button onClick={() => setAba('carteira')} className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold transition-all cursor-pointer ${aba === 'carteira' ? 'bg-primary text-white shadow-[0_0_12px_rgba(255,90,31,0.25)]' : 'text-zinc-400 hover:text-zinc-200'}`}><Wallet className="w-4 h-4" />Carteira <span className="text-[10px] font-mono opacity-80">{brl(saldo)}</span></button>
      </div>

      {aba === 'arena' ? arena : carteira}
    </div>
  );
};
