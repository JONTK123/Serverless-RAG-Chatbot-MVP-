# 📘 Documentação Mestre: Serverless RAG Chatbot (MVP)

**Versão:** 1.1.0 (Final Draft)  
**Status:** Estrutura Pronta para Desenvolvimento  
**Stack:** Nuxt 3 + AWS Lambda + LangChain + Qdrant

Este documento é a "Fonte Única de Verdade" do projeto. Ele consolida a arquitetura técnica, o fluxo de trabalho e, crucialmente, o registro de todas as decisões de design tomadas após debate técnico.

---

## 📋 Índice

1. [Visão Geral e Stack Tecnológico](#1-visão-geral-e-stack-tecnológico)
2. [Registro de Decisões e Dúvidas](#2-registro-de-decisões-e-dúvidas-architecture-decision-record)
3. [Fluxo de Trabalho Git](#3-fluxo-de-trabalho-git-padrão-promiles)
4. [Roteiro de Implementação](#4-roteiro-de-implementação-roadmap)
5. [Implementação Técnica de Referência](#5-implementação-técnica-de-referência)
6. [Checklist de Validação Final](#6-checklist-de-validação-final)
7. [Estrutura do Projeto](#7-estrutura-do-projeto)
8. [Como Começar](#8-como-começar)

---

## 1. Visão Geral e Stack Tecnológico

O objetivo é criar um Chatbot de Inteligência Artificial que responda perguntas baseadas em um documento PDF privado (RAG), com interface reativa e respostas via streaming.

### Frontend (Aplicação Web)
* **Framework:** **Nuxt 3** (Vue.js + TailwindCSS)
* **Filosofia:** "Vibecoding" (Foco em agilidade visual e prototipagem rápida)
* **Gerenciamento de Sessão:** **LocalStorage** (Navegador do Cliente)
* **Comunicação:** `fetch` nativo com leitura de `ReadableStream`

### Backend (Serverless API)
* **Framework:** **Nuxt Nitro** (Server Routes - `/server/api`)
* **Runtime:** Node.js rodando em **AWS Lambda**
* **Acesso:** **Function URL** (Endpoint HTTPS direto, sem API Gateway complexo)
* **Streaming:** `InvokeMode: RESPONSE_STREAM`

### Inteligência & Dados
* **LLM:** OpenAI `gpt-5-nano` (Placeholder para modelo econômico/rápido)
* **Orquestração:** **LangChain.js** (Core & Community)
* **Banco de Conhecimento:** **Qdrant** (Vector Database)
    * *Função:* Armazenar o PDF "fatiado" (chunks) e transformado em vetores

---

## 2. 🧠 Registro de Decisões e Dúvidas (Architecture Decision Record)

Esta seção detalha as dúvidas levantadas durante o planejamento e a solução final adotada.

### 2.1. Memória do Chat: Redis vs. LocalStorage vs. In-Memory
* **Dúvida Levantada:** *"Devo usar Redis para o histórico? Posso usar variável global em Python/Node? O Qdrant salva o histórico?"*
* **Análise:**
    * *Qdrant:* Não serve para histórico de conversa, serve apenas para conhecimento (PDF)
    * *In-Memory:* Impossível em AWS Lambda, pois a função "morre" após o uso (Stateless)
    * *Redis:* Seria a solução robusta padrão, mas adiciona custo (instância paga) e complexidade de infraestrutura (VPC) desnecessária para um MVP
* **Decisão Final:** **Frontend-Driven History**
    * O Frontend guarda o array de mensagens
    * A cada nova pergunta, o Frontend envia o **histórico completo** no `body` da requisição
    * O Backend processa, responde e esquece
    * *Identificação:* O Front gera um UUID e guarda no LocalStorage apenas para fins de Log/Analytics (enviado via Header `x-user-id`), mas não dependemos disso para a lógica da conversa

### 2.2. Comunicação: WebSockets vs. HTTP Streaming
* **Dúvida Levantada:** *"Como fazer a letra aparecer uma por uma? Preciso de WebSockets? O Lambda suporta isso?"*
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

## 3. Fluxo de Trabalho Git (Padrão ProMiles)

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
```
041125-DB-schemas-review-refactor
031225-Notifications-V2-implementation
031225-Alerts-refactor-remove-airlines
031225-Redis-optimization-monthly-quotas
031225-Moblix-V2-integration
```

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
* **Branch:** `081225-project-setup`
* **Tarefas:**
    * Init Nuxt 3
    * Install LangChain/OpenAI libs
    * Configurar `.env`

### Fase 1: O "Cérebro" (Ingestão de Dados)
* **Branch:** `091225-rag-ingestion-script`
* **Tarefas:**
    * Criar script avulso (`scripts/ingest.ts`)
    * Ler PDF
    * Quebrar texto (`RecursiveCharacterTextSplitter`)
    * Gerar Embeddings e salvar no Qdrant
* *Nota:* Isso roda localmente uma vez, não no deploy da Lambda

### Fase 2: O Backend Lógico
* **Branch:** `091225-backend-logic`
* **Tarefas:**
    * Criar rota Nitro `server/api/chat.post.ts`
    * Receber `{ question, history }`
    * Configurar conexão Qdrant + OpenAI via LangChain
    * Testar resposta texto simples (sem stream)

### Fase 3: O Frontend Visual
* **Branch:** `101225-frontend-ui`
* **Tarefas:**
    * Layout do Chat
    * Lógica de `LocalStorage` (Salvar histórico)
    * Envio do Payload completo para a API

### Fase 4: O Streaming (Integração Final)
* **Branch:** `111225-streaming-refactor`
* **Tarefas:**
    * **Back:** Mudar resposta para `sendStream` com iterável do LangChain
    * **Front:** Mudar `fetch` para usar `getReader()` e montar texto em tempo real
    * **Infra:** Configurar `serverless.yml` com `invokeMode: RESPONSE_STREAM`

---

## 5. Implementação Técnica de Referência

### 5.1 Arquivo de Configuração (`serverless.yml`)

Configuração vital para o streaming funcionar na AWS.

```yaml
service: rag-chatbot-mvp
frameworkVersion: '3'

provider:
  name: aws
  runtime: nodejs18.x
  region: us-east-1
  environment:
    OPENAI_API_KEY: ${env:OPENAI_API_KEY}
    QDRANT_URL: ${env:QDRANT_URL}

functions:
  api:
    handler: .output/server/index.handler
    url:
      cors: true
      invokeMode: RESPONSE_STREAM # <--- O SEGREDO ESTÁ AQUI
    timeout: 30
```

### 5.2 Lógica de Streaming no Nitro (`server/api/chat.post.ts`)

```typescript
import { ChatOpenAI } from "@langchain/openai";
import { ChatPromptTemplate, MessagesPlaceholder } from "@langchain/core/prompts";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { HumanMessage, AIMessage } from "@langchain/core/messages";

export default defineEventHandler(async (event) => {
  // 1. Recebe histórico completo do Front
  const { question, history } = await readBody(event);

  // 2. Transforma JSON em Objetos LangChain
  const chatHistory = history.map((msg: any) => 
    msg.role === 'user' ? new HumanMessage(msg.content) : new AIMessage(msg.content)
  );

  // 3. Configura Modelo com Streaming
  const llm = new ChatOpenAI({
    modelName: "gpt-5-nano",
    streaming: true,
  });

  // 4. Cria a Chain
  const prompt = ChatPromptTemplate.fromMessages([
    ["system", "Responda com base no contexto: {context}"],
    new MessagesPlaceholder("chat_history"),
    ["human", "{input}"]
  ]);
  
  const chain = prompt.pipe(llm).pipe(new StringOutputParser());

  // 5. Configura Headers HTTP para Stream
  setResponseHeader(event, 'Content-Type', 'text/event-stream');
  setResponseHeader(event, 'Cache-Control', 'no-cache');

  // 6. Executa e Retorna o Stream
  const stream = await chain.stream({
    context: "Contexto mockado ou vindo do Qdrant...",
    chat_history: chatHistory,
    input: question,
  });

  // Adaptador para ReadableStream web standard
  const encoder = new TextEncoder();
  const readable = new ReadableStream({
    async start(controller) {
      for await (const chunk of stream) {
        controller.enqueue(encoder.encode(chunk));
      }
      controller.close();
    },
  });

  return sendStream(event, readable);
});
```

---

## 6. Checklist de Validação Final

Antes de considerar o projeto concluído, valide:

- [ ] **Ingestão:** O Qdrant contém os vetores do PDF?
- [ ] **Sessão:** Ao dar F5 na página, a conversa anterior continua lá (LocalStorage)?
- [ ] **Contexto:** O Bot responde perguntas específicas do PDF corretamente?
- [ ] **Streaming:** O texto aparece gradualmente na tela (sem "travadinha" inicial de buffer)?
- [ ] **Deploy:** A URL da AWS Lambda está pública e funcional?

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
│   └── ChatWindow.vue           # Componente da janela de chat
│
├── composables/                 # Composables Vue (lógica reutilizável)
│   ├── useChatHistory.ts        # Gerenciamento do histórico no LocalStorage
│   └── useChatStream.ts         # Lógica de streaming de mensagens
│
├── server/                      # Backend Nitro
│   ├── api/                     # Rotas da API
│   │   └── chat.post.ts         # Endpoint principal do chat
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

## 8. Como Começar

### Pré-requisitos
- Node.js 18+ instalado
- Conta AWS (para deploy)
- Chave API da OpenAI
- Instância Qdrant (cloud ou local)

### Instalação

```bash
# 1. Clone o repositório
git clone https://github.com/JONTK123/Serverless-RAG-Chatbot-MVP-.git
cd Serverless-RAG-Chatbot-MVP-

# 2. Instale as dependências
npm install

# 3. Configure as variáveis de ambiente
cp .env.example .env
# Edite o .env com suas chaves

# 4. Execute localmente
npm run dev

# 5. Acesse http://localhost:3000
```

### Fluxo de Desenvolvimento

```bash
# 1. Sempre partir da branch develop
git checkout develop
git pull origin develop

# 2. Criar branch de feature (seguindo padrão DDMMYY-Feature-Description)
git checkout -b 081225-project-setup

# 3. Desenvolver e commitar
git add .
git commit -m "feat(setup): inicializa projeto Nuxt 3"

# 4. Push e criar PR
git push -u origin 081225-project-setup
# Criar PR no GitHub para merge em develop
```

### Scripts Disponíveis

```bash
# Desenvolvimento local
npm run dev

# Build para produção
npm run build

# Preview da build
npm run preview

# Ingestão de PDF no Qdrant
npm run ingest

# Deploy para AWS Lambda
npm run deploy

# Linting
npm run lint
```

---

## 📝 Branches do Projeto

O projeto seguirá o seguinte esquema de branches:

- **main**: Código em produção (somente após validação completa)
- **develop**: Branch de integração (base para todas as features)
- **081225-project-setup**: Setup inicial do projeto
- **091225-rag-ingestion-script**: Script de ingestão de PDF
- **091225-backend-logic**: Lógica do backend (API + RAG)
- **101225-frontend-ui**: Interface do usuário
- **111225-streaming-refactor**: Implementação de streaming

---

## 🛠 Tecnologias Utilizadas

### Frontend
- **Nuxt 3**: Framework Vue.js
- **Vue 3**: Framework reativo
- **TailwindCSS**: Estilização
- **TypeScript**: Tipagem estática

### Backend
- **Nuxt Nitro**: Engine de servidor
- **LangChain.js**: Orquestração de LLM
- **OpenAI API**: Modelo de linguagem
- **Qdrant**: Vector database

### DevOps
- **AWS Lambda**: Hospedagem serverless
- **Serverless Framework**: Deploy automatizado
- **Git**: Controle de versão

---

## 📚 Recursos Adicionais

- [Documentação Nuxt 3](https://nuxt.com/docs)
- [Documentação LangChain.js](https://js.langchain.com/)
- [Documentação Qdrant](https://qdrant.tech/documentation/)
- [OpenAI API Reference](https://platform.openai.com/docs)
- [AWS Lambda Response Streaming](https://aws.amazon.com/blogs/compute/introducing-aws-lambda-response-streaming/)

---

## 📄 Licença

Este projeto é um MVP (Minimum Viable Product) para demonstração.

---

## 👥 Contribuindo

1. Sempre partir da branch `develop`
2. Seguir o padrão de nomenclatura de branches: `DDMMYY-Feature-Description`
3. Usar Conventional Commits
4. Criar PR para `develop`
5. Aguardar code review

---

## 📌 Comandos Git Úteis

### Criar e Trabalhar com Branch
```bash
# Criar branch a partir de develop
git checkout develop
git pull origin develop
git checkout -b 081225-project-setup

# Trabalhar na feature
git add <arquivos>
git commit -m "feat(setup): inicializa projeto Nuxt 3"

# Manter branch atualizada
git checkout develop
git pull origin develop
git checkout 081225-project-setup
git rebase develop  # ou merge develop

# Push da branch
git push -u origin 081225-project-setup
```

### Verificar Status
```bash
# Ver status atual
git status

# Ver histórico de commits
git log --oneline -10

# Ver diferenças
git diff
git diff --staged
```

### Antes de PR
```bash
# Atualizar com develop
git checkout develop
git pull origin develop
git checkout 081225-project-setup
git rebase develop

# Verificar commits
git log --oneline

# Push forçado (após rebase)
git push -f origin 081225-project-setup
```

---

**Última atualização:** Dezembro 2025