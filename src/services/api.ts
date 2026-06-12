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
  is_admin: boolean;
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
}

export interface ResultadoQuedaInput {
  jogador_id: number;
  colocacao: number;
  abates: number;
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
export function getPremioPorColocacao(colocacao: number): number {
  if (colocacao === 1) return 20;
  if (colocacao === 2) return 12;
  if (colocacao === 3) return 8;
  if (colocacao === 4) return 6;
  if (colocacao >= 5 && colocacao <= 10) return 2.5;
  return 0;
}

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

  async cadastrarJogador(nome: string, nick: string, senha?: string): Promise<Jogador> {
    const res = await api.post('/auth/cadastro', { nome, nick, senha: senha || undefined });
    return res.data as Jogador;
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

  async getPlayerHistory(nick: string): Promise<any> {
    const res = await api.get(`/historico/${encodeURIComponent(nick)}`);
    return res.data;
  },

  // QUEDAS
  async obterStatusQueda(numero: number): Promise<StatusQueda> {
    const res = await api.get(`/queda/${numero}/status`);
    return res.data as StatusQueda;
  },

  async obterInfoSala(numero: number): Promise<SalaData> {
    const res = await api.get(`/queda/${numero}/sala`);
    return res.data as SalaData;
  },

  async inscreverNaQueda(numero: number): Promise<any> {
    const res = await api.post(`/queda/${numero}/inscrever`);
    return res.data;
  },

  async liberarSala(numero: number, salaId: string, senha: string): Promise<any> {
    const res = await api.post(`/queda/${numero}/sala`, { sala_id: salaId, sala_senha: senha });
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

  // DEPOSITOS
  async obterDepositosPendentes(): Promise<DepositoRequisicao[]> {
    const res = await api.get('/depositos/pendentes');
    return res.data as DepositoRequisicao[];
  },

  async processarDeposito(id: number, status: 'aprovado' | 'rejeitado'): Promise<any> {
    const res = await api.post(`/depositos/${id}/processar`, { status });
    return res.data;
  },

  async solicitarDeposito(valor: number): Promise<any> {
    const res = await api.post('/depositos/solicitar', null, { params: { valor } });
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
  async enviarComandoAgente(comando: string, _contexto?: any): Promise<{ resposta: string }> {
    const res = await api.post('/agente/comando', { comando });
    return res.data as { resposta: string };
  },
};

export default api;
