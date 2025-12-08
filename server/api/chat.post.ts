// Endpoint principal do chat
// Implementação base na branch: 091225-backend-logic
// Implementação de streaming na branch: 111225-streaming-refactor

export default defineEventHandler(async (event) => {
  // TODO: Implementar lógica do chat
  // 1. Receber { question, history } do body
  // 2. Transformar histórico em objetos LangChain
  // 3. Buscar contexto relevante no Qdrant
  // 4. Configurar modelo OpenAI com streaming
  // 5. Criar chain com LangChain
  // 6. Retornar stream de resposta
  
  return {
    message: 'Chat endpoint - a ser implementado'
  }
})
