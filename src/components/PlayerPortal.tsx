import React, { useState, useEffect } from 'react';
import { DollarSign, Wallet, Clock, Gamepad2, Copy, Check, RefreshCw, Award } from 'lucide-react';
import { apiService } from '../services/api';
import type { Jogador, SalaData, StatusQueda } from '../services/api';
import { Spinner } from './Spinner';
import PixDeposito from './PixDeposito';

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
  
  // Room and inscription states
  const [statusQueda, setStatusQueda] = useState<StatusQueda | null>(null);
  const [salaInfo, setSalaInfo] = useState<SalaData | null>(null);
  const [loadingStatus, setLoadingStatus] = useState<boolean>(false);
  const [loadingInscricao, setLoadingInscricao] = useState<boolean>(false);
  
  // Wallet states
  
  // Copy states
  const [copiedId, setCopiedId] = useState<boolean>(false);
  const [copiedSenha, setCopiedSenha] = useState<boolean>(false);

  // Persistent Timer State
  const [secondsLeft, setSecondsLeft] = useState<number>(0);

  // Fetch player match history and stats
  const fetchPlayerStats = async () => {
    setLoadingHistory(true);
    try {
      const res = await apiService.getPlayerHistory(currentUser.nick);
      if (res) {
        setHistoryData(res);
        // Also sync balance from DB to local state
        onUpdateUser({
          ...currentUser,
          saldo: res.jogador.saldo
        });
      }
    } catch (err) {
      console.error('Erro ao buscar histÃÂ³rico:', err);
    } finally {
      setLoadingHistory(false);
    }
  };

  // Fetch selected Queda status (inscription counts, is_registered, etc.)
  const fetchQuedaStatus = async (silent = false) => {
    if (!silent) setLoadingStatus(true);
    try {
      const status = await apiService.obterStatusQueda(selectedQueda);
      setStatusQueda(status);

      // If player is registered and room credentials are ready, fetch them
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

  // Run on mount and when user / selectedQueda changes
  useEffect(() => {
    fetchPlayerStats();
    fetchQuedaStatus();


    // Set up polling for the active room status every 6 seconds
    const interval = setInterval(() => {
      fetchQuedaStatus(true);
    }, 6000);

    return () => clearInterval(interval);
  }, [selectedQueda, currentUser.id]);

  // Synchronized persistent timer trigger when room details are released
  useEffect(() => {
    if (!salaInfo) {
      setSecondsLeft(0);
      return;
    }

    const timerKey = `room_timer_${selectedQueda}_${currentUser.id}`;
    let expiry = localStorage.getItem(timerKey);
    let expiryTime = expiry ? parseInt(expiry, 10) : null;

    if (!expiryTime) {
      // 5 minutes from now
      expiryTime = Date.now() + 5 * 60 * 1000;
      localStorage.setItem(timerKey, String(expiryTime));
    }

    const updateTimer = () => {
      const remaining = Math.max(0, Math.floor((expiryTime! - Date.now()) / 1000));
      setSecondsLeft(remaining);
      if (remaining === 0) {
        clearInterval(timerInterval);
      }
    };

    updateTimer();
    const timerInterval = setInterval(updateTimer, 1000);

    return () => clearInterval(timerInterval);
  }, [salaInfo, selectedQueda, currentUser.id]);

  // Handle Room Registration (Charges R$ 2.00)
  const handleInscricao = async () => {
    setLoadingInscricao(true);
    try {
      await apiService.inscreverNaQueda(selectedQueda);
      onAddToast('success', 'InscriÃÂ§ÃÂ£o Confirmada!', 'R$ 2,00 foram debitados do seu saldo.');
      
      // Update local wallet state
      const updatedUser = { ...currentUser, saldo: (currentUser.saldo || 0) - 2.0 };
      onUpdateUser(updatedUser);
      localStorage.setItem('currentUser', JSON.stringify(updatedUser));
      
      // Refresh status and stats
      fetchQuedaStatus();
      fetchPlayerStats();
    } catch (err: any) {
      onAddToast('error', 'Erro na InscriÃÂ§ÃÂ£o', err.message || 'Verifique seu saldo e tente novamente.');
    } finally {
      setLoadingInscricao(false);
    }
  };

  // Submit PIX deposit request

  const handleCopy = (text: string, type: 'id' | 'senha') => {
    navigator.clipboard.writeText(text);
    if (type === 'id') {
      setCopiedId(true);
      setTimeout(() => setCopiedId(false), 2000);
      onAddToast('info', 'ID Copiado', 'ID da sala copiado para a ÃÂ¡rea de transferÃÂªncia.');
    } else if (type === 'senha') {
      setCopiedSenha(true);
      setTimeout(() => setCopiedSenha(false), 2000);
      onAddToast('info', 'Senha Copiada', 'Senha da sala copiada para a ÃÂ¡rea de transferÃÂªncia.');
  };

  }

  const formatTime = (secs: number) => {
    const minutes = Math.floor(secs / 60);
    const remainingSeconds = secs % 60;
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const getPlacementBadge = (colocacao: number) => {
    if (colocacao === 1) return 'bg-yellow-400/10 border-yellow-400 text-yellow-400';
    if (colocacao === 2) return 'bg-zinc-300/10 border-zinc-300 text-zinc-300';
    if (colocacao === 3) return 'bg-amber-600/10 border-amber-600 text-amber-500';
    if (colocacao >= 4 && colocacao <= 10) return 'bg-purple-500/10 border-purple-500 text-purple-400';
    return 'bg-zinc-900 border-zinc-800 text-zinc-400';
  };

  return (
    <div className="space-y-6">
      {/* Top Welcome Panel */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-6 rounded-2xl border border-zinc-800 bg-panel-bg/40 backdrop-blur-md gap-4 shadow-xl">
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

        {/* Sync Wallet Button */}
        <button
          onClick={() => {
            fetchPlayerStats();
            fetchQuedaStatus();
            onAddToast('info', 'Atualizando Dados', 'Sincronizando saldo e status com o servidor...');
          }}
          className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-zinc-800 text-xs font-bold text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900 active:scale-95 transition-all cursor-pointer"
        >
          <RefreshCw className="w-4 h-4" />
          Sincronizar Saldo
        </button>
      </div>

      {/* Main Grid: Wallet & Inscription Portal */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* LEFT COLUMN: ROOM SUBSCRIPTIONS & COUNTER (8cols) */}
        <div className="lg:col-span-8 space-y-6">
          
          {/* Room Selector Tab */}
          <div className="bg-panel-bg/40 backdrop-blur-md rounded-2xl border border-zinc-800 p-4 shadow-xl">
            <h3 className="text-sm font-bold uppercase tracking-wider text-zinc-400 mb-3.5">Selecione a Queda</h3>
            <div className="grid grid-cols-3 gap-2">
              {[1, 2, 3].map((num) => (
                <button
                  key={num}
                  onClick={() => {
                    setSelectedQueda(num);
                    setSalaInfo(null);
                  }}
                  className={`py-3 rounded-xl font-bold text-sm border transition-all cursor-pointer ${
                    selectedQueda === num
                      ? 'bg-primary border-primary text-white shadow-[0_0_12px_rgba(139,92,246,0.25)]'
                      : 'bg-zinc-900/60 border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'
                  }`}
                >
                  Queda #{num}
                </button>
              ))}
            </div>
          </div>

          {/* Active Subscription/Room Card */}
          <div className="bg-panel-bg/40 backdrop-blur-md rounded-2xl border border-zinc-800 p-6 shadow-xl relative overflow-hidden">
            {loadingStatus ? (
              <div className="py-12 flex flex-col items-center justify-center gap-3">
                <Spinner size="lg" className="text-primary" />
                <p className="text-zinc-500 text-xs font-bold uppercase tracking-wider">Verificando inscriÃÂ§ÃÂµes...</p>
              </div>
            ) : (
              statusQueda && (
                <div className="space-y-6">
                  
                  {/* Status Summary Banner */}
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2.5">
                        <h4 className="text-lg font-bold text-white">Sala da Queda {statusQueda.numero_queda}</h4>
                        {statusQueda.esta_inscrito ? (
                          <span className="px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/30 text-[10px] font-black text-emerald-400 uppercase tracking-wider">
                            Inscrito & Pago
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded bg-zinc-800 border border-zinc-700 text-[10px] font-bold text-zinc-500 uppercase tracking-wider">
                            NÃÂ£o Inscrito
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-zinc-400">
                        {statusQueda.esta_inscrito
                          ? 'Sua vaga estÃÂ¡ garantida! Veja os detalhes da sala abaixo.'
                          : 'Participe desta queda solo! A inscriÃÂ§ÃÂ£o custa R$ 2,00 do seu saldo.'}
                      </p>
                    </div>

                    <div className="text-right">
                      <span className="text-xs text-zinc-500 font-bold uppercase tracking-wider block">Jogadores</span>
                      <span className="text-lg font-black text-white font-mono leading-none">
                        {statusQueda.inscritos_count} / {statusQueda.limite}
                      </span>
                    </div>
                  </div>

                  {/* LotaÃÂ§ÃÂ£o Progress Bar */}
                  <div className="w-full bg-zinc-900 rounded-full h-2 overflow-hidden border border-zinc-800/80">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        statusQueda.inscritos_count >= 48 ? 'bg-accent-orange glow-orange' : 'bg-primary glow-purple'
                      }`}
                      style={{ width: `${(statusQueda.inscritos_count / statusQueda.limite) * 100}%` }}
                    />
                  </div>

                  {/* Dynamic Action Area */}
                  {!statusQueda.esta_inscrito ? (
                    /* User needs to subscribe */
                    <div className="p-5 bg-zinc-950/40 rounded-xl border border-zinc-800 flex flex-col sm:flex-row items-center justify-between gap-4">
                      <div className="flex items-center gap-3.5">
                        <div className="p-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-400">
                          <DollarSign className="w-5 h-5 text-accent-cyan" />
                        </div>
                        <div className="text-center sm:text-left">
                          <p className="text-sm font-bold text-white">Taxa de Entrada: R$ 2,00</p>
                          <p className="text-xs text-zinc-500 font-semibold mt-0.5">Seu saldo atual: R$ {(currentUser.saldo || 0).toFixed(2).replace('.', ',')}</p>
                        </div>
                      </div>

                      <button
                        onClick={handleInscricao}
                        disabled={loadingInscricao || (currentUser.saldo || 0) < 2.0}
                        className={`px-6 py-3 rounded-xl font-bold text-sm transition-all select-none cursor-pointer flex items-center gap-2 ${
                          (currentUser.saldo || 0) < 2.0
                            ? 'bg-zinc-800 text-zinc-500 border border-zinc-700/50 cursor-not-allowed'
                            : 'bg-accent-cyan text-zinc-950 hover:bg-cyan-400 shadow-[0_0_15px_rgba(0,240,255,0.2)]'
                        }`}
                      >
                        {loadingInscricao ? (
                          <Spinner size="sm" className="text-zinc-950" />
                        ) : (
                          <Gamepad2 className="w-4 h-4" />
                        )}
                        {loadingInscricao ? 'Confirmando...' : (currentUser.saldo || 0) < 2.0 ? 'Saldo Insuficiente' : 'Inscrever-se por R$ 2,00'}
                      </button>
                    </div>
                  ) : (
                    /* User is inscribed. Show Room credentials if admin released them */
                    <div className="space-y-4">
                      {salaInfo ? (
                        <div className="space-y-4">
                          {/* Room Credentials Panel */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {/* ID Field */}
                            <div className="px-5 py-3 rounded-xl bg-zinc-950 border border-zinc-850 flex items-center justify-between gap-4">
                              <div className="space-y-0.5">
                                <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider block">ID DA SALA FF</span>
                                <span className="text-lg font-black text-white font-mono tracking-wider">{salaInfo.sala_id}</span>
                              </div>
                              <button
                                onClick={() => handleCopy(salaInfo.sala_id, 'id')}
                                className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-900 rounded-lg transition-colors cursor-pointer"
                              >
                                {copiedId ? <Check className="w-4.5 h-4.5 text-emerald-400" /> : <Copy className="w-4.5 h-4.5" />}
                              </button>
                            </div>

                            {/* Password Field */}
                            <div className="px-5 py-3 rounded-xl bg-zinc-950 border border-zinc-850 flex items-center justify-between gap-4">
                              <div className="space-y-0.5">
                                <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider block">SENHA DA SALA</span>
                                <span className="text-lg font-black text-white font-mono tracking-wider">{salaInfo.senha}</span>
                              </div>
                              <button
                                onClick={() => handleCopy(salaInfo.senha, 'senha')}
                                className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-900 rounded-lg transition-colors cursor-pointer"
                              >
                                {copiedSenha ? <Check className="w-4.5 h-4.5 text-emerald-400" /> : <Copy className="w-4.5 h-4.5" />}
                              </button>
                            </div>
                          </div>

                          {/* Countdown Timer Warning */}
                          <div className={`p-4 rounded-xl border flex items-center gap-4 ${
                            secondsLeft > 0 
                              ? 'bg-rose-500/10 border-rose-500/20 text-rose-200' 
                              : 'bg-zinc-950 border-zinc-850 text-zinc-400'
                          }`}>
                            <div className={`p-2.5 rounded-lg bg-zinc-900 flex items-center justify-center ${secondsLeft > 0 ? 'text-rose-500 animate-pulse' : 'text-zinc-600'}`}>
                              <Clock className="w-5 h-5" />
                            </div>
                            <div className="flex-grow">
                              <h5 className="text-sm font-bold">
                                {secondsLeft > 0 
                                  ? 'AtenÃÂ§ÃÂ£o! Entre na sala agora!' 
                                  : 'Contagem regressiva encerrada.'}
                              </h5>
                              <p className="text-xs text-zinc-500 font-medium mt-0.5">
                                {secondsLeft > 0 
                                  ? 'A partida comeÃÂ§arÃÂ¡ em breve. Certifique-se de estar logado na sala.' 
                                  : 'O administrador deve iniciar a partida a qualquer momento.'}
                              </p>
                            </div>
                            {secondsLeft > 0 && (
                              <div className="text-right">
                                <span className="text-2xl font-mono font-black text-rose-500 tracking-wider">
                                  {formatTime(secondsLeft)}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      ) : (
                        /* Registered but admin hasn't released credentials yet */
                        <div className="p-5 rounded-xl border border-dashed border-zinc-800 bg-zinc-950/20 text-center space-y-2">
                          <Gamepad2 className="w-8 h-8 text-zinc-600 mx-auto animate-bounce" />
                          <h5 className="text-sm font-bold text-zinc-300">Sala em PreparaÃÂ§ÃÂ£o</h5>
                          <p className="text-xs text-zinc-500 max-w-sm mx-auto leading-relaxed">
                            VocÃÂª jÃÂ¡ estÃÂ¡ inscrito! O organizador liberarÃÂ¡ o ID e a Senha da sala assim que a queda estiver lotada ou programada para comeÃÂ§ar.
                          </p>
                          <div className="pt-2">
                            <button
                              onClick={() => fetchQuedaStatus()}
                              className="px-4 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-[10px] font-bold text-zinc-400 hover:text-zinc-200 transition-colors cursor-pointer"
                            >
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

          {/* Historical Stats Panel */}
          {historyData && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              
              <div className="p-4 rounded-xl border border-zinc-800 bg-gradient-to-b from-zinc-900/40 to-zinc-950/40 flex items-center justify-between shadow-md">
                <div className="space-y-0.5">
                  <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">Ganhos Acumulados</span>
                  <h4 className="text-lg font-black text-accent-cyan font-mono">
                    R$ {historyData.totalEarnings.toFixed(2).replace('.', ',')}
                  </h4>
                </div>
              </div>

              <div className="p-4 rounded-xl border border-zinc-800 bg-gradient-to-b from-zinc-900/40 to-zinc-950/40 flex items-center justify-between shadow-md">
                <div className="space-y-0.5">
                  <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">Kills de Carreira</span>
                  <h4 className="text-lg font-black text-accent-orange font-mono">
                    {historyData.totalKills}
                  </h4>
                </div>
              </div>

              <div className="p-4 rounded-xl border border-zinc-800 bg-gradient-to-b from-zinc-900/40 to-zinc-950/40 flex items-center justify-between shadow-md">
                <div className="space-y-0.5">
                  <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">Quedas ConcluÃÂ­das</span>
                  <h4 className="text-lg font-black text-primary font-mono">
                    {historyData.totalMatches}
                  </h4>
                </div>
              </div>

              <div className="p-4 rounded-xl border border-zinc-800 bg-gradient-to-b from-zinc-900/40 to-zinc-950/40 flex items-center justify-between shadow-md">
                <div className="space-y-0.5">
                  <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">Rank MÃÂ©dio</span>
                  <h4 className="text-lg font-black text-purple-400 font-mono">
                    {historyData.averagePlacement > 0 ? `${historyData.averagePlacement}ÃÂº` : '-'}
                  </h4>
                </div>
              </div>

            </div>
          )}

          {/* Matches History Section */}
          <div className="space-y-3">
            <h3 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
              <Award className="w-5 h-5 text-primary" />
              Suas PontuaÃÂ§ÃÂµes Anteriores
            </h3>

            <div className="rounded-2xl border border-zinc-800 bg-panel-bg/40 backdrop-blur-md overflow-hidden shadow-xl">
              {loadingHistory ? (
                <div className="py-8 flex justify-center"><Spinner size="sm" /></div>
              ) : historyData && historyData.history.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-zinc-800 bg-zinc-900/50">
                        <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-zinc-400">Queda #</th>
                        <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-zinc-400">ColocaÃÂ§ÃÂ£o</th>
                        <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-zinc-400 text-right">Abates</th>
                        <th className="px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-zinc-400 text-right">PremiaÃÂ§ÃÂ£o</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-900">
                      {historyData.history.map((h: any) => (
                        <tr key={h.numero_queda} className="hover:bg-zinc-900/30 transition-colors">
                          <td className="px-5 py-3 font-bold text-xs text-zinc-300">Queda {h.numero_queda}</td>
                          <td className="px-5 py-3">
                            <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold border ${getPlacementBadge(h.colocacao)}`}>
                              {h.colocacao}ÃÂº lugar
                            </span>
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
                  VocÃÂª ainda nÃÂ£o possui quedas pontuadas registradas neste campeonato.
                </div>
              )}
            </div>
          </div>

        </div>

        {/* RIGHT COLUMN: DIGITAL WALLET & PIX DETAILS (4cols) */}
                {/* RIGHT COLUMN: DIGITAL WALLET & PIX (4cols) */}
                <div className="lg:col-span-4 space-y-6">
                  <div className="bg-panel-bg/40 backdrop-blur-md rounded-2xl border border-zinc-800 p-5 shadow-xl space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-bold text-white tracking-tight flex items-center gap-2">
                        <Wallet className="w-4 h-4 text-primary" />
                        Carteira Digital
                      </h4>
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                    </div>
                    <div className="p-4 bg-zinc-950 rounded-xl border border-zinc-800 text-center space-y-1">
                      <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">Saldo DisponÃ­vel</span>
                      <h3 className="text-3xl font-black text-white font-mono">
                        R$ {(currentUser.saldo || 0).toFixed(2).replace('.', ',')}
                      </h3>
                    </div>
                    <div className="border-t border-zinc-800" />
                    <PixDeposito jogadorId={currentUser.id} />
                  </div>
                </div>

      </div>
    </div>
  );
};
