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

### 2.6. Como o Qdrant Entende Semântica e Busca Vetores

* **Dúvida Levantada:** *"Como o Qdrant entende a semântica? Como ele decide quais vetores enviar?"*

* **Resposta:** O Qdrant **não interpreta texto diretamente**. Ele compara **vetores (embeddings)** que representam o significado semântico do texto.

#### 🔄 Fluxo Completo de Busca Semântica

**Fase 1: Ingestão (Salvar no Qdrant)**

```
1. Texto original do chunk:
   "Thiago Silva - Engenheiro de Software. Experiência em FastAPI..."

2. OpenAI Embeddings transforma texto → vetor:
   await embeddings.embedDocuments([chunk])
   → [0.23, -0.45, 0.67, 0.12, ... 1536 números]

3. Salva no Qdrant:
   {
     id: uuid(),
     vector: [0.23, -0.45, 0.67, ...],  // ← Vetor (semântica)
     payload: {
       text: "Thiago Silva - Engenheiro..."  // ← Texto original
     }
   }
```

**Fase 2: Busca (Quando você pergunta)**

```
1. Sua pergunta:
   "sobre oq ele é?"

2. Pergunta vira vetor (MESMO processo):
   await embeddings.embedQuery(question)
   → [0.34, 0.12, -0.78, 0.89, ... 1536 números]

3. Qdrant compara vetores:
   await qdrant.search({
     vector: queryVector,  // ← Vetor da pergunta
     limit: 4              // ← Top 4 mais similares
   })
```

#### 📊 Como o Qdrant Compara Vetores

O Qdrant calcula a **similaridade** entre vetores usando **distância cosseno** (ou outra métrica configurada).

**Exemplo Visual (Simplificado):**

Imagine vetores de 3 dimensões (na prática são 1536):

```
Chunk 1: "Engenheiro de Software"
Vetor: [0.8, 0.6, 0.2]

Chunk 2: "Experiência em FastAPI"
Vetor: [0.3, 0.9, 0.1]

Chunk 3: "Formação PUC-Campinas"
Vetor: [0.1, 0.2, 0.9]

Pergunta: "qual a profissão dele?"
Vetor: [0.7, 0.5, 0.3]
```

O Qdrant calcula a similaridade (distância cosseno):

```
Similaridade(Pergunta, Chunk 1) = 0.95  ⭐ (muito similar)
Similaridade(Pergunta, Chunk 2) = 0.65  (pouco similar)
Similaridade(Pergunta, Chunk 3) = 0.25  (não similar)
```

**Resultado:** Retorna Chunk 1 (mais similar).

#### 🧠 Por Que Funciona Semanticamente?

Os **embeddings da OpenAI** capturam **significado**, não apenas palavras.

**Exemplo:**

```
Texto 1: "Ele é programador"
Texto 2: "Ele trabalha como desenvolvedor"
Texto 3: "Ele gosta de futebol"
```

Mesmo com palavras diferentes, os vetores de "programador" e "desenvolvedor" ficam **próximos** no espaço vetorial, enquanto "futebol" fica **distante**.

#### 🔢 Métrica de Distância (Cosine Similarity)

No seu código, a collection foi criada com:

```typescript
distance: 'Cosine'  // Distância cosseno
```

**Como funciona:**

```
Similaridade = cos(θ) = (A · B) / (||A|| × ||B||)

Onde:
- A = vetor da pergunta
- B = vetor do chunk
- θ = ângulo entre os vetores
- Resultado: 0.0 a 1.0 (1.0 = idêntico, 0.0 = completamente diferente)
```

#### 📝 Exemplo Prático Completo

```
Pergunta: "quais tecnologias ele usa?"

1. Pergunta → Vetor: [0.89, -0.23, 0.45, ...]

2. Qdrant compara com todos os chunks:
   Chunk A: "FastAPI, React, Next.js" 
     → [0.87, -0.25, 0.43, ...] 
     → Score: 0.92 ⭐
   
   Chunk B: "Formação PUC-Campinas" 
     → [0.12, 0.78, -0.34, ...] 
     → Score: 0.31
   
   Chunk C: "Experiência em IoT" 
     → [0.65, -0.12, 0.78, ...] 
     → Score: 0.68 ⭐
   
   Chunk D: "Data de nascimento: 1995" 
     → [0.01, 0.02, 0.03, ...] 
     → Score: 0.05

3. Retorna top 4 (ou menos se houver menos chunks):
   - Chunk A (Score: 0.92) ✅
   - Chunk C (Score: 0.68) ✅
   - Chunk B (Score: 0.31)
   - Chunk D (Score: 0.05) - só se tiver menos de 4 chunks melhores
```

#### ✅ Resumo: Como Funciona

1. **Embeddings** transformam texto em vetores que capturam **significado**
2. **Qdrant** compara vetores usando **distância cosseno**
3. Retorna os chunks mais **similares** (não por palavras, mas por **significado**)
4. O modelo recebe apenas os **textos** dos chunks mais relevantes

#### 🆚 Por Que Não Busca por Palavras-Chave?

**Busca por palavras-chave:**
```
Pergunta: "qual a profissão?"
Busca: encontra apenas chunks com a palavra "profissão"
Problema: perde "trabalho", "cargo", "atuação"
```

**Busca semântica (vetorial):**
```
Pergunta: "qual a profissão?"
Busca: encontra chunks com significado similar
Resultado: encontra "Engenheiro", "Desenvolvedor", "Programador"
```

**Vantagem:** Funciona mesmo com palavras diferentes que têm o mesmo significado!

---

### 2.7. Resumo das Decisões Técnicas

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

### 2.8. Arquitetura Serverless: Nuxt Full-Stack vs. Node.js + Vue Separados

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
pnpm run build
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
pnpm run build:frontend
    ↓
dist/
├── index.html
├── js/
├── css/
└── assets/
    ↓
Upload para S3 → CloudFront (CDN)

# Backend: API isolada
pnpm run build:api
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

Quando você executa `pnpm run build` no Nuxt:

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
pnpm add -g serverless
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
- ✅ CORS gerenciado pelo middleware (simples)

**Desvantagens:**
- ⚠️ Timeout de 30s (suficiente para 99% dos casos de chat)

**Como funciona o "streaming":**
- O backend retorna um `ReadableStream` do Nuxt/Nitro
- O API Gateway HTTP API repassa os chunks usando `Transfer-Encoding: chunked`
- O cliente recebe os chunks em tempo real usando `fetch().body.getReader()`
- **Não é streaming nativo do Lambda**, mas o resultado final é idêntico

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
- ❌ **CORS deve ser controlado na aplicação** (não no `serverless.yml`)
- ❌ Precisa modificar handlers para usar `streamifyResponse`
- ❌ Precisa instalar `@aws-lambda-powertools/streamify`
- ❌ Nuxt/Nitro não suporta nativamente `RESPONSE_STREAM` sem adaptações

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

#### 🚨 Dificuldades Enfrentadas: HTTP API vs Function URL

Durante o desenvolvimento, enfrentamos diversos desafios ao tentar usar ambos os modos. Aqui está o que aprendemos:

##### 1. CORS: Diferenças Críticas

**HTTP API (httpApi):**
- ✅ CORS pode ser configurado no `serverless.yml` via `provider.httpApi.cors`
- ✅ Middleware global (`server/middleware/api-only.ts`) funciona perfeitamente
- ✅ Headers CORS são adicionados automaticamente pelo Gateway
- ✅ Preflight OPTIONS é tratado automaticamente

**Function URL:**
- ⚠️ `cors: true` no `serverless.yml` **não é suficiente**
- ❌ CORS **deve ser controlado manualmente na aplicação**
- ✅ Cada handler precisa adicionar headers CORS explicitamente:
  ```typescript
  setResponseHeader(event, 'Access-Control-Allow-Origin', '*')
  setResponseHeader(event, 'Access-Control-Allow-Headers', 'Content-Type, x-user-id')
  setResponseHeader(event, 'Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  ```
- ✅ Preflight OPTIONS deve ser tratado manualmente em cada handler:
  ```typescript
  if (event.method === 'OPTIONS') {
    setResponseStatus(event, 204)
    return null
  }
  ```
- ⚠️ Middleware global não é suficiente - cada endpoint precisa de CORS explícito

**Por que essa diferença?**
- HTTP API Gateway processa CORS no nível do Gateway (antes de chegar na Lambda)
- Function URL passa tudo direto para a Lambda, incluindo preflight OPTIONS
- Se você não tratar OPTIONS na Lambda, o navegador recebe erro de CORS

##### 2. Streaming: HTTP API Suporta Sim!

**Confusão Comum:**
"HTTP API não suporta streaming" - **FALSO!**

**Realidade:**
- HTTP API **não suporta `RESPONSE_STREAM` nativo do Lambda**
- Mas **suporta streaming via Transfer-Encoding: chunked** (HTTP padrão)
- Para o cliente (navegador), **não há diferença**

**Como funciona:**

```typescript
// Seu código (backend) - IGUAL NOS DOIS MODOS
export default defineEventHandler(async (event) => {
  const stream = new ReadableStream({
    async start(controller) {
      for await (const chunk of llmStream) {
        controller.enqueue(encoder.encode(chunk))
      }
      controller.close()
    }
  })
  return stream
})

// Cliente (frontend) - IGUAL NOS DOIS MODOS
const response = await fetch('/api/chat', { method: 'POST', body: ... })
const reader = response.body.getReader()
while (true) {
  const { done, value } = await reader.read()
  if (done) break
  console.log(new TextDecoder().decode(value)) // chunks chegam em tempo real
}
```

**Fluxo Completo:**

| Etapa | HTTP API | Function URL |
|-------|----------|--------------|
| 1. Backend retorna | `ReadableStream` | `ReadableStream` |
| 2. Lambda processa | Chunks → Buffer HTTP | Chunks → RESPONSE_STREAM nativo |
| 3. Gateway/URL repassa | Transfer-Encoding: chunked | Chunks diretos |
| 4. Cliente recebe | Chunks em tempo real ✅ | Chunks em tempo real ✅ |

**Resultado:** Ambos funcionam identicamente para o usuário final!

##### 3. Timeout: A Única Diferença Real

| Modo | Timeout Máximo | Suficiente para Chat? |
|------|----------------|----------------------|
| HTTP API | 30 segundos | ✅ Sim (99% dos casos) |
| Function URL | 15 minutos | ✅ Sim (overkill) |

**Quando você precisaria de >30s:**
- Processamento de documentos muito grandes (>100 páginas)
- Múltiplas chamadas encadeadas de APIs externas lentas
- Tarefas de machine learning pesadas

**Para chat RAG:** 30s é mais que suficiente. Respostas típicas: 2-10s.

##### 4. "Nenhuma resposta gerada" - Causas e Soluções

**Quando aparece:**
Esta mensagem é um fallback quando o modelo OpenAI não emite nenhum chunk de texto.

**Causas possíveis:**

1. **Nenhum contexto encontrado no Qdrant**
   - **Sintoma:** PDF não foi carregado ou foi carregado incorretamente
   - **Como verificar:** Veja logs `[CHAT] Retrieved contexts: 0`
   - **Solução:** Recarregar o PDF via `/api/ingest`

2. **Erro na API OpenAI**
   - **Sintoma:** Chave inválida, quota excedida, ou serviço indisponível
   - **Como verificar:** Veja logs `[CHAT] Error:` com detalhes do erro
   - **Solução:** Verificar credenciais, quota, status da OpenAI

3. **Filtragem de conteúdo**
   - **Sintoma:** OpenAI bloqueou a resposta por política de conteúdo (raro)
   - **Como verificar:** Logs silenciosos, nenhum chunk emitido
   - **Solução:** Reformular a pergunta

4. **Timeout de rede**
   - **Sintoma:** Conexão OpenAI → Lambda foi interrompida
   - **Como verificar:** Logs param no meio do processo
   - **Solução:** Tentar novamente

**Melhorias implementadas:**

```typescript
// ANTES - mensagem genérica
if (!emitted) {
  controller.enqueue(encoder.encode('Nenhuma resposta gerada.'))
}

// DEPOIS - mensagem contextual
if (!emitted) {
  const fallbackMessage = contextTexts.length === 0
    ? 'Nenhum contexto relevante foi encontrado no banco de dados para responder sua pergunta. Por favor, verifique se o documento foi carregado corretamente.'
    : 'Não foi possível gerar uma resposta no momento. Por favor, tente reformular sua pergunta ou tente novamente em alguns instantes.'
  controller.enqueue(encoder.encode(fallbackMessage))
}
```

**Logs adicionados para debugging:**

```
[CHAT] Starting chat request processing
[CHAT] User ID: anon
[CHAT] Question: qual meu nome?
[CHAT] History length: 2 messages
[CHAT] Initializing Qdrant client, collection: rag-chatbot-documents
[CHAT] Initializing OpenAI embeddings
[CHAT] Generating query embedding for search
[CHAT] ✓ Query embedding generated (1536 dimensions)
[CHAT] Searching Qdrant for relevant contexts...
[CHAT] ✓ Retrieved 4 relevant chunks from Qdrant
[CHAT] Context preview (first chunk): Thiago Silva - Engenheiro de Software...
[CHAT] Preparing conversation history...
[CHAT] ✓ Converted 2 history messages
[CHAT] Building system prompt with context...
[CHAT] ✓ System prompt built with 4 total messages
[CHAT] Initializing OpenAI model (gpt-4o-mini) with streaming...
[CHAT] Starting LLM streaming...
[CHAT] ✅ Streaming completed successfully - 47 chunks sent
```

##### 5. Por Que Não Precisa Recarregar o PDF a Cada Sessão

**Arquitetura de Persistência:**

```
Cliente (localStorage)     Lambda (stateless)     Qdrant (permanente)
       |                          |                      |
       | 1. Carrega PDF           |                      |
       |------------------------->|                      |
       |                          | 2. Processa chunks   |
       |                          |--------------------->|
       |                          |                      | 3. Salva vetores
       |                          |<---------------------|
       | 4. Confirma OK           |                      |
       |<-------------------------|                      |
       |                          |                      |
       | ... tempo passa ...      |                      |
       |                          |                      |
       | 5. Faz pergunta          |                      |
       |------------------------->|                      |
       |                          | 6. Busca contexto    |
       |                          |--------------------->|
       |                          |<---------------------| 7. Retorna chunks
       |                          | 8. Gera resposta     |
       | 9. Resposta streaming    |                      |
       |<-------------------------|                      |
```

**Conclusão:** O PDF fica **permanentemente no Qdrant**. Você só precisa carregar uma vez.

**Se parece que precisa recarregar:**
- ✅ Verifique se a collection `rag-chatbot-documents` existe no Qdrant
- ✅ Verifique se o upload foi bem-sucedido (logs de ingest)
- ✅ Verifique se a busca está retornando resultados (logs de chat)

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
pnpm init -y
pnpm add langchain @langchain/core @langchain/community @langchain/openai

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

---

## 8. HTTP API vs REST API no AWS API Gateway

### Diferenças Principais

#### HTTP API (Usado no Projeto)
- **Mais novo**: Lançado em 2019
- **Mais barato**: Até 70% mais barato que REST API
- **Mais rápido**: Menor latência
- **Mais simples**: Menos features, mais focado
- **Limitações**:
  - Não suporta `multipart/form-data` nativamente
  - Binários são automaticamente codificados em base64
  - Menos opções de autorização
  - Sem API Keys nativas

#### REST API (Versão Antiga)
- **Mais antigo**: Disponível desde o início
- **Mais caro**: Preço mais alto por requisição
- **Mais features**: Suporte completo a binários, API Keys, etc.
- **Mais complexo**: Mais opções de configuração
- **Vantagens**:
  - Suporta `multipart/form-data` nativamente
  - Não codifica binários automaticamente
  - API Keys integradas
  - Mais opções de autorização

### Por Que HTTP API Codifica em Base64?

Quando você usa HTTP API e envia dados binários (como PDF):

1. **API Gateway detecta dados binários**
2. **Codifica automaticamente em base64**
3. **Define `event.isBase64Encoded = true`**
4. **Passa para Lambda já codificado**

### Exemplo do Fluxo

```
Cliente → PDF (binário) → API Gateway → Base64 → Lambda → Precisa decodificar
```

### Solução Correta para HTTP API

#### ❌ Solução ERRADA (mudar para REST API)
```yaml
events:
  - http:  # ← REST API
      path: /api/ingest
      method: POST
```

**Problemas**:
- Mais caro (70% mais caro)
- Perde benefícios de performance
- Não resolve o problema real

#### ✅ Solução CORRETA (decodificar base64)

**No Cliente** (opcional - pode enviar binário normal):
```typescript
// Opção 1: Enviar binário direto (deixar API Gateway codificar)
const formData = new FormData()
formData.append('file', pdfFile)
await fetch('/api/ingest', { method: 'POST', body: formData })

// Opção 2: Codificar manualmente (mais controle)
const base64 = Buffer.from(pdfBuffer).toString('base64')
await fetch('/api/ingest', {
  method: 'POST',
  body: JSON.stringify({ body: base64 }),
  headers: { 'Content-Type': 'application/json' }
})
```

**Na Lambda** (sempre necessário com HTTP API):
```typescript
// Detectar se está codificado em base64
if (event.isBase64Encoded) {
  // Decodificar antes de processar
  const buffer = Buffer.from(event.body, 'base64')
  // Processar buffer decodificado
}
```

### Implementação no Nuxt com h3

#### Problema Identificado

No nosso caso, usamos `readMultipartFormData` do h3, que não sabe que o API Gateway já codificou em base64. Então:

1. Cliente envia PDF binário
2. API Gateway codifica em base64
3. h3 recebe base64 mas trata como binário
4. Resultado: dados corrompidos (650893 bytes ao invés de 373035)

#### Solução

```typescript
import { defineEventHandler, readRawBody } from 'h3'

export default defineEventHandler(async (event) => {
  // Obter o evento Lambda original
  const lambdaEvent = event.node.req

  // Verificar se está codificado em base64
  if (lambdaEvent.isBase64Encoded) {
    // Ler o body raw e decodificar
    const rawBody = await readRawBody(event)
    const decodedBody = Buffer.from(rawBody, 'base64')
    
    // Agora processar o multipart do body decodificado
    // ... parsear multipart manualmente ou usar biblioteca
  } else {
    // Processar normalmente
    const body = await readMultipartFormData(event)
  }
})
```

### Comparação de Custos

#### Cenário: 1 milhão de requests/mês

**HTTP API**:
- Custo: ~$1.00/milhão requests
- Total: $1.00/mês

**REST API**:
- Custo: ~$3.50/milhão requests
- Total: $3.50/mês

**Economia com HTTP API**: 70% ($2.50/mês)

### Quando Usar Cada Um?

#### Use HTTP API quando:
- ✅ Custo é prioridade
- ✅ Performance é crítica
- ✅ Não precisa de features avançadas
- ✅ Pode implementar encoding/decoding
- ✅ API simples REST/GraphQL

#### Use REST API quando:
- ✅ Precisa de API Keys nativas
- ✅ Precisa de authorizers complexos
- ✅ Precisa de request/response transformation
- ✅ Não quer lidar com base64
- ✅ Usa muito multipart/form-data

### Recomendação para o Projeto

**Manter HTTP API** por:
1. **Custo**: 70% mais barato
2. **Performance**: Menor latência
3. **Modernidade**: Arquitetura mais nova
4. **Solução Simples**: Apenas decodificar base64

A solução de decodificação base64 é simples e resolve o problema completamente, mantendo todos os benefícios do HTTP API.

### Referências

- [AWS HTTP APIs vs REST APIs](https://docs.aws.amazon.com/apigateway/latest/developerguide/http-api-vs-rest.html)
- [Working with Binary Media Types](https://docs.aws.amazon.com/apigateway/latest/developerguide/api-gateway-payload-encodings.html)
- [StackOverflow: Post PDF to AWS Lambda](https://stackoverflow.com/questions/57121011/how-can-i-post-a-pdf-to-aws-lambda)

---

## 9. Problemas Identificados na Rota de Ingestão de PDF

### Data: 2025-12-10

#### Resumo Executivo
Durante os testes da rota `/api/ingest` com o arquivo `thiago_relatorio.pdf`, foram identificados diversos problemas relacionados ao parsing de PDF no ambiente AWS Lambda e ao tratamento de dados multipart/form-data.

---

### 1. Lambda não conseguiu ler o PDF - Necessidade de salvar em /tmp

#### Problema
O PDFLoader do LangChain não conseguiu processar o PDF diretamente do Buffer recebido via multipart/form-data. Foi necessário salvar temporariamente em `/tmp`.

#### Causa
- O PDFLoader espera um caminho de arquivo ou Blob válido
- Buffer recebido via h3's `readMultipartFormData` não é diretamente compatível com PDFLoader
- No ambiente Lambda, o sistema de arquivos é read-only exceto `/tmp`

#### Tentativas de Solução
1. **Tentativa 1**: Converter Buffer para Blob
   ```typescript
   const pdfBlob = new Blob([filePart.data], { type: 'application/pdf' })
   const loader = new PDFLoader(pdfBlob)
   ```
   **Resultado**: Falhou com erro de tipo

2. **Tentativa 2**: Converter Buffer para Uint8Array antes do Blob
   ```typescript
   const pdfBlob = new Blob([new Uint8Array(filePart.data)], { type: 'application/pdf' })
   ```
   **Resultado**: Falhou com mesmo erro

3. **Solução Final**: Salvar temporariamente em `/tmp`
   ```typescript
   const tempFilePath = join('/tmp', `upload-${Date.now()}.pdf`)
   writeFileSync(tempFilePath, pdfBuffer)
   const loader = new PDFLoader(tempFilePath)
   ```
   **Resultado**: PDF carregado com sucesso, mas com problemas de parsing

---

### 2. Problema de Parsing do PDF - Biblioteca pdf-parse

#### Problema
A biblioteca PDFLoader do LangChain usa pdf-parse internamente, que estava gerando warnings de stream corrompido:
```
Warning: Invalid stream: "FormatError: Bad FCHECK in flate stream: 120, 239"
```

#### Causa
- O PDF `thiago_relatorio.pdf` tem streams de compressão que o pdf-parse interpreta como corrompidos
- Localmente funciona perfeitamente (7516 caracteres extraídos)
- No Lambda, apenas 10 caracteres (quebras de linha) foram extraídos

#### Logs
```
2025-12-10 15:21:08.793	INFO	PDF buffer size: 650893
2025-12-10 15:21:09.530	INFO	PDF pages: 5
2025-12-10 15:21:09.530	INFO	Text length: 10
```

#### Tentativas de Solução
1. Usar PDFLoader com opções padrão
2. Usar pdf-parse diretamente com opções customizadas
3. Ambas falharam no ambiente Lambda

---

### 3. Collection do Qdrant Não Existia

#### Problema
A collection `rag-chatbot-documents` não existia no Qdrant Cloud, causando erro `Not Found`.

#### Causa
- Collection precisa ser criada antes de tentar fazer upsert
- Qdrant não cria collections automaticamente

#### Solução
Script de teste executado:
```javascript
const qdrant = new QdrantClient({
  url: process.env.QDRANT_URL,
  apiKey: process.env.QDRANT_API_KEY
});

await qdrant.createCollection('rag-chatbot-documents', {
  vectors: {
    size: 1536, // OpenAI embeddings dimension
    distance: 'Cosine'
  }
});
```

**Resultado**: Collection criada com sucesso

---

### 4. Erro "No text content found in PDF"

#### Problema
Após resolver o problema da collection, o erro mudou para "No text content found in PDF".

#### Causa
- PDF estava sendo processado, mas apenas 10 caracteres (quebras de linha) foram extraídos
- Problema específico do ambiente Lambda com pdf-parse
- Localmente: 7516 caracteres extraídos corretamente
- Lambda: 10 caracteres (apenas `\n\n\n\n\n\n\n\n\n\n`)

#### Logs Comparativos
**Local**:
```
✅ PDF parsed successfully!
Pages: 5
Text length: 7516
```

**Lambda**:
```
INFO	PDF pages: 5
INFO	Text length: 10
```

---

### 5. Erro ao Ler Buffer do PDF no Lambda

#### Problema
O buffer estava chegando com tamanho incorreto: **650893 bytes** ao invés de **373035 bytes** (quase o dobro).

#### Causa
- O multipart/form-data estava incluindo metadados adicionais no buffer
- h3's `readMultipartFormData` retorna dados que podem incluir boundaries e headers

#### Logs
```
INFO	PDF buffer size: 650893
INFO	First 10 bytes: 255044462d312e370d0a  (%PDF-1.7)
INFO	Last 10 bytes: 3835320d0a2525454f46  (%%EOF)
```

**Observação**: Apesar dos primeiros e últimos bytes estarem corretos (`%PDF-1.7` e `%%EOF`), o tamanho total estava incorreto.

#### Tentativas de Solução
1. **Tentativa 1**: Extrair PDF do buffer buscando `%PDF` e `%%EOF`
   ```typescript
   const pdfStart = pdfBuffer.indexOf('%PDF')
   const pdfEnd = pdfBuffer.lastIndexOf('%%EOF')
   if (pdfStart !== -1 && pdfEnd !== -1) {
     pdfBuffer = pdfBuffer.slice(pdfStart, pdfEnd + 5)
   }
   ```
   **Resultado**: Tamanho continuou 650893 bytes

---

### 6. Erro com Multipart Form Data - Metadados do filePart

#### Problema
O `filePart.data` do multipart form data contém mais dados do que apenas o PDF.

#### Causa Raiz Identificada
Após análise do StackOverflow (https://stackoverflow.com/questions/57121011/how-can-i-post-a-pdf-to-aws-lambda), descobrimos que:

1. **API Gateway HTTP API vs REST API**:
   - HTTP API não suporta `multipart/form-data` nativamente
   - Dados são codificados em base64 automaticamente
   - Precisa decodificar antes de usar

2. **Problema com h3's `readMultipartFormData`**:
   - Pode estar recebendo dados já transformados pelo API Gateway
   - Buffer pode conter encoding adicional

#### Logs de Debug
```typescript
console.log('File part:', {
  name: filePart.name,        // 'file'
  filename: filePart.filename, // 'thiago_relatorio.pdf'
  type: filePart.type,        // 'application/pdf'
  dataLength: 650893,         // ❌ Deveria ser 373035
  dataType: 'object',
  isBuffer: true
})
```

---

### Solução Proposta pelo StackOverflow

#### Problema Principal
API Gateway HTTP API não suporta `multipart/form-data` diretamente. Quando você faz POST de um PDF:

1. API Gateway detecta binário
2. Codifica em base64 automaticamente
3. Passa para Lambda já codificado
4. É necessário decodificar na Lambda

#### Solução Correta

**Opção 1: Usar REST API ao invés de HTTP API**
```yaml
# serverless.yml
functions:
  api:
    handler: .output/server/index.handler
    events:
      - http:  # ← REST API ao invés de httpApi
          path: /api/ingest
          method: POST
```

**Opção 2: Decodificar base64 na Lambda**
```typescript
// Detectar se é base64
if (event.isBase64Encoded) {
  const buffer = Buffer.from(event.body, 'base64')
  // Parsear multipart manualmente ou usar biblioteca como busboy
}
```

**Opção 3: Usar S3 Presigned URL (Recomendado para arquivos grandes)**
1. Cliente solicita presigned URL
2. Cliente faz upload direto para S3
3. Lambda é trigada por evento S3
4. Lambda processa arquivo de S3

---

### Status Atual dos Testes

#### ✅ Funcionando
- Deploy da Lambda
- Connection com Qdrant
- Collection criada
- Variáveis de ambiente configuradas
- Rota acessível
- Upload do arquivo sendo recebido

#### ❌ Não Funcionando (ANTES da solução)
- Parsing correto do PDF (10 chars ao invés de 7516)
- Tamanho correto do buffer (650893 ao invés de 373035)
- Extração de texto completo

#### 📊 Estatísticas (ANTES da solução)
- **PDF Original**: 373035 bytes, 5 páginas, 7516 caracteres
- **Buffer Recebido**: 650893 bytes (174% maior)
- **Texto Extraído**: 10 caracteres (0.13% do esperado)
- **Taxa de Sucesso Local**: 100%
- **Taxa de Sucesso Lambda**: 0%

#### ✅ Status DEPOIS da Solução Base64
- **Buffer Recebido**: 373035 bytes ✅ (correto)
- **Texto Extraído**: 7516 caracteres ✅ (correto)
- **Taxa de Sucesso Lambda**: 100% ✅

---

### Próximos Passos

1. ✅ **RESOLVIDO**: Implementar solução do StackOverflow (base64)
2. Testar com PDF mais simples sem compressão
3. Considerar usar S3 Presigned URL para produção
4. Adicionar logging mais detalhado do processo multipart
5. Implementar fallback para diferentes formatos de PDF

---

### 4. CORS para ingestão via frontend

Para permitir que o frontend local (http://localhost:3000) chame a Lambda em `API_BASE_URL`, configuramos CORS diretamente no handler de ingestão (`server/api/ingest.post.ts`):
- `Access-Control-Allow-Origin: *`
- `Access-Control-Allow-Methods: POST, OPTIONS`
- `Access-Control-Allow-Headers: Content-Type`
- Resposta imediata para `OPTIONS` com `OK`.

Assim, basta definir `API_BASE_URL` apontando para a URL da API e o upload funciona sem ajustes adicionais no frontend.

### 5. Problema de Formato de Point ID no Qdrant

#### Problema
Ao tentar fazer upload de PDFs via rota `/api/ingest`, a API retornava erro `Bad Request` do Qdrant:
```
ApiError: Bad Request
Format error in JSON body: value test-user-python-1765402104281-0 is not a valid point ID, 
valid values are either an unsigned integer or a UUID
```

#### Causa
O código estava gerando IDs de pontos (vectors) no formato `${documentId}-${index}` (ex: `test-user-python-1765402104281-0`), mas o **Qdrant requer que Point IDs sejam exclusivamente UUIDs ou números inteiros não assinados**. Strings arbitrárias não são aceitas.

#### Solução Implementada
Foi adicionado o import da biblioteca `uuid` e alterado o código para gerar UUIDs válidos para cada chunk:

```typescript
import { v4 as uuidv4 } from 'uuid'

// Antes (ERRADO):
const points = chunks.map((chunk, idx) => ({
  id: `${documentId}-${idx}`, // ❌ Formato inválido
  vector: vectors[idx],
  payload: { ... }
}))

// Depois (CORRETO):
const points = chunks.map((chunk, idx) => ({
  id: uuidv4(), // ✅ UUID válido
  vector: vectors[idx],
  payload: { ... }
}))
```

#### Como Identificar o Problema
1. **Logs da Lambda**: Use `serverless logs -f api --startTime 10m` para ver os erros detalhados
2. **Teste Local**: Execute `pnpm dev` e teste a rota localmente - o erro aparece igual
3. **Mensagem de Erro**: O Qdrant retorna explicitamente o formato esperado na mensagem de erro

#### Status
✅ **RESOLVIDO** - A rota `/api/ingest` agora funciona corretamente tanto localmente quanto no Lambda.

---

### Lições Aprendidas

1. **API Gateway HTTP API vs REST API**: Diferenças críticas no tratamento de binários
2. **Multipart no Lambda**: Requer tratamento especial
3. **pdf-parse no Lambda**: Sensível a compressão de PDF
4. **Testes Locais vs Lambda**: Comportamento diferente com bibliotecas de parsing
5. **Qdrant**: Collection deve ser criada previamente
6. **Buffer Size**: Verificar sempre o tamanho real vs esperado
7. **Qdrant Point IDs**: Devem ser UUIDs ou inteiros, nunca strings arbitrárias
7. **Solução Base64**: Enviar PDF como JSON com base64 resolve completamente o problema

---

### Referências

- [StackOverflow: How can I post a PDF to AWS lambda](https://stackoverflow.com/questions/57121011/how-can-i-post-a-pdf-to-aws-lambda)
- [AWS API Gateway Binary Support](https://docs.aws.amazon.com/apigateway/latest/developerguide/api-gateway-payload-encodings.html)
- [Serverless Framework HTTP vs HTTP API](https://www.serverless.com/framework/docs/providers/aws/events/http-api)

---

## 10. Processamento de PDF: LangChain 100% vs Abordagem Híbrida

### Contexto

Para processar PDFs e gerar embeddings para RAG, existem duas abordagens principais:
1. **LangChain 100%**: Usar `PDFLoader` do LangChain para tudo
2. **Abordagem Híbrida**: Usar `pdf-parse` para extração + LangChain para chunks/embeddings

Este projeto usa a **Abordagem Híbrida**. Aqui está o porquê.

---

### Abordagem 1: LangChain 100% (PDFLoader)

```typescript
import { PDFLoader } from 'langchain/document_loaders/fs/pdf'
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter'
import { OpenAIEmbeddings } from '@langchain/openai'

// 1. Salvar em /tmp (obrigatório)
const tempFilePath = join('/tmp', `upload-${Date.now()}.pdf`)
writeFileSync(tempFilePath, pdfBuffer)

// 2. Carregar PDF com LangChain
const loader = new PDFLoader(tempFilePath)
const docs = await loader.load()  // Retorna Document[]

// 3. Dividir em chunks (opcional, já vem dividido por página)
const textSplitter = new RecursiveCharacterTextSplitter({
  chunkSize: 1000,
  chunkOverlap: 200
})
const chunks = await textSplitter.splitDocuments(docs)

// 4. Gerar embeddings
const embeddings = new OpenAIEmbeddings({ openAIApiKey: apiKey })
const vectors = await embeddings.embedDocuments(
  chunks.map(c => c.pageContent)
)

// 5. Limpar arquivo
unlinkSync(tempFilePath)
```

#### Características
- **Aceita**: `string` (caminho de arquivo) ou `Blob`
- **Não aceita**: `Buffer` diretamente
- **Retorna**: `Document[]` do LangChain com metadados (página, etc)
- **Requer**: Salvar arquivo em disco (`/tmp`)
- **I/O de disco**: 2 operações (write + read)

#### Vantagens
- ✅ Tudo integrado no ecossistema LangChain
- ✅ Metadados automáticos (número da página, etc)
- ✅ API consistente para múltiplos formatos (PDF, Word, etc)
- ✅ Splitting por página automático

#### Desvantagens
- ❌ Não aceita Buffer (requer arquivo físico)
- ❌ I/O de disco desnecessário em Lambda
- ❌ Mais lento (operações de escrita/leitura)
- ❌ Pode falhar se `/tmp` estiver cheio
- ❌ Código mais verboso (salvar, ler, limpar)
- ❌ Bundle maior (PDFLoader + dependências)

---

### Abordagem 2: Híbrida (pdf-parse + LangChain) ✅ Atual

```typescript
import pdfParse from 'pdf-parse'
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter'
import { OpenAIEmbeddings } from '@langchain/openai'

// 1. Extrair texto com pdf-parse (direto do buffer)
const pdfData = await pdfParse(pdfBuffer, { max: 0 })
const text = pdfData.text

// 2. Dividir em chunks com LangChain
const textSplitter = new RecursiveCharacterTextSplitter({
  chunkSize: 1000,
  chunkOverlap: 200
})
const chunks = await textSplitter.splitText(text)

// 3. Gerar embeddings com LangChain
const embeddings = new OpenAIEmbeddings({ openAIApiKey: apiKey })
const vectors = await embeddings.embedDocuments(chunks)
```

#### Características
- **Aceita**: `Buffer` diretamente
- **Não precisa**: Salvar arquivo em disco
- **Retorna**: `string` simples com todo o texto
- **I/O de disco**: 0 operações
- **Performance**: Mais rápido (sem I/O)

#### Vantagens
- ✅ Aceita Buffer diretamente (perfeito para Lambda)
- ✅ Sem I/O de disco (mais rápido)
- ✅ Código mais simples (menos linhas)
- ✅ Mais controle sobre parsing (opções customizadas)
- ✅ Bundle menor (só pdf-parse)
- ✅ Mesma qualidade de chunks e embeddings (usa LangChain)

#### Desvantagens
- ❌ Sem metadados automáticos de página
- ❌ Precisa gerenciar pdf-parse separadamente
- ❌ Não aproveita abstração do LangChain para extração

---

### Comparação Lado a Lado

| Aspecto | LangChain 100% (PDFLoader) | Híbrida (pdf-parse + LangChain) |
|---------|----------------------------|----------------------------------|
| **Extração de texto** | PDFLoader (usa pdf-parse internamente) | pdf-parse direto |
| **Aceita Buffer?** | ❌ Não (precisa arquivo/Blob) | ✅ Sim |
| **I/O de disco** | ✅ Sim (write + read) | ❌ Não |
| **Performance** | Mais lento | Mais rápido |
| **Linhas de código** | ~15 linhas | ~8 linhas |
| **Retorno** | `Document[]` (com metadados) | `string` simples |
| **Metadados** | Automático (página, etc) | Manual (se precisar) |
| **Complexidade** | Mais código (salvar/limpar) | Menos código |
| **Controle** | Limitado | Total sobre parsing |
| **Bundle size** | Maior (PDFLoader) | Menor (só pdf-parse) |
| **Lambda-friendly** | ⚠️ Depende de `/tmp` | ✅ Stateless |
| **Chunking** | LangChain ✅ | LangChain ✅ (igual) |
| **Embeddings** | LangChain ✅ | LangChain ✅ (igual) |

---

### Por Que Escolhemos a Abordagem Híbrida?

1. **Performance**: Sem I/O de disco = mais rápido
2. **Simplicidade**: Menos código, menos complexidade
3. **Lambda-friendly**: Não depende de `/tmp`, 100% stateless
4. **Flexibilidade**: Controle total sobre parsing
5. **Mantém LangChain onde importa**: Chunks e embeddings

#### O que usamos de cada biblioteca

```
pdf-parse:
  - Extração de texto do PDF
  - Aceita Buffer diretamente
  - Fornece metadados básicos (páginas, info)

LangChain:
  - RecursiveCharacterTextSplitter (chunking inteligente)
  - OpenAIEmbeddings (geração de vetores)
  - Não usamos: PDFLoader (substituído por pdf-parse)
```

---

### Quando Usar Cada Abordagem?

#### Use LangChain 100% (PDFLoader) quando:
- Precisa de metadados automáticos de página
- Quer tudo integrado no ecossistema LangChain
- Não se importa com I/O de disco
- Está em ambiente com sistema de arquivos estável
- Processa múltiplos formatos (PDF, Word, TXT)

#### Use Abordagem Híbrida (atual) quando:
- Performance é importante
- Está em Lambda ou ambiente serverless
- Quer controle total sobre parsing
- Quer código mais simples
- Não precisa de metadados complexos de página
- Quer bundle menor

---

### Código de Referência (Implementação Atual)

```typescript
// server/api/ingest.post.ts

// Decodificar PDF de base64
const pdfBuffer = Buffer.from(jsonBody.body, 'base64')

// 1. Extrair texto com pdf-parse (direto do buffer)
const pdfData = await pdfParse(pdfBuffer, { max: 0 })
const text = pdfData.text

// 2. Criar chunks com LangChain (AUTOMÁTICO)
const textSplitter = new RecursiveCharacterTextSplitter({ 
  chunkSize: 1000,
  chunkOverlap: 200
})
const chunks = await textSplitter.splitText(text)

// 3. Gerar embeddings com LangChain (AUTOMÁTICO)
const embeddings = new OpenAIEmbeddings({ openAIApiKey: config.openaiApiKey })
const vectors = await embeddings.embedDocuments(chunks)

// 4. Salvar no Qdrant
await qdrant.upsert(collectionName, { points: ... })
```

---

### Conclusão

A **Abordagem Híbrida** oferece o melhor dos dois mundos:
- Extração rápida e eficiente com `pdf-parse`
- Chunking e embeddings robustos com `LangChain`
- Código simples, rápido e Lambda-friendly

Você não perde nada importante (chunking e embeddings são idênticos), apenas ganha performance e simplicidade.
