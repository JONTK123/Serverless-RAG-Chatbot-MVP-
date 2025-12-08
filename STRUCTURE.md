# 📁 Estrutura do Projeto

```
Serverless-RAG-Chatbot-MVP-/
│
├── 📄 Documentação Principal
│   ├── README.md                    ⭐ Documentação master completa
│   ├── BRANCHES.md                  📋 Organização de branches Git
│   ├── QUICKSTART.md                🚀 Guia rápido de início
│   └── create-branches.sh           🔧 Script para criar branches
│
├── ⚙️ Configuração
│   ├── .env.example                 🔐 Template de variáveis de ambiente
│   ├── .gitignore                   🚫 Arquivos ignorados pelo Git
│   ├── package.json                 📦 Dependências e scripts npm
│   ├── nuxt.config.ts               ⚡ Configuração Nuxt 3
│   ├── tsconfig.json                📘 Configuração TypeScript
│   ├── tailwind.config.js           🎨 Configuração Tailwind CSS
│   └── serverless.yml               ☁️ Configuração AWS Lambda
│
├── 🎨 Frontend (Vue/Nuxt)
│   ├── app.vue                      🏠 Componente raiz
│   ├── pages/
│   │   └── index.vue                💬 Página principal do chat
│   ├── components/
│   │   ├── ChatWindow.vue           🪟 Janela do chat
│   │   ├── ChatMessage.vue          💭 Mensagem individual
│   │   └── ChatInput.vue            ⌨️ Input de mensagens
│   ├── composables/
│   │   ├── useChatHistory.ts        💾 Gerenciamento LocalStorage
│   │   └── useChatStream.ts         📡 Lógica de streaming
│   └── assets/
│       └── css/
│           └── main.css             🎨 Estilos globais
│
├── 🔧 Backend (Nitro/Lambda)
│   └── server/
│       ├── api/
│       │   └── chat.post.ts         🤖 Endpoint principal do chat
│       ├── utils/
│       │   ├── langchain.ts         🧠 Configuração LangChain
│       │   └── qdrant.ts            🔍 Conexão Qdrant
│       └── middleware/
│           └── logging.ts           📝 Middleware de logging
│
├── 🗄️ Scripts e Dados
│   ├── scripts/
│   │   ├── ingest.ts                📄 Script de ingestão de PDF
│   │   └── README.md                📖 Docs do script
│   └── data/
│       └── documents/               📚 PDFs para processar
│           └── .gitkeep
│
└── 📦 Build (gerado)
    ├── .output/                     (após npm run build)
    ├── .nuxt/                       (cache de desenvolvimento)
    └── node_modules/                (dependências)
```

## 🎯 Branches do Projeto

```
main (produção)
  └── develop (integração)
       ├── 081225-project-setup
       ├── 091225-rag-ingestion-script
       ├── 091225-backend-logic
       ├── 101225-frontend-ui
       └── 111225-streaming-refactor
```

## 📊 Status dos Arquivos

| Arquivo/Diretório | Status | Branch de Implementação |
|-------------------|--------|------------------------|
| 📦 package.json | ✅ Estrutura pronta | 081225-project-setup |
| ⚙️ Configs (nuxt, ts, tailwind) | ✅ Estrutura pronta | 081225-project-setup |
| 📄 scripts/ingest.ts | 📝 Placeholder | 091225-rag-ingestion-script |
| 🤖 server/api/chat.post.ts | 📝 Placeholder | 091225-backend-logic |
| 🧠 server/utils/*.ts | 📝 Placeholder | 091225-backend-logic |
| 💬 components/*.vue | 📝 Placeholder | 101225-frontend-ui |
| 💾 composables/*.ts | 📝 Placeholder | 101225-frontend-ui |
| 📡 Streaming | ⏳ A implementar | 111225-streaming-refactor |

## 🔄 Fluxo de Dados

```
┌─────────────┐
│   Browser   │
│ (LocalStorage)│
└──────┬──────┘
       │ fetch + ReadableStream
       ▼
┌─────────────┐
│  Nuxt Nitro │
│   /api/chat  │
└──────┬──────┘
       │
       ├─► 🤖 OpenAI (LLM)
       │
       └─► 🔍 Qdrant (Vector DB)
```

## 📈 Ordem de Implementação

```
1️⃣  Setup Inicial
    └─► Instalar deps, configurar ambiente

2️⃣  Ingestão de Dados
    └─► PDF → Chunks → Embeddings → Qdrant

3️⃣  Backend Lógico
    └─► API endpoint + RAG básico

4️⃣  Frontend Visual
    └─► Interface + LocalStorage

5️⃣  Streaming
    └─► Response streaming real-time
```

## 🛠 Comandos Rápidos

```bash
# Desenvolvimento
npm run dev                 # Iniciar servidor local
npm run build              # Build para produção
npm run preview            # Preview da build

# Dados
npm run ingest             # Processar PDF

# Deploy
npm run deploy             # Deploy AWS Lambda

# Git
./create-branches.sh       # Criar todas as branches
git checkout develop       # Ir para develop
git checkout 081225-...    # Ir para feature branch
```

## 📚 Documentos de Referência

- **README.md**: Documentação completa com ADRs
- **BRANCHES.md**: Detalhes de cada branch + checklists
- **QUICKSTART.md**: Como começar em 5 minutos
- **scripts/README.md**: Como usar script de ingestão

## ✅ Checklist Pré-desenvolvimento

- [x] ✅ Estrutura de diretórios criada
- [x] ✅ Arquivos de configuração prontos
- [x] ✅ Placeholders implementados
- [x] ✅ Documentação completa
- [x] ✅ Script de branches criado
- [ ] ⏳ npm install executado
- [ ] ⏳ Branches criadas no Git
- [ ] ⏳ .env configurado

## 🎓 Padrões Aplicados

- ✅ **Nomenclatura de Branches**: DDMMYY-Feature-Description
- ✅ **Conventional Commits**: feat/fix/docs/refactor/etc
- ✅ **Git Flow**: Feature → develop → main
- ✅ **TypeScript**: Tipagem em todos os arquivos
- ✅ **Estrutura Nuxt 3**: Pages/Components/Composables
- ✅ **Serverless Ready**: Configurado para AWS Lambda

---

**Estrutura criada em:** 08/12/2025  
**Pronta para:** Codificação nas branches específicas  
**Status:** ✅ COMPLETA - AGUARDANDO IMPLEMENTAÇÃO
