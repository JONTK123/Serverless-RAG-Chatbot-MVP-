// =============================================================================
// NUXT CONFIGURATION - RAG CHATBOT MVP
// =============================================================================
// 
// DOIS MODOS DISPONÍVEIS:
// 
// 1. API-ONLY MODE (ATIVO) - Backend Lambda + Frontend Docker Local
//    - Nitro configurado apenas para API com streaming
//    - Frontend roda localmente via Docker
//    - API_BASE_URL aponta para Lambda Function URL
// 
// 2. FULL-STACK MODE (COMENTADO) - Frontend + Backend juntos no Lambda
//    - Build completo SSR para Lambda
//    - Frontend e Backend juntos
//    - Ativar descomentando a seção e comentando API-only
// 
// =============================================================================

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
      // Em Docker local: usa Lambda URL
      // Em Full-stack: usa /api relativo
      apiBase: process.env.API_BASE_URL || '/api'
    }
  },

  // ===========================================================================
  // MODO 1: API-ONLY (ATIVO) - Backend Lambda com Streaming OTIMIZADO
  // ===========================================================================
  
  // Desabilitar SSR para API pura (sem renderização de frontend)
  ssr: false,
  
  nitro: {
    preset: 'aws-lambda',
    
    // API-only: não precisa servir assets estáticos
    serveStatic: false,
    
    // 🔥 OTIMIZAÇÕES AGRESSIVAS PARA REDUZIR TAMANHO
    
    // Inline para reduzir tamanho do bundle
    inlineDynamicImports: true,
    
    // Minificar para otimizar tamanho
    minify: true,
    
    // Remover mapas de fonte do server bundle
    sourceMap: false,
    
    // Compilar apenas rotas de API (sem SSR)
    prerender: {
      crawlLinks: false,
      routes: []
    },
    
    // 🔥 Forçar Rollup a ser agressivo
    rollupConfig: {
      // Tree-shake deve ficar no nível raiz do rollupConfig, não dentro de output
      treeshake: {
        propertyReadSideEffects: false,
        tryCatchDeoptimization: false,
        moduleSideEffects: false
      },
      output: {
        format: 'esm',
        // Remover inline de sourcemaps
        sourcemap: false
      }
    }
  },

  // ===========================================================================
  // MODO 2: FULL-STACK (COMENTADO) - Frontend + Backend no Lambda
  // ===========================================================================
  // 
  // Para ativar: descomente esta seção e comente a seção MODO 1 acima
  // 
  // nitro: {
  //   preset: 'aws-lambda',
  //   
  //   // Full-stack: servir assets estáticos (CSS, JS, imagens)
  //   serveStatic: true,
  //   
  //   // Inline para reduzir tamanho do bundle
  //   inlineDynamicImports: true,
  //   
  //   // Minificar para otimizar tamanho
  //   minify: true,
  //   
  //   // Pré-renderizar rotas estáticas se necessário
  //   prerender: {
  //     crawlLinks: false,
  //     routes: ['/']  // Homepage pode ser pré-renderizada
  //   }
  // },

  compatibilityDate: '2024-12-08'
})
