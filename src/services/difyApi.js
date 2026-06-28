/**
 * Dify API 服务层
 * 
 * API 文档: https://docs.dify.ai/api-reference/对话消息/发送对话消息
 * 
 * 接口: POST /v1/chat-messages
 * 基础 URL: https://api.dify.ai/v1
 * 认证: Bearer Token (API Key)
 */

const DIFY_BASE_URL = 'https://api.dify.ai/v1'
const API_KEY = 'app-U00zPYYbfV39aMWS5B9jT0Zi'

/**
 * 生成唯一用户标识
 */
function generateUserId() {
  let userId = localStorage.getItem('dify_user_id')
  if (!userId) {
    userId = 'user_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9)
    localStorage.setItem('dify_user_id', userId)
  }
  return userId
}

/**
 * 获取或创建会话 ID
 */
function getConversationId() {
  return localStorage.getItem('dify_conversation_id') || ''
}

/**
 * 保存会话 ID
 */
function saveConversationId(conversationId) {
  if (conversationId) {
    localStorage.setItem('dify_conversation_id', conversationId)
  }
}

/**
 * 发送聊天消息（流式响应）
 * 
 * @param {string} query - 用户输入的问题
 * @param {object} inputs - 应用变量（键值对）
 * @param {function} onMessage - 接收到消息片段的回调
 * @param {function} onComplete - 流式响应完成的回调
 * @param {function} onError - 错误回调
 * @returns {Promise<AbortController>} 用于取消请求的控制器
 */
export async function sendChatMessage(query, inputs = {}, { onMessage, onComplete, onError } = {}) {
  const controller = new AbortController()
  const userId = generateUserId()
  const conversationId = getConversationId()

  const requestBody = {
    inputs: inputs,
    query: query,
    response_mode: 'streaming',
    user: userId,
    auto_generate_name: true,
  }

  // 如果有会话 ID，则带上以继续对话
  if (conversationId) {
    requestBody.conversation_id = conversationId
  }

  try {
    const response = await fetch(`${DIFY_BASE_URL}/chat-messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal,
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.message || `请求失败: ${response.status} ${response.statusText}`)
    }

    // 读取 SSE 流
    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    let fullAnswer = ''
    let newConversationId = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      
      // 按行分割处理 SSE 事件
      const lines = buffer.split('\n')
      buffer = lines.pop() || '' // 保留不完整的行

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const dataStr = line.slice(6).trim()
          if (!dataStr) continue

          try {
            const data = JSON.parse(dataStr)
            
            // 处理不同类型的事件
            if (data.event === 'message' || data.event === 'agent_message') {
              fullAnswer += data.answer || ''
              newConversationId = data.conversation_id || newConversationId
              
              if (onMessage) {
                onMessage({
                  answer: fullAnswer,
                  conversationId: newConversationId,
                  taskId: data.task_id,
                  messageId: data.message_id,
                  metadata: data.metadata,
                })
              }
            } else if (data.event === 'message_end') {
              newConversationId = data.conversation_id || newConversationId
              // 保存会话 ID
              saveConversationId(newConversationId)
              
              if (onComplete) {
                onComplete({
                  answer: fullAnswer,
                  conversationId: newConversationId,
                  messageId: data.message_id,
                  metadata: data.metadata,
                })
              }
            } else if (data.event === 'error') {
              if (onError) {
                onError(new Error(data.message || '未知错误'))
              }
              return controller
            } else if (data.event === 'tts_message' || data.event === 'tts_message_end') {
              // TTS 消息，按需处理
              if (data.audio && onMessage) {
                onMessage({
                  answer: fullAnswer,
                  conversationId: newConversationId,
                  audio: data.audio,
                })
              }
            }
          } catch (parseError) {
            console.warn('解析 SSE 数据失败:', parseError, dataStr)
          }
        }
      }
    }

    // 处理 buffer 中剩余的数据
    if (buffer.trim()) {
      const remaining = buffer.split('\n')
      for (const line of remaining) {
        if (line.startsWith('data: ')) {
          const dataStr = line.slice(6).trim()
          if (!dataStr) continue
          try {
            const data = JSON.parse(dataStr)
            if (data.event === 'message_end') {
              saveConversationId(data.conversation_id || newConversationId)
            }
          } catch (e) {
            // 忽略解析错误
          }
        }
      }
    }

  } catch (error) {
    if (error.name === 'AbortError') {
      console.log('请求已取消')
      return controller
    }
    if (onError) {
      onError(error)
    }
  }

  return controller
}

/**
 * 获取应用参数信息
 * 用于获取应用定义的变量 (inputs)
 */
export async function getAppParameters() {
  try {
    const response = await fetch(`${DIFY_BASE_URL}/parameters`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
      },
    })

    if (!response.ok) {
      throw new Error(`获取参数失败: ${response.status}`)
    }

    return await response.json()
  } catch (error) {
    console.error('获取应用参数失败:', error)
    return null
  }
}

/**
 * 获取会话历史消息
 */
export async function getConversationMessages(conversationId, userId) {
  try {
    const params = new URLSearchParams({
      conversation_id: conversationId,
      user: userId || generateUserId(),
    })

    const response = await fetch(`${DIFY_BASE_URL}/messages?${params}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
      },
    })

    if (!response.ok) {
      throw new Error(`获取消息失败: ${response.status}`)
    }

    return await response.json()
  } catch (error) {
    console.error('获取会话消息失败:', error)
    return null
  }
}

/**
 * 停止当前响应
 */
export async function stopResponse(taskId, userId) {
  try {
    const response = await fetch(`${DIFY_BASE_URL}/chat-messages/${taskId}/stop`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        user: userId || generateUserId(),
      }),
    })

    if (!response.ok) {
      throw new Error(`停止响应失败: ${response.status}`)
    }

    return await response.json()
  } catch (error) {
    console.error('停止响应失败:', error)
    return null
  }
}

/**
 * 新建会话（清除本地存储的会话 ID）
 */
export function newConversation() {
  localStorage.removeItem('dify_conversation_id')
}
