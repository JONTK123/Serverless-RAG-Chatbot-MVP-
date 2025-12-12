<template>
  <div class="flex flex-col h-full bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-200" style="height: calc(100vh - 180px);">
    <!-- Messages Area -->
    <div 
      ref="messagesContainer"
      class="flex-1 overflow-y-auto p-6 space-y-4 chat-scroll"
    >
      <!-- Welcome Message -->
      <div v-if="messages.length === 0" class="flex items-center justify-center h-full">
        <div class="text-center max-w-md">
          <div class="w-16 h-16 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg class="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          </div>
          <h3 class="text-xl font-semibold text-gray-900 mb-2">Bem-vindo ao RAG Chatbot!</h3>
          <p class="text-gray-600 text-sm">
            Faça perguntas sobre o documento e receba respostas inteligentes baseadas no conteúdo.
          </p>
        </div>
      </div>

      <!-- Chat Messages -->
      <ChatMessage
        v-for="(message, index) in messages"
        :key="index"
        :role="message.role"
        :content="message.content"
        :timestamp="message.timestamp"
      />

      <!-- Typing Indicator -->
      <div v-if="isLoading" class="flex items-start gap-3">
        <div class="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center flex-shrink-0">
          <svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
        </div>
        <div class="bg-gray-100 rounded-2xl rounded-tl-none px-4 py-3">
          <div class="flex gap-1">
            <span class="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style="animation-delay: 0ms"></span>
            <span class="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style="animation-delay: 150ms"></span>
            <span class="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style="animation-delay: 300ms"></span>
          </div>
        </div>
      </div>
    </div>

    <!-- Input Area -->
    <div class="border-t border-gray-200 p-4 bg-white">
      <ChatInput @send="handleSendMessage" :disabled="isLoading" />
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * ChatWindow Component
 * 
 * Main chat interface component that displays messages and handles user interactions.
 * Manages the chat history, message display, auto-scrolling, and loading states.
 * 
 * Features:
 * - Displays welcome message when no messages exist
 * - Shows user and assistant messages
 * - Auto-scrolls to latest message
 * - Displays typing indicator during API calls
 * - Integrates with LocalStorage for message persistence
 * 
 * @component
 * @example
 * <ChatWindow />
 */

import { ref, nextTick, onMounted } from 'vue'

const { messages, addMessage } = useChatHistory()
const { sendMessage, isLoading, error } = useChatStream()
const messagesContainer = ref<HTMLElement | null>(null)

/**
 * Scrolls the messages container to the bottom
 * Called after new messages are added to ensure visibility
 */
const scrollToBottom = () => {
  nextTick(() => {
    if (messagesContainer.value) {
      messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight
    }
  })
}

/**
 * Handles sending a new message
 * 
 * @param {string} message - The message text to send
 */
const handleSendMessage = async (message: string) => {
  if (!message.trim() || isLoading.value) return

  // Add user message
  addMessage({
    role: 'user',
    content: message,
    timestamp: Date.now()
  })
  
  scrollToBottom()

  // Prepare assistant placeholder to stream into
  const assistantMsg = {
    role: 'assistant',
    content: '',
    timestamp: Date.now()
  }
  addMessage(assistantMsg)
  const assistantIndex = messages.value.length - 1
  
  try {
    const fullResponse = await sendMessage(
      message,
      messages.value,
      (chunk) => {
        messages.value[assistantIndex].content += chunk
        scrollToBottom()
      }
    )

    // Ensure final content set (in case stream didn't flush)
    if (fullResponse) {
      messages.value[assistantIndex].content = fullResponse
    }
    scrollToBottom()
  } catch (err) {
    console.error('Error sending message:', err)
    messages.value[assistantIndex].content =
      'Desculpe, ocorreu um erro ao processar sua mensagem. Por favor, tente novamente.'
    scrollToBottom()
  }
}

// Scroll to bottom on mount
onMounted(() => {
  scrollToBottom()
})
</script>

<style scoped>
.chat-scroll {
  scroll-behavior: smooth;
}
</style>
