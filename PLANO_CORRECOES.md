# PLANO DE CORRECOES — Camp Free Fire

> **Para o agente de IA:** Leia este arquivo primeiro. Ele descreve exatamente o que precisa ser feito, em qual ordem, e o status atual de cada tarefa. Sempre marque a tarefa como [x] apos concluir e fazer o commit.

---

## CONTEXTO DO PROJETO

- **Frontend:** React + TypeScript + Vite, deploy no Vercel (https://camp-freefire.vercel.app)
- **Backend:** Python FastAPI, deploy no Railway
- **Banco de dados:** PostgreSQL (Railway) com fallback SQLite local
- **Pagamentos PIX:** Cora Bank (cora_pix.py)
- **IA:** Google Gemini (OCR de prints + agente de comandos)

---

## STATUS GERAL

- [ ] ETAPA 1 — Backend main.py completo
- [ ] ETAPA 2 — Frontend api.ts completo
- [ ] ETAPA 3 — Correcoes de bugs no frontend
- [ ] ETAPA 4 — Dependencias e configuracao
- [ ] ETAPA 5 — Validacao final

---

## ETAPA 1 — Backend: reescrever backend/main.py

**Status:** PENDENTE

### Problema
O main.py atual tem apenas 3 rotas (cadastro, login, me). Faltam todos os modelos de banco e todas as rotas que o frontend consome.

### Modelos de banco (SQLAlchemy) a adicionar

- Queda: id, numero_queda (unique), sala_id, sala_senha, status
- Inscricao: id, jogador_id (FK), numero_queda, data_inscricao
- ResultadoQueda: id, jogador_id (FK), numero_queda, colocacao, abates, premio
- DepositoRequisicao: id, jogador_id (FK), valor, status, data_hora

### Rotas a adicionar

GET  /classificacao            — Ranking geral (publico)
GET  /jogadores                — Listar jogadores (admin)
GET  /historico/{nick}         — Historico do jogador (JWT)
GET  /queda/{n}/status         — Status da queda (JWT)
GET  /queda/{n}/sala           — Credenciais sala (JWT + inscrito)
POST /queda/{n}/inscrever      — Inscrever jogador, debita R$2 (JWT)
POST /queda/{n}/sala           — Liberar sala id+senha (admin)
POST /queda/{n}/resultado      — Lancar resultado + pagar premios (admin)
POST /queda/{n}/cancelar       — Cancelar queda + reembolsar R$2 (admin)
GET  /depositos/pendentes      — Listar depositos pendentes (admin)
POST /depositos/{id}/processar — Aprovar/rejeitar deposito (admin)
POST /ocr/resultado            — Upload print, processa Gemini Vision (admin)
POST /agente/comando           — Agente IA linguagem natural (admin)

### Campos de retorno por rota

GET /classificacao
  → lista com: id, nick, nome, saldo, total_premios, total_abates, total_quedas, melhor_colocacao

GET /historico/{nick}
  → { jogador: Jogador, history: [{numero_queda, colocacao, abates, premio}], totalEarnings, totalKills, totalMatches, averagePlacement }

GET /queda/{n}/status
  → { numero_queda, inscritos_count, limite: 52, esta_inscrito: bool, sala_liberada: bool }

GET /queda/{n}/sala
  → { sala_id: str, senha: str }  (so retorna se jogador esta inscrito)

POST /queda/{n}/resultado body
  → { numero_queda: int, resultados: [{jogador_id, colocacao, abates}] }

POST /depositos/{id}/processar body
  → { status: "aprovado" | "rejeitado" }

POST /ocr/resultado
  → multipart/form-data com numero_queda (int) e imagem (File)
  → retorna: { resultados: [{jogador_id, jogador_nick, colocacao, abates}] }

POST /agente/comando body
  → { comando: str }
  → retorna: { resposta: str }

### Tabela de premios por colocacao

1o lugar:    R$ 20,00
2o lugar:    R$ 10,00
3o lugar:    R$ 7,00
4o-5o lugar: R$ 5,00
6o-10o:      R$ 3,00
11o-20o:     R$ 1,00
Demais:      R$ 0,00
Cada abate:  +R$ 0,50

### Tambem fazer

- Adicionar app.include_router(pix_router) no main.py (importar de cora_pix.py)
- Manter JWT + bcrypt existentes
- Manter SECRET_KEY via variavel de ambiente

---

## ETAPA 2 — Frontend: reescrever src/services/api.ts

**Status:** PENDENTE

### Problema
O arquivo atual (32 linhas) so exporta instancia axios basica. Projeto inteiro importa apiService que nao existe. Nao compila.

### Tipos TypeScript a exportar

export interface Jogador {
  id: number; nome: string; nick: string; saldo: number; is_admin: boolean;
}

export interface ClassificacaoItem {
  id: number; nick: string; nome: string; saldo: number;
  total_premios: number; total_abates: number; total_quedas: number; melhor_colocacao: number | null;
}

export interface StatusQueda {
  numero_queda: number; inscritos_count: number; limite: number;
  esta_inscrito: boolean; sala_liberada: boolean;
}

export interface SalaData { sala_id: string; senha: string; }

export interface ResultadoQuedaInput { jogador_id: number; colocacao: number; abates: number; }

export interface DepositoRequisicao {
  id: number; jogador_id: number; jogador_nick?: string;
  valor: number; status: string; data_hora: string;
}

### Metodos do apiService

loginJogador(nick, senha) — POST /auth/login — salva access_token e currentUser no localStorage
cadastrarJogador(nome, nick, senha?) — POST /auth/cadastro
obterClassificacao() — GET /classificacao
listarJogadores() — GET /jogadores
getPlayerHistory(nick) — GET /historico/{nick}
obterStatusQueda(numero) — GET /queda/{numero}/status
obterInfoSala(numero) — GET /queda/{numero}/sala
inscreverNaQueda(numero) — POST /queda/{numero}/inscrever
liberarSala(numero, salaId, senha) — POST /queda/{numero}/sala
lancarResultadoQueda(dados) — POST /queda/{dados.numero_queda}/resultado
cancelarQuedaReembolsar(numero) — POST /queda/{numero}/cancelar
obterDepositosPendentes() — GET /depositos/pendentes
processarDeposito(id, status) — POST /depositos/{id}/processar
processarOcrResultado(numeroQueda, arquivo) — POST /ocr/resultado (multipart)
enviarComandoAgente(comando, contexto?) — POST /agente/comando

### Funcao getPremioPorColocacao

export function getPremioPorColocacao(colocacao: number): number
1=20, 2=10, 3=7, 4-5=5, 6-10=3, 11-20=1, outros=0

### Detalhes de implementacao

- Usar axios com interceptor JWT (localStorage key: access_token)
- No login: salvar access_token e currentUser no localStorage
- Erros: extrair error.response?.data?.detail para mensagem amigavel
- URL base: import.meta.env.VITE_API_URL

---

## ETAPA 3 — Correcoes de bugs no frontend

**Status:** PENDENTE

### Bug 1: Assinatura errada do addToast em AuthPortal.tsx

Problema: AuthPortalProps define addToast(title, desc?, type?) mas App.tsx passa handleAddToast(type, title, desc?)

Correcao:
- Renomear prop de addToast para onAddToast
- Nova assinatura: (type: success|error|warning|info, title: string, desc?: string) => void
- Atualizar todas as chamadas internas

### Bug 2: src/pages/Login.tsx usa react-router-dom inexistente

Problema: importa useNavigate que nao esta no package.json. Causa erro de build.

Correcao: substituir conteudo do arquivo por:
  export { AuthPortal as default } from '../components/AuthPortal';

### Bug 3: Strings com encoding quebrado em PlayerPortal.tsx

Substituir caracteres corrompidos (sequencias ??) por portugues sem acento:
- Inscricao, Colocacao, Premiacao, Quedas Concluidas, Rank Medio
- Voce ja esta inscrito, Verificando inscricoes, Suas Pontuacoes Anteriores
- Revisar todo o arquivo

---

## ETAPA 4 — Dependencias e configuracao

**Status:** PENDENTE

### Tarefa 1: Adicionar axios ao package.json

Em dependencies adicionar: "axios": "^1.7.0"

### Tarefa 2: Verificar vite.config.ts

Deve ter plugins: [react()] e tailwindcss() conforme deps instaladas.

### Tarefa 3: Variaveis de ambiente (documentacao — nao alterar codigo)

Vercel: VITE_API_URL = URL do Railway
Railway: SECRET_KEY, DATABASE_URL, ALLOWED_ORIGINS, GEMINI_API_KEY, BACKEND_URL
Cora PIX: CORA_CLIENT_ID, CORA_CERT_B64, CORA_KEY_B64

---

## ETAPA 5 — Validacao final

**Status:** PENDENTE

### Checklist de consistencia backend x frontend

- [ ] POST /auth/login retorna { access_token, token_type, jogador }
- [ ] GET /classificacao retorna ClassificacaoItem[]
- [ ] GET /historico/{nick} retorna { jogador, history[], totalEarnings, totalKills, totalMatches, averagePlacement }
- [ ] GET /queda/{n}/status retorna { numero_queda, inscritos_count, limite, esta_inscrito, sala_liberada }
- [ ] GET /queda/{n}/sala retorna { sala_id, senha }
- [ ] POST /queda/{n}/resultado aceita { numero_queda, resultados[] }
- [ ] POST /ocr/resultado retorna { resultados: [{jogador_id, jogador_nick, colocacao, abates}] }
- [ ] POST /agente/comando retorna { resposta: string }
- [ ] Rotas /pix/* funcionando (router incluido)
- [ ] npm run build passa sem erros TypeScript

---

## INSTRUCOES PARA O AGENTE DE IA RETOMAR

Se os tokens acabarem durante o trabalho, na proxima sessao:

1. Abrir https://github.com/ernanefideles22-bot/camp.freefire
2. Ler este arquivo PLANO_CORRECOES.md
3. Ver quais etapas estao marcadas [x] (concluidas) e [ ] (pendentes)
4. Continuar pela primeira etapa pendente
5. Apos concluir cada etapa, editar este arquivo e marcar [x]
6. Commit com mensagem: fix(etapaN): descricao

---

## HISTORICO DE COMMITS JA FEITOS (antes deste plano)

- fix(fase1): corrigir erro de sintaxe TypeScript no Leaderboard.tsx
- fix(fase1): corrigir SECRET_KEY, pg8000, CORS e require_admin
- fix(fase1): integrar AuthProvider no main.tsx
- fix(fase1): unificar AuthContext com apiService e chaves de localStorage
- fix(fase1): mover Login.tsx para src/pages/
- fix(fase1): remover URL hardcoded de PixDeposito.tsx
- fix(fase1): corrigir polling excessivo e toast automatico no Leaderboard
- fix: correct encoding mojibake in PlayerPortal.tsx (parcial)
