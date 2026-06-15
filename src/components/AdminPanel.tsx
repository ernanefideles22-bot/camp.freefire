import React, { useState, useEffect, useRef } from 'react';
import { UserPlus, Calendar, Plus, Trash2, Send, Key, Lock, Check, X, Upload, AlertTriangle, RefreshCw, Landmark } from 'lucide-react';
import { apiService, getPremioPorColocacao } from '../services/api';
import type { Jogador, ResultadoQuedaInput, DepositoRequisicao, SaqueRequisicao } from '../services/api';
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
  const [activeTab, setActiveTab] = useState<'geral' | 'lancar' | 'depositos'>('geral');
  const [salaQueda, setSalaQueda] = useState<string>('1');
  const [salaId, setSalaId] = useState<string>('');
  const [salaSenha, setSalaSenha] = useState<string>('');
  const [loadingSala, setLoadingSala] = useState<boolean>(false);
  const [quedaParaCancelar, setQuedaParaCancelar] = useState<string>('');
  const [loadingCancelar, setLoadingCancelar] = useState<boolean>(false);
  const [numeroQueda, setNumeroQueda] = useState<string>('1');
  const [linhas, setLinhas] = useState<LinhaResultado[]>([{ tempId: '1', jogadorId: '', colocacao: '', abates: '0' }]);
  const [loadingResults, setLoadingResults] = useState<boolean>(false);
  const [loadingOcr, setLoadingOcr] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [depositos, setDepositos] = useState<DepositoRequisicao[]>([]);
  const [loadingDepositos, setLoadingDepositos] = useState<boolean>(false);
  const [saques, setSaques] = useState<SaqueRequisicao[]>([]);
  const [loadingSaques, setLoadingSaques] = useState<boolean>(false);
  const [players, setPlayers] = useState<Jogador[]>([]);
  const [loadingPlayersList, setLoadingPlayersList] = useState<boolean>(false);
  const [cmJogadorId, setCmJogadorId] = useState<string>('');
  const [cmValor, setCmValor] = useState<string>('');
  const [cmMotivo, setCmMotivo] = useState<string>('');
  const [loadingCm, setLoadingCm] = useState<boolean>(false);

  const fetchPlayers = async () => {
    setLoadingPlayersList(true);
    try { const data = await apiService.listarJogadores(); setPlayers(data); }
    catch (err) { onAddToast('error', 'Falha ao buscar jogadores', 'Não foi possível listar os jogadores cadastrados.'); }
    finally { setLoadingPlayersList(false); }
  };

  const fetchSaques = async () => {
    setLoadingSaques(true);
    try { const data = await apiService.obterSaquesPendentes(); setSaques(data); }
    catch { /* silencioso */ }
    finally { setLoadingSaques(false); }
  };

  const fetchDepositos = async () => {
    setLoadingDepositos(true);
    try { const data = await apiService.obterDepositosPendentes(); setDepositos(data); }
    catch (err) { console.error('Erro ao buscar depósitos pendentes', err); }
    finally { setLoadingDepositos(false); }
  };

  useEffect(() => {
    fetchPlayers(); fetchDepositos(); fetchSaques();
    const interval = setInterval(() => { fetchDepositos(); fetchSaques(); }, 20000);
    return () => clearInterval(interval);
  }, []);

  const handleRegisterRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    const quedaNum = parseInt(salaQueda);
    if (isNaN(quedaNum) || quedaNum <= 0) { onAddToast('warning', 'Queda Inválida', 'Por favor, insira um número de queda válido.'); return; }
    if (!salaId.trim() || !salaSenha.trim()) { onAddToast('warning', 'Campos Vazios', 'Preencha o ID e a Senha da sala.'); return; }
    setLoadingSala(true);
    try {
      await apiService.liberarSala(quedaNum, salaId.trim(), salaSenha.trim());
      onAddToast('success', 'Sala Liberada', `Dados da Sala para a Queda ${quedaNum} salvos com sucesso!`);
      setSalaId(''); setSalaSenha(''); setSalaQueda((quedaNum + 1).toString());
    } catch (err) { onAddToast('error', 'Falha ao Enviar', 'Não foi possível registrar os dados da sala no backend.'); }
    finally { setLoadingSala(false); }
  };

  const handleCancelQueda = async (e: React.FormEvent) => {
    e.preventDefault();
    const numero = parseInt(quedaParaCancelar);
    if (isNaN(numero) || numero <= 0) { onAddToast('warning', 'Queda Inválida', 'Insira um número de queda válido para cancelar.'); return; }
    const confirmou = window.confirm(`Você realmente deseja CANCELAR a queda #${numero} e reembolsar R$ 2,00 para todos os inscritos?`);
    if (!confirmou) return;
    setLoadingCancelar(true);
    try {
      const res = await apiService.cancelarQuedaReembolsar(numero);
      onAddToast('success', 'Queda Cancelada e Reembolsada', res.message || `A queda #${numero} foi cancelada com sucesso.`);
      setQuedaParaCancelar(''); await fetchPlayers();
    } catch (err: any) { onAddToast('error', 'Falha ao Cancelar', err.message || 'Não foi possível cancelar e reembolsar.'); }
    finally { setLoadingCancelar(false); }
  };

  const handlePagarCora = async (saqueId: number) => {
    try {
      const res = await apiService.pagarSaque(saqueId);
      onAddToast(res.status === 'pago' ? 'success' : 'info', res.status === 'pago' ? 'Saque Pago' : 'Transferência Iniciada', res.message);
      await fetchSaques();
    } catch (err: any) {
      onAddToast('error', 'Erro no Pagamento', err.message);
    }
  };

  const handleConferirCora = async (saqueId: number) => {
    try {
      const res = await apiService.conferirSaque(saqueId);
      if (res.status === 'pago') onAddToast('success', 'Saque Pago', 'Transferência confirmada pela Cora.');
      else if (res.status === 'rejeitado') onAddToast('warning', 'Transferência Falhou', res.message || 'Valor devolvido ao jogador.');
      else onAddToast('info', 'Processando', res.message || 'Transferência em processamento.');
      await fetchSaques(); await fetchPlayers();
    } catch (err: any) {
      onAddToast('error', 'Erro ao Conferir', err.message);
    }
  };

  const handleProcessarSaque = async (saqueId: number, status: 'pago' | 'rejeitado') => {
    try {
      const res = await apiService.processarSaque(saqueId, status);
      onAddToast(status === 'pago' ? 'success' : 'warning', status === 'pago' ? 'Saque Pago' : 'Saque Rejeitado', res.message || `Saque #${saqueId} ${status}.`);
      await fetchSaques(); await fetchPlayers();
    } catch (err: any) {
      onAddToast('error', 'Erro ao Processar Saque', err.message);
    }
  };

  const handleCreditoManual = async (e: React.FormEvent) => {
    e.preventDefault();
    const v = parseFloat(cmValor.replace(',', '.'));
    if (!cmJogadorId) { onAddToast('warning', 'Selecione o jogador'); return; }
    if (isNaN(v) || v <= 0) { onAddToast('warning', 'Valor invalido'); return; }
    if (cmMotivo.trim().length < 3) { onAddToast('warning', 'Informe um motivo (auditoria)'); return; }
    setLoadingCm(true);
    try {
      const r = await apiService.creditoManual(Number(cmJogadorId), v, cmMotivo.trim());
      onAddToast('success', 'Credito manual aplicado', r.message);
      setCmValor(''); setCmMotivo('');
      await fetchPlayers();
    } catch (err: any) {
      onAddToast('error', 'Falha no credito manual', err.message);
    } finally { setLoadingCm(false); }
  };

  const handleProcessarDeposito = async (depositoId: number, status: 'aprovado' | 'rejeitado') => {
    try {
      const res = await apiService.processarDeposito(depositoId, status);
      onAddToast(status === 'aprovado' ? 'success' : 'warning', status === 'aprovado' ? 'Depósito Aprovado' : 'Depósito Rejeitado', res.message || `Depósito #${depositoId} foi ${status} com sucesso.`);
      await fetchDepositos(); await fetchPlayers();
    } catch (err: any) { onAddToast('error', 'Falha ao Processar', err.message || 'Erro ao processar requisição de depósito.'); }
  };

  const handleAddLinha = () => {
    const nextId = (linhas.length > 0 ? Math.max(...linhas.map(l => parseInt(l.tempId))) + 1 : 1).toString();
    setLinhas([...linhas, { tempId: nextId, jogadorId: '', colocacao: '', abates: '0' }]);
  };

  const handleRemoveLinha = (tempId: string) => {
    if (linhas.length === 1) { onAddToast('warning', 'Ação Bloqueada', 'Você deve lançar o resultado de pelo menos 1 jogador.'); return; }
    setLinhas(linhas.filter(l => l.tempId !== tempId));
  };

  const handleUpdateLinha = (tempId: string, field: keyof LinhaResultado, value: string) => {
    setLinhas(linhas.map(l => l.tempId === tempId ? { ...l, [field]: value } : l));
  };

  const handleOcrUpload = async (file: File) => {
    const quedaNum = parseInt(numeroQueda);
    if (isNaN(quedaNum) || quedaNum <= 0) { onAddToast('warning', 'Defina a Queda', 'Por favor, insira o número da queda antes de fazer o upload do print.'); return; }
    setLoadingOcr(true);
    try {
      const data = await apiService.processarOcrResultado(quedaNum, file);
      if (data && data.resultados && data.resultados.length > 0) {
        const ocrLinhas: LinhaResultado[] = data.resultados.map((res: any, idx: number) => ({ tempId: String(idx + 1), jogadorId: res.jogador_id ? String(res.jogador_id) : '', colocacao: String(res.colocacao), abates: String(res.abates), jogadorDetectadoNick: res.jogador_nick }));
        setLinhas(ocrLinhas);
        onAddToast('success', 'Print Lançado via OCR', `Gemini identificou ${data.resultados.length} jogadores do placar. Verifique os dados e salve.`);
      } else { onAddToast('warning', 'OCR Vazio', 'Não foi possível extrair nenhum competidor do print. Tente outra imagem.'); }
    } catch (err: any) { onAddToast('error', 'Erro no OCR Gemini', err.message || 'Erro ao processar imagem. Verifique a GEMINI_API_KEY no backend.'); }
    finally { setLoadingOcr(false); if (fileInputRef.current) fileInputRef.current.value = ''; }
  };

  const handleSendResults = async (e: React.FormEvent) => {
    e.preventDefault();
    const quedaNum = parseInt(numeroQueda);
    if (isNaN(quedaNum) || quedaNum <= 0) { onAddToast('warning', 'Queda Inválida', 'Por favor, defina um número válido para a queda.'); return; }
    const formattedResultados: ResultadoQuedaInput[] = [];
    const selectedPlayers = new Set<number>();
    for (const [idx, linha] of linhas.entries()) {
      const pId = parseInt(linha.jogadorId); const place = parseInt(linha.colocacao); const kills = parseInt(linha.abates);
      if (isNaN(pId)) { onAddToast('warning', 'Jogador Pendente', `Selecione o jogador correspondente para a linha #${idx + 1}.`); return; }
      if (isNaN(place) || place < 1 || place > 52) { onAddToast('warning', 'Colocação Inválida', `A colocação na linha #${idx + 1} deve ser entre 1 e 52.`); return; }
      if (isNaN(kills) || kills < 0) { onAddToast('warning', 'Abates Inválidos', `Os abates na linha #${idx + 1} devem ser maiores ou iguais a zero.`); return; }
      if (selectedPlayers.has(pId)) { const playerNick = players.find(p => p.id === pId)?.nick || 'jogador'; onAddToast('warning', 'Duplicação', `O jogador "${playerNick}" está duplicado na queda.`); return; }
      selectedPlayers.add(pId);
      formattedResultados.push({ jogador_id: pId, colocacao: place, abates: kills });
    }
    setLoadingResults(true);
    try {
      await apiService.lancarResultadoQueda({ numero_queda: quedaNum, resultados: formattedResultados });
      onAddToast('success', 'Resultados Registrados', `Queda ${quedaNum} lançada com sucesso no campeonato! Saldos dos vencedores foram creditados.`);
      setLinhas([{ tempId: '1', jogadorId: '', colocacao: '', abates: '0' }]); setNumeroQueda((quedaNum + 1).toString()); await fetchPlayers();
    } catch (err: any) { onAddToast('error', 'Falha ao Enviar', err.message || 'Não foi possível registrar os resultados.'); }
    finally { setLoadingResults(false); }
  };

  const inputCls = 'w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2.5 text-sm text-white placeholder:text-zinc-600 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-all';
  const labelCls = 'block text-[10px] font-bold uppercase tracking-wider text-zinc-500 mb-1.5';

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <div className="flex border-b border-zinc-800 overflow-x-auto">
        <button onClick={() => setActiveTab('geral')} className={`px-5 py-3 font-bold text-xs uppercase tracking-wider transition-all border-b-2 flex items-center gap-2 cursor-pointer whitespace-nowrap ${activeTab === 'geral' ? 'border-primary text-white' : 'border-transparent text-zinc-500 hover:text-white'}`}>
          <UserPlus className="w-4 h-4 text-primary" />
          Painel Geral
        </button>
        <button onClick={() => setActiveTab('lancar')} className={`px-5 py-3 font-bold text-xs uppercase tracking-wider transition-all border-b-2 flex items-center gap-2 cursor-pointer whitespace-nowrap ${activeTab === 'lancar' ? 'border-primary text-white' : 'border-transparent text-zinc-500 hover:text-white'}`}>
          <Calendar className="w-4 h-4 text-primary" />
          Lançar Quedas (IA OCR)
        </button>
        <button onClick={() => setActiveTab('depositos')} className={`px-5 py-3 font-bold text-xs uppercase tracking-wider transition-all border-b-2 flex items-center gap-2 cursor-pointer whitespace-nowrap relative ${activeTab === 'depositos' ? 'border-primary text-white' : 'border-transparent text-zinc-500 hover:text-white'}`}>
          <Landmark className="w-4 h-4 text-primary" />
          Depósitos PIX
          {(depositos.length > 0 || saques.length > 0) && (<span className="absolute top-1.5 right-1.5 flex h-2.5 w-2.5"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span><span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span></span>)}
        </button>
      </div>
      <div className="p-5">
        {activeTab === 'geral' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 items-start">
            <div className="space-y-5">
              <div className="ff-card p-5">
                <h2 className="text-sm font-bold text-white flex items-center gap-2 mb-4"><Key className="w-4 h-4 text-primary" />Liberar Sala e Senha</h2>
                <form onSubmit={handleRegisterRoom} className="space-y-4">
                  <div><label className={labelCls}>Número da Queda</label><input type="number" min="1" value={salaQueda} onChange={(e) => setSalaQueda(e.target.value)} disabled={loadingSala} className={inputCls} /></div>
                  <div><label className={labelCls}>ID da Sala (Custom)</label><input type="text" placeholder="Ex: 549382" value={salaId} onChange={(e) => setSalaId(e.target.value)} disabled={loadingSala} className={inputCls} /></div>
                  <div><label className={labelCls}>Senha da Sala</label><input type="text" placeholder="Ex: 1234" value={salaSenha} onChange={(e) => setSalaSenha(e.target.value)} disabled={loadingSala} className={inputCls} /></div>
                  <button type="submit" disabled={loadingSala || !salaId.trim() || !salaSenha.trim()} className="w-full py-3 rounded-xl bg-primary text-white font-bold text-sm hover:opacity-90 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:pointer-events-none">
                    {loadingSala ? <Spinner size="sm" /> : <Lock className="w-4 h-4" />}{loadingSala ? 'Liberando...' : 'Liberar Credenciais'}
                  </button>
                </form>
              </div>
              <div className="bg-rose-900/20 backdrop-blur-md rounded-2xl border border-rose-800 p-5 shadow-xl">
                <h2 className="text-sm font-bold text-white flex items-center gap-2 mb-4"><AlertTriangle className="w-4 h-4 text-primary" />Cancelar Queda e Reembolsar</h2>
                <p className="text-xs text-zinc-400 mb-4">Cancele uma queda não lotada. Isso removerá as inscrições e devolverá automaticamente R$ 2,00 para a carteira de todos os jogadores participantes.</p>
                <form onSubmit={handleCancelQueda} className="space-y-4">
                  <div><label className={labelCls}>Número da Queda para Cancelar</label><input type="number" min="1" placeholder="Ex: 1" value={quedaParaCancelar} onChange={(e) => setQuedaParaCancelar(e.target.value)} disabled={loadingCancelar} className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2.5 text-sm text-white placeholder:text-zinc-600 focus:border-rose-500 focus:outline-none focus:ring-1 focus:ring-rose-500 transition-all" /></div>
                  <button type="submit" disabled={loadingCancelar || !quedaParaCancelar.trim()} className="w-full py-3 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-sm transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:pointer-events-none">
                    {loadingCancelar ? <Spinner size="sm" /> : <Trash2 className="w-4 h-4" />}{loadingCancelar ? 'Cancelando...' : 'Cancelar e Reembolsar Competidores'}
                  </button>
                </form>
              </div>
            </div>
            <div className="ff-card h-full min-h-[600px]">
              <AdminAgentChat onAddToast={onAddToast} onRefreshData={fetchPlayers} />
            </div>
          </div>
        )}
        {activeTab === 'lancar' && (
          <div className="ff-card p-5 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h2 className="text-sm font-bold text-white flex items-center gap-2 mb-1"><Calendar className="w-4 h-4 text-primary" />Lançador de Resultados de Queda</h2>
                <p className="text-xs text-zinc-400">Lançamento de colocações (1-52) e abates. Utilize OCR Inteligente por imagem para preenchimento instantâneo.</p>
              </div>
              <div className="flex items-center gap-2 bg-zinc-950 border border-zinc-800 px-3 py-1.5 rounded-xl">
                <span className="text-[10px] font-bold text-zinc-500 uppercase">Queda:</span>
                <input type="number" min="1" value={numeroQueda} onChange={(e) => setNumeroQueda(e.target.value)} disabled={loadingResults || loadingOcr} className="w-16 bg-transparent border-none text-white text-center text-sm font-black focus:outline-none" />
              </div>
            </div>
            <div className="p-4 rounded-xl border border-dashed border-zinc-800 bg-zinc-950/20 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-zinc-500 flex items-center gap-1.5"><Upload className="w-4 h-4 text-primary" />Carregar Print de Placar (IA OCR Gemini)</span>
                <span className="text-[9px] text-zinc-500 bg-zinc-900 border border-zinc-800 px-1.5 py-0.5 rounded">Requer GEMINI_API_KEY</span>
              </div>
              <div className="border border-dashed border-zinc-800 hover:border-primary/50 rounded-xl p-6 flex flex-col items-center justify-center text-center cursor-pointer bg-zinc-950/40 hover:bg-zinc-950/80 transition-all group" onClick={() => fileInputRef.current?.click()} onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }} onDrop={async (e) => { e.preventDefault(); e.stopPropagation(); const files = e.dataTransfer.files; if (files && files.length > 0) await handleOcrUpload(files[0]); }}>
                <input type="file" ref={fileInputRef} onChange={async (e) => { const files = e.target.files; if (files && files.length > 0) await handleOcrUpload(files[0]); }} accept="image/*" className="hidden" />
                {loadingOcr ? (<div className="space-y-2 py-2"><Spinner size="md" className="mx-auto text-primary" /><p className="text-xs font-bold text-primary animate-pulse">Gemini OCR analisando placar...</p><p className="text-[10px] text-zinc-500">Mapeando nicks detectados com a base de dados</p></div>) : (<div className="space-y-1.5"><Upload className="w-8 h-8 text-zinc-600 group-hover:text-primary mx-auto transition-colors" /><p className="text-xs text-zinc-300"><span className="font-bold text-primary">Arraste o print do placar final</span> ou clique para escolher</p><p className="text-[10px] text-zinc-500">Suporta capturas de tela contendo os apelidos, colocação e quantidade de abates</p></div>)}
              </div>
            </div>
            <form onSubmit={handleSendResults} className="space-y-4">
              <div className="space-y-2.5 max-h-[450px] overflow-y-auto pr-1">
                {linhas.map((linha, index) => {
                  const placeNum = parseInt(linha.colocacao);
                  const cashPrize = !isNaN(placeNum) ? getPremioPorColocacao(placeNum) : 0;
                  return (
                    <div key={linha.tempId} className="flex flex-col md:flex-row items-stretch md:items-center gap-3 p-4 rounded-xl border border-zinc-800 bg-zinc-950/40">
                      <div className="flex items-center gap-2 md:w-8 text-xs font-bold text-zinc-600">#{index + 1}</div>
                      <div className="flex-1 min-w-[180px]">
                        <label className={`${labelCls} md:hidden`}>Jogador</label>
                        <select value={linha.jogadorId} onChange={(e) => handleUpdateLinha(linha.tempId, 'jogadorId', e.target.value)} disabled={loadingResults || loadingPlayersList || loadingOcr} className="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-200 text-sm focus:border-primary focus:outline-none">
                          <option value="">-- Vincular Competidor --</option>
                          {players.map(p => (<option key={p.id} value={p.id}>{p.nick} ({p.nome})</option>))}
                        </select>
                        {linha.jogadorDetectadoNick && (<div className="flex items-center gap-1 mt-1"><span className="text-[9px] font-extrabold text-amber-500/80 bg-amber-500/5 border border-amber-500/10 px-1.5 py-0.5 rounded">OCR: "{linha.jogadorDetectadoNick}"</span>{!linha.jogadorId && <span className="text-[9px] text-zinc-500 italic">(Não vinculado automaticamente)</span>}</div>)}
                      </div>
                      <div className="w-full md:w-32"><label className={`${labelCls} md:hidden`}>Colocação</label><input type="number" min="1" max="52" placeholder="Posição (1-52)" value={linha.colocacao} onChange={(e) => handleUpdateLinha(linha.tempId, 'colocacao', e.target.value)} disabled={loadingResults || loadingOcr} className="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-200 text-sm focus:border-primary focus:outline-none" /></div>
                      <div className="w-full md:w-24"><label className={`${labelCls} md:hidden`}>Kills</label><input type="number" min="0" placeholder="Kills" value={linha.abates} onChange={(e) => handleUpdateLinha(linha.tempId, 'abates', e.target.value)} disabled={loadingResults || loadingOcr} className="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-200 text-sm focus:border-primary focus:outline-none" /></div>
                      <div className="w-full md:w-32 flex items-center gap-1.5 md:justify-end px-1">
                        <span className="text-zinc-500 text-xs md:hidden">Prêmio: </span>
                        {cashPrize > 0 ? (<span className="bg-zinc-950 border border-zinc-800 rounded-xl p-2 text-center text-xs font-black text-emerald-400">+ R$ {cashPrize.toFixed(2).replace('.', ',')}</span>) : (<span className="bg-zinc-950 border border-zinc-800 rounded-xl p-2 text-center text-xs text-zinc-600 font-semibold">R$ 0,00</span>)}
                      </div>
                      <button type="button" onClick={() => handleRemoveLinha(linha.tempId)} disabled={loadingResults || loadingOcr} className="p-2 text-zinc-600 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer self-end md:self-auto"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  );
                })}
              </div>
              <div className="border-t border-zinc-800 my-4" />
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                <button type="button" onClick={handleAddLinha} disabled={loadingResults || loadingOcr || players.length === 0} className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl border border-dashed border-zinc-700 text-zinc-300 hover:text-white hover:border-primary transition-all cursor-pointer text-xs font-bold uppercase tracking-wider disabled:opacity-50 disabled:pointer-events-none"><Plus className="w-4 h-4" />Adicionar Linha</button>
                <button type="submit" disabled={loadingResults || loadingOcr || players.length === 0} className="w-full py-3 rounded-xl bg-primary text-white font-bold text-sm hover:opacity-90 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:pointer-events-none">{loadingResults ? <Spinner size="sm" /> : <Send className="w-4 h-4" />}{loadingResults ? 'Gravando...' : 'Salvar Queda e Pagar'}</button>
              </div>
              {players.length === 0 && (<div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-400">Não existem competidores cadastrados no banco de dados. Cadastre jogadores no painel geral primeiro.</div>)}
            </form>
          </div>
        )}
        {activeTab === 'depositos' && (
          <div className="ff-card p-5 space-y-6">
            <form onSubmit={handleCreditoManual} className="space-y-3 rounded-xl border border-primary/20 bg-primary/5 p-4">
              <div>
                <h2 className="text-sm font-bold text-white flex items-center gap-2 mb-1"><Landmark className="w-4 h-4 text-primary" />Credito Manual de Saldo</h2>
                <p className="text-xs text-zinc-400">Use para pagamento por fora, bonus ou correcao. Entra como saldo NAO sacavel e fica registrado no ledger com o motivo. O deposito normal do jogador e automatico via PIX.</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <select value={cmJogadorId} onChange={e => setCmJogadorId(e.target.value)}
                  className="bg-zinc-950 border border-zinc-800 px-3 py-2.5 rounded-xl text-sm text-white focus:border-primary focus:outline-none">
                  <option value="">Selecione o jogador</option>
                  {players.map(pl => (<option key={pl.id} value={pl.id}>{pl.nick} (#{pl.id})</option>))}
                </select>
                <input type="text" inputMode="decimal" placeholder="Valor R$" value={cmValor}
                  onChange={e => setCmValor(e.target.value.replace(/[^0-9.,]/g, ''))}
                  className="bg-zinc-950 border border-zinc-800 px-3 py-2.5 rounded-xl text-sm text-white focus:border-primary focus:outline-none font-mono" />
                <input type="text" placeholder="Motivo (auditoria)" value={cmMotivo}
                  onChange={e => setCmMotivo(e.target.value)}
                  className="bg-zinc-950 border border-zinc-800 px-3 py-2.5 rounded-xl text-sm text-white focus:border-primary focus:outline-none" />
              </div>
              <button type="submit" disabled={loadingCm}
                className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-primary text-white font-bold text-sm hover:opacity-90 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50">
                {loadingCm ? <Spinner size="sm" /> : <Plus className="w-4 h-4" />}Aplicar Credito
              </button>
            </form>
            <div className="flex items-center justify-between gap-4">
              <div><h2 className="text-sm font-bold text-white flex items-center gap-2 mb-1"><Landmark className="w-4 h-4 text-primary" />Depósitos PIX Pendentes</h2><p className="text-xs text-zinc-400">Valide a transação no extrato da sua conta bancária antes de aprovar e creditar o saldo na conta do competidor.</p></div>
              <button onClick={fetchDepositos} disabled={loadingDepositos} className="p-2 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-400 hover:text-white transition-colors cursor-pointer" title="Atualizar"><RefreshCw className={`w-4 h-4 ${loadingDepositos ? 'animate-spin' : ''}`} /></button>
            </div>
            {loadingDepositos && depositos.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 space-y-3"><Spinner size="md" className="text-primary" /><p className="text-xs text-zinc-400">Carregando solicitações de recarga...</p></div>
            ) : depositos.length === 0 ? (
              <div className="border border-dashed border-zinc-800 rounded-xl p-12 text-center text-zinc-500"><Landmark className="w-12 h-12 text-zinc-700 mx-auto mb-3" /><p className="text-sm font-bold text-zinc-400">Nenhum depósito pendente</p><p className="text-xs text-zinc-500 mt-1">O depósito do jogador agora é automático via PIX (Asaas). Esta lista legada permanece vazia.</p></div>
            ) : (
              <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
                {depositos.map((dep) => (
                  <div key={dep.id} className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 p-4 rounded-xl border border-zinc-800 bg-zinc-950/60 transition-all hover:border-zinc-700">
                    <div className="space-y-1 flex-1"><div className="flex items-center gap-2 flex-wrap"><span className="text-sm font-black text-white">{dep.jogador_nick || 'Jogador Desconhecido'}</span><span className="text-[9px] bg-zinc-800 text-zinc-400 px-1.5 py-0.5 rounded font-mono">ID Jogador: #{dep.jogador_id}</span></div><p className="text-[10px] text-zinc-500">Solicitado em: {dep.data_hora}</p></div>
                    <div className="flex items-center gap-4 justify-between sm:justify-end border-t sm:border-none pt-3 sm:pt-0 border-zinc-800">
                      <div className="text-left sm:text-right"><p className="text-[9px] text-zinc-500 font-bold uppercase tracking-wider">Valor Solicitado</p><span className="text-base font-black text-emerald-400">R$ {dep.valor.toFixed(2).replace('.', ',')}</span></div>
                      <div className="flex items-center gap-1.5">
                        <button onClick={() => handleProcessarDeposito(dep.id, 'aprovado')} className="p-2 rounded-xl bg-emerald-500/10 hover:bg-emerald-500 text-emerald-400 hover:text-zinc-950 border border-emerald-500/20 hover:border-emerald-500 transition-all cursor-pointer flex items-center justify-center" title="Aprovar Depósito"><Check className="w-4 h-4" /></button>
                        <button onClick={() => handleProcessarDeposito(dep.id, 'rejeitado')} className="p-2 rounded-xl bg-rose-500/10 hover:bg-rose-500 text-rose-400 hover:text-zinc-950 border border-rose-500/20 hover:border-rose-500 transition-all cursor-pointer flex items-center justify-center" title="Rejeitar Depósito"><X className="w-4 h-4" /></button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="border-t border-zinc-800 pt-5 space-y-4">
              <div className="flex items-center justify-between gap-4">
                <div><h2 className="text-sm font-bold text-white flex items-center gap-2 mb-1"><Landmark className="w-4 h-4 text-amber-400" />Saques Pendentes</h2><p className="text-xs text-zinc-400">O valor já foi reservado do saldo do jogador. \"Pagar PIX\" envia automaticamente pela chave cadastrada — ou pague manualmente e marque como pago. Rejeitar devolve o valor.</p></div>
                <button onClick={fetchSaques} disabled={loadingSaques} className="p-2 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-400 hover:text-white transition-colors cursor-pointer" title="Atualizar"><RefreshCw className={`w-4 h-4 ${loadingSaques ? 'animate-spin' : ''}`} /></button>
              </div>
              {saques.length === 0 ? (
                <div className="border border-dashed border-zinc-800 rounded-xl p-8 text-center text-zinc-500"><p className="text-sm font-bold text-zinc-400">Nenhum saque pendente</p></div>
              ) : (
                <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
                  {saques.map((sq) => (
                    <div key={sq.id} className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 p-4 rounded-xl border border-zinc-800 bg-zinc-950/60 hover:border-zinc-700 transition-all">
                      <div className="space-y-1 flex-1">
                        <div className="flex items-center gap-2 flex-wrap"><span className="text-sm font-black text-white">{sq.jogador_nick || 'Jogador'}</span><span className="text-[9px] bg-zinc-800 text-zinc-400 px-1.5 py-0.5 rounded font-mono">#{sq.jogador_id}</span>{sq.status === 'processando' && (<span className="text-[9px] bg-sky-500/10 text-sky-400 border border-sky-500/20 px-1.5 py-0.5 rounded-full font-bold uppercase">Processando</span>)}</div>
                        {sq.banco_codigo && (<p className="text-[10px] text-zinc-500">Banco {sq.banco_codigo} · Ag {sq.agencia} · CC <span className="font-mono text-zinc-300">{sq.conta}</span> · {sq.titular_nome}</p>)}
                        <p className="text-[10px] text-zinc-500">Chave PIX ({sq.tipo_chave}): <span className="font-mono text-zinc-300 select-all">{sq.chave_pix}</span></p>
                        {sq.titular_chave && (<p className="text-[10px] text-emerald-400/80">Titular (Asaas): {sq.titular_chave}</p>)}
                        <p className="text-[10px] text-zinc-600">Solicitado em: {sq.criado_em}</p>
                      </div>
                      <div className="flex items-center gap-4 justify-between sm:justify-end border-t sm:border-none pt-3 sm:pt-0 border-zinc-800">
                        <div className="text-left sm:text-right"><p className="text-[9px] text-zinc-500 font-bold uppercase tracking-wider">Valor do Saque</p><span className="text-base font-black text-amber-400">R$ {sq.valor.toFixed(2).replace('.', ',')}</span></div>
                        <div className="flex items-center gap-1.5 flex-wrap justify-end">
                          {sq.status === 'pendente' && (
                            <button onClick={() => handlePagarCora(sq.id)} className="px-3 py-2 rounded-xl bg-primary/10 hover:bg-primary text-primary hover:text-white border border-primary/30 hover:border-primary transition-all cursor-pointer text-xs font-bold" title="Envia o PIX automaticamente pela chave do jogador">Pagar PIX</button>
                          )}
                          {sq.status === 'processando' && (
                            <button onClick={() => handleConferirCora(sq.id)} className="px-3 py-2 rounded-xl bg-sky-500/10 hover:bg-sky-500 text-sky-400 hover:text-zinc-950 border border-sky-500/20 hover:border-sky-500 transition-all cursor-pointer text-xs font-bold" title="Consulta o status da transferência">Conferir</button>
                          )}
                          <button onClick={() => handleProcessarSaque(sq.id, 'pago')} className="px-3 py-2 rounded-xl bg-emerald-500/10 hover:bg-emerald-500 text-emerald-400 hover:text-zinc-950 border border-emerald-500/20 hover:border-emerald-500 transition-all cursor-pointer text-xs font-bold flex items-center gap-1" title="Marcar como pago (se pagou manualmente)"><Check className="w-4 h-4" />Pago</button>
                          <button onClick={() => handleProcessarSaque(sq.id, 'rejeitado')} className="p-2 rounded-xl bg-rose-500/10 hover:bg-rose-500 text-rose-400 hover:text-zinc-950 border border-rose-500/20 hover:border-rose-500 transition-all cursor-pointer" title="Rejeitar (devolve o valor ao jogador)"><X className="w-4 h-4" /></button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};