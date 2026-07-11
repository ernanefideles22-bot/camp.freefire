import axios from 'axios';

const API_URL = (import.meta as any).env?.VITE_API_URL || '/api';

const api = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

let refreshing: Promise<string | null> | null = null;

async function tryRefreshToken(): Promise<string | null> {
  const refresh = localStorage.getItem('refresh_token');
  if (!refresh) return null;
  try {
    const res = await axios.post(`${API_URL}/auth/refresh`, { refresh_token: refresh });
    const { access_token, refresh_token } = res.data;
    localStorage.setItem('access_token', access_token);
    if (refresh_token) localStorage.setItem('refresh_token', refresh_token);
    return access_token as string;
  } catch {
    return null;
  }
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;
    if (error.response?.status === 401 && original && !original._retry) {
      original._retry = true;
      refreshing = refreshing ?? tryRefreshToken();
      const newToken = await refreshing;
      refreshing = null;
      if (newToken) {
        original.headers.Authorization = `Bearer ${newToken}`;
        return api(original);
      }
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      localStorage.removeItem('currentUser');
    }
    const msg = error.response?.data?.detail || error.message || 'Erro desconhecido';
    return Promise.reject(new Error(typeof msg === 'string' ? msg : JSON.stringify(msg)));
  }
);

// ====================== TIPOS ======================
export interface Jogador {
  id: number;
  nome: string;
  nick: string;
  saldo: number;
  saldo_sacavel?: number;
  is_admin: boolean;
}

export interface AgenteResposta {
  tipo: 'info' | 'proposta' | 'erro';
  resposta?: string;
  acao?: string;
  dados?: any;
  resumo?: string;
  aviso?: string;
}

export interface TransacaoExtrato {
  id: number;
  tipo: string;
  valor: number;
  saldo_depois: number;
  sacavel_depois: number;
  ref?: string | null;
  criado_em: string | null;
}

export interface ClassificacaoItem {
  id: number;
  jogador_id: number;
  posicao: number;
  nick: string;
  nome: string;
  saldo: number;
  total_premios: number;
  ganhos_reais: number;
  total_abates: number;
  total_quedas: number;
  quedas_jogadas: number;
  total_pontos: number;
  melhor_colocacao: number | null;
}

export interface MeuConvite {
  codigo: string;
  link: string;
  valor_por_convite: number;
  bonus_convidado: number;
  convidados_total: number;
  convidados_que_jogaram: number;
  ganhos_total: number;
  restante_semana: number;
}

export interface QuedaAberta {
  numero_queda: number;
  inscritos_count: number;
  limite: number;
  sala_liberada: boolean;
  horario?: string | null;
}

export interface StatusQueda {
  numero_queda: number;
  inscritos_count: number;
  limite: number;
  esta_inscrito: boolean;
  sala_liberada: boolean;
}

export interface SalaData {
  sala_id: string;
  senha: string;
  horario?: string;
}

export interface ResultadoQuedaInput {
  jogador_id: number;
  colocacao: number;
  abates: number;
}

export interface SaqueRequisicao {
  id: number;
  jogador_id: number;
  jogador_nick?: string;
  valor: number;
  chave_pix: string;
  tipo_chave: string;
  status: string;
  cora_transfer_id?: string | null;
  titular_chave?: string | null;
  banco_codigo?: string | null;
  agencia?: string | null;
  conta?: string | null;
  titular_nome?: string | null;
  criado_em: string | null;
}

export interface DadosBancarios {
  banco_codigo: string | null;
  agencia: string | null;
  conta: string | null;
  tipo_conta: string | null;
  titular_nome: string | null;
  titular_doc: string | null;
  chave_pix: string | null;
  completo: boolean;
}

export interface DepositoRequisicao {
  id: number;
  jogador_id: number;
  jogador_nick?: string;
  valor: number;
  status: string;
  data_hora: string;
}

// ====================== FUNCAO PREMIO ======================
export interface ConfigRegras {
  taxa_inscricao: number;
  rake: number;
  share_colocacao: number;
  share_abate: number;
  pesos_colocacao: Record<string, number>;
  lobby_cheio: number;
}

let _configCache: ConfigRegras | null = null;

export async function getConfig(): Promise<ConfigRegras> {
  if (_configCache) return _configCache;
  const res = await api.get('/config');
  _configCache = res.data as ConfigRegras;
  return _configCache;
}

// Previa da premiacao de uma queda vinda do BACKEND, calculada sobre os
// INSCRITOS REAIS (fonte unica de verdade). Use apiService.obterPremiacaoQueda().
export interface PremiacaoQueda {
  numero_queda: number;
  inscritos: number;
  taxa_inscricao: number;
  arrecadado: number;
  premiacao_total: number;
  bolo_abates: number;
  premios_colocacao: Record<string, number>; // { '1': R$, ..., '5': R$ }
}

// Lista de quem PAGOU a inscricao de uma queda (admin). Ordem de chegada.
// Vem de GET /queda/{numero}/inscritos. Fonte de "quem vai jogar a proxima queda".
export interface InscritoQueda {
  jogador_id: number;
  nick: string;
  nome: string;
  pago_em: string | null; // 'dd/mm HH:MM' ou null
}

export interface InscritosQueda {
  numero_queda: number;
  total: number;
  arrecadado: number;
  jogadores: InscritoQueda[];
}

// Estimativa LOCAL (fallback/offline) do premio de colocacao para uma queda com
// `inscritos` jogadores. Espelha a formula do backend. NUNCA assume lobby cheio:
// quem chama e obrigado a informar quantos jogadores cairam.
export function premioPorColocacao(colocacao: number, inscritos: number): number {
  const c = _configCache;
  if (!c) { getConfig().catch(() => {}); return 0; }
  const peso = c.pesos_colocacao?.[String(colocacao)];
  if (!peso || inscritos <= 0) return 0;
  const somaPesos = Object.values(c.pesos_colocacao).reduce((a, b) => a + b, 0);
  const arrecadado = inscritos * c.taxa_inscricao;
  const boloColoc = arrecadado * (1 - c.rake) * c.share_colocacao;
  return boloColoc * (peso / somaPesos);
}
export const getPremioPorColocacao = premioPorColocacao;

// ====================== QUEDA BONUS ======================
export interface EventoBonus {
  id: number;
  nome: string;
  status: 'inscricao' | 'em_andamento' | 'aguardando_revisao' | 'pago' | 'cancelado';
  min_jogadores: number;
  premio_total: number;
  data_hora: string | null;
  inscritos: number;
  premio_top5: number[];
}

export interface PlacarBonusItem {
  jogador_id: number;
  nick: string;
  nome: string;
  pontos: number;
  kills: number;
  quedas_jogadas: number;
  melhor_colocacao: number | null;
  elegivel: boolean;
  posicao: number;
}

export interface PlacarBonus {
  evento_id: number;
  status: string;
  premio_top5: number[];
  jogadores: PlacarBonusItem[];
}

export interface BonusSala { ordem: number; sala_id: string; senha: string; horario?: string | null; }
export interface MinhaInscricaoBonus { inscrito: boolean; salas: BonusSala[]; }
export interface HistoricoBonusVencedor { colocacao: number; nick: string | null; valor: number; status: string; }
export interface HistoricoBonusItem {
  id: number;
  nome: string;
  data_hora: string | null;
  status: string;
  inscritos: number;
  premio_total: number;
  premio_top5: number[];
  vencedores: HistoricoBonusVencedor[];
}
export interface BonusInscrito { jogador_id: number; nick: string; nome: string; entrou_em: string | null; }

export interface PagamentoBonus {
  id: number;
  jogador_id: number;
  nick: string | null;
  nome: string | null;
  colocacao: number;
  pontos: number;
  valor: number;
  status: string;
  ip_compartilhado: boolean;
  device_compartilhado: boolean;
}

export interface BonusResultadoInput { jogador_id: number; colocacao: number; abates: number; }

// ====================== API SERVICE ======================
export const apiService = {
  // AUTH
  async loginJogador(nick: string, senha: string): Promise<Jogador> {
    const res = await api.post('/auth/login', { nick, senha });
    const { access_token, refresh_token, jogador } = res.data;
    localStorage.setItem('access_token', access_token);
    if (refresh_token) localStorage.setItem('refresh_token', refresh_token);
    localStorage.setItem('currentUser', JSON.stringify(jogador));
    return jogador as Jogador;
  },

  async cadastrarJogador(nome: string, nick: string, senha?: string,
                         aceitouTermos = false, confirmaIdade = false, dataNascimento?: string,
                         ref?: string | null): Promise<Jogador> {
    const res = await api.post('/auth/cadastro', {
      nome, nick, senha: senha || undefined,
      aceitou_termos: aceitouTermos, confirma_idade: confirmaIdade, data_nascimento: dataNascimento,
      ref: ref || undefined,
    });
    return res.data as Jogador;
  },

  async loginGoogle(idToken: string, nick?: string,
                    aceitouTermos = false, confirmaIdade = false, dataNascimento?: string): Promise<{
    jogador?: Jogador; precisa_nick?: boolean; email?: string; nome_sugerido?: string;
  }> {
    const res = await api.post('/auth/google', {
      id_token: idToken, nick, aceitou_termos: aceitouTermos, confirma_idade: confirmaIdade, data_nascimento: dataNascimento,
      ref: (typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('ref') : null) || undefined,
    });
    const data = res.data;
    if (data.access_token) {
      localStorage.setItem('access_token', data.access_token);
      if (data.refresh_token) localStorage.setItem('refresh_token', data.refresh_token);
      localStorage.setItem('currentUser', JSON.stringify(data.jogador));
    }
    return data;
  },

  // CLASSIFICACAO
  async obterClassificacao(): Promise<ClassificacaoItem[]> {
    const res = await api.get('/classificacao');
    return res.data as ClassificacaoItem[];
  },

  // JOGADORES
  async listarJogadores(): Promise<Jogador[]> {
    const res = await api.get('/jogadores');
    return res.data as Jogador[];
  },

  async limparJogadoresTeste(): Promise<any> {
    const res = await api.post('/admin/jogadores/limpar-teste');
    return res.data;
  },
  async apagarJogador(jogadorId: number): Promise<any> {
    const res = await api.post(`/admin/jogadores/${jogadorId}/apagar`);
    return res.data;
  },

  async getPlayerHistory(nick: string): Promise<any> {
    const res = await api.get(`/historico/${encodeURIComponent(nick)}`);
    return res.data;
  },

  // QUEDAS
  async obterMeuConvite(): Promise<MeuConvite> {
    const res = await api.get('/me/convite');
    return res.data as MeuConvite;
  },

  async listarQuedasAbertas(): Promise<QuedaAberta[]> {
    const res = await api.get('/quedas/abertas');
    return res.data as QuedaAberta[];
  },

  async obterStatusQueda(numero: number): Promise<StatusQueda> {
    const res = await api.get(`/queda/${numero}/status`);
    return res.data as StatusQueda;
  },

  async obterPremiacaoQueda(numero: number): Promise<PremiacaoQueda> {
    const res = await api.get(`/queda/${numero}/premiacao`);
    return res.data as PremiacaoQueda;
  },

  // Lista de quem PAGOU a inscricao da queda (somente admin).
  async obterInscritosQueda(numero: number): Promise<InscritosQueda> {
    const res = await api.get(`/queda/${numero}/inscritos`);
    return res.data as InscritosQueda;
  },

  // ---------- QUEDA BONUS ----------
  async obterBonusAtual(): Promise<EventoBonus | null> {
    const res = await api.get('/bonus/atual');
    return (res.data?.evento ?? null) as EventoBonus | null;
  },
  async obterPlacarBonus(eventoId: number): Promise<PlacarBonus> {
    const res = await api.get(`/bonus/${eventoId}/placar`);
    return res.data as PlacarBonus;
  },
  async inscreverBonus(eventoId: number, deviceHash: string): Promise<any> {
    const res = await api.post(`/bonus/${eventoId}/inscrever`, { device_hash: deviceHash });
    return res.data;
  },
  async obterMinhaInscricaoBonus(eventoId: number): Promise<MinhaInscricaoBonus> {
    const res = await api.get(`/bonus/${eventoId}/minha-inscricao`);
    return res.data as MinhaInscricaoBonus;
  },
  async obterHistoricoBonus(): Promise<HistoricoBonusItem[]> {
    const res = await api.get('/bonus/historico');
    return (res.data?.eventos ?? []) as HistoricoBonusItem[];
  },
  async criarBonus(payload: { nome: string; data_hora?: string; min_jogadores?: number; premios?: number[] }): Promise<EventoBonus> {
    const res = await api.post('/admin/bonus/criar', payload);
    return res.data as EventoBonus;
  },
  async configurarBonus(eventoId: number, payload: { nome?: string; data_hora?: string; min_jogadores?: number; premios?: number[] }): Promise<EventoBonus> {
    const res = await api.post(`/admin/bonus/${eventoId}/config`, payload);
    return res.data as EventoBonus;
  },
  async iniciarBonus(eventoId: number): Promise<any> {
    const res = await api.post(`/admin/bonus/${eventoId}/iniciar`);
    return res.data;
  },
  async definirSalaBonus(eventoId: number, ordem: number, salaId: string, salaSenha: string, horario?: string): Promise<any> {
    const res = await api.post(`/admin/bonus/${eventoId}/sala`, { ordem, sala_id: salaId, sala_senha: salaSenha, horario });
    return res.data;
  },
  async lancarResultadoBonus(eventoId: number, ordem: number, resultados: BonusResultadoInput[]): Promise<any> {
    const res = await api.post(`/admin/bonus/${eventoId}/resultado`, { ordem, resultados });
    return res.data;
  },
  async apurarBonus(eventoId: number): Promise<any> {
    const res = await api.post(`/admin/bonus/${eventoId}/apurar`);
    return res.data;
  },
  async cancelarBonus(eventoId: number): Promise<any> {
    const res = await api.post(`/admin/bonus/${eventoId}/cancelar`);
    return res.data;
  },
  async listarInscritosBonus(eventoId: number): Promise<{ evento_id: number; total: number; jogadores: BonusInscrito[] }> {
    const res = await api.get(`/admin/bonus/${eventoId}/inscritos`);
    return res.data;
  },
  async listarPagamentosBonus(eventoId: number): Promise<{ evento_id: number; pagamentos: PagamentoBonus[] }> {
    const res = await api.get(`/admin/bonus/${eventoId}/pagamentos`);
    return res.data;
  },
  async liberarPagamentoBonus(pagamentoId: number): Promise<any> {
    const res = await api.post(`/admin/bonus/pagamento/${pagamentoId}/liberar`);
    return res.data;
  },
  async rejeitarPagamentoBonus(pagamentoId: number): Promise<any> {
    const res = await api.post(`/admin/bonus/pagamento/${pagamentoId}/rejeitar`);
    return res.data;
  },

  async obterInfoSala(numero: number): Promise<SalaData> {
    const res = await api.get(`/queda/${numero}/sala`);
    return res.data as SalaData;
  },

  async inscreverNaQueda(numero: number): Promise<any> {
    const res = await api.post(`/queda/${numero}/inscrever`);
    return res.data;
  },

  async liberarSala(numero: number, salaId: string, senha: string, horario?: string): Promise<any> {
    const res = await api.post(`/queda/${numero}/sala`, { sala_id: salaId, sala_senha: senha, horario });
    return res.data;
  },

  async lancarResultadoQueda(dados: { numero_queda: number; resultados: ResultadoQuedaInput[] }): Promise<any> {
    const res = await api.post(`/queda/${dados.numero_queda}/resultado`, dados);
    return res.data;
  },

  async cancelarQuedaReembolsar(numero: number): Promise<any> {
    const res = await api.post(`/queda/${numero}/cancelar`);
    return res.data;
  },

  async resetarRanking(): Promise<any> {
    const res = await api.post('/admin/ranking/resetar');
    return res.data;
  },

  // DEPOSITOS
  async obterDepositosPendentes(): Promise<DepositoRequisicao[]> {
    const res = await api.get('/depositos/pendentes');
    return res.data as DepositoRequisicao[];
  },

  async processarDeposito(id: number, status: 'aprovado' | 'rejeitado'): Promise<any> {
    const res = await api.post(`/depositos/${id}/processar`, { status });
    return res.data;
  },

  async creditoManual(jogadorId: number, valor: number, motivo: string): Promise<any> {
    const res = await api.post('/depositos/manual', { jogador_id: jogadorId, valor, motivo });
    return res.data;
  },

  // OCR GEMINI
  async processarOcrResultado(numeroQueda: number, arquivo: File): Promise<any> {
    const formData = new FormData();
    formData.append('numero_queda', String(numeroQueda));
    formData.append('imagem', arquivo);
    const res = await api.post('/ocr/resultado', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data;
  },

  async cadastrarJogadoresDaImagem(arquivo: File): Promise<any> {
    const formData = new FormData();
    formData.append('imagem', arquivo);
    const res = await api.post('/agente/jogadores-da-imagem', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data;
  },

  // DADOS BANCARIOS
  async obterDadosBancarios(): Promise<DadosBancarios> {
    const res = await api.get('/me/dados-bancarios');
    return res.data as DadosBancarios;
  },

  async salvarDadosBancarios(dados: Omit<DadosBancarios, 'completo'>): Promise<any> {
    const res = await api.put('/me/dados-bancarios', dados);
    return res.data;
  },

  // SAQUES
  async solicitarSaque(valor: number, chavePix: string, tipoChave: string): Promise<any> {
    // O backend valida que a chave pertence ao mesmo CPF da conta antes de pagar.
    const res = await api.post('/saques/solicitar', { valor, chave_pix: chavePix, tipo_chave: tipoChave });
    return res.data;
  },

  async meuExtrato(limite = 50): Promise<TransacaoExtrato[]> {
    const res = await api.get('/me/extrato', { params: { limite } });
    return res.data as TransacaoExtrato[];
  },

  async pagarSaque(id: number): Promise<any> {
    const res = await api.post(`/saques/${id}/pagar`);
    return res.data;
  },

  async conferirSaque(id: number): Promise<any> {
    const res = await api.post(`/saques/${id}/conferir`);
    return res.data;
  },

  async meusSaques(): Promise<SaqueRequisicao[]> {
    const res = await api.get('/saques/meus');
    return res.data as SaqueRequisicao[];
  },

  async obterSaquesPendentes(): Promise<SaqueRequisicao[]> {
    const res = await api.get('/saques/pendentes');
    return res.data as SaqueRequisicao[];
  },

  // PREMIOS RETIDOS (revisao antifraude)
  async obterResultadosSuspeitos(): Promise<any[]> {
    const res = await api.get('/admin/resultados/suspeitos');
    return res.data as any[];
  },

  async liberarResultado(resultadoId: number): Promise<any> {
    const res = await api.post(`/admin/resultados/${resultadoId}/liberar`);
    return res.data;
  },

  async rejeitarResultado(resultadoId: number): Promise<any> {
    const res = await api.post(`/admin/resultados/${resultadoId}/rejeitar`);
    return res.data;
  },

  async processarSaque(id: number, status: 'pago' | 'rejeitado'): Promise<any> {
    const res = await api.post(`/saques/${id}/processar`, { status });
    return res.data;
  },

  // PIX (Cora)
  async criarCobrancaPix(valor: number, cpf: string): Promise<any> {
    const res = await api.post('/pix/criar-cobranca', { valor, cpf });
    return res.data;
  },

  async statusCobrancaPix(invoiceId: string): Promise<any> {
    const res = await api.get(`/pix/status/${encodeURIComponent(invoiceId)}`);
    return res.data;
  },

  // AGENTE IA
  async enviarComandoAgente(comando: string): Promise<AgenteResposta> {
    const res = await api.post('/agente/comando', { comando });
    return res.data as AgenteResposta;
  },

  async executarAcaoAgente(acao: string, dados: any): Promise<any> {
    const res = await api.post('/agente/executar', { acao, dados });
    return res.data;
  },
};

export default api;
