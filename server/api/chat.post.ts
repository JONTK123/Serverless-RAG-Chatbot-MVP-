/**
 * Chat API Endpoint (Streaming)
 * 
 * Endpoint for conversational chat with RAG (Retrieval-Augmented Generation).
 * Receives user questions, searches Qdrant for relevant document chunks using semantic similarity,
 * and generates streaming responses using OpenAI GPT models via LangChain.
 * 
 * @module server/api/chat
 * 
 * Request:
 * @param {string} question - User's question/message
 * @param {Array<{role: string, content: string}>} history - Optional conversation history for context
 * @param {string} userId - Optional user identifier for tracking (can also be sent via x-user-id header)
 * 
 * Response:
 * @returns {ReadableStream} Streaming response with text chunks -> Content-Type: text/event-stream
 * @returns {Object} JSON error response if request fails -> Content-Type: application/json
 * 
 * @example
 * POST /api/chat
 * Content-Type: application/json
 * x-user-id: user-123
 * 
 * {
 *   "question": "Qual é o conteúdo do documento?",
 *   "history": [
 *     { "role": "user", "content": "Pergunta anterior" },
 *     { "role": "assistant", "content": "Resposta anterior" }
 *   ],
 *   "userId": "user-123"
 * }
 * 
 * Response (Streaming):
 * Content-Type: text/event-stream
 * 
 * [Streaming de texto em tempo real]
 * 
 * @note This endpoint uses:
 *       - LangChain for OpenAI embeddings (semantic search) and chat model (streaming)
 *       - Qdrant for vector similarity search to retrieve relevant document chunks
 *       - Streaming response via ReadableStream for real-time token delivery
 *       - CORS headers are set to allow cross-origin requests from frontend
 */

import {
  defineEventHandler,
  readBody,
  setResponseHeader,
  getRequestHeader,
  setResponseStatus
} from 'h3'
import { ChatOpenAI, OpenAIEmbeddings } from '@langchain/openai'
import { HumanMessage, AIMessage, SystemMessage } from 'langchain/schema'
import { QdrantClient } from '@qdrant/js-client-rest'

export default defineEventHandler(async (event) => {
  setResponseHeader(event, 'Access-Control-Allow-Origin', '*')
  setResponseHeader(event, 'Access-Control-Allow-Methods', 'POST, OPTIONS')
  setResponseHeader(event, 'Access-Control-Allow-Headers', 'Content-Type, x-user-id')

  // Streaming headers
  setResponseHeader(event, 'Content-Type', 'text/event-stream')
  setResponseHeader(event, 'Cache-Control', 'no-cache')
  setResponseHeader(event, 'Connection', 'keep-alive')
  setResponseHeader(event, 'X-Accel-Buffering', 'no')

  // Handle Preflight OPTIONS request immediately (Function URL specific)
  if (event.method === 'OPTIONS') {
    setResponseStatus(event, 204) // success but no content
    return null
  }

  try {
    console.log('[CHAT] Starting chat request processing')

    const config = useRuntimeConfig()

    const collectionName = config.qdrantCollectionName

    console.log('[CHAT] Initializing Qdrant client, collection:', collectionName)
    const qdrant = new QdrantClient({
      url: config.qdrantUrl,
      apiKey: config.qdrantApiKey
    })

    console.log('[CHAT] Initializing OpenAI embeddings')
    const embeddings = new OpenAIEmbeddings({
      openAIApiKey: config.openaiApiKey
    })

    // Generics <{...}> -> type safety for the body
    const body = await readBody<{
      question?: string
      history?: Array<{ role: string; content: string }> // Dict array
      userId?: string
    }>(event)

    const question = body?.question?.trim()
    const history = body.history || []
    const userId = body?.userId || 'anon'

    if (!question) {
      console.error('[CHAT] Error: Missing question in request body')
      setResponseHeader(event, 'Content-Type', 'application/json')
      return { success: false, message: 'Missing "question" in request body.' }
    }

    console.log('[CHAT] User ID:', userId)
    console.log('[CHAT] Question:', question)
    console.log('[CHAT] History length:', history.length, 'messages')

    // Streaming configurations
    const encoder = new TextEncoder()

    const stream = new ReadableStream({
      async start(controller) {
        try {
          // Ex: "Qual é o conteúdo do documento?" -> [0.1, 0.2, 0.3, ... 1536 numbers]
          console.log('[CHAT] Generating query embedding for search')
          const queryVector = await embeddings.embedQuery(question)
          console.log('[CHAT] ✓ Query embedding generated (1536 dimensions)')

          // Ex: [0.1, 0.2, 0.3, ... 1536 numbers] -> [0.1, 0.2, 0.3, ... 1536 numbers]
          // Cosine similarity between vector and vectors in Qdrant
          console.log('[CHAT] Searching Qdrant for relevant contexts...')
          const searchResults = await qdrant.search(collectionName, {
            vector: queryVector,
            limit: 4,
            with_payload: true
          })

              // Process search results into simple text
              // map
          const contextTexts = searchResults
            .map((hit) => {
              const payload = hit.payload as { text?: string } // transform the payload into a dictionary of text
              return payload.text // text property of the payload
            })
            .filter(Boolean) // Filter out empty strings ( '', null, undefined )
          
          if (contextTexts.length === 0) {
            console.warn('[CHAT] ⚠️ No relevant contexts found in Qdrant - model will respond with "no information found"')
          } else {
            console.log('[CHAT] Context preview (first chunk):', contextTexts[0].substring(0, 100) + '...')
          }

          console.log('[CHAT] Preparing conversation history...')
          const historyMessages = history
            .map((msg) => {
              if (msg.role === 'user') return new HumanMessage(msg.content)
              if (msg.role === 'assistant') return new AIMessage(msg.content)
              return null
            })
            .filter(Boolean) // Filter out null values
          console.log('[CHAT] ✓ Converted', historyMessages.length, 'history messages')

          console.log('[CHAT] Building system prompt with context...')
          const systemPrompt = contextTexts.length > 0
            ? [
                'Você é um assistente RAG (Retrieval-Augmented Generation).',
                'O usuário carregou documentos (PDFs) que foram processados e salvos em um banco de dados vetorial.',
                'IMPORTANTE: Você TEM acesso ao conteúdo desses documentos através do contexto fornecido abaixo.',
                'Seu trabalho é responder perguntas sobre esses documentos usando APENAS o contexto fornecido.',
                'Se a pergunta for genérica como "sobre o que é o documento?" ou "me fale sobre ele", ',
                'faça um resumo do conteúdo baseado no contexto disponível.',
                '',
                'REGRAS:',
                '- Use APENAS as informações do contexto abaixo',
                '- Se o contexto não tiver informação suficiente para responder, diga isso claramente',
                '- Não invente ou assuma informações que não estão no contexto',
                '- Seja direto e objetivo nas respostas',
                '',
                `CONTEXTO DOS DOCUMENTOS:\n${contextTexts.join('\n---\n')}`,
                '',
                `User ID (tracking): ${userId}`
              ].join('\n')
            : [
                'Você é um assistente RAG (Retrieval-Augmented Generation).',
                'ATENÇÃO: Nenhum documento foi encontrado no banco de dados para esta pergunta.',
                'Possíveis causas:',
                '- Nenhum documento foi carregado ainda',
                '- A pergunta não está relacionada com o conteúdo dos documentos carregados',
                '- Houve um problema na busca vetorial',
                '',
                'Informe ao usuário que não há documentos disponíveis ou que a pergunta não corresponde ao conteúdo carregado.',
                'Sugira que o usuário carregue um documento ou refaça a pergunta de forma mais específica.',
                '',
                `User ID (tracking): ${userId}`
              ].join('\n')

          const messages = [
            new SystemMessage(systemPrompt),
            ...historyMessages,
            new HumanMessage(question)
          ]
          console.log('[CHAT] ✓ System prompt built with', messages.length, 'total messages')

          console.log('[CHAT] Initializing OpenAI model (gpt-4.1-nano) with streaming...')
          const model = new ChatOpenAI({
            modelName: 'gpt-4.1-nano',
            streaming: true,
            modelKwargs: {
              max_completion_tokens: 400
            },
            openAIApiKey: config.openaiApiKey
          })

          console.log('[CHAT] Starting LLM streaming...')
          const llmStream = await model.stream(messages)

          let emitted = false
          let chunkCount = 0
          for await (const chunk of llmStream) {
            // chunk.content pode ser string ou array (OpenAI v4 multi-part)
            const raw =
              (chunk as any)?.content ??
              (chunk as any)?.message?.content ??
              ''
            const token = Array.isArray(raw)
              ? raw.map((p: any) => p?.text ?? '').join('')
              : raw

            if (token && token.length > 0) {
              emitted = true
              chunkCount++
              controller.enqueue(encoder.encode(token))
            }
          }

          if (emitted) {
            console.log('[CHAT] ✅ Streaming completed successfully -', chunkCount, 'chunks sent')
          } else {
            console.warn('[CHAT] ⚠️ No chunks emitted by LLM - possible causes:')
            console.warn('[CHAT]    - OpenAI API error (check API key/quota)')
            console.warn('[CHAT]    - Content filtering triggered')
            console.warn('[CHAT]    - Network/timeout issue')
            console.warn('[CHAT]    - Empty context (Qdrant returned no results)')
            const fallbackMessage = contextTexts.length === 0
              ? 'Nenhum contexto relevante foi encontrado no banco de dados para responder sua pergunta. Por favor, verifique se o documento foi carregado corretamente.'
              : 'Não foi possível gerar uma resposta no momento. Por favor, tente reformular sua pergunta ou tente novamente em alguns instantes.'
            controller.enqueue(encoder.encode(fallbackMessage))
          }

          controller.close()
        } catch (err) {
          console.error('[CHAT] ❌ Error during streaming:', err)
          console.error('[CHAT] Error details:', {
            name: (err as any)?.name,
            message: (err as any)?.message,
            stack: (err as any)?.stack?.split('\n').slice(0, 3).join('\n')
          })
          const message =
            (err as any)?.message ||
            'Erro ao processar a resposta do modelo.'
          controller.enqueue(encoder.encode(`ERRO: ${message}`))
          controller.close()
        }
      }
    })

    return stream
  } catch (error) {
    console.error('[CHAT] ❌ Unexpected error in chat endpoint:', error)
    setResponseHeader(event, 'Content-Type', 'application/json')
    return {
      success: false,
      message: 'Error processing chat request',
      error: error instanceof Error ? error.message : String(error)
    }
  }
})

