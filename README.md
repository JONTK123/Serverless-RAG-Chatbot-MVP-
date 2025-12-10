# 📘 Documentação: Serverless RAG Chatbot (MVP)

## 📋 Índice

1. [Visão Geral e Stack Tecnológico](#1-visão-geral-e-stack-tecnológico)
2. [Registro de Decisões e Dúvidas](#2-registro-de-decisões-e-dúvidas-architecture-decision-record)
3. [Fluxo de Trabalho Git](#3-fluxo-de-trabalho-git-padrão-promiles)
4. [Roteiro de Implementação](#4-roteiro-de-implementação-roadmap)
5. [Implementação Técnica de Referência](#5-implementação-técnica-de-referência)
6. [Otimização de Bundle: API-Only vs Full-Stack](#6-📦-otimização-de-bundle-api-only-vs-full-stack)
7. [Estrutura do Projeto](#7-estrutura-do-projeto)
8. [Como Começar](#8-como-começar)

---

## 1. Visão Geral e Stack Tecnológico

O objetivo é criar um Chatbot de Inteligência Artificial que responda perguntas baseadas em um documento PDF privado (RAG), com interface reativa e respostas via streaming.

### Frontend (Aplicação Web)
* **Framework:** **Nuxt 3** (Vue.js + TailwindCSS)
* **Gerenciamento de Sessão:** **LocalStorage** (Navegador do Cliente)
* **Comunicação:** `fetch` nativo com leitura de `ReadableStream`

### Backend (Serverless API)
* **Framework:** **Nuxt Nitro** (Server Routes - `/server/api`)
* **Runtime:** Node.js rodando em **AWS Lambda**
* **Acesso:** **Function URL** (Endpoint HTTPS direto, sem API Gateway complexo)
* **Streaming:** `InvokeMode: RESPONSE_STREAM`
* **Endpoints:**
    * `/api/ingest` - Upload e processamento de PDFs 
    * `/api/chat` - Conversação com o chatbot (streaming de resposta)

### Inteligência & Dados
* **LLM:** OpenAI `gpt-5-nano`
* **Orquestração:** **LangChain.js** (Core & Community)
* **Banco de Conhecimento:** **Qdrant** (Vector Database)
    * *Função:* Armazenar o PDF (chunks) e transformado em vetores

---

## 2. 🧠 Registro de Decisões e Dúvidas (Architecture Decision Record)

Esta seção detalha as dúvidas levantadas durante o planejamento e a solução final adotada.

### 2.1. Memória do Chat: Redis vs. LocalStorage vs. In-Memory
* **Dúvida Levantada:** *"Devo usar Redis para o histórico? Posso usar variável global em Python/Node? O Qdrant salva o histórico? Banco não relacional / relacional funciona aqui?"*
* **Análise:**
    * *Qdrant:* Não serve para histórico de conversa, serve apenas para conhecimento (PDF)
    * *In-Memory (variável global):* Impossível em AWS Lambda, pois a função "morre" após o uso (Stateless). Variável global Node seria perdida entre invocações
    * *Banco Relacional (PostgreSQL, MySQL):* Funcionaria tecnicamente, mas é "overkill" para MVP. Exige RDS (custo), gerenciamento de conexões e esquema de dados
    * *Banco Não Relacional (DynamoDB, MongoDB):* Também funcionaria, mas adiciona complexidade de queries e custo. DynamoDB seria serverless, mas precisa gerenciar TTL e cleanup
    * *Redis:* Seria a solução robusta padrão para cache de sessão, mas adiciona custo (instância paga) e complexidade de infraestrutura (VPC) desnecessária para um MVP
* **Decisão Final:** **Frontend-Driven History**
    * O Frontend guarda o array de mensagens no LocalStorage
    * A cada nova pergunta, o Frontend envia o **histórico completo** no `body` da requisição
    * O Backend recebe tudo que precisa no request, processa e responde (stateless)
    * O Backend **não armazena** e **não busca** histórico em nenhum banco de dados
    * *Identificação (`x-user-id`):* O Front gera um UUID apenas para correlacionar logs/analytics. O backend **não usa esse ID para buscar dados** (não há dados armazenados para buscar!), apenas para logging/tracking. É como um "número de protocolo" - serve para rastrear requisições nos logs, não para recuperar histórico. Cada request é independente e autocontido.

**Por que Frontend-Driven?**
- ✅ **Simples:** Sem infraestrutura extra (Redis, DynamoDB, etc)
- ✅ **Escalável:** Lambda é stateless, múltiplos usuários não se interferem
- ✅ **Privado:** Usuário controla seus dados (localStorage local)
- ✅ **Econômico:** Zero custo de persistência para MVP
- ❌ Não persiste após limpar dados do navegador (mas é MVP)

### 2.2. Comunicação: WebSockets vs. HTTP Streaming
* **Dúvida Levantada:** *"Como fazer a conexão cliente servidor para esse projeto sabendo do lambda (sobe e morre)? Preciso de WebSockets? Http padrão resolve? Lambda suporta Streaming de respostas?"*
* **Análise:**
    * *WebSockets:* Em arquitetura Serverless, exigem API Gateway V2 e gerenciamento manual de conexões (`@connections`) no DynamoDB. Muito complexo para uma via de mão única (Bot respondendo)
    * *API Gateway Padrão:* Faz buffer da resposta (espera tudo ficar pronto para enviar), matando o efeito de digitação
* **Decisão Final:** **Lambda Function URL com Response Streaming**
    * Usaremos o modo `RESPONSE_STREAM` nativo da Lambda
    * Isso permite enviar chunks de texto via HTTP padrão assim que o LangChain os gera

### 2.3. Framework Backend: Nuxt Nitro vs. Express.js
* **Dúvida Levantada:** *"Por que usar Nitro? Existem outras alternativas como Express?"*
* **Análise:**
    * *Express:* Pesado, lento para iniciar (*cold start*) e não otimizado para Serverless moderno
    * *Nitro:* É o motor nativo do Nuxt. Permite escrever a API dentro da mesma pasta do projeto Frontend, compartilha a configuração de build e compila para um pacote minúsculo otimizado para Lambda
* **Decisão Final:** **Nuxt Nitro**. Pela simplicidade de manter um único repositório (Monorepo implícito) e performance

### 2.4. Estratégia de RAG: Vetorial vs. Contexto Bruto
* **Dúvida Levantada:** *"Por que um banco vetorial? Por que não extrair o JSON do texto e jogar no prompt?"*
* **Análise:**
    * *Contexto Bruto:* Jogar um PDF inteiro no prompt estoura o limite de tokens do modelo e custa caro
* **Decisão Final:** **Qdrant (Vetorial)**
    * Usaremos o LangChain para dividir o PDF em pedaços
    * O Qdrant busca semanticamente apenas os trechos relevantes à pergunta
    * A IA recebe apenas o necessário para responder

### 2.5. Orquestração: LangChain vs. "Na Mão"
* **Dúvida Levantada:** *"Vamos usar LangChain ou chamar a OpenAI direto? LangChain não é complexo para streaming?"*
* **Análise:**
    * O LangChain antigo era complexo. O novo (LCEL - LangChain Expression Language) simplificou o streaming com o método `.stream()`
    * Fazer a ingestão do PDF (Splitters + Embeddings) "na mão" é muito trabalhoso
* **Decisão Final:** **Híbrido/LangChain**
    * Usaremos LangChain para processar o PDF
    * Usaremos LangChain para o Chat, aproveitando a integração nativa de streaming

---

### 2.6. Resumo das Decisões Técnicas

| Item | Dúvida/Contexto | Onde está documentado | Solução Adotada |
|------|----------------|----------------------|-----------------|
| **Redis (Inicialmente)** | "Devo usar Redis para o histórico? Posso usar variável global em Python/Node? O Qdrant salva o histórico? Banco não relacional / relacional funciona aqui?" | **Seção 2.1** | Descartado por custo/complexidade (VPC). Usamos LocalStorage no frontend. |
| **Identificação Usuário** | Como identificar usuários sem autenticação? | **Seção 2.1** | UUID no LocalStorage para logs/analytics. Enviado via header `x-user-id`. |
| **Banco Vetorial vs. Relacional** | "Por que um banco vetorial? Por que não extrair o JSON do texto e jogar no prompt?" | **Seção 2.4** | Qdrant resolve o problema de Context Window (limite de tokens). Busca semântica. |
| **WebSocket vs. Lambda** | Como fazer conexão cliente-servidor sabendo que Lambda sobe e morre? WebSockets ou HTTP resolve? | **Seção 2.2** | WebSocket complexo demais. Usamos HTTP Streaming com `RESPONSE_STREAM`. |
| **LangChain vs. Na mão** | "Vamos usar LangChain ou chamar a OpenAI direto? LangChain não é complexo para streaming?" | **Seção 2.5** | Sim. Nova sintaxe (`.stream()`) simplificou. Processa PDF automaticamente. |
| **Memória Persistente** | Onde salvar o histórico? | **Seção 2.1** | Frontend é o "dono" do estado. Envia histórico completo a cada request. |
| **Config AWS Lambda (Streaming)** | Como ativar streaming na Lambda? | **Seção 5.1** | `invokeMode: RESPONSE_STREAM` no `serverless.yml`. |
| **Nuxt Nitro vs. Express** | Por que Nitro e não Express? | **Seção 2.3** | Nitro é nativo do Nuxt, evita cold start, monorepo simplificado. |
| **Function URL vs. API Gateway** | Qual usar para evitar buffer? | **Seção 1** | Function URL direto, sem passar pelo API Gateway tradicional. |
| **PDF Processing** | pdf-parse ou LangChain? | **Package.json** | 100% LangChain com `PDFLoader`. Mais integrado e sem deps extras. |
| **Upload de PDF** | Script local ou interface web? | **Seção 5.1.1** | Interface web com drag & drop. Endpoint `/api/ingest` processa upload. |

---

### 2.7. Arquitetura Serverless: Nuxt Full-Stack vs. Node.js + Vue Separados

#### 🎯 A Decisão: Por que Nuxt Monolítico para MVP?

Este projeto usa **Nuxt Full-Stack** (Frontend + Backend no mesmo Lambda). Mas por quê? E como seria com separação tradicional?

#### 📦 Nuxt Full-Stack (Atual)

**Estrutura:**
```
Seu Projeto
├── pages/          ← Frontend (Vue components renderizados)
├── server/         ← Backend (Node.js/H3 endpoints)
└── nuxt.config.ts  ← Configuração única
```

**Build & Deploy:**
```
npm run build
         ↓
    .output/
    ├── public/      ← Assets estáticos (JS, CSS)
    ├── server/      ← Node.js compilado
    └── index.mjs    ← Entry point único
         ↓
    Upload para AWS Lambda (único pacote)
```

**Em Execução (Lambda):**
```
Usuario acessa: https://api.lambda.amazonaws.com/
                         ↓
                    Lambda Function
                    (index.mjs inicia)
                         ↓
          ┌──────────────┴──────────────┐
          ↓                             ↓
    GET /            GET /api/chat
  (Renderiza HTML)  (LangChain + RAG)
   (Frontend Vue)    (Backend Node.js)
```

**Vantagens para MVP:**
- ✅ **Código compartilhado**: Types, utilities, validações entre frontend e backend
- ✅ **Uma única build**: Simplifica CI/CD
- ✅ **Deploy simples**: Um arquivo ZIP para Lambda
- ✅ **SSR/Rendering**: Nuxt renderiza HTML no servidor (melhora SEO, primeira carga mais rápida)
- ✅ **Monorepo implícito**: Sem necessidade de gerenciar múltiplos repos

**Desvantagens:**
- ❌ **Cold starts maiores**: Bundle = LangChain (~5MB) + Vue (~500KB) + Qdrant (~10MB) = 15-30MB zipped
  - Resultado: 10-30 segundos no primeiro request ⏱️
- ❌ **Limite de tamanho**: Lambda tem limite de 50MB (zipped), você fica perto do limite
- ❌ **Scaling desacoplado impossível**: Frontend e backend escalam juntos (não ideal em produção)

---

#### 🏗️ Node.js + Vue Separados (Produção)

**Arquitetura Desacoplada:**
```
┌─────────────────┐         ┌──────────────┐
│   S3 + CDN      │         │   Lambda     │
│  (Vue Build)    │         │  (Node API)  │
└────────┬────────┘         └──────┬───────┘
         │                         │
    estáticos.com          api.estáticos.com
      (S3+CF)               (API puro)
```

**Build Diferenciado:**
```bash
# Frontend: Build estático
npm run build:frontend
    ↓
dist/
├── index.html
├── js/
├── css/
└── assets/
    ↓
Upload para S3 → CloudFront (CDN)

# Backend: API isolada
npm run build:api
    ↓
.output-api/
├── server/
└── index.mjs
    ↓
Upload para Lambda
```

**Em Execução:**
```
Usuario acessa: https://estáticos.com
                      ↓
    CloudFront serve HTML/JS/CSS
    (Assets estáticos pré-compilados)
                      ↓
   Script Vue executa no navegador
                      ↓
   POST /api/chat → https://api.estáticos.com
                      ↓
              Lambda Function
          (Node.js + LangChain puro)
                      ↓
         Retorna resposta com streaming
```

**Vantagens para Produção:**
- ✅ **Cold starts reduzidos**: Lambda contém apenas LangChain (~15MB) + dependências
  - Resultado: 3-5 segundos no primeiro request
- ✅ **Scaling independente**: Se frontend é acessado muito, CDN absorve. Se backend é pesado, Lambda escala à parte
- ✅ **Cache agressivo**: S3 + CloudFront cacheia assets por anos
- ✅ **Assets globais**: CDN distribui JS/CSS pelo mundo
- ✅ **Separação de responsabilidades**: Frontend versionado separado do backend

**Desvantagens:**
- ❌ **Complexidade aumenta**: Gerenciar 2 builds, 2 deployments, 2 repos
- ❌ **Setup inicial**: Precisa configurar CloudFront, S3, origem do CORS
- ❌ **Custo**: S3 + CloudFront adiciona custo (porém mínimo para MVP)

---

#### 📊 Comparação Lado a Lado

| Aspecto | Nuxt Full-Stack (Atual) | Node + Vue Separados |
|--------|-------------------------|----------------------|
| **Cold Start** | 10-30s | 3-5s |
| **Tamanho Bundle** | 20-30MB | 15MB (API) + 2MB (Frontend) |
| **Complexidade** | Baixa | Média |
| **Deploy** | Um comando | Dois comandos (2 pipelines) |
| **Cache Frontend** | Nenhum (sempre do Lambda) | Agressivo (CDN) |
| **Custo Mensal** | ~$0.20 (poucos reqs) | ~$1-3 (inclui CDN) |
| **Escalabilidade** | Ruim | Excelente |
| **Recomendado para** | MVP, protótipos | Produção, alto tráfego |

---

#### 🎬 Roadmap Sugerido

1. **Fase 1 (MVP - Atual)**: Nuxt Full-Stack
   - Válido para <100 reqs/dia
   - Prototipa rápido
   - Deploy simples

2. **Fase 2 (Beta - ~1 mês)**: Separação de builds
   - Mantém monorepo único
   - Scripts `build:frontend` e `build:api`
   - Deployments independentes mas no mesmo repo

3. **Fase 3 (Produção)**: Monorepo split
   - 2 repositórios (`frontend` e `backend-api`)
   - CI/CD pipelines completamente separadas
   - Scaling independente

---

#### 💡 Resposta Técnica: Como Funciona?

**Por que ambos vão juntos para Lambda atualmente?**

Quando você executa `npm run build` no Nuxt:

1. Nuxt compila o Vue em componentes reativos
2. Nuxt compila o `/server` em módulos Node.js
3. Tudo é empacotado em `.output/` com um único `index.mjs`
4. Você faz zip de `.output/` e upload para Lambda
5. Lambda executa `index.mjs`, que:
   - Inicia um servidor Node.js na porta 3000
   - Quando recebe GET `/`, renderiza HTML do Vue
   - Quando recebe POST `/api/chat`, executa o handler do server

**Resultado**: Uma única função Lambda atende ambos.

**Vantagem futura**: Você pode exportar apenas o `/server` compilado para uma Lambda separada sem alterar código (apenas CI/CD).


## 3. Fluxo de Trabalho Git (Padrão Standard)

Seguiremos rigorosamente este fluxo para organização.

### Regras de Branch
1. **Nunca** commitar na `main` ou `develop` diretamente
2. Toda branch nasce da `develop`
3. Toda branch morre (merge) na `develop`

### Nomenclatura
Padrão: `DDMMYY-Feature-Description`

#### Formato
- **DDMMYY**: Data no formato dia/mês/ano (2 dígitos cada)
- **Feature**: Nome da feature em kebab-case
- **Description**: Descrição adicional em kebab-case

#### Exemplos
041125-DB-schemas-review-refactor
031225-Notifications-V2-implementation
031225-Alerts-refactor-remove-airlines
031225-Redis-optimization-monthly-quotas
031225-Moblix-V2-integration
#### Regras
- Use kebab-case (palavras separadas por hífens)
- Seja descritivo mas conciso
- Inclua a data de criação da branch
- Use maiúsculas apenas para siglas (V2, API, DB)

### Fluxo Simplificado

#### Estrutura
```
Feature Branch → develop → master
```

#### Fluxo Detalhado

1. **Criar branch de feature**
   ```bash
   git checkout develop
   git pull origin develop
   git checkout -b 081225-project-setup
   ```

2. **Desenvolver feature**
   - Múltiplos commits organizados
   - Commits seguindo Conventional Commits
   - Data já está no nome da branch (não repetir nos commits)

3. **Criar Pull Request**
   - PR: `081225-project-setup` → `develop`
   - Adicionar descrição clara
   - Linkar issues relacionadas

4. **Merge em develop**
   - Após code review e aprovação
   - Testes passando
   - Sem conflitos
   - Merges frequente na branch develop

5. **Merge em master**
   - Apenas quando função de alto nível estiver completa
   - Testes passando
   - Documentação atualizada
   - Coordenação com frontend alinhada

### Regra: Sempre Partir de Develop

**Todas as branches de feature devem SEMPRE ser criadas a partir de `develop`.**

#### Por quê?

1. **`develop` é a branch de integração estável**
   - Contém todas as features já mergeadas e testadas
   - É o ponto de referência comum para todo o time

2. **Evita dependências entre features**
   - Cada feature é independente
   - Não cria dependências desnecessárias entre branches

3. **Facilita o merge posterior**
   - Menos conflitos ao fazer merge em `develop`
   - Histórico mais limpo e organizado

4. **Mantém todas as features no mesmo ponto de partida**
   - Garante consistência entre diferentes features
   - Facilita code review e testes

#### Workflow Correto

```bash
# 1. SEMPRE voltar para develop primeiro
git checkout develop

# 2. Atualizar develop com o remoto (importante!)
git pull origin develop

# 3. Criar nova branch de feature a partir de develop atualizada
git checkout -b 081225-project-setup

# 4. Agora trabalhar na feature
git add <arquivos>
git commit -m "feat(setup): ..."
```

#### O Que NÃO Fazer

```bash
# ❌ ERRADO - Criar branch a partir de outra feature branch
git checkout 091225-backend-logic
git checkout -b 101225-frontend-ui  # ERRADO!

# ❌ ERRADO - Criar branch sem atualizar develop primeiro
git checkout develop
git checkout -b 081225-project-setup  # Pode estar desatualizada!
```

### Princípios
- **Features**: Merge direto em `develop` via PR
- **Master**: Merge apenas quando função completa e testada
- **Develop**: Sempre estável para basear trabalho

### Conventional Commits

#### Formato
```
<tipo>(<escopo>): <descrição>
```

#### Tipos Comuns
- `feat`: Nova funcionalidade
- `fix`: Correção de bug
- `docs`: Documentação
- `style`: Formatação (sem mudança de código)
- `refactor`: Refatoração
- `perf`: Melhoria de performance
- `test`: Testes
- `chore`: Tarefas de manutenção
- `ci`: CI/CD
- `build`: Build system

#### Exemplos
```bash
feat(auth): adiciona login com Google OAuth
fix(payment): corrige cálculo de desconto
docs(readme): atualiza instruções de instalação
refactor(api): simplifica validação de dados
```

#### Primeira Linha
- Use o imperativo: "adiciona", "corrige", "atualiza"
- Não use: "adicionado", "corrigido", "atualizado"
- Seja específico e claro
- Evite mensagens genéricas como "update" ou "fix"

#### Boas Práticas
- Um commit = uma mudança lógica
- Commits pequenos e frequentes
- Teste antes de commitar
- Use o corpo para explicar o "porquê" quando necessário

#### Estrutura Completa

```
<tipo>(<escopo>): <assunto curto>

<corpo opcional explicando o porquê>

<rodapé opcional com referências>
```

#### Exemplo Completo
```bash
feat(api): adiciona endpoint de busca de usuários

Implementa busca paginada com filtros por nome e email.
Isso melhora a performance em listas grandes de usuários.

Closes #123
```

#### Exemplos de Boas Mensagens
```bash
feat(chat): adiciona componente ChatMessage
feat(api): implementa endpoint de streaming
feat(rag): integra Qdrant para busca vetorial
refactor(ui): simplifica lógica de LocalStorage
fix(stream): corrige encoding de caracteres especiais
docs(readme): atualiza instruções de instalação
```

#### Exemplos de Mensagens a Evitar
```bash
# ❌ Evite
update
fix
changes
WIP
test

# ✅ Prefira
feat(chat): adiciona componente ChatMessage
fix(stream): corrige encoding de caracteres especiais
refactor(ui): simplifica lógica de LocalStorage
```

---

## 4. Roteiro de Implementação (Roadmap)

Siga esta ordem exata para evitar bloqueios.

### Fase 0: Setup Inicial
* **Branch:** `project-setup`
* **Tarefas:**
    * Init Nuxt 3
    * Install LangChain/OpenAI libs
    * Configurar `.env`

### Fase 1: O "Cérebro" (Ingestão de Dados)
* **Branch:** `rag-ingestion-implementation`
* **Tarefas:**
    * Criar endpoint `server/api/ingest.post.ts`
    * Receber PDF via multipart/form-data
    * Processar com LangChain (`PDFLoader` + `RecursiveCharacterTextSplitter`)
    * Gerar Embeddings e salvar no Qdrant
    * Criar componente `DocumentUpload.vue` (drag & drop)
* *Nota:* O upload agora é feito via interface web, não por script local

### Fase 2: O Backend Lógico
* **Branch:** `backend-logic-implementation`
* **Tarefas:**
    * Criar rota Nitro `server/api/chat.post.ts`
    * Receber `{ question, history }`
    * Configurar conexão Qdrant + OpenAI via LangChain
    * Testar resposta texto simples (sem stream)

### Fase 3: O Frontend Visual
* **Branch:** `frontend-ui-implementation`
* **Tarefas:**
    * Layout do Chat
    * Lógica de `LocalStorage` (Salvar histórico)
    * Envio do Payload completo para a API

### Fase 4: O Streaming (Integração Final)
* **Branch:** `streaming-implementation`
* **Tarefas:**
    * **Back:** Mudar resposta para `sendStream` com iterável do LangChain
    * **Front:** Mudar `fetch` para usar `getReader()` e montar texto em tempo real
    * **Infra:** Configurar `serverless.yml` com `invokeMode: RESPONSE_STREAM`

---

## 5. Implementação Técnica de Referência

### 5.1 Endpoints da API

O projeto possui **2 endpoints principais**:

#### 5.1.1 `/api/ingest` - Upload de Documentos

Endpoint para fazer upload de PDFs e processar para o Qdrant.

**Request:**
```http
POST /api/ingest
Content-Type: multipart/form-data

file: <PDF_FILE>
```

**Response:**
Retorna JSON com status de sucesso, número de chunks processados e ID do documento.

**Detalhes de Implementação:**
Ver código em `server/api/ingest.post.ts` para implementação completa com PDFLoader, RecursiveCharacterTextSplitter e integração Qdrant.

#### 5.1.2 `/api/chat` - Conversação com Streaming

Endpoint para conversar com o chatbot. Retorna resposta via streaming.

**Request:**
```http
POST /api/chat
Content-Type: application/json
x-user-id: <UUID>

{
  "question": "Qual é o conteúdo do documento?",
  "history": [
    { "role": "user", "content": "Pergunta anterior" },
    { "role": "assistant", "content": "Resposta anterior" }
  ]
}
```

**Response:**
```http
Content-Type: text/event-stream

[Streaming de texto em tempo real]
```

**Implementação:** Ver seção 5.2

### 5.2 Arquivo de Configuração (`serverless.yml`)

Configuração vital para o streaming funcionar na AWS.

**Pontos Principais:**
- `invokeMode: RESPONSE_STREAM` - Essencial para streaming funcionar
- `timeout: 30` - Timeout de 30 segundos para processar requisições
- `memorySize: 512` - Memória RAM alocada para a Lambda
- Variáveis de ambiente carregadas via `serverless-dotenv-plugin`

### 5.3 Lógica de Streaming no Nitro (`server/api/chat.post.ts`)

**Fluxo de Streaming:**
1. Recebe `{ question, history }` do frontend
2. Transforma histórico JSON em objetos LangChain (HumanMessage, AIMessage)
3. Configura ChatOpenAI com `streaming: true`
4. Cria Chain com prompt template + LLM + output parser
5. Configura headers HTTP (`Content-Type: text/event-stream`)
6. Executa chain e converte para ReadableStream
7. Retorna stream usando `sendStream(event, readable)`

**Ver implementação completa em:** `server/api/chat.post.ts`

### 5.4 Guia de Implementação AWS Serverless (Credenciais + Deploy)

**Resumo direto**
- **Para que servem as chaves (Access Key / Secret):** credenciais de usuário IAM para o CLI (Serverless Framework / AWS CLI) autenticar na sua conta AWS e criar/atualizar recursos. Sem elas, o `serverless deploy` não tem permissão para subir nada.
- **Quem usa:** o próprio `serverless deploy` (via AWS SDK) e qualquer comando AWS CLI. Não são usadas pelo código do app em runtime e não vão dentro do bundle.
- **Onde ficam:** o comando `serverless config credentials --provider aws --key ... --secret ...` salva em `~/.aws/credentials` (e `~/.aws/config`), fora do projeto e fora do Git.
- **Relação com `serverless.yml`:**
  - O `serverless.yml` descreve o que criar na AWS: serviço `rag-chatbot-mvp`, runtime `nodejs18.x`, região `us-east-1`, função `api` apontando para `.output/server/index.handler`, URL pública com CORS e streaming, timeout/memória e variáveis de ambiente do Lambda.
  - Ao rodar `serverless deploy`, o Serverless Framework lê o `serverless.yml`, empacota o handler e usa as credenciais do `~/.aws/credentials` para provisionar/atualizar a Lambda + URL.
  - As variáveis em `environment:` (`OPENAI_API_KEY`, `QDRANT_URL`, etc.) são injetadas no runtime da Lambda a partir do ambiente do deploy (via `.env` + `serverless-dotenv-plugin` ou variáveis do CI). **Não** devem conter as chaves IAM; essas ficam só no perfil local/CI para autenticação do deploy.

**Resumo prático**
1) Guarde as chaves IAM apenas em `~/.aws/credentials` (ou variáveis de ambiente no CI).
2) Coloque apenas as variáveis do app em `.env` (OpenAI/Qdrant etc.).
3) Rode `pnpm build` para gerar `.output/server/index.handler`.
4) Rode `serverless deploy`: ele usa as credenciais locais para falar com a AWS e criar/atualizar a Lambda conforme o `serverless.yml`.

#### 📌 Guia passo a passo (AWS + Serverless)

##### Fase 1: O Terreno (AWS Root)
Objetivo: ter uma conta ativa na nuvem.
1. Acessar `aws.amazon.com` e criar a conta (root user) com email, pagamento e verificação.

##### Fase 2: O Crachá do Robô (IAM User)
Objetivo: gerar chaves para o Serverless Framework atuar na conta.
1. No console AWS, abrir **IAM > Users > Create User** (ex: `serverless-admin`).
2. Em **Permissions**, usar **Attach policies directly** → `AdministratorAccess` (para facilitar o MVP).
3. Abrir o usuário criado → aba **Security Credentials** → **Access Keys** → **Create access key** → opção **Command Line Interface (CLI)**.
4. Copiar `Access Key ID` e `Secret Access Key` (guardar em local seguro).

##### Fase 3: Configurar o "crachá" no Serverless Framework
Objetivo: instalar a ferramenta e armazenar as credenciais localmente.
```bash
npm install -g serverless
serverless config credentials --provider aws --key SUA_ACCESS_KEY --secret SUA_SECRET_KEY
```
*Esse comando salva em `~/.aws/credentials` para o Serverless usar sempre. Não vai para o repo.*

##### Fase 4: Preparar o Projeto Nuxt
Objetivo: deixar o código pronto para empacotar.
```bash
pnpm add -D serverless-dotenv-plugin

# Criar .env na raiz (exemplo)
OPENAI_API_KEY=sk-proj-...
QDRANT_URL=https://...
QDRANT_API_KEY=th-...

# Conferir serverless.yml (resumo)
service: rag-chatbot-mvp
frameworkVersion: '3'
provider:
  name: aws
  runtime: nodejs18.x
  region: us-east-1
  environment:
    OPENAI_API_KEY: ${env:OPENAI_API_KEY}
    QDRANT_URL: ${env:QDRANT_URL}
    QDRANT_API_KEY: ${env:QDRANT_API_KEY}
functions:
  api:
    handler: .output/server/index.handler
    url:
      cors: true
      invokeMode: RESPONSE_STREAM
    timeout: 30
plugins:
  - serverless-dotenv-plugin
```

##### Fase 5: Build e Deploy
Objetivo: compilar o Nuxt e enviar para a AWS.
```bash
pnpm build          # gera .output
serverless deploy   # lê o serverless.yml e faz o upload
```
Após o deploy, o terminal retorna a Function URL pública (ex: `https://xyz.lambda-url.us-east-1.on.aws`).

---

### 📦 O que `pnpm run deploy:api` faz?

O script `deploy:api` executa dois comandos em sequência:

```bash
"deploy:api": "pnpm build && serverless deploy --verbose"
```

#### 1️⃣ `pnpm build` → Executa `nuxt build`:
- Compila o código Vue/Nuxt (TypeScript → JavaScript)
- Gera a pasta `.output/server/` com o código otimizado para Lambda
- Faz **tree-shaking** (remove código não usado)
- Faz **minificação** (reduz tamanho dos arquivos)
- Faz **bundling** de dependências em um único arquivo (`index.mjs` de ~208 KB)

#### 2️⃣ `serverless deploy` → Pega o `.output/server/` e:
- Cria o ZIP (~517 KB)
- Faz upload para S3
- Cria/atualiza a Lambda Function na AWS
- Retorna a Function URL pública

#### 🤔 Por que o build é necessário?

| Uso | Precisa do Build? | Motivo |
|-----|-------------------|--------|
| **Lambda (API)** | ✅ SIM | Lambda precisa do código compilado em `.output/server/` |
| **Frontend Docker Local** | ✅ SIM | Também usa o build do Nuxt, mas com preset diferente (`node-server`) |

O build é **essencial** para o Lambda porque:

1. **Transforma TypeScript → JavaScript**: Lambda não executa TypeScript nativamente
2. **Bundla dependências**: Todas as deps são empacotadas em um único arquivo (`index.mjs`)
3. **Otimiza para produção**: Remove código de desenvolvimento, minifica, tree-shake
4. **Reduz tamanho**: De ~500 MB (`node_modules` raiz) para ~2 MB (`.output/server/`)

**Resultado final do build:**
```
.output/server/
├── index.mjs       (208 KB) ← Código da aplicação + deps bundladas
├── package.json    (673 B)  ← Metadados mínimos
└── node_modules/   (~1.5 MB) ← Apenas deps que não podem ser bundladas
```

---

## 6. 📦 Otimização de Bundle: API-Only vs Full-Stack

### 🎯 Por que Full-Stack funcionou mas API-Only não?

Durante o desenvolvimento, encontramos um problema curioso: o modo **Full-Stack funcionou de primeira**, mas o **API-Only dava erro de tamanho** (130 MB). 

**A resposta:** O problema **nunca foi o build do Nuxt** - foi a **configuração do `serverless.yml`!**

---

#### 🔍 O que realmente aconteceu

O build do Nuxt **sempre funcionou corretamente** em ambos os modos:

```
Build do Nuxt (.output/):
├── public/     (500 KB)  ← Assets frontend (só no Full-Stack)
└── server/     (2 MB)    ← Backend otimizado
    └── node_modules/ (1.5 MB) ← Deps bundladas
```

O problema estava no **empacotamento do Serverless Framework**, não no build.

---

#### ✅ Full-Stack (funcionou de primeira)

```yaml
# serverless.yml Full-Stack
package:
  patterns:
    - '.output/**'           # Inclui .output/public + .output/server
    - '!node_modules/**'     # Exclui node_modules raiz
```

**O que o Serverless empacotava:**
```
ZIP enviado (~3.5 MB):
├── .output/public/  ✅ (500 KB)
├── .output/server/  ✅ (2 MB)
└── node_modules/    ❌ Excluído corretamente
```

**Por que funcionou?** O pattern `.output/**` era específico o suficiente para que o Serverless não "vazasse" outros arquivos.

---

#### ❌ API-Only (não funcionou - ANTES de arrumar)

```yaml
# serverless.yml API-Only (ANTES)
package:
  patterns:
    - '.output/server/**'    # Inclui server
    - '!node_modules/**'     # DEVERIA excluir, mas...
```

**O que o Serverless REALMENTE empacotava:**
```
ZIP enviado (~130 MB):
├── .output/server/  ✅ (2 MB)
├── node_modules/    ❌ (500 MB) ← DA RAIZ! 😱
```

**Por que falhou?** O Serverless Framework faz um **glob match** na raiz do projeto. Como `.output/server/**` não cobre "tudo", ele ainda procurava outros arquivos e **encontrava o `node_modules/` da raiz do projeto**.

A exclusão `!node_modules/**` não funcionava bem porque a **ordem dos patterns** estava errada.

---

#### ✅ API-Only (funcionou - DEPOIS de arrumar)

```yaml
# serverless.yml API-Only (DEPOIS)
package:
  patterns:
    - '!**'                          # 1️⃣ Exclui ABSOLUTAMENTE TUDO
    - '!node_modules/**'             # 2️⃣ Garante exclusão extra
    - '.output/server/index.mjs'     # 3️⃣ Inclui APENAS o necessário
    - '.output/server/package.json'
    - '.output/server/node_modules/**'
```

**O que o Serverless empacota agora:**
```
ZIP enviado (~517 KB):
├── .output/server/index.mjs      ✅ (208 KB)
├── .output/server/package.json   ✅ (673 B)
└── .output/server/node_modules/  ✅ (1.5 MB)
```

**Por que funciona?** O `!**` exclui **absolutamente tudo** primeiro, e depois incluímos **apenas** os arquivos específicos que precisamos.

---

#### 📊 Tabela Comparativa Final

| Aspecto | Full-Stack | API-Only (antes) | API-Only (depois) |
|---------|------------|------------------|-------------------|
| **Build Nuxt** | ✅ Mesmo (~2 MB) | ✅ Mesmo (~2 MB) | ✅ Mesmo (~2 MB) |
| **O que QUERIA enviar** | `.output/` inteiro | Apenas `.output/server/` | Apenas `.output/server/` |
| **O que REALMENTE enviou** | ✅ `.output/` (~3.5 MB) | ❌ `.output/server/` + `node_modules/` raiz (~130 MB) | ✅ `.output/server/` (~517 KB) |
| **Pattern inicial** | `.output/**` | `.output/server/**` | `!**` |
| **node_modules raiz incluído?** | ❌ Não | ✅ SIM (bug!) | ❌ Não |
| **Tamanho ZIP final** | ~3.5 MB ✅ | ~130 MB ❌ | ~517 KB ✅ |

---

#### 💡 Lição Aprendida

**Resumo:** Nos dois casos (Full-Stack e API-Only):
1. Você fazia o build → `pnpm build` → gerava `.output/` otimizado (~2-3 MB)
2. Você jogava a build no Lambda → `serverless deploy`

**O que aconteceu:**
- ✅ O build **sempre funcionou**
- ✅ A lógica de "Full-Stack = tudo, API-Only = só server" estava **certa**
- ❌ O `serverless.yml` do API-Only tinha patterns que **vazavam o `node_modules/` raiz**

**Por que Full-Stack funcionou "por sorte":**  
O pattern `.output/**` era específico o suficiente para que o Serverless não "vazasse" outros arquivos.

**Por que API-Only falhou:**  
O pattern `.output/server/**` era menos abrangente, e o Serverless Framework ainda buscava outros arquivos na raiz, encontrando o `node_modules/` de 500 MB.

> **A solução:** `'!**'` primeiro para garantir que **nada vaze**.

---

### 🌐 httpApi vs Function URL: Por que um funcionou e o outro não?

Durante o desenvolvimento, testamos duas abordagens para expor a Lambda:

#### ❌ Function URL (não funcionou inicialmente)

```yaml
functions:
  api:
    url:
      cors: true
      invokeMode: RESPONSE_STREAM
```

**Problema:** O Serverless Framework v3 criava a Function URL com `AuthType: AWS_IAM` por padrão, exigindo credenciais AWS assinadas para acesso. Resultado: **403 Forbidden** para requisições públicas.

**Por que isso aconteceu:**
- Function URLs são um recurso mais novo da AWS (2022)
- O Serverless Framework não tinha controle total sobre o `AuthType` via sintaxe simples
- Mesmo especificando `cors: true`, a URL era criada como privada

**Solução temporária:** Executar `aws lambda update-function-url-config --auth-type NONE` manualmente após cada deploy.

**Solução permanente:** Adicionar recurso CloudFormation customizado para forçar `AuthType: NONE`.

---

#### ✅ API Gateway HTTP API (funcionou de primeira)

```yaml
functions:
  api:
    events:
      - httpApi: '*'
```

**Por que funcionou:**
- API Gateway HTTP API é um serviço mais maduro e amplamente suportado
- O Serverless Framework tem controle total sobre as configurações
- Por padrão, cria endpoints **públicos** (sem autenticação)
- Rota coringa `*` captura todas as requisições e repassa para a Lambda

**Vantagens:**
- ✅ Deploy determinístico (sempre público)
- ✅ CORS configurável via provider
- ✅ Suporte a custom domains
- ✅ Métricas e logs integrados

**Desvantagens:**
- ❌ Limite de timeout de 30 segundos (vs 15 minutos na Function URL)
- ❌ Não suporta `RESPONSE_STREAM` nativo (streaming funciona mas com overhead)
- ❌ Custo adicional mínimo (mas irrelevante para MVP)

---

#### 📊 Comparação Final

| Aspecto | Function URL | API Gateway HTTP API |
|---------|--------------|----------------------|
| **AuthType padrão (Serverless)** | `AWS_IAM` ❌ | Público ✅ |
| **Timeout máximo** | 15 minutos | 30 segundos |
| **Streaming nativo** | ✅ `RESPONSE_STREAM` | ⚠️ Via chunks |
| **Configuração** | Requer CloudFormation extra | ✅ Funciona out-of-the-box |
| **Custo** | Gratuito | +$1/milhão de requisições |
| **Recomendação MVP** | ⚠️ Requer setup extra | ✅ **Use este** |

---

#### 🤔 Confusão Comum: "Mas httpApi não aceita streaming?"

**Resposta curta:** Aceita sim! Mas de forma diferente.

**Como funciona:**

| Método | Function URL (`RESPONSE_STREAM`) | API Gateway (`httpApi`) |
|--------|----------------------------------|-------------------------|
| **Tipo** | Streaming nativo da Lambda | HTTP Transfer-Encoding: chunked |
| **Implementação** | Lambda envia chunks diretamente | Lambda retorna body, Gateway repassa em chunks |
| **Cliente** | Recebe chunks em tempo real | Recebe chunks em tempo real |
| **Resultado** | ✅ Funciona | ✅ Funciona |

**Em ambos os casos**, seu código no cliente usa o **mesmo** `fetch` + `ReadableStream`:

```ts
const response = await fetch('/api/chat', { method: 'POST', body: ... })
const reader = response.body.getReader()
while (true) {
  const { done, value } = await reader.read()
  if (done) break
  console.log(new TextDecoder().decode(value)) // chunks chegam aqui
}
```

**A diferença está no backend:**

```ts
// Function URL (RESPONSE_STREAM)
export const handler = awslambda.streamifyResponse(async (event, responseStream) => {
  responseStream.write('chunk1\n')
  responseStream.write('chunk2\n')
  responseStream.end()
})

// API Gateway (HTTP chunked) - mais simples!
export default defineEventHandler(async (event) => {
  const stream = new ReadableStream(...)
  return stream // Nuxt/Nitro cuida do resto
})
```

**Conclusão:** Com `httpApi`, o streaming funciona perfeitamente para chat. A única limitação real é o **timeout de 30s**.

---

#### 🎯 Como Implementar Streaming: Suas Opções

Se você quer streaming de resposta no chat, tem duas opções:

##### ✅ Opção 1: httpApi (Atual) - **RECOMENDADO**

**Status:** Já configurado e funcionando

```yaml
functions:
  api:
    events:
      - httpApi: '*'
```

**Vantagens:**
- ✅ Streaming já funciona (HTTP Transfer-Encoding: chunked)
- ✅ Zero mudanças no código
- ✅ Público por padrão (sem 403 Forbidden)
- ✅ Setup simples

**Desvantagens:**
- ⚠️ Timeout de 30s (suficiente para 99% dos casos de chat)

**Mudanças necessárias no código:** **NENHUMA** ✨

---

##### ⚠️ Opção 2: Function URL com RESPONSE_STREAM

**Status:** Requer configuração adicional

```yaml
functions:
  api:
    handler: .output/server/index.handler
    url:
      cors: true
      invokeMode: RESPONSE_STREAM
    timeout: 120
    memorySize: 512

# Adicionar no final do serverless.yml
resources:
  Resources:
    ApiLambdaFunctionUrl:
      Type: AWS::Lambda::Url
      Properties:
        AuthType: NONE  # ← Crucial para acesso público
        TargetFunctionArn: !GetAtt ApiLambdaFunction.Arn
        InvokeMode: RESPONSE_STREAM
        Cors:
          AllowOrigins: ["*"]
          AllowMethods: ["*"]
          AllowHeaders: ["*"]
    
    ApiLambdaPermissionFnUrl:
      Type: AWS::Lambda::Permission
      Properties:
        FunctionName: !Ref ApiLambdaFunction
        Action: lambda:InvokeFunctionUrl
        Principal: "*"
        FunctionUrlAuthType: NONE
```

**Vantagens:**
- ✅ Streaming nativo da Lambda
- ✅ Timeout até 15 minutos

**Desvantagens:**
- ❌ Requer configuração CloudFormation extra
- ❌ Precisa modificar handlers para usar `streamifyResponse`
- ❌ Precisa instalar `@aws-lambda-powertools/streamify`

**Mudanças necessárias no código:**

```ts
// ANTES (funciona com httpApi)
export default defineEventHandler(async (event) => {
  const stream = new ReadableStream({
    async start(controller) {
      controller.enqueue('chunk1\n')
      controller.close()
    }
  })
  return stream
})

// DEPOIS (para RESPONSE_STREAM)
import { streamifyResponse } from '@aws-lambda-powertools/streamify'

export const handler = streamifyResponse(async (event, responseStream) => {
  responseStream.write('chunk1\n')
  responseStream.end()
})
```

---

##### 📊 Comparação de Esforço

| Aspecto | httpApi (Opção 1) | Function URL (Opção 2) |
|---------|-------------------|------------------------|
| **Config no serverless.yml** | ✅ Já está | ⚠️ Adicionar resources (20 linhas) |
| **Mudança no código** | ✅ Zero | ❌ Reescrever todos os handlers |
| **Instalar dependências** | ✅ Nada | ❌ `pnpm add @aws-lambda-powertools` |
| **Streaming funciona** | ✅ Sim | ✅ Sim |
| **Timeout** | 30s | 15 min |
| **Público por padrão** | ✅ Sim | ⚠️ Só com CloudFormation |

---

##### 💡 Recomendação Final

**Use httpApi (Opção 1)** porque:

1. **Streaming já funciona** - seu código atual com `ReadableStream` funciona perfeitamente
2. **30s é suficiente** - respostas de chat GPT raramente excedem 10s
3. **Zero trabalho extra** - não precisa mudar absolutamente nada
4. **Simples e confiável** - menos pontos de falha

**Só use Function URL (Opção 2) se:**
- Você realmente precisa de respostas >30s (muito raro)
- Quer experimentar streaming nativo por curiosidade técnica
- Está disposto a reescrever todos os handlers

---

### 🚫 Bloqueando Rotas de Frontend no Modo API-Only

Quando você faz deploy apenas da API, ainda pode acontecer do SSR do Nuxt tentar renderizar páginas HTML. Aqui está como bloquear completamente.

#### ✅ Resultado Esperado

```bash
# ❌ Rota raiz bloqueada
$ curl https://sua-api.execute-api.sa-east-1.amazonaws.com
{"message":"Not Found"}  # 404 do API Gateway

# ✅ Rotas /api/* funcionam
$ curl https://sua-api.execute-api.sa-east-1.amazonaws.com/api/chat
{"message":"Chat endpoint - a ser implementado"}  # JSON puro
```

---

#### 🔧 Solução 1: Bloquear no API Gateway (RECOMENDADO)

Configure rotas específicas no `serverless.yml`:

```yaml
functions:
  api:
    handler: .output/server/index.handler
    events:
      # Bloquear rotas de frontend - só permite /api/*
      - httpApi:
          path: /api/{proxy+}
          method: ANY
      - httpApi:
          path: /api/chat
          method: POST
      - httpApi:
          path: /api/ingest
          method: POST
```

**Vantagem:** O API Gateway retorna **404 antes de chegar na Lambda** → economia de custo e latência.

---

#### 🔧 Solução 2: Forçar Content-Type nos Handlers

Adicione `setResponseHeader` em **todos os endpoints**:

```typescript
// server/api/chat.post.ts
export default defineEventHandler(async (event) => {
  // Forçar resposta JSON (evita SSR renderizar HTML)
  setResponseHeader(event, 'Content-Type', 'application/json')
  
  return {
    message: 'Chat endpoint - a ser implementado'
  }
})
```

**Por que precisa disso?**

O Nuxt tem um **sistema de rotas universal** que tenta renderizar páginas HTML mesmo para rotas `/api/*` quando você retorna um objeto simples. Ao definir `Content-Type: application/json`, você força o Nuxt a enviar JSON puro sem passar pelo SSR.

---

#### 🔧 Solução 3: Middleware Global (Opcional)

Adicione um middleware que bloqueia tudo exceto `/api/*`:

```typescript
// server/middleware/api-only.ts
export default defineEventHandler((event) => {
  const path = event.path || event.node.req.url || ''
  
  // Permitir apenas rotas /api/*
  if (!path.startsWith('/api/')) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Not Found',
      message: 'API-only mode. Frontend runs locally in Docker.'
    })
  }
})
```

**Vantagem:** Bloqueia globalmente, mas a Lambda ainda processa a request.

---

#### 📊 Qual usar?

| Abordagem | Bloqueia Onde | Vantagem | Desvantagem |
|-----------|---------------|----------|-------------|
| **Solução 1: httpApi paths** | API Gateway | Não chega na Lambda | Precisa listar todas as rotas |
| **Solução 2: Content-Type** | Handler | Simples, 1 linha | Precisa em todos os endpoints |
| **Solução 3: Middleware** | Nitro/Nuxt | Global, 3 linhas | Lambda processa antes de bloquear |

**Recomendação:** **Solução 1 + 2** (bloquear no Gateway + forçar JSON nos handlers).

---

### 🔧 Bônus: O que o Build do Nuxt/Nitro faz automaticamente

Embora o problema tenha sido no `serverless.yml`, é útil entender que o **Nitro já otimiza** o build automaticamente:

#### Otimizações automáticas do Nitro:
- ✅ Remove `test/`, `docs/`, `examples/` folders
- ✅ Remove `*.md`, `*.map` files
- ✅ Faz tree-shaking de código não usado
- ✅ Minifica o código JavaScript
- ✅ Bundla dependências em um único arquivo (`index.mjs`)

#### Configurações extras no `nuxt.config.ts`:

```typescript
nitro: {
  preset: 'aws-lambda',
  serveStatic: false,
  minify: true,
  sourcemap: false,  // Remove source maps
  
  rollupConfig: {
    output: {
      format: 'esm',
      sourcemap: false
    }
  }
}
```

**Resultado do Build:**
```
.output/server/
├── index.mjs       (208 KB) ← Código bundlado
├── package.json    (673 B)
└── node_modules/   (~1.5 MB) ← Apenas deps não bundláveis
```

> **Importante:** Essas otimizações do Nitro **sempre funcionaram**. O problema de 130 MB era porque o Serverless Framework incluía o `node_modules/` da **raiz do projeto** (500 MB), não o `.output/server/node_modules/` otimizado.

---

#### ⚙️ Configuração Final do serverless.yml

```yaml
package:
  patterns:
    - '!**'                     # 1. Exclui TUDO (primeira regra)
    - '!node_modules/**'        # 2. Garante exclusão de node_modules raiz
    - '!.nuxt/**'               # 3. Exclui cache do Nuxt
    - '!.git/**'                # 4. Exclui arquivos git
    - '.output/server/index.mjs'        # 5. Inclui só o que precisa
    - '.output/server/package.json'
    - '.output/server/node_modules/**'  # 6. Inclui deps do build
```

**Por que isso funciona?**
1. `'!**'` exclui **absolutamente tudo** do projeto
2. Depois você adiciona de volta **apenas** os arquivos da pasta `.output/server/`
3. O `node_modules/` da raiz (500 MB) **nunca é incluído**
4. Apenas o `node_modules/` otimizado dentro de `.output/server/` (2 MB) é incluído

**Resultado real do projeto:**
```
Antes (ordem errada): 130 MB ZIP ❌ (incluía node_modules raiz)
Depois (ordem correta): 517 KB ZIP ✅ (apenas .output/server)
```

---

#### 📦 Otimização de package.json: DevDependencies

Outra dica importante é garantir que suas **dependências de desenvolvimento** estejam em `devDependencies`, não em `dependencies`.

##### 🤔 Por que isso importa?

Quando você roda `pnpm install --production` ou quando o Serverless Framework faz o bundle, ele **ignora** tudo que está em `devDependencies`. Isso reduz o tamanho final do pacote.

##### ✅ Dependências que devem estar em `devDependencies`:

| Pacote | Por quê? |
|--------|----------|
| `dotenv` | Usado apenas em desenvolvimento (variáveis vão pro env da Lambda) |
| `serverless` | Ferramenta de CLI, não roda em produção |
| `serverless-dotenv-plugin` | Plugin do Serverless, não vai pro Lambda |
| `typescript` | Compilador, código final é JS |
| `eslint`, `prettier` | Ferramentas de dev |
| `nodemon` | Dev server, não usa em Lambda |
| `@types/*` | Types do TypeScript |
| `tsx` | Runtime de dev para TypeScript |

##### ✅ Dependências que devem estar em `dependencies`:

| Pacote | Por quê? |
|--------|----------|
| `langchain`, `@langchain/*` | Usado em runtime |
| `openai` | Cliente da API OpenAI |
| `@qdrant/js-client-rest` | Cliente do Qdrant |
| `nuxt`, `vue` | Framework de runtime |
| `uuid` | Usado em runtime |

##### 📋 Exemplo de package.json correto:

```json
{
  "dependencies": {
    "langchain": "^0.3.x",
    "@langchain/openai": "^0.5.x",
    "nuxt": "^3.x",
    "vue": "^3.x"
  },
  "devDependencies": {
    "dotenv": "^16.x",
    "serverless": "^3.x",
    "serverless-dotenv-plugin": "^6.x",
    "typescript": "^5.x",
    "@types/node": "^22.x"
  }
}
```

> **💡 Dica:** Execute `pnpm install` após mover dependências para garantir que o `pnpm-lock.yaml` seja atualizado corretamente.

---

### 🔗 Alternativa: Lambda Layers

Se as otimizações acima não forem suficientes, a alternativa é usar **Lambda Layers** para separar as dependências pesadas.

#### 🤔 O que são Lambda Layers?

Layers são pacotes de código/dependências compartilhadas que podem ser reutilizadas por múltiplas Lambda Functions. Você sobe as deps uma vez e referencia em várias funções.

#### 📦 Estrutura com Layers

```
meu-projeto/
├── lambda-function/     (seu código - 5 MB)
│   ├── index.mjs
│   └── package.json
│
├── layers/
│   ├── langchain-layer/         (Layer 1: 50 MB)
│   │   ├── nodejs/node_modules/
│   │   │   ├── langchain/
│   │   │   ├── @langchain/
│   │   │   └── encoding/
│   │   └── layer.zip
│   │
│   └── openai-layer/            (Layer 2: 40 MB)
│       ├── nodejs/node_modules/
│       │   ├── openai/
│       │   └── axios/
│       └── layer.zip
│
└── serverless.yml  (referencia as layers)
```

#### ✅ Vantagens de Usar Layers

1. **Separação de preocupações**: Cada layer tem responsabilidade clara
2. **Reutilização**: Mesma layer pode ser usada por múltiplas funções
3. **Versionamento**: Você versiona cada layer independentemente
4. **Tamanho menor**: Função fica ~5 MB, layers compartilhadas (uploaded uma vez)
5. **Cold start mais rápido**: Sem precisar descompactar 200+ MB
6. **Atualização independente**: Atualizar dependência não redeploiya a função inteira

#### ❌ Desvantagens

1. **Complexidade aumenta**: Mais configuração no `serverless.yml`
2. **Limite de layers**: AWS permite até 5 layers por função
3. **Espaço total**: Soma da função + todas as layers não pode exceder 250 MB descompactado
4. **Deployment mais lento**: Precisa fazer upload de múltiplos ZIPs

#### 📋 Implementação com Layers (Exemplo)

```yaml
# serverless.yml com Layers

service: rag-chatbot-mvp

plugins:
  - serverless-dotenv-plugin

provider:
  name: aws
  runtime: nodejs18.x
  region: sa-east-1

# 🔥 Definir Layers
layers:
  langchainLayer:
    path: layers/langchain
    name: rag-chatbot-langchain-${sls:stage}
    
  openaiLayer:
    path: layers/openai
    name: rag-chatbot-openai-${sls:stage}

functions:
  api:
    handler: .output/server/index.handler
    # 🔥 Referenciar layers
    layers:
      - !Ref LangchainLayerLambdaLayer
      - !Ref OpenaiLayerLambdaLayer
    url:
      cors: true
      invokeMode: RESPONSE_STREAM
    timeout: 120
    memorySize: 512
```

#### 🛠️ Como Criar uma Layer

```bash
# 1. Criar estrutura de diretórios
mkdir -p layers/langchain/nodejs

# 2. Navegar e instalar deps
cd layers/langchain/nodejs
npm init -y
npm install langchain @langchain/core @langchain/community @langchain/openai

# 3. Compactar (a estrutura AWS espera nodejs/node_modules)
cd ..
zip -r langchain-layer.zip nodejs/

# 4. No serverless.yml, apontar para o ZIP
# (o path aponta para o arquivo ZIP ou para o diretório)
```

#### 📊 Tamanho Comparativo

```
SEM Layers (Current):
├── Função ZIP: 130 MB ❌ Excede limite

COM Layers (Otimizado):
├── Função ZIP: 5 MB
├── Langchain Layer: 50 MB (reutilizável)
└── OpenAI Layer: 40 MB (reutilizável)
Total enviado: 95 MB (layers são enviadas apenas uma vez) ✅
```

#### 🎯 Quando Usar Layers

- **Use Layers se:**
  - Bundle principal > 50 MB mesmo com otimizações
  - Você tem múltiplas funções Lambda reutilizando as mesmas deps
  - Quer cold starts mais rápidos
  - Precisa versionar dependências independentemente

- **Não use Layers se:**
  - Bundle < 50 MB (simples é melhor)
  - Função é única e não é reutilizada
  - Quer keep it simple para MVP

---

## 7. Estrutura do Projeto

```
Serverless-RAG-Chatbot-MVP-/
├── .env.example                 # Template de variáveis de ambiente
├── .gitignore                   # Arquivos ignorados pelo Git
├── README.md                    # Este arquivo
├── package.json                 # Dependências do projeto
├── nuxt.config.ts               # Configuração do Nuxt 3
├── tsconfig.json                # Configuração do TypeScript
├── tailwind.config.js           # Configuração do Tailwind CSS
├── serverless.yml               # Configuração de deploy AWS Lambda
│
├── app.vue                      # Componente raiz da aplicação
├── pages/                       # Páginas da aplicação
│   └── index.vue                # Página inicial (Chat UI)
│
├── components/                  # Componentes Vue reutilizáveis
│   ├── ChatMessage.vue          # Componente de mensagem individual
│   ├── ChatInput.vue            # Componente de input de mensagem
│   ├── ChatWindow.vue           # Componente da janela de chat
│   ├── ThemeToggle.vue          # Toggle de dark mode
│   └── DocumentUpload.vue       # Upload de PDF (drag & drop)
│
├── composables/                 # Composables Vue (lógica reutilizável)
│   ├── useChatHistory.ts        # Gerenciamento do histórico no LocalStorage
│   └── useChatStream.ts         # Lógica de streaming de mensagens
│
├── server/                      # Backend Nitro
│   ├── api/                     # Rotas da API
│   │   ├── chat.post.ts         # Endpoint de conversação (streaming)
│   │   └── ingest.post.ts       # Endpoint de upload de PDF
│   ├── utils/                   # Utilitários do servidor
│   │   ├── langchain.ts         # Configuração do LangChain
│   │   └── qdrant.ts            # Configuração do Qdrant
│   └── middleware/              # Middleware do servidor
│
├── scripts/                     # Scripts auxiliares
│   ├── ingest.ts                # Script de ingestão de PDF para Qdrant
│   └── README.md                # Documentação dos scripts
│
├── data/                        # Dados do projeto
│   └── documents/               # PDFs para ingestão
│       └── .gitkeep
│
├── public/                      # Arquivos estáticos
│   └── favicon.ico
│
└── assets/                      # Assets processados (CSS, imagens)
    └── css/
        └── main.css             # CSS global
```
