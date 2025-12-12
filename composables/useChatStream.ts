/**
 * Chat Stream Composable
 * 
 * Manages communication with the chat API endpoint, including message sending
 * and response streaming. Handles loading states, errors, and integrates with
 * the chat history for context-aware responses.
 * 
 * Features:
 * - Sends messages to /api/chat endpoint
 * - Includes full conversation history for context
 * - Manages loading and error states
 * - Session ID tracking via headers
 * 
 * @module useChatStream
 * @example
 * const { sendMessage, isLoading, error } = useChatStream()
 * await sendMessage('Hello!', historyArray)
 */

import { ref } from 'vue'
import type { ChatMessage } from './useChatHistory'

/**
 * Composable for managing chat API communication
 * 
 * @returns {Object} Chat stream management functions and state
 * @returns {Function} sendMessage - Function to send a message and get response
 * @returns {Ref<boolean>} isLoading - Loading state indicator
 * @returns {Ref<string|null>} error - Error message if any
 */
export const useChatStream = () => {
  const isLoading = ref(false)
  const error = ref<string | null>(null)
  const { sessionId } = useChatHistory()

  /**
   * Sends a message to the chat API and retrieves the response
   * 
   * Sends the user's question along with the full conversation history
   * to maintain context. The API will use this history to provide
   * contextually relevant responses.
   * 
   * @param {string} question - The user's question/message
   * @param {ChatMessage[]} history - Array of previous messages for context
   * @returns {Promise<string>} The assistant's response text
   * @throws {Error} If the API request fails
   * 
   * @example
   * const response = await sendMessage('What is RAG?', messages.value)
   */
  const sendMessage = async (question: string, history: ChatMessage[]): Promise<string> => {
    isLoading.value = true
    error.value = null

    try {
      // Prepare the payload with question and full history
      const payload = {
        question: question.trim(),
        history: history.map(msg => ({
          role: msg.role,
          content: msg.content
        }))
      }

      // Make request to the API endpoint
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': sessionId.value || ''
        },
        body: JSON.stringify(payload)
      })

      if (!response.ok) {
        throw new Error(`API Error: ${response.status} ${response.statusText}`)
      }

      const data = await response.json()
      return data.message || data.response || 'Sem resposta do servidor.'

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro desconhecido ao enviar mensagem'
      error.value = errorMessage
      console.error('Error in sendMessage:', err)
      throw err
    } finally {
      isLoading.value = false
    }
  }

  /**
   * Sends a message with streaming support (for future implementation)
   * 
   * This function will support real-time streaming of responses using ReadableStream API.
   * 
   * @param {string} question - The user's question/message
   * @param {ChatMessage[]} history - Array of previous messages for context
   * @param {Function} onChunk - Callback function called with each chunk of text
   * @returns {Promise<string>} The complete assistant's response
   * 
   * @example
   * const response = await sendMessageStream(
   *   'Tell me a story',
   *   messages.value,
   *   (chunk) => console.log('Received:', chunk)
   * )
   */
  const sendMessageStream = async (
    question: string, 
    history: ChatMessage[],
    onChunk?: (chunk: string) => void
  ): Promise<string> => {
    // TODO: Implement streaming support
    // Will use ReadableStream API and getReader() to process chunks in real-time
    
    // For now, fallback to regular sendMessage
    return sendMessage(question, history)
  }

  return {
    sendMessage,
    sendMessageStream,
    isLoading,
    error
  }
}
