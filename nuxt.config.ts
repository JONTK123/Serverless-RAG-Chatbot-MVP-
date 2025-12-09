// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  devtools: { enabled: true },
  
  modules: [
    '@nuxtjs/tailwindcss'
  ],

  css: ['~/assets/css/main.css'],

  app: {
    head: {
      title: 'RAG Chatbot MVP',
      meta: [
        { charset: 'utf-8' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        { name: 'description', content: 'Serverless RAG Chatbot with Nuxt 3 and LangChain' }
      ]
    }
  },

  // Configuração de runtime para variáveis de ambiente
  runtimeConfig: {
    // Variáveis privadas (apenas servidor)
    openaiApiKey: process.env.OPENAI_API_KEY,
    qdrantUrl: process.env.QDRANT_URL,
    qdrantApiKey: process.env.QDRANT_API_KEY,
    qdrantCollectionName: process.env.QDRANT_COLLECTION_NAME || 'rag-chatbot-documents',
    
    // Variáveis públicas (cliente + servidor)
    public: {
      apiBase: process.env.API_BASE_URL || '/api'
    }
  },

  // Configuração de Nitro para AWS Lambda
  nitro: {
    preset: 'aws-lambda',
    serveStatic: true,
    inlineDynamicImports: true
  },

  compatibilityDate: '2024-12-08'
})
