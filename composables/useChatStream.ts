// Composable para gerenciar streaming de mensagens do chat
// Implementação completa na branch: 111225-streaming-refactor

export const useChatStream = () => {
  // TODO: Implementar lógica de streaming
  // - Fazer requisição para /api/chat
  // - Ler ReadableStream
  // - Processar chunks em tempo real
  // - Atualizar UI progressivamente
  
  const sendMessage = async (question: string, history: any[]) => {
    // Implementação do fetch com streaming
  }
  
  return {
    sendMessage,
    isLoading: ref(false),
    error: ref<string | null>(null)
  }
}
