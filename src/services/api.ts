// API client for Free Fire Solo Championship
// Connects directly to FastAPI backend on http://localhost:8000

const API_BASE_URL = 'http://localhost:8000';

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

// Map placement to prize money in Reais (R$)
export const getPremioPorColocacao = (colocacao: number): number => {
  if (colocacao === 1) return 20.00;
  if (colocacao === 2) return 10.00;
  if (colocacao === 3) return 7.00;
  if (colocacao === 4) return 5.00;
  if (colocacao >= 5 && colocacao <= 10) return 1.50;
  return 0.00;
};

// Points per placement according to the user's backend scores config:
// TABELA_PONTUACAO_COLOCACAO = {1: 12, 2: 9, 3: 8, 4: 7, 5: 6, 6: 5, 7: 4, 8: 3, 9: 2, 10: 1}
export const getPontosPorColocacao = (colocacao: number): number => {
  const pointsTable: Record<number, number> = {
    1: 12, 2: 9, 3: 8, 4: 7, 5: 6, 6: 5, 7: 4, 8: 3, 9: 2, 10: 1
  };
  return pointsTable[colocacao] || 0;
};

// Get custom authorization headers
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

// Get headers with content type JSON and auth info
const getJsonHeaders = (): Record<string, string> => {
  return {
    'Content-Type': 'application/json',
    ...getAuthHeaders()
  };
};

export const apiService = {
  // --- AUTENTICAÇÃO E CADASTRO ---
  async cadastrarJogador(nome: string, nick: string, senha?: string): Promise<Jogador> {
    const response = await fetch(`${API_BASE_URL}/auth/cadastro`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
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

  async login(nick: string, senha?: string): Promise<Jogador> {
    const response = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ nick, senha: senha || '1234' })
    });

    if (!response.ok) {
      if (response.status === 401) {
        throw new Error('Nick ou senha incorretos.');
      }
      throw new Error('Falha ao fazer login');
    }

    return response.json();
  },

  async getJogadores(): Promise<Jogador[]> {
    const response = await fetch(`${API_BASE_URL}/jogadores`);
    if (!response.ok) {
      throw new Error('Falha ao obter lista de jogadores');
    }
    return response.json();
  },

  async getClassificacao(): Promise<ClassificacaoItem[]> {
    const response = await fetch(`${API_BASE_URL}/classificacao`);
    if (!response.ok) {
      throw new Error('Falha ao obter classificação');
    }
    return response.json();
  },

  async lancarResultados(numero_queda: number, resultados: ResultadoQuedaInput[]): Promise<any> {
    const response = await fetch(`${API_BASE_URL}/quedas`, {
      method: 'POST',
      headers: getJsonHeaders(),
      body: JSON.stringify({
        numero_queda,
        resultados
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || 'Falha ao registrar queda');
    }

    return response.json();
  },

  async getPlayerHistory(nick: string): Promise<any> {
    const response = await fetch(`${API_BASE_URL}/jogadores/${encodeURIComponent(nick)}/historico`);
    if (response.status === 404) {
      return null;
    }
    if (!response.ok) {
      throw new Error('Falha ao obter histórico do jogador');
    }
    return response.json();
  },

  // --- CARTEIRA / SALDO ---
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
      method: 'GET',
      headers: getAuthHeaders()
    });

    if (!response.ok) {
      throw new Error('Falha ao obter depósitos pendentes');
    }

    return response.json();
  },

  async processarDeposito(id: number, status: 'aprovado' | 'rejeitado'): Promise<any> {
    const response = await fetch(`${API_BASE_URL}/admin/depositos/${id}/processar`, {
      method: 'POST',
      headers: getJsonHeaders(),
      body: JSON.stringify({ status })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || 'Falha ao processar depósito');
    }

    return response.json();
  },

  // --- INSCRIÇÕES E QUEDAS ---
  async inscreverQueda(numero_queda: number): Promise<any> {
    const response = await fetch(`${API_BASE_URL}/quedas/${numero_queda}/inscrever`, {
      method: 'POST',
      headers: getJsonHeaders()
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || 'Falha ao se inscrever na queda');
    }

    return response.json();
  },

  async obterStatusQueda(numero_queda: number): Promise<StatusQueda> {
    const response = await fetch(`${API_BASE_URL}/quedas/${numero_queda}/status`, {
      method: 'GET',
      headers: getAuthHeaders()
    });

    if (!response.ok) {
      throw new Error('Falha ao obter status da queda');
    }

    return response.json();
  },

  async cancelarQuedaReembolsar(numero_queda: number): Promise<any> {
    const response = await fetch(`${API_BASE_URL}/quedas/${numero_queda}/cancelar-reembolsar`, {
      method: 'POST',
      headers: getJsonHeaders()
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || 'Falha ao cancelar queda e reembolsar');
    }

    return response.json();
  },

  // --- ROOM MANAGEMENT ---
  async liberarSala(numero_queda: number, sala_id: string, senha: string): Promise<SalaData> {
    const response = await fetch(`${API_BASE_URL}/salas`, {
      method: 'POST',
      headers: getJsonHeaders(),
      body: JSON.stringify({
        numero_queda,
        sala_id,
        senha
      })
    });

    if (!response.ok) {
      throw new Error('Falha ao liberar sala');
    }

    return response.json();
  },

  async obterSala(numero_queda: number): Promise<SalaData | null> {
    try {
      const response = await fetch(`${API_BASE_URL}/salas/${numero_queda}`);
      if (response.status === 404) {
        return null;
      }
      if (!response.ok) {
        throw new Error('Falha ao obter sala');
      }
      return await response.json();
    } catch (err) {
      return null;
    }
  },

  // --- IA AGENT / OCR ENPOINT ---
  async enviarComandoAgente(comando: string, api_key?: string): Promise<{ resposta: string }> {
    const response = await fetch(`${API_BASE_URL}/agente/comando`, {
      method: 'POST',
      headers: getJsonHeaders(),
      body: JSON.stringify({ comando, api_key: api_key || undefined })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || 'Falha ao processar comando da IA');
    }

    return response.json();
  },

  async processarOcrResultado(numero_queda: number, file: File): Promise<any> {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch(`${API_BASE_URL}/quedas/${numero_queda}/processar-ocr`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: formData
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || 'Falha ao processar print OCR');
    }

    return response.json();
  }
};
