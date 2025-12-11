/**
 * Ingest API Endpoint
 * 
 * Endpoint for uploading and processing PDF documents.
 * Receives PDF files encoded in base64, extracts text, splits into chunks, 
 * generates embeddings, and stores vectors in Qdrant for semantic search.
 * 
 * @module server/api/ingest
 * 
 * Request:
 * @param {string} body - PDF file encoded in base64
 * @param {string} userId - Optional user identifier for tracking
 * 
 * Response:
 * @returns {Object} JSON response with processing results -> This avoids returning in html from SSR of Nuxt
 * @returns {boolean} success - Whether the processing succeeded
 * @returns {string} message - Success or error message
 * @returns {number} chunks - Number of chunks created from the document
 * @returns {string} documentId - Unique identifier for the processed document
 * 
 * @example
 * POST /api/ingest
 * Content-Type: application/json
 * 
 * {
 *   "body": "JVBERi0xLjcNCiW1tbW1DQoxIDAgb2JqDQo8PC...",
 *   "userId": "user-123"
 * }
 * 
 * @note HTTP API Gateway automatically encodes binary data in base64.
 *       To work around this, we explicitly expect base64-encoded PDFs in JSON.
 *       This is the recommended approach per AWS documentation and StackOverflow.
 *       See: https://stackoverflow.com/questions/57121011/how-can-i-post-a-pdf-to-aws-lambda
 */

import { defineEventHandler, readBody, setResponseHeader } from 'h3'
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter'
import { OpenAIEmbeddings } from '@langchain/openai'
import { QdrantClient } from "@qdrant/js-client-rest"
import pdfParse from 'pdf-parse'
import { v4 as uuidv4 } from 'uuid'

// POST method -> Accessed via /api/ingest.post.ts by url
// Await similar to FastAPI
// Event is similar to Request object in FastAPI(ASGI) -> body, headers, etc.
export default defineEventHandler(async (event) => {
  // CORS
  setResponseHeader(event, 'Access-Control-Allow-Origin', '*')
  setResponseHeader(event, 'Access-Control-Allow-Methods', 'POST, OPTIONS')
  setResponseHeader(event, 'Access-Control-Allow-Headers', 'Content-Type')
  // Force JSON response (prevents SSR from rendering HTML)
  setResponseHeader(event, 'Content-Type', 'application/json')
  
  try {
    console.log('[INGEST] Starting PDF ingestion process')
    
    // Get runtime configuration (environment variables)
    const config = useRuntimeConfig()
    
    // Initialize Qdrant client to store vectors
    const qdrant = new QdrantClient({
      url: config.qdrantUrl,
      apiKey: config.qdrantApiKey
    })
    const collectionName = config.qdrantCollectionName
    console.log('[INGEST] Qdrant client initialized, collection:', collectionName)
    
    // Read body as JSON ex:
    // {
    //   "body": "JVBERi0xLjc...",
    //   "userId": "user-123"
    // }
    const jsonBody = await readBody(event)
    console.log('[INGEST] Request body received')
    
    // Validate presence of "body" field with PDF in base64
    if (!jsonBody.body) {
      console.error('[INGEST] Error: Missing "body" field in JSON')
      return {
        success: false,
        message: 'No "body" field found in JSON. Expected format: { "body": "<base64-pdf>", "userId": "optional" }'
      }
    }
    
    // Extract PDF in base64 and userId
    const pdf64 = jsonBody.body
    const userId: string | undefined = jsonBody.userId
    
    console.log('[INGEST] Base64 string length:', pdf64.length, 'characters')
    console.log('[INGEST] User ID:', userId || 'anonymous')
    
    // Decode base64 to Buffer (binary)
    // pdfBuffer outside of try/catch to be accessed outside of the try/catch block
    let pdfBuffer: Buffer
    try {
      pdfBuffer = Buffer.from(pdf64, 'base64')
      console.log('[INGEST] ✓ PDF decoded successfully, buffer size:', pdfBuffer.length, 'bytes')
    } catch (error) {
      console.error('[INGEST] Error: Failed to decode base64 string')
      return {
        success: false,
        message: 'Failed to decode base64 string',
        error: error instanceof Error ? error.message : String(error)
      }
    }
    
    // ========================================================================
    // [FIRST ATTEMPT - COMMENTED] Multipart/form-data (DOES NOT WORK WITH HTTP API)
    // ========================================================================
    // 
    // IDENTIFIED PROBLEM:
    // - Gateway encodes multipart in base64 automatically
    // - h3's readMultipartFormData does not decode correctly
    // - Result: Corrupted buffer (650893 bytes instead of 373035)
    // - Extracted text: only 10 characters instead of 7516
    //
    // else {
    //   console.log('Processing multipart/form-data request')
    //   const body = await readMultipartFormData(event)
    //
    //   if (!body || body.length === 0) {
    //     return {
    //       success: false,
    //       message: 'No file uploaded'
    //     }
    //   }
    //
    //   const filePart = body.find(part => part.name === 'file')
    //
    //   if (!filePart) {
    //     return {
    //       success: false,
    //       message: 'No file field found'
    //     }
    //   }
    //
    //   // Validate file type
    //   if (filePart.type !== 'application/pdf') {
    //     return {
    //       success: false,
    //       message: 'Invalid file type. Please upload a PDF document.'
    //     }
    //   }
    //   
    //   pdfBuffer = Buffer.isBuffer(filePart.data) ? filePart.data : Buffer.from(filePart.data)
    //   
    //   const userIdPart = body.find(part => part.name === 'userId')
    //   userId = userIdPart ? userIdPart.data.toString() : undefined
    //   
    //   console.log('Multipart PDF buffer size:', pdfBuffer.length)
    // }
    // ========================================================================
    
    // Extract text from PDF using pdf-parse (directly from buffer)
    console.log('[INGEST] Starting PDF parsing...')
    let text: string
    try {      
      const pdfData = await pdfParse(pdfBuffer, { max: 0 })
      text = pdfData.text
      console.log('[INGEST] ✓ PDF parsed successfully')
      console.log('[INGEST]   - Pages:', pdfData.numpages)
      console.log('[INGEST]   - Extracted text length:', text.length, 'characters')
    } catch (pdfError) {
      console.error('[INGEST] Error: PDF parsing failed:', pdfError)
      return {
        success: false,
        message: 'Error parsing PDF file',
        error: pdfError instanceof Error ? pdfError.message : String(pdfError)
      }
    }

    // Split text into chunks
    console.log('[INGEST] Starting text chunking...')
    const textSplitter = new RecursiveCharacterTextSplitter({ 
      chunkSize: 1000,
      chunkOverlap: 200
    })
    const chunks = await textSplitter.splitText(text)
    console.log('[INGEST] ✓ Text split into', chunks.length, 'chunks')

    // Generate embeddings using OpenAI
    console.log('[INGEST] Starting embeddings generation...')
    const embeddings = new OpenAIEmbeddings({
      openAIApiKey: config.openaiApiKey
    })

    // Generate vectors for all chunks (batch)
    const vectors = await embeddings.embedDocuments(chunks)
    console.log('[INGEST] ✓ Generated', vectors.length, 'embeddings (1536 dimensions each)')
    
    // Generate unique ID for the document
    const documentId = `${userId || 'anon'}-${Date.now()}`
    console.log('[INGEST] Document ID:', documentId)
    
    // Create points to insert into Qdrant
    console.log('[INGEST] Preparing points for Qdrant...')
    const points = chunks.map((chunk, idx) => ({
      id: uuidv4(), // unique ID: UUID required by Qdrant
      vector: vectors[idx], // embedding vector of the chunk
      payload: {
        text: chunk, // original text of the chunk
        documentId, // parent document ID
        userId, // user ID (tracking)
        chunkIndex: idx // index of the chunk in the document
      }
    }))
    
    // Insert points into Qdrant (upsert = insert or update if exists)
    console.log('[INGEST] Uploading', points.length, 'points to Qdrant collection:', collectionName)
    await qdrant.upsert(collectionName, { points })
    console.log('[INGEST] ✓ Successfully upserted all points to Qdrant')
    
    console.log('[INGEST] ✅ Ingestion completed successfully!')
    return {
      success: true,
      message: 'PDF processed and chunks saved in Qdrant!',
      chunks: points.length,
      documentId,
      userId
    }
  } catch (error) {
    console.error('[INGEST] ❌ Unexpected error:', error)
    return {
      success: false,
      message: 'Error processing file upload',
      error: error instanceof Error ? error.message : String(error)
    }
  }
})
