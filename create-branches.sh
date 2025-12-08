#!/bin/bash

# Script para criar todas as branches do projeto
# Execute este script após o merge inicial em develop

echo "🚀 Criando estrutura de branches do projeto..."
echo ""

# Cores para output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Verificar se estamos em um repositório git
if ! git rev-parse --git-dir > /dev/null 2>&1; then
    echo "❌ Erro: Este não é um repositório git!"
    exit 1
fi

echo "${YELLOW}📋 Branches que serão criadas:${NC}"
echo "  1. develop (branch de integração)"
echo "  2. 081225-project-setup (Fase 0: Setup Inicial)"
echo "  3. 091225-rag-ingestion-script (Fase 1: Ingestão de Dados)"
echo "  4. 091225-backend-logic (Fase 2: Backend Lógico)"
echo "  5. 101225-frontend-ui (Fase 3: Frontend Visual)"
echo "  6. 111225-streaming-refactor (Fase 4: Streaming)"
echo ""

read -p "Deseja continuar? (s/n) " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Ss]$ ]]
then
    echo "Operação cancelada."
    exit 1
fi

# Função para criar branch
create_branch() {
    local branch_name=$1
    local description=$2
    
    echo "${BLUE}➜ Criando branch: ${branch_name}${NC}"
    
    # Criar branch localmente
    git checkout -b "$branch_name" 2>/dev/null || {
        echo "${YELLOW}  ⚠ Branch já existe localmente${NC}"
        git checkout "$branch_name"
    }
    
    # Tentar push (pode falhar se sem permissão, mas está ok)
    if git push -u origin "$branch_name" 2>/dev/null; then
        echo "${GREEN}  ✓ Branch criada e enviada para o remoto${NC}"
    else
        echo "${YELLOW}  ⚠ Branch criada localmente (push manual necessário)${NC}"
    fi
    
    echo ""
}

# Voltar para a branch atual (provavelmente main ou copilot/...)
current_branch=$(git branch --show-current)
echo "Branch atual: $current_branch"
echo ""

# Criar branch develop primeiro
echo "${BLUE}═══════════════════════════════════════════════${NC}"
echo "${BLUE}  Criando branch base: develop${NC}"
echo "${BLUE}═══════════════════════════════════════════════${NC}"
git checkout -b develop 2>/dev/null || git checkout develop
if git push -u origin develop 2>/dev/null; then
    echo "${GREEN}✓ Branch develop criada no remoto${NC}"
else
    echo "${YELLOW}⚠ Branch develop criada localmente${NC}"
fi
echo ""

# Criar feature branches a partir de develop
echo "${BLUE}═══════════════════════════════════════════════${NC}"
echo "${BLUE}  Criando feature branches${NC}"
echo "${BLUE}═══════════════════════════════════════════════${NC}"
echo ""

# Certifique-se de estar em develop
git checkout develop

# Criar cada feature branch
create_branch "081225-project-setup" "Fase 0: Setup Inicial"
git checkout develop

create_branch "091225-rag-ingestion-script" "Fase 1: Ingestão de Dados"
git checkout develop

create_branch "091225-backend-logic" "Fase 2: Backend Lógico"
git checkout develop

create_branch "101225-frontend-ui" "Fase 3: Frontend Visual"
git checkout develop

create_branch "111225-streaming-refactor" "Fase 4: Streaming"
git checkout develop

echo ""
echo "${GREEN}═══════════════════════════════════════════════${NC}"
echo "${GREEN}  ✓ Estrutura de branches criada com sucesso!${NC}"
echo "${GREEN}═══════════════════════════════════════════════${NC}"
echo ""
echo "${YELLOW}📝 Próximos passos:${NC}"
echo ""
echo "1. Para começar a trabalhar em uma feature:"
echo "   ${BLUE}git checkout 081225-project-setup${NC}"
echo ""
echo "2. Após fazer mudanças:"
echo "   ${BLUE}git add .${NC}"
echo "   ${BLUE}git commit -m \"feat(setup): sua mensagem\"${NC}"
echo ""
echo "3. Push das mudanças:"
echo "   ${BLUE}git push origin 081225-project-setup${NC}"
echo ""
echo "4. Criar Pull Request no GitHub para merge em develop"
echo ""
echo "5. Ver todas as branches:"
echo "   ${BLUE}git branch -a${NC}"
echo ""
echo "${YELLOW}📚 Consulte BRANCHES.md para mais detalhes sobre cada branch${NC}"
echo ""
