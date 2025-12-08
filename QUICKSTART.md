# 🚀 Guia Rápido de Início

Este guia mostra os passos essenciais para começar a trabalhar no projeto.

## 📋 Pré-requisitos

- Node.js 18+ instalado
- Git configurado
- Conta na OpenAI (para API key)
- Instância Qdrant (cloud ou local)

## ⚡ Setup Inicial (5 minutos)

### 1. Clone e Instale

```bash
# Clone o repositório
git clone https://github.com/JONTK123/Serverless-RAG-Chatbot-MVP-.git
cd Serverless-RAG-Chatbot-MVP-

# Instale as dependências
npm install
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
npm run dev

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

## 📚 Ordem de Implementação

Siga esta ordem para evitar bloqueios:

1. **081225-project-setup** → Setup inicial completo
2. **091225-rag-ingestion-script** → Script de ingestão de PDF
3. **091225-backend-logic** → API e lógica RAG
4. **101225-frontend-ui** → Interface do chat
5. **111225-streaming-refactor** → Streaming de respostas

## 📖 Documentação Completa

- **README.md** → Documentação completa do projeto
- **BRANCHES.md** → Detalhes de cada branch e checklist
- **scripts/README.md** → Como usar o script de ingestão

## 🔧 Comandos Úteis

```bash
# Desenvolvimento
npm run dev              # Servidor de desenvolvimento
npm run build            # Build para produção
npm run preview          # Preview da build

# Ingestão de dados
npm run ingest           # Processar PDF para Qdrant

# Deploy
npm run deploy           # Deploy para AWS Lambda

# Git
git branch -a            # Ver todas as branches
git status               # Status atual
git log --oneline -10    # Últimos 10 commits
```

## ❓ Problemas Comuns

### Erro: "Cannot find module..."
```bash
# Limpe e reinstale
rm -rf node_modules
npm install
```

### Erro: "Port 3000 already in use"
```bash
# Mate o processo na porta 3000
lsof -ti:3000 | xargs kill -9

# Ou use outra porta
PORT=3001 npm run dev
```

### Erro: Git push failed
```bash
# Certifique-se de estar na branch correta
git branch --show-current

# Configure upstream se necessário
git push -u origin nome-da-branch
```

## 🆘 Precisa de Ajuda?

1. Consulte **README.md** para documentação completa
2. Veja **BRANCHES.md** para detalhes das branches
3. Leia os comentários nos arquivos de código
4. Cada arquivo tem um comentário indicando em qual branch será implementado

## 🎉 Pronto!

Agora você está pronto para começar a codificar! Lembre-se:

- ✅ Sempre partir de `develop`
- ✅ Usar Conventional Commits
- ✅ Criar PR para code review
- ✅ Testar antes do push
- ✅ Seguir a ordem de implementação

**Boa codificação! 🚀**
