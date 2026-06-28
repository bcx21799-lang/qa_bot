import React, { useState, useRef, useEffect, useCallback } from 'react'
import { sendChatMessage, newConversation } from './services/difyApi'
import MessageList from './components/MessageList'
import ChatInput from './components/ChatInput'
import Header from './components/Header'

export default function App() {
  const [messages, setMessages] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const [streamingContent, setStreamingContent] = useState('')
  const abortControllerRef = useRef(null)
  const messagesEndRef = useRef(null)

  // 自动滚动到底部
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages, streamingContent, scrollToBottom])

  // 发送消息
  const handleSend = useCallback(async (query) => {
    if (!query.trim() || isLoading) return

    // 添加用户消息
    const userMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: query,
      timestamp: Date.now(),
    }

    setMessages(prev => [...prev, userMessage])
    setIsLoading(true)
    setStreamingContent('')

    let currentAnswer = ''
    let currentConversationId = ''

    try {
      abortControllerRef.current = await sendChatMessage(
        query,
        {},
        {
          onMessage: ({ answer, conversationId }) => {
            currentAnswer = answer
            currentConversationId = conversationId
            setStreamingContent(answer)
          },
          onComplete: ({ answer, conversationId, metadata }) => {
            const assistantMessage = {
              id: (Date.now() + 1).toString(),
              role: 'assistant',
              content: answer,
              conversationId: conversationId,
              metadata: metadata,
              timestamp: Date.now(),
            }
            setMessages(prev => [...prev, assistantMessage])
            setStreamingContent('')
            setIsLoading(false)
          },
          onError: (error) => {
            console.error('发送消息失败:', error)
            const errorMessage = {
              id: (Date.now() + 1).toString(),
              role: 'assistant',
              content: `抱歉，请求出错了：${error.message}`,
              isError: true,
              timestamp: Date.now(),
            }
            setMessages(prev => [...prev, errorMessage])
            setStreamingContent('')
            setIsLoading(false)
          },
        }
      )
    } catch (error) {
      console.error('发送消息失败:', error)
      const errorMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: `抱歉，发生了错误：${error.message}`,
        isError: true,
        timestamp: Date.now(),
      }
      setMessages(prev => [...prev, errorMessage])
      setStreamingContent('')
      setIsLoading(false)
    }
  }, [isLoading])

  // 停止生成
  const handleStop = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      abortControllerRef.current = null
    }

    // 保存当前流式内容到消息列表
    if (streamingContent) {
      const assistantMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: streamingContent + '\n\n*[已停止生成]*',
        timestamp: Date.now(),
      }
      setMessages(prev => [...prev, assistantMessage])
    }

    setStreamingContent('')
    setIsLoading(false)
  }, [streamingContent])

  // 新建会话
  const handleNewChat = useCallback(() => {
    if (isLoading && abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
    newConversation()
    setMessages([])
    setStreamingContent('')
    setIsLoading(false)
  }, [isLoading])

  return (
    <div className="app">
      <Header onNewChat={handleNewChat} />
      <main className="main-content">
        <div className="chat-container">
          {messages.length === 0 && !streamingContent ? (
            <div className="welcome-screen">
              <div className="welcome-icon">🤖</div>
              <h1>有什么可以帮助你的？</h1>
              <p>基于 Dify AI 的智能问答助手，随时为你解答问题</p>
              <div className="suggestion-list">
                <button 
                  className="suggestion-btn"
                  onClick={() => handleSend('请简单介绍一下你自己')}
                >
                  👋 介绍一下你自己
                </button>
                <button 
                  className="suggestion-btn"
                  onClick={() => handleSend('你能帮我做什么？')}
                >
                  💡 你能帮我做什么？
                </button>
                <button 
                  className="suggestion-btn"
                  onClick={() => handleSend('今天天气怎么样？')}
                >
                  🌤️ 今天天气怎么样？
                </button>
              </div>
            </div>
          ) : (
            <MessageList 
              messages={messages} 
              streamingContent={streamingContent}
              isLoading={isLoading}
            />
          )}
          <div ref={messagesEndRef} />
        </div>
      </main>
      <div className="input-area">
        <ChatInput 
          onSend={handleSend} 
          onStop={handleStop}
          isLoading={isLoading}
        />
      </div>
    </div>
  )
}
