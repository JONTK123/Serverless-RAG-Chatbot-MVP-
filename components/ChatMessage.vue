<template>
  <div class="message">
    <!-- Componente de mensagem individual -->
    <!-- Será implementado na branch: 101225-frontend-ui -->
  </div>
</template>

<script setup lang="ts">
// Props para o componente
interface Props {
  role: 'user' | 'assistant'
  content: string
}

defineProps<Props>()
</script>
