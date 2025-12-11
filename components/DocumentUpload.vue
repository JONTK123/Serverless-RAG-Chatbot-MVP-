<template>
  <div class="relative">
    <!-- Botão de Upload (inline, ao lado do botão de enviar) -->
    <ActionButton
      type="button"
      variant="secondary"
      @click="showUpload = !showUpload"
      :aria-label="showUpload ? 'Fechar upload' : 'Upload de documento'"
      :class="{ 'ring-2 ring-purple-300': showUpload }"
    >
      <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
      </svg>
    </ActionButton>

      <!-- Modal de Upload -->
      <div
        v-if="showUpload"
        class="absolute bottom-full right-0 mb-2 w-96 bg-white rounded-lg shadow-2xl border border-gray-200 overflow-hidden z-50"
      >
        <!-- Header -->
        <div class="px-4 py-3 bg-gradient-to-r from-indigo-500 to-purple-600 text-white">
          <h3 class="font-semibold text-lg">Upload de Documento</h3>
          <p class="text-xs text-indigo-100 mt-1">Envie um PDF para o chatbot analisar</p>
        </div>

        <!-- Drop Zone -->
        <div
          @drop.prevent="handleDrop"
          @dragover.prevent="isDragging = true"
          @dragleave.prevent="isDragging = false"
          class="p-6 border-2 border-dashed rounded-lg m-4 transition-all"
          :class="isDragging 
            ? 'border-indigo-500 bg-indigo-50' 
            : 'border-gray-300 bg-gray-50'"
        >
          <div class="text-center">
            <svg class="w-12 h-12 mx-auto text-gray-400 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            
            <p class="text-sm text-gray-400 mb-2">
              Arraste um arquivo PDF aqui ou
            </p>
            
            <label class="cursor-pointer inline-flex items-center px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg transition-colors">
              <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
              Selecionar arquivo
              <input
                type="file"
                accept=".pdf"
                @change="handleFileSelect"
                class="hidden"
              />
            </label>
          </div>

          <!-- Preview do arquivo -->
          <div v-if="selectedFile" class="mt-4 p-3 bg-gray-50 rounded-lg border border-gray-200">
            <div class="flex items-center justify-between">
              <div class="flex items-center space-x-3">
                <svg class="w-8 h-8 text-red-500" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" />
                </svg>
                <div>
                  <p class="text-sm font-medium text-gray-900">{{ selectedFile.name }}</p>
                  <p class="text-xs text-gray-500">{{ formatFileSize(selectedFile.size) }}</p>
                </div>
              </div>
              <button
                @click="selectedFile = null"
                class="text-gray-500 hover:text-red-500 transition-colors"
              >
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        <!-- Status de Upload -->
        <div v-if="uploadStatus" class="px-4 pb-4">
          <div
            class="p-3 rounded-lg"
            :class="{
              'bg-blue-50 text-blue-700 border border-blue-200': uploadStatus === 'uploading',
              'bg-green-50 text-green-700 border border-green-200': uploadStatus === 'success',
              'bg-red-50 text-red-700 border border-red-200': uploadStatus === 'error'
            }"
          >
            <p class="text-sm font-medium">{{ uploadMessage }}</p>
            <div v-if="uploadStatus === 'uploading'" class="mt-2 w-full bg-gray-200 rounded-full h-2">
              <div class="bg-indigo-500 h-2 rounded-full animate-pulse" :style="`width: ${uploadProgress}%`"></div>
            </div>
          </div>
        </div>

        <!-- Botões de Ação -->
        <div class="px-4 pb-4 flex gap-2">
          <button
            @click="uploadDocument"
            :disabled="!selectedFile || uploadStatus === 'uploading'"
            class="flex-1 px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {{ uploadStatus === 'uploading' ? 'Enviando...' : 'Enviar' }}
          </button>
          <button
            @click="showUpload = false"
            class="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium transition-colors"
          >
            Fechar
          </button>
        </div>
      </div>
  </div>
</template>

<script setup lang="ts">
/**
 * DocumentUpload Component
 * 
 * Componente para upload de documentos PDF via drag & drop ou seleção de arquivo
 * Envia para o endpoint /api/ingest para processar e armazenar no Qdrant
 * 
 * @component
 * @example
 * <DocumentUpload />
 */

import { ref } from 'vue'

const showUpload = ref(false)
const isDragging = ref(false)
const selectedFile = ref<File | null>(null)
const uploadStatus = ref<'uploading' | 'success' | 'error' | null>(null)
const uploadMessage = ref('')
const uploadProgress = ref(0)

const handleDrop = (e: DragEvent) => {
  isDragging.value = false
  const files = e.dataTransfer?.files
  if (files && files.length > 0) {
    const file = files[0]
    if (file.type === 'application/pdf') {
      selectedFile.value = file
    } else {
      uploadStatus.value = 'error'
      uploadMessage.value = 'Por favor, selecione apenas arquivos PDF'
      setTimeout(() => {
        uploadStatus.value = null
      }, 3000)
    }
  }
}

const handleFileSelect = (e: Event) => {
  const target = e.target as HTMLInputElement
  if (target.files && target.files.length > 0) {
    selectedFile.value = target.files[0]
  }
}

const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}

const uploadDocument = async () => {
  if (!selectedFile.value) return

  uploadStatus.value = 'uploading'
  uploadMessage.value = 'Processando documento...'
  uploadProgress.value = 0

  try {
    const userId = localStorage.getItem('userId')
    console.log('[UPLOAD] Iniciando upload')
    console.log('[UPLOAD] API base:', useRuntimeConfig().public.apiBase)
    console.log('[UPLOAD] User ID:', userId || 'anonymous')

    // Converter arquivo para Base64
    const reader = new FileReader()
    const fileBase64Promise = new Promise((resolve, reject) => {
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          // Remover prefixo "data:application/pdf;base64,"
          const base64String = reader.result.split(',')[1]
          console.log('[UPLOAD] Base64 length:', base64String.length)
          resolve(base64String)
        } else {
          reject(new Error('Failed to convert file to base64'))
        }
      }
      reader.onerror = reject
      reader.readAsDataURL(selectedFile.value)
    })

    const base64Content = await fileBase64Promise

    // Preparar payload JSON
    const payload = {
      body: base64Content,
      userId: userId || undefined
    }
    console.log('[UPLOAD] Payload pronto. Enviando para /ingest')

    // Simular progresso
    const progressInterval = setInterval(() => {
      if (uploadProgress.value < 90) {
        uploadProgress.value += 10
      }
    }, 500)

    const response = await fetch(`${useRuntimeConfig().public.apiBase}/ingest`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload),
    })
    console.log('[UPLOAD] Status da resposta:', response.status)

    clearInterval(progressInterval)
    uploadProgress.value = 100

    if (response.ok) {
      uploadStatus.value = 'success'
      uploadMessage.value = 'Documento processado com sucesso! Agora você pode fazer perguntas sobre ele.'
      setTimeout(() => {
        selectedFile.value = null
        uploadStatus.value = null
        showUpload.value = false
      }, 3000)
    } else {
      throw new Error('Erro ao fazer upload')
    }
  } catch (error) {
    console.error('Erro no upload:', error)
    uploadStatus.value = 'error'
    uploadMessage.value = `Erro: ${error instanceof Error ? error.message : String(error)}`
    // Não limpar erro automaticamente para permitir leitura
    // setTimeout(() => {
    //   uploadStatus.value = null
    // }, 5000)
  }
}
</script>
