<template>
  <div class="min-h-screen bg-white text-gray-900">
    <NuxtPage />
  </div>
</template>

<script setup lang="ts">
// Tema branco permanente
if (process.client) {
  document.documentElement.classList.remove('dark')
}
</script>
