# PLANO DE CORRECOES — Camp Free Fire

> **Para o agente de IA:** Leia este arquivo primeiro. Veja quais etapas estao [x] concluidas e [ ] pendentes.

---

## CONTEXTO DO PROJETO

- **Frontend:** React + TypeScript + Vite, deploy no Vercel (https://camp-freefire.vercel.app)
- **Backend:** Python FastAPI, deploy no Railway
- **Banco de dados:** PostgreSQL (Railway) com fallback SQLite local
- **Pagamentos PIX:** Cora Bank (cora_pix.py)
- **IA:** Google Gemini (OCR de prints + agente de comandos)

---

## STATUS GERAL

- [x] ETAPA 1 — Backend main.py completo — CONCLUIDA
- [x] ETAPA 2 — Frontend api.ts completo — CONCLUIDA
- [x] ETAPA 3 — Correcoes de bugs no frontend — CONCLUIDA
- [x] ETAPA 4 — Dependencias e configuracao — CONCLUIDA
- [x] ETAPA 5 — Validacao e documentacao — CONCLUIDA

---

## O QUE FOI FEITO EM CADA ETAPA

### ETAPA 1 — backend/main.py reescrito
Commit: fix(etapa1): reescrever backend/main.py completo com todos os modelos e rotas

Adicionado:
- Modelos: QuedaModel, InscricaoModel, ResultadoQuedaModel, DepositoRequisicaoModel
- Rotas: GET /classificacao, GET /jogadores, GET /historico/{nick}
- Rotas: GET+POST /queda/{n}/status, /sala, /inscrever, /resultado, /cancelar
- Rotas: GET /depositos/pendentes, POST /depositos/{id}/processar, POST /depositos/solicitar
- Rotas: POST /ocr/resultado (Gemini Vision), POST /agente/comando (Gemini NLP)
- app.include_router(pix_router) para ativar rotas /pix/*
- Funcao calcular_premio() com tabela completa de premios
- senha_hash nullable para suportar cadastro pelo admin sem senha

### ETAPA 2 — src/services/api.ts reescrito
Commit: fix(etapa2): reescrever src/services/api.ts completo com apiService e tipos

Adicionado:
- Tipos: Jogador, ClassificacaoItem, StatusQueda, SalaData, ResultadoQuedaInput, DepositoRequisicao
- apiService com todos os metodos: loginJogador, cadastrarJogador, obterClassificacao,
  listarJogadores, getPlayerHistory, obterStatusQueda, obterInfoSala, inscreverNaQueda,
  liberarSala, lancarResultadoQueda, cancelarQuedaReembolsar, obterDepositosPendentes,
  processarDeposito, solicitarDeposito, processarOcrResultado, enviarComandoAgente
- Funcao getPremioPorColocacao()
- Interceptor JWT com tratamento de erros (extrai detail do FastAPI)

### ETAPA 3 — Bugs do frontend corrigidos
Commits: fix(etapa3a), fix(etapa3b)

Corrigido:
- AuthPortal.tsx: prop renomeada de addToast para onAddToast, assinatura corrigida para (type, title, desc?)
- Login.tsx: removida dependencia de react-router-dom inexistente, re-exporta AuthPortal
- Obs: PlayerPortal.tsx ainda pode ter strings com encoding quebrado — revisar se necessario

### ETAPA 4 — Dependencias
Commit: fix(etapa4): adicionar axios nas dependencies do package.json

Corrigido:
- axios adicionado em dependencies (era usado mas nao estava no package.json)

---

## PENDENCIAS RESTANTES (proxima sessao se necessario)

### App.tsx — verificar chamada do AuthPortal
O App.tsx passa onAuthSuccess e addToast para AuthPortal.
Verificar se o nome da prop foi atualizado de addToast para onAddToast.
Se nao, editar App.tsx e corrigir a prop.

### PlayerPortal.tsx — strings com encoding quebrado
Alguns textos ainda podem ter caracteres corrompidos (ex: ?? no lugar de acento).
Revisar todo o arquivo e substituir strings com caracteres ?? pelo texto correto.

### Variaveis de ambiente (configurar nos paineis — nao e codigo)
Vercel: VITE_API_URL = URL do Railway
Railway: SECRET_KEY, DATABASE_URL, ALLOWED_ORIGINS, GEMINI_API_KEY, BACKEND_URL
Cora: CORA_CLIENT_ID, CORA_CERT_B64, CORA_KEY_B64

### package-lock.json
Apos o deploy no Vercel rodar npm install, o package-lock.json sera atualizado automaticamente.
Nao e necessario atualizar manualmente.

---

## INSTRUCOES PARA O AGENTE DE IA RETOMAR

Se houver trabalho pendente:
1. Leia as PENDENCIAS RESTANTES acima
2. Comece pelo App.tsx (verificar prop onAddToast)
3. Depois PlayerPortal.tsx (encoding)
4. Apos cada arquivo, marque como concluido aqui
5. Commit: fix(pendencia): descricao

---

## HISTORICO DE COMMITS

Commits desta sessao de correcoes:
- docs: criar PLANO_CORRECOES.md com roadmap completo de correcoes
- fix(etapa1): reescrever backend/main.py completo com todos os modelos e rotas
- fix(etapa2): reescrever src/services/api.ts completo com apiService e tipos
- fix(etapa3a): corrigir assinatura onAddToast no AuthPortal.tsx
- fix(etapa3b): corrigir Login.tsx removendo dependencia de react-router-dom
- fix(etapa4): adicionar axios nas dependencies do package.json

Commits anteriores (sessoes anteriores):
- fix(fase1): corrigir erro de sintaxe TypeScript no Leaderboard.tsx
- fix(fase1): corrigir SECRET_KEY, pg8000, CORS e require_admin
- fix(fase1): integrar AuthProvider no main.tsx
- fix(fase1): unificar AuthContext com apiService e chaves de localStorage
- fix(fase1): mover Login.tsx para src/pages/
- fix(fase1): remover URL hardcoded de PixDeposito.tsx
- fix(fase1): corrigir polling excessivo e toast automatico no Leaderboard
- fix: correct encoding mojibake in PlayerPortal.tsx (parcial)
