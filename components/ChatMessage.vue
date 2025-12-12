<template>
  <div class="flex items-start gap-3 mb-4" :class="isUser ? 'flex-row-reverse' : 'flex-row'">
    <!-- Avatar -->
    <div 
      class="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
      :class="isUser ? 'bg-gradient-to-br from-purple-500 to-pink-500' : 'bg-gradient-to-br from-blue-500 to-indigo-600'"
    >
      <svg v-if="isUser" class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
      </svg>
      <svg v-else class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
      </svg>
    </div>

    <!-- Message Bubble -->
    <div 
      class="max-w-[75%] rounded-2xl px-4 py-3 shadow-sm"
      :class="isUser 
        ? 'bg-gradient-to-br from-purple-500 to-pink-500 text-white rounded-tr-none' 
        : 'bg-gray-100 text-gray-900 rounded-tl-none border border-gray-200'"
    >
      <!-- Message Content -->
      <div class="text-sm leading-relaxed whitespace-pre-wrap break-words">
        {{ content }}
      </div>
      
      <!-- Timestamp -->
      <div 
        class="text-xs mt-2 opacity-70"
        :class="isUser ? 'text-white' : 'text-gray-500'"
      >
        {{ formattedTime }}
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * ChatMessage Component
 * 
 * Displays an individual chat message with avatar, content, and timestamp.
 * Supports both user and assistant messages with different styling.
 * 
 * @component
 * @prop {('user'|'assistant')} role - The role of the message sender
 * @prop {string} content - The message text content
 * @prop {number} timestamp - Unix timestamp of when the message was sent
 * 
 * @example
 * <ChatMessage 
 *   role="user" 
 *   content="Hello!" 
 *   :timestamp="Date.now()" 
 * />
 */

import { computed } from 'vue'

interface Props {
  role: 'user' | 'assistant'
  content: string
  timestamp: number
}

const props = defineProps<Props>()

/**
 * Checks if the message is from the user
 * @returns {boolean} True if message is from user
 */
const isUser = computed(() => props.role === 'user')

/**
 * Formats the timestamp into a readable time string
 * @returns {string} Formatted time string (HH:MM)
 */
const formattedTime = computed(() => {
  const date = new Date(props.timestamp)
  return date.toLocaleTimeString('pt-BR', { 
    hour: '2-digit', 
    minute: '2-digit' 
  })
})
</script>
