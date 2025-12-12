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

## 🔧 Comandos Úteis

```bash
# Editei comandos no package.json para juntar build + serverless deploy
set -a && source .env && set +a && pnpm run deploy:api   # carrega env + build + deploy lambda
set -a && source .env && set +a && pnpm run remove:api   # carrega env + remove lambda 

serverless logs -f api --startTime 1h    # Última 1 hora
serverless logs -f api --startTime 24h   # Últimas 24 horas
serverless logs -f api --tail            # Seguir logs em tempo real
serverless logs -f api --filter "ERROR"  # Filtrar apenas erros

# Após iniciar o backend lambda -> Iniciar Frontend local apontando para a Lambda (ajuste a URL do deploy)
API_BASE_URL=https://2u8hvyvvje.execute-api.sa-east-1.amazonaws.com/api pnpm dev --host 0.0.0.0
