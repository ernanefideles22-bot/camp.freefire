# PLANO DE CORRECOES — Camp Free Fire

> **Para o agente de IA:** Leia este arquivo primeiro. Veja quais etapas estao [x] concluidas e [ ] pendentes.

---

## STATUS GERAL — TODAS AS ETAPAS CONCLUIDAS

- [x] ETAPA 1 — Backend main.py completo
- [x] ETAPA 2 — Frontend api.ts completo
- [x] ETAPA 3 — Correcoes de bugs no frontend
- [x] ETAPA 4 — Dependencias e configuracao
- [x] ETAPA 5 — Validacao e documentacao
- [x] PENDENCIA 1 — App.tsx prop addToast -> onAddToast
- [x] PENDENCIA 2 — PlayerPortal.tsx encoding quebrado

---

## CONTEXTO DO PROJETO

- **Frontend:** React + TypeScript + Vite, deploy no Vercel (https://camp-freefire.vercel.app)
- **Backend:** Python FastAPI, deploy no Railway
- **Banco de dados:** PostgreSQL (Railway) com fallback SQLite local
- **Pagamentos PIX:** Cora Bank (cora_pix.py)
- **IA:** Google Gemini (OCR de prints + agente de comandos)

---

## HISTORICO COMPLETO DE COMMITS

### Commits desta sessao de correcoes (Jun 2026):
- docs: criar PLANO_CORRECOES.md com roadmap completo
- fix(etapa1): reescrever backend/main.py completo com todos os modelos e rotas
- fix(etapa2): reescrever src/services/api.ts completo com apiService e tipos
- fix(etapa3a): corrigir assinatura onAddToast no AuthPortal.tsx
- fix(etapa3b): corrigir Login.tsx removendo dependencia de react-router-dom
- fix(etapa4): adicionar axios nas dependencies do package.json
- docs(etapa5): atualizar PLANO_CORRECOES.md marcando todas as etapas concluidas
- fix(pendencia1): corrigir prop addToast para onAddToast no App.tsx e limpar logout
- fix(pendencia2): corrigir encoding quebrado e reescrever PlayerPortal.tsx limpo

### Commits anteriores (Mai 2026):
- fix(fase1): corrigir erro de sintaxe TypeScript no Leaderboard.tsx
- fix(fase1): corrigir SECRET_KEY, pg8000, CORS e require_admin
- fix(fase1): integrar AuthProvider no main.tsx
- fix(fase1): unificar AuthContext com apiService e chaves de localStorage
- fix(fase1): mover Login.tsx para src/pages/
- fix(fase1): remover URL hardcoded de PixDeposito.tsx
- fix(fase1): corrigir polling excessivo e toast automatico no Leaderboard
- fix: correct encoding mojibake in PlayerPortal.tsx (parcial)

---

## O QUE FOI FEITO EM CADA ETAPA

### ETAPA 1 — backend/main.py
Modelos novos: QuedaModel, InscricaoModel, ResultadoQuedaModel, DepositoRequisicaoModel
Rotas novas: /classificacao, /jogadores, /historico/{nick}, /queda/{n}/status, /sala, /inscrever,
             /resultado, /cancelar, /depositos/pendentes, /depositos/{id}/processar,
             /depositos/solicitar, /ocr/resultado, /agente/comando
Extras: app.include_router(pix_router), calcular_premio(), senha_hash nullable

### ETAPA 2 — src/services/api.ts
Tipos: Jogador, ClassificacaoItem, StatusQueda, SalaData, ResultadoQuedaInput, DepositoRequisicao
apiService com 15 metodos completos + getPremioPorColocacao()
Interceptor JWT com tratamento de erros do FastAPI (detail)

### ETAPA 3 — Bugs do frontend
AuthPortal.tsx: prop renomeada addToast -> onAddToast, assinatura corrigida
Login.tsx: removida dependencia react-router-dom, re-exporta AuthPortal

### ETAPA 4 — package.json
axios adicionado em dependencies

### PENDENCIA 1 — App.tsx
Corrigidas as 2 chamadas do AuthPortal: addToast -> onAddToast
Tambem: logout agora limpa access_token + currentUser

### PENDENCIA 2 — PlayerPortal.tsx
Reescrito completamente sem strings com encoding quebrado
Strings corrigidas: Inscricao, Colocacao, Premiacao, Quedas Concluidas,
                    Rank Medio, Voce ja esta inscrito, Verificando inscricoes,
                    Suas Pontuacoes Anteriores, Atencao, etc.

---

## PROXIMOS PASSOS (configuracao — nao e codigo)

Para colocar o projeto em producao, configure as variaveis de ambiente:

### Vercel (Frontend):
VITE_API_URL = https://sua-url.up.railway.app

### Railway (Backend):
SECRET_KEY = (chave aleatoria segura, ex: openssl rand -hex 32)
DATABASE_URL = (fornecido automaticamente pelo PostgreSQL do Railway)
ALLOWED_ORIGINS = https://camp-freefire.vercel.app
GEMINI_API_KEY = (obtido em https://aistudio.google.com/apikey)
BACKEND_URL = https://sua-url.up.railway.app

### Cora Bank PIX (opcional):
CORA_CLIENT_ID = (obtido no painel Cora)
CORA_CERT_B64 = (certificado .crt em base64)
CORA_KEY_B64 = (chave .key em base64)

---

## INSTRUCOES PARA O AGENTE DE IA (se precisar retomar)

1. Leia este arquivo
2. Veja STATUS GERAL — todas marcadas [x] significa que o codigo esta completo
3. Se houver novo trabalho: criar nova secao NOVA SESSAO com as tarefas
4. Commits com mensagem: tipo(escopo): descricao

---

## NOVA SESSAO — Jun 2026 (deploy Vercel + Supabase)

- [x] Corrigir 7 erros TS que quebravam o build/deploy (Leaderboard, AuthContext)
- [x] Webhook PIX: persistencia em cobrancas_pix + confirmacao via API Cora (mTLS) + idempotencia
- [x] /pix/criar-cobranca agora exige JWT; CORA_CLIENT_ID removido do codigo
- [x] Refresh token (/auth/refresh) + senha obrigatoria no cadastro + /auth/definir-senha
- [x] SQLAlchemy 2.x nativo (Mapped/mapped_column, select())
- [x] Gemini via REST (modelo configuravel, default gemini-2.5-flash)
- [x] Backend convertido p/ Vercel serverless (api/index.py + vercel.json) — Railway aposentado
- [x] Banco: Supabase (ref bbisshfqavavfhlpdanr), migration schema_inicial_camp_freefire aplicada
- [x] 15 testes pytest (backend/tests/)

### Variaveis de ambiente no Vercel (Settings > Environment Variables):
SECRET_KEY        = (openssl rand -hex 32)
DATABASE_URL      = postgresql://postgres.bbisshfqavavfhlpdanr:[SENHA]@aws-0-us-west-2.pooler.supabase.com:6543/postgres
ALLOWED_ORIGINS   = https://camp-freefire.vercel.app
GEMINI_API_KEY    = (https://aistudio.google.com/apikey)
CORA_CLIENT_ID    = (painel Cora)
CORA_CERT_B64     = (certificado .crt em base64)
CORA_KEY_B64      = (chave .key em base64)

### Webhook Cora: cadastrar endpoint https://camp-freefire.vercel.app/api/pix/webhook


---

## TROCA DE PROVEDOR DE PAGAMENTOS — Cora -> Asaas (Jun 2026)

Motivo: a conta Cora pertence a outro negocio do dono; alem disso o Asaas faz
PIX de SAIDA por chave (a Cora so transfere por agencia/conta).

- backend/asaas.py substitui cora_pix.py (removido)
- Deposito: POST /payments (billingType PIX) + GET /payments/{id}/pixQrCode
- Webhook: valida header asaas-access-token + reconsulta a cobranca na API antes de creditar
- Saque: POST /transfers com pixAddressKey (chave PIX) — execucao instantanea
- Variaveis no Vercel:
  ASAAS_API_KEY       = (painel Asaas > Integracoes > API)
  ASAAS_WEBHOOK_TOKEN = (token que voce define ao cadastrar o webhook no painel)
  ASAAS_BASE_URL      = https://api-sandbox.asaas.com/v3 (apenas para sandbox; apague em producao)
- Webhook a cadastrar no painel Asaas: https://camp-freefire.vercel.app/api/pix/webhook
  (evento: cobrancas recebidas/confirmadas; token = ASAAS_WEBHOOK_TOKEN)


---

## TROCA DE IA — Gemini -> Anthropic (Claude) (Jun 2026)

- OCR de placar e agente de comandos agora usam a API da Anthropic (Messages, REST)
- Variaveis no Vercel:
  ANTHROPIC_API_KEY = (https://console.anthropic.com/ > API Keys)
  ANTHROPIC_MODEL   = opcional (default claude-haiku-4-5-20251001)
- GEMINI_API_KEY / GEMINI_MODEL nao sao mais usadas (podem ser removidas)
