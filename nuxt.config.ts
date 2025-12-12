// 1. API-ONLY MODE - Lambda backend + local frontend
//    - Nitro configured only for API with streaming
//    - Frontend runs locally
//    - API_BASE_URL points to the deployed Lambda
//
// 2. FULL-STACK MODE (COMMENTED) - Frontend + Backend on Lambda
//    - Full SSR build for Lambda
//    - Frontend and Backend together
//    - Enable by uncommenting the section and disabling API-only

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

  // Runtime configuration for environment variables
  runtimeConfig: {
    // Private variables (server only)
    openaiApiKey: process.env.OPENAI_API_KEY,
    qdrantUrl: process.env.QDRANT_URL,
    qdrantApiKey: process.env.QDRANT_API_KEY,
    qdrantCollectionName: process.env.QDRANT_COLLECTION_NAME || 'rag-chatbot-documents',
    
    // Public variables (client + server)
    public: {
      // Local frontend: use Lambda URL via API_BASE_URL
      // Full-stack: use relative /api
      apiBase: process.env.API_BASE_URL || '/api'
    }
  },

  // MODE 1: API-ONLY (ACTIVE) - Lambda backend with streaming
  // Disable SSR for API-only, except in local development
  ssr: process.env.NODE_ENV === 'development',
  
  nitro: {
    preset: 'aws-lambda',
    
    // API-only: no static assets (except in dev)
    serveStatic: process.env.NODE_ENV === 'development',
    
    // Aggressive size optimizations
    // Inline to reduce bundle size
    inlineDynamicImports: true,
    
    // Minify to reduce size
    minify: true,
    
    // Remove source maps from server bundle
    sourceMap: false,
    
    // Compile only API routes (no SSR)
    prerender: {
      crawlLinks: false,
      routes: []
    },
    
    // Force Rollup to be aggressive
    rollupConfig: {
      // Tree-shake must be at rollupConfig root, not inside output
      treeshake: {
        propertyReadSideEffects: false,
        tryCatchDeoptimization: false,
        moduleSideEffects: false
      },
      output: {
        format: 'esm',
        // Remove inline sourcemaps
        sourcemap: false
      }
    }
  },

  // MODE 2: FULL-STACK (COMMENTED) - Frontend + Backend on Lambda
  // 
  // To enable: uncomment this section and disable MODE 1 above
  // 
  // nitro: {
  //   preset: 'aws-lambda',
  //   
  //   // Full-stack: serve static assets (CSS, JS, images)
  //   serveStatic: true,
  //   
  //   // Inline to reduce bundle size
  //   inlineDynamicImports: true,
  //   
  //   // Minify to reduce size
  //   minify: true,
  //   
  //   // Pre-render static routes if needed
  //   prerender: {
  //     crawlLinks: false,
  //     routes: ['/']  // Homepage can be pre-rendered
  //   }
  // },

  compatibilityDate: '2024-12-08'
})
