import React, { useState, useEffect, useRef } from 'react';
import { UserPlus, Calendar, Plus, Trash2, Send, Key, Lock, Check, X, Upload, AlertTriangle, RefreshCw, Landmark } from 'lucide-react';
import { apiService, getPremioPorColocacao } from '../services/api';
import type { Jogador, ResultadoQuedaInput, DepositoRequisicao } from '../services/api';
import { Spinner } from './Spinner';
import { AdminAgentChat } from './AdminAgentChat';

interface AdminPanelProps {
  onAddToast: (type: 'success' | 'error' | 'warning' | 'info', title: string, desc?: string) => void;
  currentUser?: Jogador;
}

interface LinhaResultado {
  tempId: string;
  jogadorId: string;
  colocacao: string;
  abates: string;
  jogadorDetectadoNick?: string;
}

export const AdminPanel: React.FC<AdminPanelProps> = ({ onAddToast, currentUser: _currentUser }) => {
  // --- STATE FOR TABS ---
  const [activeTab, setActiveTab] = useState<'geral' | 'lancar' | 'depositos'>('geral');

  // --- STATE FOR PLAYER FORM ---
  const [nome, setNome] = useState<string>('');
  const [nick, setNick] = useState<string>('');
  const [loadingPlayer, setLoadingPlayer] = useState<boolean>(false);

  // --- STATE FOR ROOM FORM ---
  const [salaQueda, setSalaQueda] = useState<string>('1');
  const [salaId, setSalaId] = useState<string>('');
  const [salaSenha, setSalaSenha] = useState<string>('');
  const [loadingSala, setLoadingSala] = useState<boolean>(false);

  // --- STATE FOR CANCEL ROOM FORM ---
  const [quedaParaCancelar, setQuedaParaCancelar] = useState<string>('');
  const [loadingCancelar, setLoadingCancelar] = useState<boolean>(false);

  // --- STATE FOR RESULTS FORM (OCR & Manual) ---
  const [numeroQueda, setNumeroQueda] = useState<string>('1');
  const [linhas, setLinhas] = useState<LinhaResultado[]>([
    { tempId: '1', jogadorId: '', colocacao: '', abates: '0' }
  ]);
  const [loadingResults, setLoadingResults] = useState<boolean>(false);
  const [loadingOcr, setLoadingOcr] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- STATE FOR DEPOSITS LIST ---
  const [depositos, setDepositos] = useState<DepositoRequisicao[]>([]);
  const [loadingDepositos, setLoadingDepositos] = useState<boolean>(false);

  // --- PLAYERS LIST STATE ---
  const [players, setPlayers] = useState<Jogador[]>([]);
  const [loadingPlayersList, setLoadingPlayersList] = useState<boolean>(false);

  // Load players to populate the dropdowns
  const fetchPlayers = async () => {
    setLoadingPlayersList(true);
    try {
      const data = await apiService.getJogadores();
      setPlayers(data);
    } catch (err) {
      onAddToast('error', 'Falha ao buscar jogadores', 'Não foi possível listar os jogadores cadastrados.');
    } finally {
      setLoadingPlayersList(false);
    }
  };

  // Load pending deposits
  const fetchDepositos = async () => {
    setLoadingDepositos(true);
    try {
      const data = await apiService.obterDepositosPendentes();
      setDepositos(data);
    } catch (err) {
      console.error("Erro ao buscar depósitos pendentes", err);
    } finally {
      setLoadingDepositos(false);
    }
  };

  useEffect(() => {
    fetchPlayers();
    fetchDepositos();

    // Poll for pending deposits every 20 seconds to keep admin updated
    const interval = setInterval(fetchDepositos, 20000);
    return () => clearInterval(interval);
  }, []);

  // --- HANDLERS FOR PLAYER REGISTRATION ---
  const handleRegisterPlayer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome.trim() || !nick.trim()) {
      onAddToast('warning', 'Campos Obrigatórios', 'Preencha todos os campos para cadastrar o jogador.');
      return;
    }

    setLoadingPlayer(true);

    try {
      const newPlayer = await apiService.cadastrarJogador(nome.trim(), nick.trim());
      onAddToast('success', 'Jogador Cadastrado', `Jogador "${newPlayer.nick}" adicionado com sucesso!`);
      setNome('');
      setNick('');
      await fetchPlayers();
    } catch (err: any) {
      if (err.status === 400) {
        onAddToast('error', 'Nick Duplicado', err.message || 'Este nick de jogo já está sendo utilizado.');
      } else {
        onAddToast('error', 'Erro no Cadastro', 'Não foi possível cadastrar o jogador no momento.');
      }
    } finally {
      setLoadingPlayer(false);
    }
  };

  // --- HANDLERS FOR ROOM REGISTRATION ---
  const handleRegisterRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    const quedaNum = parseInt(salaQueda);
    if (isNaN(quedaNum) || quedaNum <= 0) {
      onAddToast('warning', 'Queda Inválida', 'Por favor, insira um número de queda válido.');
      return;
    }
    if (!salaId.trim() || !salaSenha.trim()) {
      onAddToast('warning', 'Campos Vazios', 'Preencha o ID e a Senha da sala.');
      return;
    }

    setLoadingSala(true);

    try {
      await apiService.liberarSala(quedaNum, salaId.trim(), salaSenha.trim());
      onAddToast('success', 'Sala Liberada', `Dados da Sala para a Queda ${quedaNum} salvos com sucesso!`);
      setSalaId('');
      setSalaSenha('');
      setSalaQueda((quedaNum + 1).toString());
    } catch (err) {
      onAddToast('error', 'Falha ao Enviar', 'Não foi possível registrar os dados da sala no backend.');
    } finally {
      setLoadingSala(false);
    }
  };

  // --- HANDLERS FOR CANCEL / REIMBURSE ROOM ---
  const handleCancelQueda = async (e: React.FormEvent) => {
    e.preventDefault();
    const numero = parseInt(quedaParaCancelar);
    if (isNaN(numero) || numero <= 0) {
      onAddToast('warning', 'Queda Inválida', 'Insira um número de queda válido para cancelar.');
      return;
    }

    const confirmou = window.confirm(`Você realmente deseja CANCELAR a queda #${numero} e reembolsar R$ 2,00 para todos os inscritos?`);
    if (!confirmou) return;

    setLoadingCancelar(true);
    try {
      const res = await apiService.cancelarQuedaReembolsar(numero);
      onAddToast('success', 'Queda Cancelada e Reembolsada', res.message || `A queda #${numero} foi cancelada com sucesso.`);
      setQuedaParaCancelar('');
      await fetchPlayers(); // refresh balances
    } catch (err: any) {
      onAddToast('error', 'Falha ao Cancelar', err.message || 'Não foi possível cancelar e reembolsar.');
    } finally {
      setLoadingCancelar(false);
    }
  };

  // --- HANDLERS FOR DEPOSITS ---
  const handleProcessarDeposito = async (depositoId: number, status: 'aprovado' | 'rejeitado') => {
    try {
      const res = await apiService.processarDeposito(depositoId, status);
      onAddToast(
        status === 'aprovado' ? 'success' : 'warning',
        status === 'aprovado' ? 'Depósito Aprovado' : 'Depósito Rejeitado',
        res.message || `Depósito #${depositoId} foi ${status} com sucesso.`
      );
      await fetchDepositos();
      await fetchPlayers(); // refresh player list to update shown balance
    } catch (err: any) {
      onAddToast('error', 'Falha ao Processar', err.message || 'Erro ao processar requisição de depósito.');
    }
  };

  // --- HANDLERS FOR RESULTS BUILDER ---
  const handleAddLinha = () => {
    const nextId = (linhas.length > 0 ? Math.max(...linhas.map(l => parseInt(l.tempId))) + 1 : 1).toString();
    setLinhas([
      ...linhas,
      { tempId: nextId, jogadorId: '', colocacao: '', abates: '0' }
    ]);
  };

  const handleRemoveLinha = (tempId: string) => {
    if (linhas.length === 1) {
      onAddToast('warning', 'Ação Bloqueada', 'Você deve lançar o resultado de pelo menos 1 jogador.');
      return;
    }
    setLinhas(linhas.filter(l => l.tempId !== tempId));
  };

  const handleUpdateLinha = (tempId: string, field: keyof LinhaResultado, value: string) => {
    setLinhas(
      linhas.map(l => {
        if (l.tempId === tempId) {
          return { ...l, [field]: value };
        }
        return l;
      })
    );
  };

  // --- HANDLER FOR OCR SCANNER ---
  const handleOcrUpload = async (file: File) => {
    const quedaNum = parseInt(numeroQueda);
    if (isNaN(quedaNum) || quedaNum <= 0) {
      onAddToast('warning', 'Defina a Queda', 'Por favor, insira o número da queda antes de fazer o upload do print.');
      return;
    }

    setLoadingOcr(true);
    try {
      const data = await apiService.processarOcrResultado(quedaNum, file);
      
      if (data && data.resultados && data.resultados.length > 0) {
        const ocrLinhas: LinhaResultado[] = data.resultados.map((res: any, idx: number) => ({
          tempId: String(idx + 1),
          jogadorId: res.jogador_id ? String(res.jogador_id) : '',
          colocacao: String(res.colocacao),
          abates: String(res.abates),
          jogadorDetectadoNick: res.jogador_nick
        }));
        
        setLinhas(ocrLinhas);
        onAddToast(
          'success',
          'Print Lançado via OCR',
          `Gemini identificou ${data.resultados.length} jogadores do placar. Verifique os dados e salve.`
        );
      } else {
        onAddToast('warning', 'OCR Vazio', 'Não foi possível extrair nenhum competidor do print. Tente outra imagem.');
      }
    } catch (err: any) {
      onAddToast(
        'error',
        'Erro no OCR Gemini',
        err.message || 'Erro ao processar imagem. Verifique a GEMINI_API_KEY no backend.'
      );
    } finally {
      setLoadingOcr(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleSendResults = async (e: React.FormEvent) => {
    e.preventDefault();

    const quedaNum = parseInt(numeroQueda);
    if (isNaN(quedaNum) || quedaNum <= 0) {
      onAddToast('warning', 'Queda Inválida', 'Por favor, defina um número válido para a queda.');
      return;
    }

    const formattedResultados: ResultadoQuedaInput[] = [];
    const selectedPlayers = new Set<number>();

    for (const [idx, linha] of linhas.entries()) {
      const pId = parseInt(linha.jogadorId);
      const place = parseInt(linha.colocacao);
      const kills = parseInt(linha.abates);

      if (isNaN(pId)) {
        onAddToast('warning', 'Jogador Pendente', `Selecione o jogador correspondente para a linha #${idx + 1}.`);
        return;
      }

      if (isNaN(place) || place < 1 || place > 52) {
        onAddToast('warning', 'Colocação Inválida', `A colocação na linha #${idx + 1} deve ser entre 1 e 52.`);
        return;
      }

      if (isNaN(kills) || kills < 0) {
        onAddToast('warning', 'Abates Inválidos', `Os abates na linha #${idx + 1} devem ser maiores ou iguais a zero.`);
        return;
      }

      if (selectedPlayers.has(pId)) {
        const playerNick = players.find(p => p.id === pId)?.nick || 'jogador';
        onAddToast('warning', 'Duplicação', `O jogador "${playerNick}" está duplicado na queda.`);
        return;
      }

      selectedPlayers.add(pId);
      formattedResultados.push({
        jogador_id: pId,
        colocacao: place,
        abates: kills
      });
    }

    setLoadingResults(true);

    try {
      await apiService.lancarResultados(quedaNum, formattedResultados);
      onAddToast('success', 'Resultados Registrados', `Queda ${quedaNum} lançada com sucesso no campeonato! Saldos dos vencedores foram creditados.`);
      
      // Reset form
      setLinhas([{ tempId: '1', jogadorId: '', colocacao: '', abates: '0' }]);
      setNumeroQueda((quedaNum + 1).toString());
      await fetchPlayers(); // Refresh balances in UI
    } catch (err: any) {
      onAddToast('error', 'Falha ao Enviar', err.message || 'Não foi possível registrar os resultados.');
    } finally {
      setLoadingResults(false);
    }
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-start">
      {/* LEFT: Work area organized with tabs */}
      <div className="xl:col-span-2 space-y-6">
        {/* Modern Tabs Bar */}
        <div className="flex border-b border-zinc-800 gap-1 overflow-x-auto pb-px">
          <button
            onClick={() => setActiveTab('geral')}
            className={`px-5 py-3 font-bold text-xs uppercase tracking-wider transition-all border-b-2 flex items-center gap-2 cursor-pointer whitespace-nowrap ${
              activeTab === 'geral'
                ? 'border-primary text-primary shadow-[0_4px_12px_rgba(168,85,247,0.15)] font-extrabold'
                : 'border-transparent text-zinc-400 hover:text-white'
            }`}
          >
            <UserPlus className="w-4 h-4" />
            Painel Geral
          </button>
          
          <button
            onClick={() => setActiveTab('lancar')}
            className={`px-5 py-3 font-bold text-xs uppercase tracking-wider transition-all border-b-2 flex items-center gap-2 cursor-pointer whitespace-nowrap ${
              activeTab === 'lancar'
                ? 'border-accent-cyan text-accent-cyan shadow-[0_4px_12px_rgba(6,182,212,0.15)] font-extrabold'
                : 'border-transparent text-zinc-400 hover:text-white'
            }`}
          >
            <Calendar className="w-4 h-4" />
            Lançar Quedas (IA OCR)
          </button>

          <button
            onClick={() => setActiveTab('depositos')}
            className={`px-5 py-3 font-bold text-xs uppercase tracking-wider transition-all border-b-2 flex items-center gap-2 cursor-pointer relative whitespace-nowrap ${
              activeTab === 'depositos'
                ? 'border-emerald-500 text-emerald-400 shadow-[0_4px_12px_rgba(16,185,129,0.15)] font-extrabold'
                : 'border-transparent text-zinc-400 hover:text-white'
            }`}
          >
            <Landmark className="w-4 h-4" />
            Depósitos Pix
            {depositos.length > 0 && (
              <span className="absolute top-1.5 right-1.5 flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
              </span>
            )}
          </button>
        </div>

        {/* TAB 1: PAINEL GERAL (REGISTER COMPETITOR, RELEASE ROOM, CANCEL ROOM) */}
        {activeTab === 'geral' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
            {/* CARD: REGISTER COMPETITOR */}
            <div className="p-6 rounded-2xl border border-zinc-800 bg-panel-bg/40 backdrop-blur-md shadow-xl space-y-6">
              <div className="space-y-1">
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <UserPlus className="w-5 h-5 text-primary animate-neon" />
                  Cadastrar Jogador
                </h2>
                <p className="text-xs text-zinc-400">
                  Adicione jogadores para que possam fazer login e participar de quedas.
                </p>
              </div>

              <form onSubmit={handleRegisterPlayer} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Nome Completo</label>
                  <input
                    type="text"
                    placeholder="Ex: Pedro Henrique"
                    value={nome}
                    onChange={(e) => setNome(e.target.value)}
                    disabled={loadingPlayer}
                    className="w-full px-4 py-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-white text-sm placeholder-zinc-600 focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none transition-all"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Nickname do Jogo</label>
                  <input
                    type="text"
                    placeholder="Ex: PH"
                    value={nick}
                    onChange={(e) => setNick(e.target.value)}
                    disabled={loadingPlayer}
                    className="w-full px-4 py-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-white text-sm placeholder-zinc-600 focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none transition-all"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loadingPlayer || !nome.trim() || !nick.trim()}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-primary hover:bg-primary-dark text-white font-bold transition-all disabled:opacity-50 disabled:pointer-events-none cursor-pointer shadow-md"
                >
                  {loadingPlayer ? <Spinner size="sm" /> : <Plus className="w-4 h-4" />}
                  {loadingPlayer ? 'Cadastrando...' : 'Cadastrar Competidor'}
                </button>
              </form>
            </div>

            {/* CARD: RELEASE ROOM */}
            <div className="p-6 rounded-2xl border border-zinc-800 bg-panel-bg/40 backdrop-blur-md shadow-xl space-y-6">
              <div className="space-y-1">
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <Key className="w-5 h-5 text-accent-orange" />
                  Liberar Sala e Senha
                </h2>
                <p className="text-xs text-zinc-400">
                  Insira os dados da sala personalizada. Ficará disponível aos inscritos.
                </p>
              </div>

              <form onSubmit={handleRegisterRoom} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Número da Queda</label>
                  <input
                    type="number"
                    min="1"
                    value={salaQueda}
                    onChange={(e) => setSalaQueda(e.target.value)}
                    disabled={loadingSala}
                    className="w-full px-4 py-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-white text-sm focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none transition-all"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">ID da Sala (Custom)</label>
                  <input
                    type="text"
                    placeholder="Ex: 549382"
                    value={salaId}
                    onChange={(e) => setSalaId(e.target.value)}
                    disabled={loadingSala}
                    className="w-full px-4 py-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-white text-sm placeholder-zinc-600 focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none transition-all"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Senha da Sala</label>
                  <input
                    type="text"
                    placeholder="Ex: 1234"
                    value={salaSenha}
                    onChange={(e) => setSalaSenha(e.target.value)}
                    disabled={loadingSala}
                    className="w-full px-4 py-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-white text-sm placeholder-zinc-600 focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none transition-all"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loadingSala || !salaId.trim() || !salaSenha.trim()}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-gradient-to-r from-accent-orange to-amber-600 text-white font-bold transition-all disabled:opacity-50 disabled:pointer-events-none cursor-pointer shadow-md hover:shadow-[0_0_15px_rgba(249,115,22,0.2)]"
                >
                  {loadingSala ? <Spinner size="sm" /> : <Lock className="w-4 h-4" />}
                  {loadingSala ? 'Liberando...' : 'Liberar Credenciais'}
                </button>
              </form>
            </div>

            {/* CARD: CANCEL ROOM & REIMBURSE */}
            <div className="p-6 rounded-2xl border border-zinc-800 bg-panel-bg/40 backdrop-blur-md shadow-xl space-y-6 md:col-span-2">
              <div className="space-y-1">
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-rose-500 animate-pulse" />
                  Cancelar Queda e Reembolsar
                </h2>
                <p className="text-xs text-zinc-400">
                  Cancele uma queda não lotada. Isso removerá as inscrições e devolverá automaticamente R$ 2,00 para a carteira de todos os jogadores participantes.
                </p>
              </div>

              <form onSubmit={handleCancelQueda} className="flex flex-col sm:flex-row items-stretch sm:items-end gap-4">
                <div className="flex-1 space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Número da Queda para Cancelar</label>
                  <input
                    type="number"
                    min="1"
                    placeholder="Ex: 1"
                    value={quedaParaCancelar}
                    onChange={(e) => setQuedaParaCancelar(e.target.value)}
                    disabled={loadingCancelar}
                    className="w-full px-4 py-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-white text-sm focus:border-rose-500 focus:ring-1 focus:ring-rose-500 focus:outline-none transition-all"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loadingCancelar || !quedaParaCancelar.trim()}
                  className="flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold transition-all disabled:opacity-50 disabled:pointer-events-none cursor-pointer shadow-md"
                >
                  {loadingCancelar ? <Spinner size="sm" /> : <Trash2 className="w-4 h-4" />}
                  {loadingCancelar ? 'Cancelando...' : 'Cancelar e Reembolsar Competidores'}
                </button>
              </form>
            </div>
          </div>
        )}

        {/* TAB 2: RESULTS LAUNCHER (WITH OCR AND MANUAL BUILDER) */}
        {activeTab === 'lancar' && (
          <div className="p-6 rounded-2xl border border-zinc-800 bg-panel-bg/40 backdrop-blur-md shadow-xl space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="space-y-1">
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-accent-cyan" />
                  Lançador de Resultados de Queda
                </h2>
                <p className="text-xs text-zinc-400">
                  Lançamento de colocações (1-52) e abates. Utilize OCR Inteligente por imagem para preenchimento instantâneo.
                </p>
              </div>

              <div className="flex items-center gap-2 bg-zinc-950 border border-zinc-800 px-3 py-1.5 rounded-xl">
                <span className="text-[10px] font-bold text-zinc-400 uppercase">Queda:</span>
                <input
                  type="number"
                  min="1"
                  value={numeroQueda}
                  onChange={(e) => setNumeroQueda(e.target.value)}
                  disabled={loadingResults || loadingOcr}
                  className="w-16 bg-transparent border-none text-white text-center text-sm font-black focus:outline-none"
                />
              </div>
            </div>

            {/* OCR Drag-Drop Image Uploader */}
            <div className="p-4 rounded-xl border border-dashed border-zinc-800 bg-zinc-950/20 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
                  <Upload className="w-3.5 h-3.5 text-accent-cyan" />
                  Carregar Print de Placar (IA OCR Gemini)
                </span>
                <span className="text-[9px] text-zinc-500 bg-zinc-900 border border-zinc-800 px-1.5 py-0.5 rounded">
                  Requer GEMINI_API_KEY
                </span>
              </div>

              <div
                className="border border-dashed border-zinc-800 hover:border-accent-cyan/50 rounded-lg p-6 flex flex-col items-center justify-center text-center cursor-pointer bg-zinc-950/40 hover:bg-zinc-950/80 transition-all group"
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
                onDrop={async (e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  const files = e.dataTransfer.files;
                  if (files && files.length > 0) {
                    await handleOcrUpload(files[0]);
                  }
                }}
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={async (e) => {
                    const files = e.target.files;
                    if (files && files.length > 0) {
                      await handleOcrUpload(files[0]);
                    }
                  }}
                  accept="image/*"
                  className="hidden"
                />
                {loadingOcr ? (
                  <div className="space-y-2 py-2">
                    <Spinner size="md" className="mx-auto text-accent-cyan" />
                    <p className="text-xs font-bold text-accent-cyan animate-pulse">
                      Gemini OCR analisando placar...
                    </p>
                    <p className="text-[10px] text-zinc-500">
                      Mapeando nicks detectados com a base de dados
                    </p>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    <Upload className="w-8 h-8 text-zinc-600 group-hover:text-accent-cyan mx-auto transition-colors" />
                    <p className="text-xs text-zinc-300">
                      <span className="font-bold text-accent-cyan">Arraste o print do placar final</span> ou clique para escolher
                    </p>
                    <p className="text-[10px] text-zinc-500">
                      Suporta capturas de tela contendo os apelidos, colocação e quantidade de abates
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Results interactive grid */}
            <form onSubmit={handleSendResults} className="space-y-4">
              <div className="space-y-2.5 max-h-[450px] overflow-y-auto pr-1">
                {linhas.map((linha, index) => {
                  const placeNum = parseInt(linha.colocacao);
                  const cashPrize = !isNaN(placeNum) ? getPremioPorColocacao(placeNum) : 0;

                  return (
                    <div
                      key={linha.tempId}
                      className="flex flex-col md:flex-row items-stretch md:items-center gap-3 p-4 rounded-xl border border-zinc-900 bg-zinc-950/40 relative group"
                    >
                      <div className="flex items-center gap-2 md:w-8 text-xs font-bold text-zinc-600">
                        #{index + 1}
                      </div>

                      {/* SELECT PLAYER */}
                      <div className="flex-1 min-w-[180px] space-y-1">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 block md:hidden">Jogador</label>
                        <select
                          value={linha.jogadorId}
                          onChange={(e) => handleUpdateLinha(linha.tempId, 'jogadorId', e.target.value)}
                          disabled={loadingResults || loadingPlayersList || loadingOcr}
                          className="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-200 text-sm focus:border-primary focus:outline-none"
                        >
                          <option value="">-- Vincular Competidor --</option>
                          {players.map(p => (
                            <option key={p.id} value={p.id}>{p.nick} ({p.nome})</option>
                          ))}
                        </select>
                        {linha.jogadorDetectadoNick && (
                          <div className="flex items-center gap-1">
                            <span className="text-[9px] font-extrabold text-amber-500/80 bg-amber-500/5 border border-amber-500/10 px-1.5 py-0.5 rounded">
                              OCR: "{linha.jogadorDetectadoNick}"
                            </span>
                            {!linha.jogadorId && (
                              <span className="text-[9px] text-zinc-500 italic">
                                (Não vinculado automaticamente)
                              </span>
                            )}
                          </div>
                        )}
                      </div>

                      {/* PLACING */}
                      <div className="w-full md:w-32">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 block md:hidden">Colocação</label>
                        <input
                          type="number"
                          min="1"
                          max="52"
                          placeholder="Posição (1-52)"
                          value={linha.colocacao}
                          onChange={(e) => handleUpdateLinha(linha.tempId, 'colocacao', e.target.value)}
                          disabled={loadingResults || loadingOcr}
                          className="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-200 text-sm focus:border-primary focus:outline-none"
                        />
                      </div>

                      {/* KILLS */}
                      <div className="w-full md:w-24">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 block md:hidden">Kills</label>
                        <input
                          type="number"
                          min="0"
                          placeholder="Kills"
                          value={linha.abates}
                          onChange={(e) => handleUpdateLinha(linha.tempId, 'abates', e.target.value)}
                          disabled={loadingResults || loadingOcr}
                          className="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-200 text-sm focus:border-primary focus:outline-none"
                        />
                      </div>

                      {/* CASH PRIZE PREVIEW */}
                      <div className="w-full md:w-32 flex items-center gap-1.5 md:justify-end px-1">
                        <span className="text-zinc-500 text-xs md:hidden">Prêmio: </span>
                        {cashPrize > 0 ? (
                          <span className="text-xs font-black text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-lg">
                            + R$ {cashPrize.toFixed(2).replace('.', ',')}
                          </span>
                        ) : (
                          <span className="text-xs text-zinc-600 font-semibold bg-zinc-900 border border-zinc-800/40 px-2.5 py-1 rounded-lg">
                            R$ 0,00
                          </span>
                        )}
                      </div>

                      {/* DELETE ROW */}
                      <button
                        type="button"
                        onClick={() => handleRemoveLinha(linha.tempId)}
                        disabled={loadingResults || loadingOcr}
                        className="p-2 text-zinc-600 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer self-end md:self-auto"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  );
                })}
              </div>

              {/* Action buttons */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-zinc-800/60">
                <button
                  type="button"
                  onClick={handleAddLinha}
                  disabled={loadingResults || loadingOcr || players.length === 0}
                  className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl border border-dashed border-zinc-700 text-zinc-300 hover:text-white hover:border-accent-cyan transition-all active:scale-95 cursor-pointer text-xs font-bold uppercase tracking-wider"
                >
                  <Plus className="w-4 h-4" />
                  Adicionar Linha
                </button>

                <button
                  type="submit"
                  disabled={loadingResults || loadingOcr || players.length === 0}
                  className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-accent-cyan to-cyan-600 text-zinc-950 font-black hover:shadow-[0_0_20px_rgba(0,240,255,0.3)] transition-all active:scale-95 cursor-pointer text-xs font-bold uppercase tracking-wider"
                >
                  {loadingResults ? <Spinner size="sm" className="border-t-zinc-950" /> : <Send className="w-4 h-4" />}
                  {loadingResults ? 'Gravando...' : 'Salvar Queda e Pagar'}
                </button>
              </div>

              {players.length === 0 && (
                <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-400">
                  ⚠️ Não existem competidores cadastrados no banco de dados. Cadastre jogadores no painel geral primeiro.
                </div>
              )}
            </form>
          </div>
        )}

        {/* TAB 3: PENDING DEPOSITS PIX APPROVAL */}
        {activeTab === 'depositos' && (
          <div className="p-6 rounded-2xl border border-zinc-800 bg-panel-bg/40 backdrop-blur-md shadow-xl space-y-6">
            <div className="flex items-center justify-between gap-4">
              <div className="space-y-1">
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <Landmark className="w-5 h-5 text-emerald-400 animate-neon" />
                  Depósitos PIX Pendentes
                </h2>
                <p className="text-xs text-zinc-400">
                  Valide a transação no extrato da sua conta bancária antes de aprovar e creditar o saldo na conta do competidor.
                </p>
              </div>

              <button
                onClick={fetchDepositos}
                disabled={loadingDepositos}
                className="p-2 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-400 hover:text-white transition-colors cursor-pointer"
                title="Atualizar"
              >
                <RefreshCw className={`w-4.5 h-4.5 ${loadingDepositos ? 'animate-spin' : ''}`} />
              </button>
            </div>

            {loadingDepositos && depositos.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 space-y-3">
                <Spinner size="md" className="text-emerald-400" />
                <p className="text-xs text-zinc-400">Carregando solicitações de recarga...</p>
              </div>
            ) : depositos.length === 0 ? (
              <div className="border border-dashed border-zinc-800 rounded-xl p-12 text-center text-zinc-500">
                <Landmark className="w-12 h-12 text-zinc-700 mx-auto mb-3" />
                <p className="text-sm font-bold text-zinc-400">Nenhum depósito pendente</p>
                <p className="text-xs text-zinc-500 mt-1">
                  Os depósitos solicitados pelos jogadores via PIX manual aparecerão aqui.
                </p>
              </div>
            ) : (
              <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
                {depositos.map((dep) => (
                  <div
                    key={dep.id}
                    className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 p-4 rounded-xl border border-zinc-900 bg-zinc-950/60 transition-all hover:border-zinc-800/80"
                  >
                    <div className="space-y-1 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-black text-white">
                          {dep.jogador_nick || 'Jogador Desconhecido'}
                        </span>
                        <span className="text-[9px] bg-zinc-800 text-zinc-400 px-1.5 py-0.5 rounded font-mono">
                          ID Jogador: #{dep.jogador_id}
                        </span>
                      </div>
                      <p className="text-[10px] text-zinc-500">
                        Solicitado em: {dep.data_hora}
                      </p>
                    </div>

                    <div className="flex items-center gap-4 justify-between sm:justify-end border-t sm:border-none pt-3 sm:pt-0 border-zinc-900">
                      <div className="text-left sm:text-right">
                        <p className="text-[9px] text-zinc-500 font-bold uppercase tracking-wider">Valor Solicitado</p>
                        <span className="text-base font-black text-emerald-400">
                          R$ {dep.valor.toFixed(2).replace('.', ',')}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => handleProcessarDeposito(dep.id, 'aprovado')}
                          className="p-2 rounded-xl bg-emerald-500/10 hover:bg-emerald-500 text-emerald-400 hover:text-zinc-950 border border-emerald-500/20 hover:border-emerald-500 transition-all cursor-pointer flex items-center justify-center"
                          title="Aprovar Depósito (Creditar Saldo)"
                        >
                          <Check className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleProcessarDeposito(dep.id, 'rejeitado')}
                          className="p-2 rounded-xl bg-rose-500/10 hover:bg-rose-500 text-rose-400 hover:text-zinc-950 border border-rose-500/20 hover:border-rose-500 transition-all cursor-pointer flex items-center justify-center"
                          title="Rejeitar Depósito"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* RIGHT: AI Admin Agent Chat (always visible) */}
      <div className="xl:col-span-1">
        <AdminAgentChat onAddToast={onAddToast} onRefreshData={fetchPlayers} />
      </div>
    </div>
  );
};
