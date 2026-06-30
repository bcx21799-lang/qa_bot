/**
 * Dify Workflow API 服务层
 *
 * 应用: 学术文献检索助手 (Workflow 类型)
 * API: POST /v1/workflows/run
 */

const DIFY_BASE_URL = 'https://api.dify.ai/v1'
const API_KEY = 'app-Z16TT6Bo1fbAKTqu4ZmuXgNU'

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
 * 运行学术文献检索工作流
 *
 * @param {string} query     - 用户输入的关键词
 * @param {object} inputs    - 工作流输入变量
 * @param {object} callbacks
 * @param {function} callbacks.onProgress - 工作流节点进度回调
 * @param {function} callbacks.onComplete - 工作流完成回调
 * @param {function} callbacks.onError    - 错误回调
 * @returns {Promise<AbortController>}
 */
export async function runWorkflow(query, inputs = {}, { onProgress, onComplete, onError } = {}) {
  const controller = new AbortController()
  const userId = generateUserId()

  const requestBody = {
    inputs: {
      keword: query, // 必填: 文献检索关键词
      ...inputs,
    },
    response_mode: 'streaming',
    user: userId,
  }

  try {
    const response = await fetch(`${DIFY_BASE_URL}/workflows/run`, {
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
      throw new Error(errorData.message || `请求失败: ${response.status}`)
    }

    // 读取 SSE 流
    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    let progressText = ''
    let nodeCount = 0

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const dataStr = line.slice(6).trim()
          if (!dataStr || dataStr === '[DONE]') continue

          try {
            const data = JSON.parse(dataStr)
            const event = data.event

            if (event === 'workflow_started') {
              progressText = '🔄 工作流已启动，正在检索文献...'
              nodeCount = 0
              if (onProgress) onProgress({ progress: progressText })
            }
            else if (event === 'node_started') {
              const title = data.data?.title || data.data?.node_type || ''
              nodeCount++
              progressText = `📂 正在执行: ${title}`
              if (onProgress) onProgress({ progress: progressText, nodeTitle: title })
            }
            else if (event === 'node_finished') {
              const title = data.data?.title || ''
              const status = data.data?.status || ''
              const outputs = data.data?.outputs || {}
              // 尝试提取 LLM 输出文本，用于流式展示
              let outputText = ''
              if (data.data?.node_type === 'llm' && outputs.text) {
                outputText = outputs.text
              }
              if (data.data?.process_data?.prompts) {
                const prompts = data.data.process_data.prompts
                // 提取 assistant 的回复作为展示内容
                const assistantMsg = prompts.find(p => p.role === 'assistant')
                if (assistantMsg?.text) {
                  outputText = assistantMsg.text
                }
              }
              if (onProgress) {
                onProgress({
                  progress: status === 'succeeded'
                    ? `✅ ${title} 完成`
                    : `❌ ${title} ${status}`,
                  nodeTitle: title,
                  status,
                  outputText,
                })
              }
            }
            else if (event === 'workflow_finished') {
              const outputs = data.data?.outputs || {}
              const status = data.data?.status || ''

              // 合并所有输出
              let finalAnswer = ''
              if (outputs && Object.keys(outputs).length > 0) {
                // 按优先级: text > result > output > summarizer > 其他
                const priorityKeys = ['text', 'result', 'output', 'summary', 'literature_results']
                for (const key of priorityKeys) {
                  if (outputs[key]) {
                    finalAnswer = outputs[key]
                    break
                  }
                }
                if (!finalAnswer) {
                  finalAnswer = Object.entries(outputs)
                    .filter(([_, v]) => v)
                    .map(([k, v]) => `**${k}**\n${v}`)
                    .join('\n\n')
                }
              }

              if (status === 'succeeded') {
                if (!finalAnswer) {
                  finalAnswer = '文献检索完成，未找到匹配结果。请尝试更具体的关键词。'
                }
              } else {
                finalAnswer = `工作流执行失败: ${data.data?.error || '未知错误'}\n\n请尝试更换搜索关键词后重试。`
              }

              if (onComplete) {
                onComplete({
                  answer: finalAnswer,
                  status,
                  workflowRunId: data.workflow_run_id,
                  metadata: {
                    total_tokens: data.data?.total_tokens,
                    total_steps: data.data?.total_steps,
                    elapsed_time: data.data?.elapsed_time,
                  },
                })
              }
            }
          } catch (parseError) {
            console.warn('解析 SSE 数据失败:', parseError)
          }
        }
      }
    }

    // 处理 buffer 中剩余数据
    if (buffer.trim()) {
      const remaining = buffer.split('\n')
      for (const line of remaining) {
        if (line.startsWith('data: ') && !line.includes('[DONE]')) {
          const dataStr = line.slice(6).trim()
          try {
            const data = JSON.parse(dataStr)
            if (data.event === 'workflow_finished' && onComplete) {
              const outputs = data.data?.outputs || {}
              const finalAnswer = Object.entries(outputs)
                .filter(([_, v]) => v)
                .map(([k, v]) => `**${k}**\n${v}`)
                .join('\n\n') || '工作流已完成'
              onComplete({
                answer: finalAnswer,
                status: data.data?.status,
                workflowRunId: data.workflow_run_id,
                metadata: data.data,
              })
            }
          } catch { /* 忽略 */ }
        }
      }
    }

  } catch (error) {
    if (error.name === 'AbortError') {
      console.log('请求已取消')
      return controller
    }
    if (onError) onError(error)
  }

  return controller
}

/**
 * 新建会话（Workflow 无会话概念，保留接口兼容性）
 */
export function newConversation() {
  // Workflow 每次独立运行，无需管理会话
}
