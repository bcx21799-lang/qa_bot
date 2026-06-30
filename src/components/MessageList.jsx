import React from 'react'
import ReactMarkdown from 'react-markdown'

function SearchReferenceCard({ result, index }) {
  return (
    <a
      href={result.url}
      target="_blank"
      rel="noopener noreferrer"
      className="search-ref-card"
      title={result.body}
    >
      <span className="search-ref-index">{index + 1}</span>
      <div className="search-ref-content">
        <div className="search-ref-title">{result.title || result.url}</div>
        <div className="search-ref-body">{result.body?.substring(0, 120)}</div>
        <div className="search-ref-source">{result.source}</div>
      </div>
    </a>
  )
}

function SearchBadge() {
  return (
    <span className="search-badge" title="已联网搜索">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="11" cy="11" r="8"></circle>
        <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
      </svg>
      联网
    </span>
  )
}

function MessageBubble({ message }) {
  const isUser = message.role === 'user'
  const isError = message.isError

  return (
    <div className={`message ${isUser ? 'message-user' : 'message-assistant'} ${isError ? 'message-error' : ''}`}>
      <div className="message-avatar">
        {isUser ? '👤' : '🤖'}
      </div>
      <div className="message-body">
        <div className="message-role">
          {isUser ? '你' : '检索助手'}
          {message.searchBadge && <SearchBadge />}
        </div>
        <div className="message-content">
          {isUser ? (
            <p>{message.content}</p>
          ) : (
            <ReactMarkdown>
              {message.content}
            </ReactMarkdown>
          )}
        </div>
        {/* 联网搜索引用 */}
        {message.searchResults && message.searchResults.length > 0 && (
          <div className="search-references">
            <div className="search-references-title">
              🌐 联网搜索结果 ({message.searchResults.length}条)
            </div>
            <div className="search-references-grid">
              {message.searchResults.slice(0, 6).map((result, i) => (
                <SearchReferenceCard key={i} result={result} index={i} />
              ))}
            </div>
          </div>
        )}
        {message.metadata?.usage && (
          <div className="message-meta">
            <span>Tokens: {message.metadata.usage.total_tokens}</span>
            {message.metadata.usage.latency && (
              <span>延迟: {(message.metadata.usage.latency * 1000).toFixed(0)}ms</span>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function StreamingBubble({ content }) {
  return (
    <div className="message message-assistant">
      <div className="message-avatar">🤖</div>
      <div className="message-body">
        <div className="message-role">检索助手</div>
        <div className="message-content">
          <ReactMarkdown>
            {content}
          </ReactMarkdown>
        </div>
        <div className="typing-indicator">
          <span className="typing-dot"></span>
          <span className="typing-dot"></span>
          <span className="typing-dot"></span>
        </div>
      </div>
    </div>
  )
}

export default function MessageList({ messages, streamingContent, isLoading, isSearching }) {
  return (
    <div className="message-list">
      {messages.map((message) => (
        <MessageBubble key={message.id} message={message} />
      ))}
      {/* 联网搜索进度提示 */}
      {isSearching && (
        <div className="message message-assistant message-searching">
          <div className="message-avatar">🔍</div>
          <div className="message-body">
            <div className="message-role">搜索</div>
            <div className="searching-indicator">
              <span className="typing-dot"></span>
              <span className="typing-dot"></span>
              <span className="typing-dot"></span>
              <span className="searching-text">正在搜索网络...</span>
            </div>
          </div>
        </div>
      )}
      {streamingContent && (
        <StreamingBubble content={streamingContent} />
      )}
      {isLoading && !streamingContent && !isSearching && (
        <div className="message message-assistant">
          <div className="message-avatar">🤖</div>
          <div className="message-body">
            <div className="message-role">检索助手</div>
            <div className="typing-indicator">
              <span className="typing-dot"></span>
              <span className="typing-dot"></span>
              <span className="typing-dot"></span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
