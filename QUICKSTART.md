### 1. Clone e Instale

```bash
# Clone o repositório
git clone https://github.com/JONTK123/Serverless-RAG-Chatbot-MVP-.git
cd Serverless-RAG-Chatbot-MVP-

# Instale as dependências
pnpm install
```

### 2. Configure Variáveis de Ambiente

```bash
# Copie o template
cp .env.example .env

# Edite o .env com suas credenciais
nano .env  # ou use seu editor preferido
```

Preencha:
```env
OPENAI_API_KEY=sk-seu-token-aqui
QDRANT_URL=https://sua-instancia-qdrant.com
QDRANT_API_KEY=sua-chave-qdrant
```

### 3. Crie as Branches do Projeto

```bash
# Execute o script de criação de branches
./create-branches.sh

# Ou manualmente:
git checkout -b develop
git checkout -b 081225-project-setup
git checkout -b 091225-rag-ingestion-script
git checkout -b 091225-backend-logic
git checkout -b 101225-frontend-ui
git checkout -b 111225-streaming-refactor
```

### 4. Teste Localmente

```bash
# Volte para develop
git checkout develop

# Execute o servidor de desenvolvimento
pnpm dev

# Acesse: http://localhost:3000
```

## 🎯 Workflow de Desenvolvimento

### Para cada Feature:

```bash
# 1. Atualize develop
git checkout develop
git pull origin develop

# 2. Vá para a branch da feature
git checkout 081225-project-setup

# 3. Faça suas mudanças...

# 4. Commit (Conventional Commits)
git add .
git commit -m "feat(setup): implementa configuração inicial"

# 5. Push
git push origin 081225-project-setup

# 6. Crie Pull Request no GitHub para develop
```

## 🔧 Comandos Úteis

```bash
# Desenvolvimento
pnpm dev                # Servidor de desenvolvimento
pnpm build              # Build para produção
pnpm preview            # Preview da build
pnpm generate           # Gera build estática

# Lint
pnpm lint               # Verifica padrões de código
pnpm lint:fix           # Corrige problemas de lint automaticamente

# Ingestão de dados
pnpm ingest             # Processar PDF para Qdrant

# Deploy (build + deploy da API com variáveis carregadas)
set -a && source .env && set +a && pnpm run deploy:api   # carrega env + build + deploy
set -a && source .env && set +a && pnpm run remove:api   # carrega env + remove lambda 
pnpm run deploy                                           # Deploy para AWS Lambda
pnpm run deploy:api                                       # Deploy detalhado da API
pnpm run remove:api                                       # Remove a API do ambiente

# Serverless Framework (backend Lambda)
serverless deploy                        # Deploy do backend na AWS Lambda
serverless deploy --verbose              # Deploy detalhado do backend
serverless remove                        # Remove o backend da AWS Lambda
set -a && source .env && set +a && serverless logs -f api --startTime 10m  # Logs últimos 10 minutos
serverless logs -f api --startTime 1h    # Última 1 hora
serverless logs -f api --startTime 24h   # Últimas 24 horas
serverless logs -f api --tail            # Seguir logs em tempo real
serverless logs -f api --filter "ERROR"  # Filtrar apenas erros

# Frontend local apontando para a Lambda (ajuste a URL do deploy)
API_BASE_URL=https://7aq993qjt5.execute-api.sa-east-1.amazonaws.com/api pnpm dev --host 0.0.0.0

# Git
git branch -a            # Ver todas as branches
git status               # Status atual
git log --oneline -10    # Últimos 10 commits
```
