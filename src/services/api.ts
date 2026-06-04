import axios from 'axios';

const API_URL = (import.meta as any).env?.VITE_API_URL || '';

const api = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('access_token');
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
  nick: string;
  nome: string;
  saldo: number;
  total_premios: number;
  total_abates: number;
  total_quedas: number;
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
  if (colocacao === 2) return 10;
  if (colocacao === 3) return 7;
  if (colocacao >= 4 && colocacao <= 5) return 5;
  if (colocacao >= 6 && colocacao <= 10) return 3;
  if (colocacao >= 11 && colocacao <= 20) return 1;
  return 0;
}

// ====================== API SERVICE ======================
export const apiService = {
  // AUTH
  async loginJogador(nick: string, senha: string): Promise<Jogador> {
    const res = await api.post('/auth/login', { nick, senha });
    const { access_token, jogador } = res.data;
    localStorage.setItem('access_token', access_token);
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

  // AGENTE IA
  async enviarComandoAgente(comando: string, _contexto?: any): Promise<{ resposta: string }> {
    const res = await api.post('/agente/comando', { comando });
    return res.data as { resposta: string };
  },
};

export default api;
