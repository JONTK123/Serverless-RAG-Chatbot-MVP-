<template>
  <div class="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex flex-col">
    <!-- Header -->
    <header class="bg-white shadow-sm border-b border-gray-200">
      <div class="container mx-auto px-4 py-4">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center">
              <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
              </svg>
            </div>
            <div>
              <h1 class="text-xl font-bold text-gray-900">RAG Chatbot</h1>
              <p class="text-xs text-gray-500">Powered by AI & Vector Search</p>
            </div>
          </div>
          <button 
            @click="clearHistory" 
            class="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
            title="Limpar histórico"
          >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </div>
    </header>

    <!-- Main Chat Area -->
    <main class="flex-1 container mx-auto px-4 py-6 max-w-4xl">
      <ChatWindow />
    </main>
  </div>
</template>

<script setup lang="ts">
/**
 * Index Page Component
 * 
 * Main page for the RAG chatbot application. Provides the layout structure
 * including header with branding and clear history button, and the main
 * chat interface area.
 * 
 * @component
 * @example
 * <IndexPage />
 */

const { clearHistory } = useChatHistory()
</script>
