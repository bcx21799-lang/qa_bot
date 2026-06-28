import React from 'react'

export default function Header({ onNewChat }) {
  return (
    <header className="header">
      <div className="header-left">
        <div className="logo">🤖</div>
        <h1 className="header-title">Dify 智能问答</h1>
      </div>
      <div className="header-right">
        <button className="new-chat-btn" onClick={onNewChat} title="新建会话">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>
          <span>新对话</span>
        </button>
      </div>
    </header>
  )
}
