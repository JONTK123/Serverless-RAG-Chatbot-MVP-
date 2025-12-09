/**
 * Logging Middleware
 * 
 * Server middleware for logging incoming requests and responses.
 * Useful for debugging and monitoring API usage.
 * 
 * @module server/middleware/logging
 * 
 * Features:
 * - Logs request method and URL
 * - Tracks request duration
 * - Can be extended for error logging
 * 
 * @example
 * // Automatically applied to all server routes
 * // Logs appear in server console
 */

export default defineEventHandler((event) => {
  const startTime = Date.now()
  const { method, url } = event.node.req
  
  // Log incoming request
  console.log(`[${new Date().toISOString()}] ${method} ${url}`)
  
  // Optional: Add response logging
  // event.node.res.on('finish', () => {
  //   const duration = Date.now() - startTime
  //   console.log(`[${new Date().toISOString()}] ${method} ${url} - ${duration}ms`)
  // })
})
