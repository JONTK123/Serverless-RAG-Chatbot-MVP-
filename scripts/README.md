# Scripts do Projeto

Este diretório contém scripts auxiliares para o projeto.

## Ingestão de PDF (`ingest.ts`)

Script para processar e ingerir documentos PDF no Qdrant.

### Como usar:

1. Coloque seu PDF em `data/documents/`
2. Configure as variáveis de ambiente no `.env`
3. Execute o script:

```bash
npm run ingest
```

### O que o script faz:

1. Lê o arquivo PDF especificado
2. Extrai o texto usando `pdf-parse`
3. Divide o texto em chunks usando `RecursiveCharacterTextSplitter`
4. Gera embeddings usando OpenAI
5. Armazena os vetores no Qdrant

### Configuração:

O script usa as seguintes variáveis de ambiente:
- `OPENAI_API_KEY`: Chave da API OpenAI
- `QDRANT_URL`: URL da instância Qdrant
- `QDRANT_API_KEY`: Chave da API Qdrant
- `QDRANT_COLLECTION_NAME`: Nome da coleção (padrão: "rag-chatbot-documents")

### Notas:

- Este script roda **localmente**, não faz parte do deploy da Lambda
- Execute apenas quando adicionar ou atualizar documentos
- O processo pode demorar dependendo do tamanho do PDF
