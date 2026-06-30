import React, { useState, useRef, useEffect } from 'react'

export default function ChatInput({ onSend, onStop, isLoading, webSearchOn, onToggleSearch, isSearching }) {
  const [input, setInput] = useState('')
  const textareaRef = useRef(null)

  // 自动调整文本框高度
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 150) + 'px'
    }
  }, [input])

  // 发送消息
  const handleSubmit = () => {
    if (!input.trim() || isLoading) return
    onSend(input.trim(), { webSearch: webSearchOn })
    setInput('')
    // 重置文本框高度
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }
  }

  // 键盘事件
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  return (
    <div className="chat-input-container">
      <div className="chat-input-wrapper">
        {/* 联网搜索开关 */}
        <button
          className={`search-toggle ${webSearchOn ? 'search-toggle-on' : ''} ${isSearching ? 'search-toggle-searching' : ''}`}
          onClick={onToggleSearch}
          disabled={isLoading}
          title={webSearchOn ? '已开启联网搜索' : '点击开启联网搜索'}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            <line x1="11" y1="8" x2="11" y2="14" className="search-plus-v"></line>
            <line x1="8" y1="11" x2="14" y2="11" className="search-plus-h"></line>
          </svg>
          <span className="search-toggle-label">联网</span>
        </button>

        <textarea
          ref={textareaRef}
          className="chat-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={isSearching ? '正在搜索网络...' : webSearchOn ? '输入关键词，将联网搜索并检索文献...' : '输入学术关键词，检索相关论文...'}
          rows={1}
          disabled={isLoading}
        />
        <div className="chat-input-actions">
          <span className="input-hint">Enter 发送 / Shift+Enter 换行</span>
          {isLoading ? (
            <button 
              className="stop-btn" 
              onClick={onStop}
              title="停止生成"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <rect x="4" y="4" width="16" height="16" rx="2" />
              </svg>
              停止
            </button>
          ) : (
            <button 
              className="send-btn" 
              onClick={handleSubmit}
              disabled={!input.trim()}
              title={webSearchOn ? '联网搜索并发送' : '发送消息'}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13"></line>
                <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
              </svg>
            </button>
          )}
        </div>
      </div>
      <p className="input-disclaimer">
        内容由 AI 生成，仅供学术参考
      </p>
    </div>
  )
}
