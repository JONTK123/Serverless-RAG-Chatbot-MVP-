<template>
  <div class="chat-input">
    <!-- Componente de input para mensagens -->
    <!-- Será implementado na branch: 101225-frontend-ui -->
  </div>
</template>

<script setup lang="ts">
// Emits para o componente
const emit = defineEmits<{
  send: [message: string]
}>()
</script>
