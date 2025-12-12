/**
 * PDF Ingestion Script for RAG Chatbot
 * 
 * This script processes PDF documents and ingests them into Qdrant vector database
 * using LangChain for document processing and OpenAI for embeddings generation.
 * 
 * Process Flow:
 * 1. Load PDF using LangChain's PDFLoader
 * 2. Split text into chunks using RecursiveCharacterTextSplitter
 * 3. Generate embeddings using OpenAI
 * 4. Store vectors in Qdrant collection
 * 
 * Usage:
 *   npm run ingest
 * 
 * Requirements:
 *   - PDF files in data/documents/ directory
 *   - OPENAI_API_KEY in environment
 *   - QDRANT_URL and QDRANT_API_KEY in environment
 * 
 * @module scripts/ingest
 */

import 'dotenv/config'
import { PDFLoader } from 'langchain/document_loaders/fs/pdf'
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter'
import { OpenAIEmbeddings } from '@langchain/openai'
import { QdrantVectorStore } from '@langchain/community/vectorstores/qdrant'
import { QdrantClient } from '@qdrant/js-client-rest'
import { readdir } from 'fs/promises'
import { join } from 'path'

/**
 * Configuration for the ingestion process
 */
const CONFIG = {
  pdfDirectory: './data/documents',
  collectionName: process.env.QDRANT_COLLECTION_NAME || 'rag-chatbot-documents',
  chunkSize: 1000,
  chunkOverlap: 200,
  qdrantUrl: process.env.QDRANT_URL || '',
  qdrantApiKey: process.env.QDRANT_API_KEY || '',
  openaiApiKey: process.env.OPENAI_API_KEY || ''
}

/**
 * Validates that all required environment variables are set
 * 
 * @throws {Error} If any required environment variable is missing
 */
function validateEnvironment(): void {
  const required = ['OPENAI_API_KEY', 'QDRANT_URL']
  const missing = required.filter(key => !process.env[key])
  
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`)
  }
}

/**
 * Gets list of PDF files from the documents directory
 * 
 * @returns {Promise<string[]>} Array of PDF file paths
 * @throws {Error} If no PDF files are found
 */
async function getPdfFiles(): Promise<string[]> {
  try {
    const files = await readdir(CONFIG.pdfDirectory)
    const pdfFiles = files
      .filter(file => file.toLowerCase().endsWith('.pdf'))
      .map(file => join(CONFIG.pdfDirectory, file))
    
    if (pdfFiles.length === 0) {
      throw new Error(`No PDF files found in ${CONFIG.pdfDirectory}`)
    }
    
    return pdfFiles
  } catch (error) {
    throw new Error(`Error reading PDF directory: ${error}`)
  }
}

/**
 * Loads and processes a PDF file using LangChain
 * 
 * @param {string} filePath - Path to the PDF file
 * @returns {Promise<Document[]>} Array of loaded documents
 */
async function loadPdf(filePath: string) {
  console.log(`📄 Loading PDF: ${filePath}`)
  
  const loader = new PDFLoader(filePath)
  const docs = await loader.load()
  
  console.log(`✓ Loaded ${docs.length} page(s) from PDF`)
  return docs
}

/**
 * Splits documents into smaller chunks for better retrieval
 * 
 * @param {Document[]} docs - Array of documents to split
 * @returns {Promise<Document[]>} Array of split document chunks
 */
async function splitDocuments(docs: any[]) {
  console.log(`✂️  Splitting documents into chunks...`)
  
  const textSplitter = new RecursiveCharacterTextSplitter({
    chunkSize: CONFIG.chunkSize,
    chunkOverlap: CONFIG.chunkOverlap
  })
  
  const splits = await textSplitter.splitDocuments(docs)
  
  console.log(`✓ Created ${splits.length} chunks`)
  return splits
}

/**
 * Initializes Qdrant client and creates collection if it doesn't exist
 * 
 * @returns {Promise<QdrantClient>} Configured Qdrant client
 */
async function initializeQdrant(): Promise<QdrantClient> {
  console.log(`🔗 Connecting to Qdrant...`)
  
  const client = new QdrantClient({
    url: CONFIG.qdrantUrl,
    apiKey: CONFIG.qdrantApiKey
  })
  
  // Check if collection exists
  try {
    await client.getCollection(CONFIG.collectionName)
    console.log(`✓ Collection '${CONFIG.collectionName}' exists`)
  } catch (error) {
    console.log(`Creating new collection '${CONFIG.collectionName}'...`)
    await client.createCollection(CONFIG.collectionName, {
      vectors: {
        size: 1536, // OpenAI embedding dimension
        distance: 'Cosine'
      }
    })
    console.log(`✓ Collection created`)
  }
  
  return client
}

/**
 * Stores document chunks in Qdrant with embeddings
 * 
 * @param {Document[]} documents - Array of document chunks to store
 * @param {QdrantClient} qdrantClient - Configured Qdrant client
 */
async function storeInQdrant(documents: any[], qdrantClient: QdrantClient) {
  console.log(`💾 Generating embeddings and storing in Qdrant...`)
  
  const embeddings = new OpenAIEmbeddings({
    openAIApiKey: CONFIG.openaiApiKey
  })
  
  await QdrantVectorStore.fromDocuments(
    documents,
    embeddings,
    {
      client: qdrantClient,
      collectionName: CONFIG.collectionName
    }
  )
  
  console.log(`✓ Stored ${documents.length} chunks in Qdrant`)
}

/**
 * Main ingestion function
 * Orchestrates the entire PDF to Qdrant pipeline
 * 
 * @throws {Error} If any step in the process fails
 */
async function ingestPDF(): Promise<void> {
  console.log('🚀 Starting PDF ingestion process...\n')
  
  try {
    // Validate environment
    validateEnvironment()
    
    // Get PDF files
    const pdfFiles = await getPdfFiles()
    console.log(`Found ${pdfFiles.length} PDF file(s)\n`)
    
    // Initialize Qdrant
    const qdrantClient = await initializeQdrant()
    console.log('')
    
    // Process each PDF
    for (const pdfFile of pdfFiles) {
      // Load PDF using LangChain
      const docs = await loadPdf(pdfFile)
      
      // Split into chunks
      const chunks = await splitDocuments(docs)
      
      // Store in Qdrant
      await storeInQdrant(chunks, qdrantClient)
      
      console.log(`\n✅ Successfully processed: ${pdfFile}\n`)
    }
    
    console.log('🎉 Ingestion complete!')
    
  } catch (error) {
    console.error('❌ Ingestion failed:', error)
    throw error
  }
}

// Execute if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  ingestPDF().catch(error => {
    console.error('Fatal error:', error)
    process.exit(1)
  })
}

export { ingestPDF }
