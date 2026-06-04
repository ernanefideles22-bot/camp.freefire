import React, { useEffect, useState, useCallback } from 'react';
import { Trophy, RefreshCw, ShieldAlert, Award } from 'lucide-react';
import { apiService } from '../services/api';
import type { ClassificacaoItem } from '../services/api';
import { Spinner } from './Spinner';

interface LeaderboardProps {
  onAddToast: (type: 'success' | 'error' | 'warning' | 'info', title: string, desc?: string) => void;
}

export const Leaderboard: React.FC<LeaderboardProps> = ({ onAddToast }) => {
  const [data, setData] = useState<ClassificacaoItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [connected, setConnected] = useState<boolean>(true);
  const [countdown, setCountdown] = useState<number>(30);

  // FIX 1.9: loadData aceita suppressToast=false para autorefresh silencioso
  const loadData = useCallback(async (isSilent = false, suppressToast = false) => {
    if (!isSilent) setLoading(true);
    else setRefreshing(true);

    try {
      const result = await apiService.obterClassificacao();
      setData(result);
      setConnected(true);
      setCountdown(30);
      // Toast apenas em refresh manual (nao no polling automatico)
      if (isSilent && !suppressToast) {
        onAddToast('success', 'Tabela Atualizada', 'Os dados de classificacao foram atualizados com sucesso.');
      }
    } catch (err) {
      // Em refresh automatico, falha silenciosa (sem spam de toasts)
      if (!suppressToast) {
        setConnected(false);
        onAddToast('error', 'Erro ao Carregar Dados', 'Nao foi possivel buscar a classificacao do campeonato.');
      } else {
        setConnected(false);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [onAddToast]);

  // Initial load
  useEffect(() => {
    loadData();
  }, [loadData]);

  // FIX 1.9: separar countdown (1s) do fetch (30s) — sem toast automatico
  useEffect(() => {
    // Countdown visual a cada 1s (sem chamar API)
    const countdownTimer = setInterval(() => {
      setCountdown((prev) => (prev <= 1 ? 30 : prev - 1));
    }, 1000);

    // Fetch silencioso a cada 30s — sem toast automatico
    const fetchTimer = setInterval(() => {
      loadData(false, true); // silent = true (sem toast)
    }, 30000);

    return () => {
      clearInterval(countdownTimer);
      clearInterval(fetchTimer);
    };
  }, [loadData]);


  const handleManualRefresh = () => {
    loadData(true);
  };

  const getRankBadge = (posicao: number) => {
    if (posicao === 1) {
      return (
        <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-gradient-to-r from-yellow-400 to-amber-500 text-zinc-950 font-black shadow-[0_0_10px_rgba(251,191,36,0.5)]">
          1º
        </span>
      );
    }
    if (posicao === 2) {
      return (
        <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-gradient-to-r from-zinc-300 to-zinc-400 text-zinc-950 font-black shadow-[0_0_10px_rgba(209,213,219,0.4)]">
          2º
        </span>
      );
    }
    if (posicao === 3) {
      return (
        <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-gradient-to-r from-amber-600 to-amber-700 text-white font-black shadow-[0_0_10px_rgba(180,83,9,0.4)]">
          3º
        </span>
      );
    }
    return <span className="text-zinc-500 font-semibold text-sm pl-2">{posicao}º</span>;
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <Spinner size="lg" />
        <p className="text-zinc-400 font-medium text-sm animate-pulse">Buscando dados da LBFF Solo...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header controls & stats */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <Trophy className="w-6 h-6 text-primary animate-neon" />
            Classificação Geral
          </h2>
          <p className="text-sm text-zinc-400">
            Acompanhe o ranking e os prêmios acumulados do campeonato.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Status Badge */}
          {connected ? (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-xs font-semibold text-emerald-400">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
              API Conectada
            </div>
          ) : (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-rose-500/10 border border-rose-500/20 text-xs font-semibold text-rose-400">
              <ShieldAlert className="w-3.5 h-3.5" />
              API Offline
            </div>
          )}

          {/* Autorefresh indicator */}
          <div className="text-xs text-zinc-500 font-mono hidden md:block">
            Auto-refresh em {countdown}s
          </div>

          {/* Manual reload button */}
          <button
            onClick={handleManualRefresh}
            disabled={refreshing}
            className="flex items-center justify-center gap-2 px-4 py-2 text-sm font-semibold rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-200 hover:bg-zinc-800 active:scale-95 disabled:opacity-50 transition-all cursor-pointer shadow-md"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin text-primary' : ''}`} />
            {refreshing ? 'Atualizando...' : 'Atualizar'}
          </button>
        </div>
      </div>

      {/* Main Table */}
      <div className="relative overflow-hidden rounded-2xl border border-zinc-800 bg-panel-bg/40 backdrop-blur-md shadow-xl">
        <div className="overflow-x-auto">
          {data.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-12 text-center">
              <Award className="w-12 h-12 text-zinc-600 mb-3" />
              <h3 className="text-lg font-bold text-zinc-300">Nenhum jogador pontuou ainda</h3>
              <p className="text-sm text-zinc-500 max-w-sm mt-1">
                Cadastre jogadores e envie os resultados das quedas no Painel do Administrador para ver o ranking subir.
              </p>
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-zinc-800 bg-zinc-900/50">
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-zinc-400 w-20">Pos</th>
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-zinc-400">Jogador</th>
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-zinc-400 text-right text-accent-orange font-mono">
                    Ganhos (R$)
                  </th>
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-zinc-400 text-right hidden sm:table-cell">
                    Pontos LBFF
                  </th>
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-zinc-400 text-right">
                    Kills (Abates)
                  </th>
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-zinc-400 text-right hidden sm:table-cell">
                    Quedas
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-900">
                {data.map((item) => {
                  const isTop3 = item.posicao <= 3;
                  return (
                    <tr
                      key={item.jogador_id}
                      className={`group hover:bg-zinc-800/35 transition-colors ${
                        isTop3
                          ? 'bg-gradient-to-r from-primary/5 via-transparent to-transparent'
                          : ''
                      }`}
                    >
                      {/* Rank Position */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        {getRankBadge(item.posicao)}
                      </td>

                      {/* Nickname & Player Details */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="font-bold text-white group-hover:text-primary transition-colors text-base">
                          {item.nick}
                        </span>
                      </td>

                      {/* Total Prize money */}
                      <td className="px-6 py-4 whitespace-nowrap text-right font-black text-accent-cyan text-base font-mono">
                        R$ {(item.ganhos_reais || 0).toFixed(2).replace('.', ',')}
                      </td>

                      {/* LBFF Score points */}
                      <td className="px-6 py-4 whitespace-nowrap text-right text-zinc-300 font-semibold text-sm hidden sm:table-cell">
                        {item.total_pontos} pts
                      </td>

                      {/* Kills Count */}
                      <td className="px-6 py-4 whitespace-nowrap text-right text-zinc-300 font-medium text-sm">
                        {item.total_abates}
                      </td>

                      {/* Falls Played */}
                      <td className="px-6 py-4 whitespace-nowrap text-right text-zinc-400 text-sm hidden sm:table-cell">
                        {item.quedas_jogadas}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Rules Footer Summary */}
      <div className="p-4 rounded-xl bg-zinc-950/40 border border-zinc-900 flex flex-col md:flex-row justify-between items-center gap-4 text-xs text-zinc-500">
        <p>🏆 Classificação prioritária por **Prêmio Acumulado**, seguido de **Pontos LBFF** (colocação + abates).</p>
        <p className="flex items-center gap-3">
          <span className="text-zinc-400 font-bold">Taxa: R$ 2,00</span>
          <span>•</span>
          <span>1º: R$ 20</span>
          <span>•</span>
          <span>2º: R$ 10</span>
          <span>•</span>
          <span>3º: R$ 7</span>
          <span>•</span>
          <span>4º: R$ 5</span>
          <span>•</span>
          <span>5º-10º: R$ 1,50</span>
        </p>
      </div>
    </div>
  );
};
