<template>
  <form @submit.prevent="handleSubmit" class="flex gap-3">
    <!-- Input Field -->
    <div class="flex-1 relative">
      <input
        v-model="inputMessage"
        type="text"
        placeholder="Digite sua mensagem..."
        :disabled="disabled"
        class="w-full px-4 py-3 pr-12 rounded-xl border border-gray-600 bg-gray-800 text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-700 disabled:cursor-not-allowed transition-all"
        @keydown.enter.exact.prevent="handleSubmit"
      />
      
      <!-- Character Count (Optional) -->
      <div 
        v-if="inputMessage.length > 0" 
        class="absolute right-3 top-1/2 transform -translate-y-1/2 text-xs text-gray-500"
      >
        {{ inputMessage.length }}
      </div>
    </div>

    <!-- Upload Button -->
    <DocumentUpload />

    <!-- Send Button -->
    <ActionButton
      type="submit"
      variant="primary"
      :disabled="disabled || !inputMessage.trim()"
      aria-label="Enviar mensagem"
    >
      <svg 
        v-if="!disabled" 
        class="w-5 h-5" 
        fill="none" 
        stroke="currentColor" 
        viewBox="0 0 24 24"
      >
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
      </svg>
      <svg 
        v-else 
        class="w-5 h-5 animate-spin" 
        fill="none" 
        stroke="currentColor" 
        viewBox="0 0 24 24"
      >
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
      </svg>
    </ActionButton>
  </form>
</template>

<script setup lang="ts">
/**
 * ChatInput Component
 * 
 * Provides an input field for users to type and send messages.
 * Handles form submission, keyboard shortcuts, and disabled states.
 * 
 * Features:
 * - Text input with character count
 * - Submit button with loading state
 * - Enter key to send (Shift+Enter for new line handled by parent)
 * - Disabled state during message processing
 * 
 * @component
 * @prop {boolean} disabled - Whether the input should be disabled
 * @emits {send} Emitted when user sends a message with the message text
 * 
 * @example
 * <ChatInput 
 *   :disabled="isLoading" 
 *   @send="handleSendMessage" 
 * />
 */

import { ref } from 'vue'

interface Props {
  disabled?: boolean
}

const props = defineProps<Props>()

const emit = defineEmits<{
  send: [message: string]
}>()

const inputMessage = ref('')

/**
 * Handles form submission
 * Validates input, emits send event, and clears the input field
 */
const handleSubmit = () => {
  const message = inputMessage.value.trim()
  if (message && !props.disabled) {
    emit('send', message)
    inputMessage.value = ''
  }
}
</script>
