# Organização de Branches do Projeto

Este documento descreve todas as branches que serão criadas para o desenvolvimento do projeto, seguindo o padrão ProMiles: `DDMMYY-Feature-Description`

## Estrutura de Branches

```
main (produção)
└── develop (integração)
    ├── 081225-project-setup
    ├── 091225-rag-ingestion-script
    ├── 091225-backend-logic
    ├── 101225-frontend-ui
    └── 111225-streaming-refactor
```

---

## Branches do Projeto

### Branch Base: `develop`
- **Descrição:** Branch de integração principal
- **Uso:** Todas as features são mergeadas aqui
- **Proteção:** Não commitar diretamente, apenas via PR

### Branch Produção: `main`
- **Descrição:** Código em produção
- **Uso:** Merge apenas quando tudo estiver testado e validado
- **Proteção:** Apenas merges de `develop` após validação completa

---

## Feature Branches

### 1. `081225-project-setup`
**Fase 0: Setup Inicial**

**Responsável por:**
- Inicializar projeto Nuxt 3
- Instalar dependências (LangChain, OpenAI, Qdrant, etc.)
- Configurar arquivos de ambiente (.env.example)
- Configurar TypeScript e Tailwind CSS
- Configurar serverless.yml

**Arquivos principais:**
- `package.json`
- `nuxt.config.ts`
- `tsconfig.json`
- `tailwind.config.js`
- `.env.example`
- `serverless.yml`

**Comandos:**
```bash
git checkout develop
git pull origin develop
git checkout -b 081225-project-setup

# Fazer as implementações
git add .
git commit -m "feat(setup): inicializa projeto Nuxt 3"
git commit -m "feat(setup): configura dependências LangChain e OpenAI"
git commit -m "feat(setup): adiciona configuração Serverless"

git push -u origin 081225-project-setup
# Criar PR para develop
```

**Checklist:**
- [ ] `npm init` executado
- [ ] Dependências instaladas
- [ ] Nuxt configurado
- [ ] TypeScript configurado
- [ ] Tailwind configurado
- [ ] Serverless configurado
- [ ] `.env.example` criado
- [ ] Projeto roda com `npm run dev`

---

### 2. `091225-rag-ingestion-script`
**Fase 1: O "Cérebro" (Ingestão de Dados)**

**Responsável por:**
- Criar script de ingestão de PDF
- Ler e processar PDFs
- Dividir texto em chunks
- Gerar embeddings com OpenAI
- Salvar vetores no Qdrant

**Arquivos principais:**
- `scripts/ingest.ts`
- `scripts/README.md`

**Comandos:**
```bash
git checkout develop
git pull origin develop
git checkout -b 091225-rag-ingestion-script

# Fazer as implementações
git add .
git commit -m "feat(rag): implementa leitor de PDF"
git commit -m "feat(rag): adiciona RecursiveCharacterTextSplitter"
git commit -m "feat(rag): integra geração de embeddings OpenAI"
git commit -m "feat(rag): implementa salvamento no Qdrant"
git commit -m "docs(rag): adiciona documentação do script"

git push -u origin 091225-rag-ingestion-script
# Criar PR para develop
```

**Checklist:**
- [ ] Script lê PDF do diretório `data/documents/`
- [ ] Texto é extraído corretamente
- [ ] Chunks são criados com tamanho apropriado
- [ ] Embeddings são gerados
- [ ] Vetores são salvos no Qdrant
- [ ] Script é executável via `npm run ingest`
- [ ] Documentação está completa

**Nota:** Este script roda **localmente**, não faz parte do deploy da Lambda.

---

### 3. `091225-backend-logic`
**Fase 2: O Backend Lógico**

**Responsável por:**
- Criar rota Nitro `/api/chat`
- Receber `{ question, history }` no body
- Configurar conexão Qdrant
- Configurar LangChain com OpenAI
- Buscar contexto relevante no Qdrant
- Retornar resposta (texto simples, sem stream inicialmente)

**Arquivos principais:**
- `server/api/chat.post.ts`
- `server/utils/langchain.ts`
- `server/utils/qdrant.ts`

**Comandos:**
```bash
git checkout develop
git pull origin develop
git checkout -b 091225-backend-logic

# Fazer as implementações
git add .
git commit -m "feat(api): cria endpoint /api/chat"
git commit -m "feat(api): implementa conexão com Qdrant"
git commit -m "feat(api): configura LangChain com OpenAI"
git commit -m "feat(api): integra busca vetorial para RAG"
git commit -m "feat(api): implementa lógica de resposta básica"

git push -u origin 091225-backend-logic
# Criar PR para develop
```

**Checklist:**
- [ ] Endpoint `/api/chat` criado
- [ ] Recebe `question` e `history` corretamente
- [ ] Conecta com Qdrant
- [ ] Busca documentos similares
- [ ] Configura modelo OpenAI
- [ ] Processa histórico de conversa
- [ ] Retorna resposta em texto simples
- [ ] Testa com Postman/Insomnia

---

### 4. `101225-frontend-ui`
**Fase 3: O Frontend Visual**

**Responsável por:**
- Criar layout do chat
- Implementar componentes (ChatWindow, ChatMessage, ChatInput)
- Implementar lógica de LocalStorage
- Gerenciar histórico de mensagens
- Enviar requisições para `/api/chat`
- Gerar e salvar UUID de sessão

**Arquivos principais:**
- `pages/index.vue`
- `components/ChatWindow.vue`
- `components/ChatMessage.vue`
- `components/ChatInput.vue`
- `composables/useChatHistory.ts`
- `composables/useChatStream.ts` (básico, sem streaming ainda)
- `app.vue`

**Comandos:**
```bash
git checkout develop
git pull origin develop
git checkout -b 101225-frontend-ui

# Fazer as implementações
git add .
git commit -m "feat(ui): cria layout base do chat"
git commit -m "feat(ui): implementa componente ChatWindow"
git commit -m "feat(ui): implementa componente ChatMessage"
git commit -m "feat(ui): implementa componente ChatInput"
git commit -m "feat(ui): adiciona composable useChatHistory"
git commit -m "feat(ui): integra LocalStorage para histórico"
git commit -m "feat(ui): implementa envio de mensagens para API"
git commit -m "style(ui): adiciona estilos e animações"

git push -u origin 101225-frontend-ui
# Criar PR para develop
```

**Checklist:**
- [ ] Interface de chat visível e funcional
- [ ] Mensagens aparecem na tela
- [ ] Input de mensagem funciona
- [ ] Histórico salvo no LocalStorage
- [ ] UUID de sessão gerado e salvo
- [ ] Histórico carregado ao recarregar página (F5)
- [ ] Requisições enviadas para `/api/chat`
- [ ] Respostas aparecem (ainda sem streaming)
- [ ] Design responsivo

---

### 5. `111225-streaming-refactor`
**Fase 4: O Streaming (Integração Final)**

**Responsável por:**
- Implementar streaming no backend (sendStream)
- Configurar ReadableStream no LangChain
- Atualizar frontend para ler stream
- Implementar `getReader()` no fetch
- Montar texto em tempo real (efeito de digitação)
- Configurar headers corretos (text/event-stream)

**Arquivos principais:**
- `server/api/chat.post.ts` (refatoração)
- `composables/useChatStream.ts` (implementação completa)
- `serverless.yml` (confirmar RESPONSE_STREAM)

**Comandos:**
```bash
git checkout develop
git pull origin develop
git checkout -b 111225-streaming-refactor

# Fazer as implementações
git add .
git commit -m "feat(stream): implementa streaming no backend"
git commit -m "feat(stream): configura ReadableStream no LangChain"
git commit -m "feat(stream): atualiza frontend para ler stream"
git commit -m "feat(stream): implementa efeito de digitação"
git commit -m "fix(stream): corrige encoding de caracteres"
git commit -m "perf(stream): otimiza buffer de chunks"

git push -u origin 111225-streaming-refactor
# Criar PR para develop
```

**Checklist:**
- [ ] Backend retorna stream com `sendStream()`
- [ ] Headers corretos configurados
- [ ] Frontend usa `getReader()` para ler stream
- [ ] Texto aparece progressivamente (letra por letra)
- [ ] Não há travamento inicial
- [ ] Caracteres especiais funcionam
- [ ] serverless.yml tem `invokeMode: RESPONSE_STREAM`
- [ ] Testado localmente
- [ ] Deploy funciona na AWS Lambda

---

## Fluxo de Trabalho Resumido

```bash
# Para cada feature:

# 1. Partir de develop atualizada
git checkout develop
git pull origin develop

# 2. Criar branch seguindo o padrão
git checkout -b DDMMYY-Feature-Description

# 3. Desenvolver e commitar (Conventional Commits)
git add .
git commit -m "feat(escopo): descrição"

# 4. Push e criar PR
git push -u origin DDMMYY-Feature-Description
# Criar PR no GitHub para merge em develop

# 5. Após aprovação, merge em develop
# 6. Deletar branch local e remota
git branch -d DDMMYY-Feature-Description
git push origin --delete DDMMYY-Feature-Description
```

---

## Merge em Main (Produção)

Apenas após **todas as features** estarem completas e testadas:

```bash
git checkout develop
git pull origin develop

# Verificar testes
npm run build
npm run lint

# Criar PR de develop para main
# Após aprovação e merge:

git checkout main
git pull origin main

# Deploy para produção
npm run deploy
```

---

## Convenções de Commit

Todas as mensagens devem seguir o padrão Conventional Commits:

```bash
feat(escopo): adiciona nova funcionalidade
fix(escopo): corrige bug
docs(escopo): atualiza documentação
style(escopo): formatação de código
refactor(escopo): refatoração
perf(escopo): melhoria de performance
test(escopo): adiciona testes
chore(escopo): tarefas de manutenção
```

**Exemplos:**
```bash
feat(setup): inicializa projeto Nuxt 3
feat(rag): implementa ingestão de PDF
feat(api): cria endpoint de chat
feat(ui): adiciona componente ChatMessage
feat(stream): implementa streaming de respostas
fix(stream): corrige encoding UTF-8
docs(readme): atualiza instruções
refactor(api): simplifica lógica de busca
```

---

## Notas Importantes

1. **Nunca commitar direto em `main` ou `develop`**
2. **Sempre criar PR para code review**
3. **Testar localmente antes do push**
4. **Manter commits pequenos e focados**
5. **Usar mensagens descritivas**
6. **Atualizar `develop` antes de criar nova branch**
7. **Resolver conflitos antes do merge**
8. **Deletar branches após merge**

---

**Data de criação:** 08/12/2025
**Última atualização:** 08/12/2025
