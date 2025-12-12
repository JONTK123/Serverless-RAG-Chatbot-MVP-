/**
 * API-Only Middleware
 *
 * Global CORS + bloqueio de rotas não /api.
 */

import {
  defineEventHandler,
  setResponseHeader,
  setResponseStatus,
  getMethod
} from 'h3'

export default defineEventHandler((event) => {
  // 1. Global CORS handling (Essential for Lambda accessed from local/different domains)
  setResponseHeader(event, 'Access-Control-Allow-Origin', '*')
  setResponseHeader(event, 'Access-Control-Allow-Methods', 'GET, HEAD, POST, PUT, DELETE, CONNECT, OPTIONS, TRACE, PATCH')
  setResponseHeader(event, 'Access-Control-Allow-Headers', 'Content-Type, Authorization, x-user-id')
  setResponseHeader(event, 'Access-Control-Max-Age', '86400')

  // Handle Preflight OPTIONS request immediately
  if (getMethod(event) === 'OPTIONS') {
    setResponseStatus(event, 204)
    return null
  }

  // Skip strict API checks in local development
  if (process.env.NODE_ENV === 'development') {
    return
  }

  const path = event.path || event.node.req.url || ''
  
  // 2. Block non-API routes
  // Allow only /api/*
  if (!path.startsWith('/api/')) {
    // Return JSON error directly to avoid triggering the Vue Renderer (which crashes on Lambda)
    setResponseStatus(event, 404)
    return {
      statusCode: 404,
      statusMessage: 'Not Found',
      message: 'API-only mode. Frontend runs locally in Docker. Only /api/* routes are available.'
    }
  }
})
