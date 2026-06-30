import React, { useState, useRef, useEffect, useCallback } from 'react'
import { runWorkflow, newConversation } from './services/difyApi'
import { searchWeb } from './services/searchService'
import MessageList from './components/MessageList'
import ChatInput from './components/ChatInput'
import Header from './components/Header'

export default function App() {
  const [messages, setMessages] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const [streamingContent, setStreamingContent] = useState('')
  const [webSearchOn, setWebSearchOn] = useState(false)
  const [isSearching, setIsSearching] = useState(false)
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
  const handleSend = useCallback(async (query, options = {}) => {
    if (!query.trim() || isLoading) return

    const useWebSearch = options.webSearch ?? webSearchOn
    const displayQuery = useWebSearch ? `[联网搜索] ${query}` : query

    // 添加用户消息
    const userMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: displayQuery,
      searchBadge: useWebSearch,
      timestamp: Date.now(),
    }

    setMessages(prev => [...prev, userMessage])
    setIsLoading(true)
    setStreamingContent('')

    // 如果开启了联网搜索，先执行搜索
    let searchContext = ''
    let searchResults = null

    if (useWebSearch) {
      setIsSearching(true)
      try {
        const searchData = await searchWeb(query)
        searchResults = searchData.results
        searchContext = searchData.contextText
        console.log(`📥 收到 ${searchResults.length} 条搜索结果`)
      } catch (err) {
        console.warn('联网搜索失败:', err)
      }
      setIsSearching(false)

      if (abortControllerRef.current?.signal?.aborted) return
    }

    // 构建工作流查询
    // 学术文献检索的核心是 keyword，联网搜索结果为辅助上下文
    let workflowQuery = query
    if (searchContext) {
      workflowQuery = `${searchContext}\n\n检索关键词: ${query}`
    }

    // 工作流 inputs
    const inputs = {}
    if (searchResults && searchResults.length > 0) {
      inputs.web_search_results = JSON.stringify(searchResults.slice(0, 8))
    }

    try {
      abortControllerRef.current = await runWorkflow(
        workflowQuery,
        inputs,
        {
          onProgress: ({ progress, outputText }) => {
            // 展示工作流节点的执行进度
            setStreamingContent(prev => {
              const lines = prev ? prev.split('\n') : []
              lines.push(progress || '')
              return lines.join('\n')
            })
            // 如果有 LLM 输出文本，追加展示
            if (outputText) {
              setStreamingContent(prev => prev + '\n\n' + outputText)
            }
          },
          onComplete: ({ answer, status, workflowRunId, metadata }) => {
            const assistantMessage = {
              id: (Date.now() + 1).toString(),
              role: 'assistant',
              content: answer,
              workflowRunId: workflowRunId,
              metadata: metadata,
              searchResults: searchResults,
              timestamp: Date.now(),
            }
            setMessages(prev => [...prev, assistantMessage])
            setStreamingContent('')
            setIsLoading(false)
          },
          onError: (error) => {
            console.error('工作流执行失败:', error)
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
  }, [isLoading, webSearchOn])

  // 停止生成
  const handleStop = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      abortControllerRef.current = null
    }

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
              <div className="welcome-icon">📚</div>
              <h1>学术文献检索助手</h1>
              <p>输入关键词，AI 帮你检索并分析相关学术论文</p>
              <div className="suggestion-list">
                <button 
                  className="suggestion-btn"
                  onClick={() => handleSend('deep learning image recognition')}
                >
                  🧠 深度学习图像识别
                </button>
                <button 
                  className="suggestion-btn"
                  onClick={() => handleSend('large language model attention mechanism')}
                >
                  🤖 大语言模型注意力机制
                </button>
                <button 
                  className="suggestion-btn"
                  onClick={() => handleSend('reinforcement learning robotics')}
                >
                  🦾 强化学习与机器人
                </button>
              </div>
            </div>
          ) : (
            <MessageList 
              messages={messages} 
              streamingContent={streamingContent}
              isLoading={isLoading}
              isSearching={isSearching}
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
          webSearchOn={webSearchOn}
          onToggleSearch={() => setWebSearchOn(v => !v)}
          isSearching={isSearching}
        />
      </div>
    </div>
  )
}
