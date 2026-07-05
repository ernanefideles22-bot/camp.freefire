import React, { useState, useEffect } from 'react';
import { DollarSign, Wallet, Clock, Gamepad2, Copy, Check, RefreshCw, Award } from 'lucide-react';
import { apiService } from '../services/api';
import type { Jogador, SalaData, StatusQueda, PremiacaoQueda } from '../services/api';
import { Spinner } from './Spinner';
import PixDeposito from './PixDeposito';
import PixSaque from './PixSaque';

interface PlayerPortalProps {
  currentUser: Jogador;
  onUpdateUser: (user: Jogador) => void;
  onAddToast: (type: 'success' | 'error' | 'warning' | 'info', title: string, desc?: string) => void;
}

export const PlayerPortal: React.FC<PlayerPortalProps> = ({
  currentUser,
  onUpdateUser,
  onAddToast
}) => {
  const [selectedQueda, setSelectedQueda] = useState<number>(1);
  const [historyData, setHistoryData] = useState<any>(null);
  const [loadingHistory, setLoadingHistory] = useState<boolean>(false);
  const [statusQueda, setStatusQueda] = useState<StatusQueda | null>(null);
  const [premiacao, setPremiacao] = useState<PremiacaoQueda | null>(null);
  const [salaInfo, setSalaInfo] = useState<SalaData | null>(null);
  const [loadingStatus, setLoadingStatus] = useState<boolean>(false);
  const [loadingInscricao, setLoadingInscricao] = useState<boolean>(false);
  const [copiedId, setCopiedId] = useState<boolean>(false);
  const [copiedSenha, setCopiedSenha] = useState<boolean>(false);

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
  }, [selectedQueda, currentUser.id]);


  const handleInscricao = async () => {
    setLoadingInscricao(true);
    try {
      await apiService.inscreverNaQueda(selectedQueda);
      onAddToast('success', 'Inscricao Confirmada!', 'R$ 3,00 foram debitados do seu saldo.');
      const updatedUser = { ...currentUser, saldo: (currentUser.saldo || 0) - 3.0 };
      onUpdateUser(updatedUser);
      localStorage.setItem('currentUser', JSON.stringify(updatedUser));
      fetchQuedaStatus();
      fetchPlayerStats();
    } catch (err: any) {
      onAddToast('error', 'Erro na Inscricao', err.message || 'Verifique seu saldo e tente novamente.');
    } finally {
      setLoadingInscricao(false);
    }
  };

  const handleCopy = (text: string, type: 'id' | 'senha') => {
    navigator.clipboard.writeText(text);
    if (type === 'id') {
      setCopiedId(true);
      setTimeout(() => setCopiedId(false), 2000);
      onAddToast('info', 'ID Copiado', 'ID da sala copiado para a area de transferencia.');
    } else {
      setCopiedSenha(true);
      setTimeout(() => setCopiedSenha(false), 2000);
      onAddToast('info', 'Senha Copiada', 'Senha da sala copiada para a area de transferencia.');
    }
  };


  const getPlacementBadge = (colocacao: number) => {
    if (colocacao === 1) return 'bg-yellow-400/10 border-yellow-400 text-yellow-400';
    if (colocacao === 2) return 'bg-zinc-300/10 border-zinc-300 text-zinc-300';
    if (colocacao === 3) return 'bg-amber-600/10 border-amber-600 text-amber-500';
    if (colocacao >= 4 && colocacao <= 10) return 'bg-amber-500/10 border-amber-500 text-amber-400';
    return 'bg-zinc-900 border-zinc-800 text-zinc-400';
  };

  return (
    <div className="space-y-6">
      {/* Painel de boas-vindas */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-6 ff-card gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary to-primary-dark flex items-center justify-center text-white font-bold text-2xl shadow-md uppercase">
            {currentUser.nick.slice(0, 2)}
          </div>
          <div>
            <h2 className="text-2xl font-black text-white">{currentUser.nick}</h2>
            <p className="text-xs text-zinc-400 flex items-center gap-1.5 mt-0.5">
              Nome de Registro: <span className="text-zinc-300 font-semibold">{currentUser.nome}</span>
            </p>
          </div>
        </div>
        <button onClick={() => { fetchPlayerStats(); fetchQuedaStatus(); onAddToast('info', 'Atualizando Dados', 'Sincronizando saldo e status com o servidor...'); }}
          className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-zinc-800 text-xs font-bold text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900 active:scale-95 transition-all cursor-pointer">
          <RefreshCw className="w-4 h-4" />
          Sincronizar Saldo
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Coluna esquerda */}
        <div className="lg:col-span-8 space-y-6">
          {/* Seletor de Queda */}
          <div className="ff-card p-4">
            <h3 className="text-sm font-bold uppercase tracking-wider text-zinc-400 mb-3.5">Selecione a Queda</h3>
            <div className="grid grid-cols-3 gap-2">
              {[1, 2, 3].map((num) => (
                <button key={num} onClick={() => { setSelectedQueda(num); setSalaInfo(null); }}
                  className={`py-3 rounded-xl font-bold text-sm border transition-all cursor-pointer ${selectedQueda === num ? 'bg-primary border-primary text-white shadow-[0_0_12px_rgba(255,90,31,0.25)]' : 'bg-zinc-900/60 border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'}`}>
                  Queda #{num}
                </button>
              ))}
            </div>
          </div>

          {/* Card da sala */}
          <div className="ff-card p-6 relative overflow-hidden">
            {loadingStatus ? (
              <div className="py-12 flex flex-col items-center justify-center gap-3">
                <Spinner size="lg" className="text-primary" />
                <p className="text-zinc-500 text-xs font-bold uppercase tracking-wider">Verificando inscricoes...</p>
              </div>
            ) : (
              statusQueda && (
                <div className="space-y-6">
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2.5">
                        <h4 className="text-lg font-bold text-white">Sala da Queda {statusQueda.numero_queda}</h4>
                        {statusQueda.esta_inscrito ? (
                          <span className="px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/30 text-[10px] font-black text-emerald-400 uppercase tracking-wider">Inscrito & Pago</span>
                        ) : (
                          <span className="px-2 py-0.5 rounded bg-zinc-800 border border-zinc-700 text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Nao Inscrito</span>
                        )}
                      </div>
                      <p className="text-xs text-zinc-400">
                        {statusQueda.esta_inscrito ? 'Sua vaga esta garantida! Veja os detalhes da sala abaixo.' : 'Clique em Entrar na Sala: R$ 3,00 sao descontados e o ID + senha aparecem para copiar.'}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="text-xs text-zinc-500 font-bold uppercase tracking-wider block">Jogadores</span>
                      <span className="text-lg font-black text-white font-mono leading-none">{statusQueda.inscritos_count} / {statusQueda.limite}</span>
                    </div>
                  </div>

                  <div className="w-full bg-zinc-900 rounded-full h-2 overflow-hidden border border-zinc-800/80">
                    <div className={`h-full rounded-full transition-all duration-500 ${statusQueda.inscritos_count >= 48 ? 'bg-accent-orange' : 'bg-primary'}`}
                      style={{ width: `${(statusQueda.inscritos_count / statusQueda.limite) * 100}%` }} />
                  </div>

                  {premiacao && (
                    <div className="p-4 rounded-xl border border-emerald-500/20 bg-emerald-500/5 space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-[10px] font-black uppercase tracking-wider text-emerald-400 flex items-center gap-1.5"><Award className="w-3.5 h-3.5" />Premiação desta queda</span>
                        <span className="text-xs text-zinc-300">Pote atual: <b className="text-emerald-400">R$ {premiacao.premiacao_total.toFixed(2).replace('.', ',')}</b> <span className="text-zinc-500">• cresce a cada inscrito</span></span>
                      </div>
                      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 text-center">
                        {(['1', '2', '3', '4', '5'] as const).map((pos) => (
                          <div key={pos} className="rounded-lg bg-zinc-950/60 border border-zinc-800 px-2 py-1.5">
                            <span className="text-[9px] font-bold text-zinc-500 uppercase block">{pos}º lugar</span>
                            <span className="text-xs font-black text-white">R$ {(premiacao.premios_colocacao[pos] ?? 0).toFixed(2).replace('.', ',')}</span>
                          </div>
                        ))}
                        <div className="rounded-lg bg-zinc-950/60 border border-zinc-800 px-2 py-1.5">
                          <span className="text-[9px] font-bold text-zinc-500 uppercase block">Bolo kills</span>
                          <span className="text-xs font-black text-accent-cyan">R$ {premiacao.bolo_abates.toFixed(2).replace('.', ',')}</span>
                        </div>
                      </div>
                      <p className="text-[10px] text-zinc-500">Valores calculados sobre os {premiacao.inscritos} inscritos atuais. O bolo de kills é dividido proporcionalmente entre os abates da partida.</p>
                    </div>
                  )}

                  {!statusQueda.esta_inscrito ? (
                    <div className="p-5 bg-zinc-950/40 rounded-xl border border-zinc-800 flex flex-col sm:flex-row items-center justify-between gap-4">
                      <div className="flex items-center gap-3.5">
                        <div className="p-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-400">
                          <DollarSign className="w-5 h-5 text-accent-cyan" />
                        </div>
                        <div className="text-center sm:text-left">
                          <p className="text-sm font-bold text-white">Entrar na Sala — R$ 3,00</p>
                          <p className="text-xs text-zinc-500 font-semibold mt-0.5">Seu saldo atual: R$ {(currentUser.saldo || 0).toFixed(2).replace('.', ',')}</p>
                        </div>
                      </div>
                      <button onClick={handleInscricao}
                        disabled={loadingInscricao || (currentUser.saldo || 0) < 3.0}
                        className={`px-6 py-3 rounded-xl font-bold text-sm transition-all select-none cursor-pointer flex items-center gap-2 ${(currentUser.saldo || 0) < 3.0 ? 'bg-zinc-800 text-zinc-500 border border-zinc-700/50 cursor-not-allowed' : 'bg-accent-cyan text-zinc-950 hover:bg-amber-400 shadow-[0_0_15px_rgba(255,160,50,0.2)]'}`}>
                        {loadingInscricao ? <Spinner size="sm" className="text-zinc-950" /> : <Gamepad2 className="w-4 h-4" />}
                        {loadingInscricao ? 'Confirmando...' : (currentUser.saldo || 0) < 3.0 ? 'Saldo Insuficiente' : 'Entrar na Sala (R$ 3,00)'}
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {salaInfo ? (
                        <div className="space-y-4">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="px-5 py-3 rounded-xl bg-zinc-950 border border-zinc-800 flex items-center justify-between gap-4">
                              <div className="space-y-0.5">
                                <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider block">ID DA SALA FF</span>
                                <span className="text-lg font-black text-white font-mono tracking-wider">{salaInfo.sala_id}</span>
                              </div>
                              <button onClick={() => handleCopy(salaInfo.sala_id, 'id')} className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-900 rounded-lg transition-colors cursor-pointer">
                                {copiedId ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                              </button>
                            </div>
                            <div className="px-5 py-3 rounded-xl bg-zinc-950 border border-zinc-800 flex items-center justify-between gap-4">
                              <div className="space-y-0.5">
                                <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider block">SENHA DA SALA</span>
                                <span className="text-lg font-black text-white font-mono tracking-wider">{salaInfo.senha}</span>
                              </div>
                              <button onClick={() => handleCopy(salaInfo.senha, 'senha')} className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-900 rounded-lg transition-colors cursor-pointer">
                                {copiedSenha ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                              </button>
                            </div>
                          </div>
                          <div className="p-4 rounded-xl border bg-zinc-950 border-zinc-800 text-zinc-400 flex items-center gap-4">
                            <div className="p-2.5 rounded-lg bg-zinc-900 flex items-center justify-center text-primary">
                              <Clock className="w-5 h-5" />
                            </div>
                            <div className="flex-grow">
                              <h5 className="text-sm font-bold text-white">Horario do Salto</h5>
                              <p className="text-xs text-zinc-500 font-medium mt-0.5">{salaInfo.horario ? 'Entre na sala antes do horario. O adm inicia a partida no horario marcado.' : 'O organizador ainda nao definiu o horario. Fique atento.'}</p>
                            </div>
                            <div className="text-right">
                              <span className="text-2xl font-mono font-black text-primary tracking-wider">{salaInfo.horario || '--:--'}</span>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="p-5 rounded-xl border border-dashed border-zinc-800 bg-zinc-950/20 text-center space-y-2">
                          <Gamepad2 className="w-8 h-8 text-zinc-600 mx-auto animate-bounce" />
                          <h5 className="text-sm font-bold text-zinc-300">Sala em Preparacao</h5>
                          <p className="text-xs text-zinc-500 max-w-sm mx-auto leading-relaxed">
                            Voce ja esta inscrito! O organizador liberara o ID e a Senha da sala assim que a queda estiver pronta para comecar.
                          </p>
                          <div className="pt-2">
                            <button onClick={() => fetchQuedaStatus()}
                              className="px-4 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-[10px] font-bold text-zinc-400 hover:text-zinc-200 transition-colors cursor-pointer">
                              Verificar Sala
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            )}
          </div>

          {/* Estatisticas */}
          {historyData && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="p-4 rounded-xl border border-zinc-800 bg-gradient-to-b from-zinc-900/40 to-zinc-950/40 flex items-center justify-between shadow-md">
                <div className="space-y-0.5">
                  <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">Ganhos Acumulados</span>
                  <h4 className="text-lg font-black text-accent-cyan font-mono">R$ {historyData.totalEarnings.toFixed(2).replace('.', ',')}</h4>
                </div>
              </div>
              <div className="p-4 rounded-xl border border-zinc-800 bg-gradient-to-b from-zinc-900/40 to-zinc-950/40 flex items-center justify-between shadow-md">
                <div className="space-y-0.5">
                  <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">Kills de Carreira</span>
                  <h4 className="text-lg font-black text-accent-orange font-mono">{historyData.totalKills}</h4>
                </div>
              </div>
              <div className="p-4 rounded-xl border border-zinc-800 bg-gradient-to-b from-zinc-900/40 to-zinc-950/40 flex items-center justify-between shadow-md">
                <div className="space-y-0.5">
                  <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">Quedas Concluidas</span>
                  <h4 className="text-lg font-black text-primary font-mono">{historyData.totalMatches}</h4>
                </div>
              </div>
              <div className="p-4 rounded-xl border border-zinc-800 bg-gradient-to-b from-zinc-900/40 to-zinc-950/40 flex items-center justify-between shadow-md">
                <div className="space-y-0.5">
                  <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">Rank Medio</span>
                  <h4 className="text-lg font-black text-amber-400 font-mono">{historyData.averagePlacement > 0 ? `${historyData.averagePlacement}o` : '-'}</h4>
                </div>
              </div>
            </div>
          )}

          {/* Historico de partidas */}
          <div className="space-y-3">
            <h3 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
              <Award className="w-5 h-5 text-primary" />
              Suas Pontuacoes Anteriores
            </h3>
            <div className="ff-card overflow-hidden">
              {loadingHistory ? (
                <div className="py-8 flex justify-center"><Spinner size="sm" /></div>
              ) : historyData && historyData.history.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-zinc-800 bg-zinc-900/50">
                        <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-zinc-400">Queda #</th>
                        <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-zinc-400">Colocacao</th>
                        <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-zinc-400 text-right">Abates</th>
                        <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-zinc-400 text-right">Premiacao</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-900">
                      {historyData.history.map((h: any) => (
                        <tr key={h.numero_queda} className="hover:bg-zinc-900/30 transition-colors">
                          <td className="px-5 py-3 font-bold text-xs text-zinc-300">Queda {h.numero_queda}</td>
                          <td className="px-5 py-3">
                            <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold border ${getPlacementBadge(h.colocacao)}`}>{h.colocacao}o lugar</span>
                          </td>
                          <td className="px-5 py-3 text-right text-xs text-zinc-300">{h.abates}</td>
                          <td className={`px-5 py-3 text-right font-bold text-xs font-mono ${h.premio > 0 ? 'text-accent-cyan' : 'text-zinc-500'}`}>
                            {h.premio > 0 ? `+ R$ ${h.premio.toFixed(2).replace('.', ',')}` : 'R$ 0,00'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="p-6 text-center text-zinc-500 text-xs">
                  Voce ainda nao possui quedas pontuadas registradas neste campeonato.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Coluna direita - Carteira */}
        <div className="lg:col-span-4 space-y-6">
          <div className="ff-card p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-bold text-white tracking-tight flex items-center gap-2">
                <Wallet className="w-4 h-4 text-primary" />
                Carteira Digital
              </h4>
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            </div>
            <div className="p-4 bg-zinc-950/80 rounded-xl border border-zinc-800 text-center space-y-1 relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-0.5 ff-topbar" />
              <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">Saldo Total</span>
              <h3 className="text-3xl font-black font-mono text-gradient-neon">
                R$ {(currentUser.saldo || 0).toFixed(2).replace('.', ',')}
              </h3>
              <p className="text-[11px] text-zinc-500">
                Disponivel p/ saque:{' '}
                <span className="text-emerald-400 font-bold font-mono">R$ {(currentUser.saldo_sacavel || 0).toFixed(2).replace('.', ',')}</span>
              </p>
            </div>
            <div className="border-t border-zinc-800" />
            <PixDeposito jogadorId={currentUser.id} />
            <div className="border-t border-zinc-800" />
            <PixSaque saldoSacavel={currentUser.saldo_sacavel || 0} saldo={currentUser.saldo || 0} />
          </div>
        </div>
      </div>
    </div>
  );
};
