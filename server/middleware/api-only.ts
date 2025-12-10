/**
 * API-Only Middleware
 * 
 * Garante que apenas rotas /api/* funcionem, bloqueando completamente
 * o SSR do frontend na Lambda.
 * 
 * Qualquer requisição para rotas não-API retorna 404.
 */

export default defineEventHandler((event) => {
  const path = event.path || event.node.req.url || ''
  
  // Permitir apenas rotas /api/*
  if (!path.startsWith('/api/')) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Not Found',
      message: 'API-only mode. Frontend runs locally in Docker. Only /api/* routes are available.'
    })
  }
})
