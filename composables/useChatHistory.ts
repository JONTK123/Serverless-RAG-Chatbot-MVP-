/**
 * Chat History Composable
 * 
 * Manages chat message history using browser LocalStorage for persistence.
 * Provides functionality to add, retrieve, and clear messages, as well as
 * manage a unique session ID for the user.
 * 
 * Features:
 * - Automatic persistence to LocalStorage
 * - Session ID generation and storage
 * - Message history management
 * - Reactive state updates
 * 
 * @module useChatHistory
 * @example
 * const { messages, addMessage, clearHistory, sessionId } = useChatHistory()
 */

import { ref, watch, onMounted } from 'vue'
import { v4 as uuidv4 } from 'uuid'

const STORAGE_KEY = 'rag-chatbot-messages'
const SESSION_ID_KEY = 'rag-chatbot-session-id'

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  timestamp: number
}

/**
 * Composable for managing chat history with LocalStorage persistence
 * 
 * @returns {Object} Chat history management functions and state
 * @returns {Ref<ChatMessage[]>} messages - Reactive array of chat messages
 * @returns {Function} addMessage - Function to add a new message
 * @returns {Function} clearHistory - Function to clear all messages
 * @returns {Ref<string>} sessionId - Unique session identifier
 */
export const useChatHistory = () => {
  const messages = ref<ChatMessage[]>([])
  const sessionId = ref<string>('')

  /**
   * Loads messages from LocalStorage
   * Parses stored JSON data and populates the messages array
   */
  const loadMessages = () => {
    if (process.client) {
      try {
        const stored = localStorage.getItem(STORAGE_KEY)
        if (stored) {
          messages.value = JSON.parse(stored)
        }
      } catch (error) {
        console.error('Error loading messages from localStorage:', error)
        messages.value = []
      }
    }
  }

  /**
   * Saves current messages to LocalStorage
   * Serializes messages array to JSON format
   */
  const saveMessages = () => {
    if (process.client) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(messages.value))
      } catch (error) {
        console.error('Error saving messages to localStorage:', error)
      }
    }
  }

  /**
   * Loads or generates a session ID
   * Creates a new UUID if one doesn't exist in LocalStorage
   */
  const loadOrCreateSessionId = () => {
    if (process.client) {
      try {
        let stored = localStorage.getItem(SESSION_ID_KEY)
        if (!stored) {
          stored = uuidv4()
          localStorage.setItem(SESSION_ID_KEY, stored)
        }
        sessionId.value = stored
      } catch (error) {
        console.error('Error with session ID:', error)
        sessionId.value = uuidv4()
      }
    }
  }

  /**
   * Adds a new message to the chat history
   * 
   * @param {ChatMessage} message - The message object to add
   * @param {('user'|'assistant')} message.role - The role of the sender
   * @param {string} message.content - The message content
   * @param {number} message.timestamp - Unix timestamp
   */
  const addMessage = (message: ChatMessage) => {
    messages.value.push(message)
    saveMessages()
  }

  /**
   * Clears all messages from history and LocalStorage
   * Resets the messages array to empty
   */
  const clearHistory = () => {
    messages.value = []
    if (process.client) {
      try {
        localStorage.removeItem(STORAGE_KEY)
      } catch (error) {
        console.error('Error clearing localStorage:', error)
      }
    }
  }

  // Watch for changes and auto-save
  watch(messages, saveMessages, { deep: true })

  // Initialize on mount
  onMounted(() => {
    loadMessages()
    loadOrCreateSessionId()
  })

  return {
    messages,
    addMessage,
    clearHistory,
    sessionId
  }
}
