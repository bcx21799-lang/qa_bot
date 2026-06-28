import React from 'react'
import ReactMarkdown from 'react-markdown'

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
          {isUser ? '你' : 'AI 助手'}
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
        <div className="message-role">AI 助手</div>
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

export default function MessageList({ messages, streamingContent, isLoading }) {
  return (
    <div className="message-list">
      {messages.map((message) => (
        <MessageBubble key={message.id} message={message} />
      ))}
      {streamingContent && (
        <StreamingBubble content={streamingContent} />
      )}
      {isLoading && !streamingContent && (
        <div className="message message-assistant">
          <div className="message-avatar">🤖</div>
          <div className="message-body">
            <div className="message-role">AI 助手</div>
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
