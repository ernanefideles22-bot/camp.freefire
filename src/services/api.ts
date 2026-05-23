// API client for Free Fire Solo Championship
// URL do backend via variável de ambiente (definida no Vercel e no .env.local)
// Em produção: VITE_API_URL=https://seu-backend.railway.app
// Em desenvolvimento local: VITE_API_URL=http://localhost:8000

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export interface Jogador {
  id: number;
  nome: string;
  nick: string;
  saldo: number;
  is_admin: boolean;
}

export interface ResultadoQuedaInput {
  jogador_id: number;
  colocacao: number;
  abates: number;
}

export interface QuedaPayload {
  numero_queda: number;
  resultados: ResultadoQuedaInput[];
}

export interface ClassificacaoItem {
  posicao: number;
  jogador_id: number;
  nick: string;
  total_pontos: number;
  total_abates: number;
  quedas_jogadas: number;
  ganhos_reais?: number;
}

export interface SalaData {
  numero_queda: number;
  sala_id: string;
  senha: string;
}

export interface DepositoRequisicao {
  id: number;
  jogador_id: number;
  jogador_nick?: string;
  valor: number;
  data_hora: string;
  status: 'pendente' | 'aprovado' | 'rejeitado';
}

export interface StatusQueda {
  numero_queda: number;
  inscritos_count: number;
  limite: number;
  esta_inscrito: boolean;
  sala_liberada: boolean;
}

export const getPremioPorColocacao = (colocacao: number): number => {
  if (colocacao === 1) return 20.00;
  if (colocacao === 2) return 10.00;
  if (colocacao === 3) return 7.00;
  if (colocacao === 4) return 5.00;
  if (colocacao >= 5 && colocacao <= 10) return 1.50;
  return 0.00;
  async cancelarQuedaReembolsar(numero: number): Promise<{message: string}> {
    const response = await fetch(`${API_BASE_URL}/quedas/${numero}/cancelar-reembolsar`, {
      method: 'POST', headers: getJsonHeaders()
    });
    if (!response.ok) { const e = await response.json().catch(()=>({})); throw new Error(e.detail || 'Falha ao cancelar queda'); }
    return response.json();
  },

  async processarOcrResultado(numeroQueda: number, file: File): Promise<any> {
    const formData = new FormData();
    formData.append('file', file);
    const response = await fetch(`${API_BASE_URL}/quedas/${numeroQueda}/processar-ocr`, {
      method: 'POST', headers: getAuthHeaders(), body: formData
    });
    if (!response.ok) { const e = await response.json().catch(()=>({})); throw new Error(e.detail || 'Falha no OCR'); }
    return response.json();
  },

  async getPlayerHistory(nick: string): Promise<any> {
    const response = await fetch(`${API_BASE_URL}/jogadores/${nick}/historico`, {
      headers: getAuthHeaders()
    });
    if (!response.ok) throw new Error('Falha ao carregar historico');
    return response.json();
  },

  async enviarComandoAgente(comando: string, apiKey?: string): Promise<{resposta: string}> {
    const response = await fetch(`${API_BASE_URL}/agente/comando`, {
      method: 'POST', headers: getJsonHeaders(),
      body: JSON.stringify({ comando, api_key: apiKey })
    });
    if (!response.ok) { const e = await response.json().catch(()=>({})); throw new Error(e.detail || 'Erro no agente'); }
    return response.json();
  },

  async processarDeposito(depositoId: number, status: 'aprovado' | 'rejeitado'): Promise<{message: string}> {
    const response = await fetch(`${API_BASE_URL}/admin/depositos/${depositoId}/processar`, {
      method: 'POST', headers: getJsonHeaders(),
      body: JSON.stringify({ status })
    });
    if (!response.ok) { const e = await response.json().catch(()=>({})); throw new Error(e.detail || 'Falha ao processar deposito'); }
    return response.json();
  },

};

export const getPontosPorColocacao = (colocacao: number): number => {
  const pointsTable: Record<number, number> = {
    1: 12, 2: 9, 3: 8, 4: 7, 5: 6, 6: 5, 7: 4, 8: 3, 9: 2, 10: 1
  };
  return pointsTable[colocacao] || 0;
};

const getAuthHeaders = (): Record<string, string> => {
  const userJson = localStorage.getItem('currentUser');
  const headers: Record<string, string> = {};
  if (userJson) {
    try {
      const user = JSON.parse(userJson);
      if (user && user.id) {
        headers['x-user-id'] = String(user.id);
      }
    } catch (e) {
      console.error("Erro ao ler currentUser do localStorage", e);
    }
  }
  return headers;
};

const getJsonHeaders = (): Record<string, string> => {
  return {
    'Content-Type': 'application/json',
    ...getAuthHeaders()
  };
};

export const apiService = {
  async cadastrarJogador(nome: string, nick: string, senha?: string): Promise<Jogador> {
    const response = await fetch(`${API_BASE_URL}/auth/cadastro`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nome, nick, senha: senha || '1234' })
    });
    if (!response.ok) {
      if (response.status === 400) {
        const errorData = await response.json();
        throw { status: 400, message: errorData.detail || 'Este Nick já está cadastrado.' };
      }
      throw new Error('Falha ao cadastrar jogador');
    }
    return response.json();
  },

  async loginJogador(nick: string, senha: string): Promise<Jogador> {
    const response = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nick, senha })
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw { status: response.status, message: errorData.detail || 'Nick ou senha incorretos.' };
    }
    return response.json();
  },

  async listarJogadores(): Promise<Jogador[]> {
    const response = await fetch(`${API_BASE_URL}/jogadores`, {
      headers: getAuthHeaders()
    });
    if (!response.ok) throw new Error('Falha ao listar jogadores');
    return response.json();
  },

  async obterJogador(id: number): Promise<Jogador> {
    const response = await fetch(`${API_BASE_URL}/jogadores/${id}`, {
      headers: getAuthHeaders()
    });
    if (!response.ok) throw new Error('Jogador não encontrado');
    return response.json();
  },

  async obterClassificacao(): Promise<ClassificacaoItem[]> {
    const response = await fetch(`${API_BASE_URL}/classificacao`);
    if (!response.ok) throw new Error('Falha ao carregar classificação');
    return response.json();
  },

  async obterStatusQueda(numeroQueda: number): Promise<StatusQueda> {
    const response = await fetch(`${API_BASE_URL}/quedas/${numeroQueda}/status`, {
      headers: getAuthHeaders()
    });
    if (!response.ok) throw new Error('Falha ao obter status da queda');
    return response.json();
  },

  async inscreverNaQueda(numeroQueda: number): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/quedas/${numeroQueda}/inscrever`, {
      method: 'POST',
      headers: getJsonHeaders()
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || 'Falha ao se inscrever na queda');
    }
  },

  async lancarResultadoQueda(payload: QuedaPayload): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/quedas`, {
      method: 'POST',
      headers: getJsonHeaders(),
      body: JSON.stringify(payload)
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || 'Falha ao lançar resultado');
    }
  },

  async obterInfoSala(numeroQueda: number): Promise<SalaData> {
    const response = await fetch(`${API_BASE_URL}/salas/${numeroQueda}`, {
      headers: getAuthHeaders()
    });
    if (!response.ok) throw new Error('Sala não encontrada');
    return response.json();
  },

  async liberarSala(numeroQueda: number, salaId: string, senha: string): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/salas`, {
      method: 'POST',
      headers: getJsonHeaders(),
      body: JSON.stringify({ numero_queda: numeroQueda, sala_id: salaId, senha })
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || 'Falha ao liberar sala');
    }
  },

  async solicitarDeposito(valor: number): Promise<DepositoRequisicao> {
    const response = await fetch(`${API_BASE_URL}/carteira/depositar`, {
      method: 'POST',
      headers: getJsonHeaders(),
      body: JSON.stringify({ valor })
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || 'Falha ao solicitar depósito');
    }
    return response.json();
  },

  async obterDepositosPendentes(): Promise<DepositoRequisicao[]> {
    const response = await fetch(`${API_BASE_URL}/admin/depositos/pendentes`, {
      headers: getAuthHeaders()
    });
    if (!response.ok) throw new Error('Falha ao buscar depósitos pendentes');
    return response.json();
  },

  async aprovarDeposito(depositoId: number): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/admin/depositos/${depositoId}/processar`, {
      method: 'POST',
      headers: getJsonHeaders(),
      body: JSON.stringify({ status: 'aprovado' })
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || 'Falha ao aprovar depósito');
    }
  },

  async rejeitarDeposito(depositoId: number): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/admin/depositos/${depositoId}/processar`, {
      method: 'POST',
      headers: getJsonHeaders(),
      body: JSON.stringify({ status: 'rejeitado' })
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || 'Falha ao rejeitar depósito');
    }
  },
};
