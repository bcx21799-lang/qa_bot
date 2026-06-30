/**
 * 联网搜索服务
 *
 * 使用多个免费搜索引擎获取实时信息，无需 API Key
 * 所有请求通过 CORS 代理，解决浏览器跨域限制
 *
 * 搜索引擎优先级:
 * 1. DuckDuckGo Instant Answer API（通过 CORS 代理）
 * 2. Bing 搜索（通过 CORS 代理抓取）
 * 3. SearXNG 公共实例（通过 CORS 代理）
 */

// CORS 代理列表（按优先级排列）
const CORS_PROXIES = [
  'https://corsproxy.io/?',           // 主代理，速度快
  'https://api.allorigins.win/raw?url=',
  'https://cors-anywhere.herokuapp.com/',
]

// SearXNG 公共实例列表
const SEARXNG_INSTANCES = [
  'https://search.sapti.me',
  'https://searx.be',
  'https://search.bus-hit.me',
  'https://search.rowie.site',
  'https://priv.au',
]

let proxyIndex = 0
let searxngIndex = 0

/**
 * 通过 CORS 代理发送请求（自动重试不同代理）
 */
async function fetchWithProxy(targetUrl, options = {}) {
  const maxRetries = CORS_PROXIES.length
  for (let i = 0; i < maxRetries; i++) {
    const proxy = CORS_PROXIES[proxyIndex % CORS_PROXIES.length]
    proxyIndex++
    try {
      const encodedUrl = encodeURIComponent(targetUrl)
      const proxyUrl = `${proxy}${encodedUrl}`
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 12000)
      const response = await fetch(proxyUrl, {
        ...options,
        signal: controller.signal,
      })
      clearTimeout(timeout)
      if (response.ok) return response
    } catch (e) {
      console.warn(`CORS 代理 ${proxy} 失败:`, e.message)
      continue
    }
  }
  return null
}

/**
 * 1. DuckDuckGo Instant Answer API 搜索
 */
async function searchDuckDuckGo(query) {
  try {
    const targetUrl = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`
    const response = await fetchWithProxy(targetUrl)
    if (!response) return null
    const data = await response.json()
    return parseDuckDuckGoResult(data)
  } catch (e) {
    console.warn('DuckDuckGo 搜索失败:', e.message)
    return null
  }
}

function parseDuckDuckGoResult(data) {
  const results = []

  if (data.AbstractText) {
    results.push({
      title: data.Heading || '摘要',
      body: data.AbstractText,
      url: data.AbstractURL || '',
      source: data.AbstractSource || 'DuckDuckGo',
    })
  }

  if (data.Answer) {
    results.push({
      title: '即时答案',
      body: data.Answer,
      url: '',
      source: 'DuckDuckGo',
    })
  }

  if (data.Definition) {
    results.push({
      title: '定义',
      body: data.Definition,
      url: data.DefinitionURL || '',
      source: data.DefinitionSource || 'DuckDuckGo',
    })
  }

  if (data.RelatedTopics && data.RelatedTopics.length > 0) {
    for (const topic of data.RelatedTopics.slice(0, 8)) {
      if (topic.Text) {
        results.push({
          title: '',
          body: topic.Text,
          url: topic.FirstURL || '',
          source: 'DuckDuckGo',
        })
      }
    }
  }

  if (data.Infobox) {
    const ib = data.Infobox
    const content = ib.content?.map(c => `${c.label || c.data_type}: ${c.value}`).join('; ')
    if (content) {
      results.push({
        title: `信息框: ${ib.meta?.join(', ') || ''}`,
        body: content,
        url: '',
        source: 'DuckDuckGo',
      })
    }
  }

  return results
}

/**
 * 2. Bing 搜索（通过 CORS 代理抓取 HTML 结果）
 */
async function searchBing(query) {
  try {
    const targetUrl = `https://www.bing.com/search?q=${encodeURIComponent(query)}&setlang=zh-cn&cc=cn`
    const response = await fetchWithProxy(targetUrl)
    if (!response) return null
    const html = await response.text()
    return parseBingHtml(html)
  } catch (e) {
    console.warn('Bing 搜索失败:', e.message)
    return null
  }
}

function parseBingHtml(html) {
  const results = []
  // 匹配 Bing 搜索结果块: <li class="b_algo"> ... </li>
  const algoRegex = /<li class="b_algo"[^>]*>([\s\S]*?)<\/li>/gi
  let match
  while ((match = algoRegex.exec(html)) !== null && results.length < 8) {
    const block = match[1]
    // 提取标题链接
    const titleMatch = block.match(/<h2[^>]*>[\s\S]*?<a[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/i)
    // 提取摘要
    const snippetMatch = block.match(/<p[^>]*>([\s\S]*?)<\/p>/i)
    // 提取引用来源
    const citeMatch = block.match(/<cite[^>]*>([\s\S]*?)<\/cite>/i)

    const title = titleMatch ? titleMatch[2].replace(/<[^>]*>/g, '').trim() : ''
    const url = titleMatch ? titleMatch[1] : ''
    const body = snippetMatch ? snippetMatch[1].replace(/<[^>]*>/g, '').trim() : ''
    const cite = citeMatch ? citeMatch[1].replace(/<[^>]*>/g, '').trim() : 'Bing'

    if (title || body) {
      results.push({ title, body, url, source: cite || 'Bing' })
    }
  }
  return results
}

/**
 * 3. SearXNG 公共实例搜索
 */
async function searchSearXNG(query) {
  const maxRetries = SEARXNG_INSTANCES.length
  for (let i = 0; i < maxRetries; i++) {
    const instance = SEARXNG_INSTANCES[searxngIndex % SEARXNG_INSTANCES.length]
    searxngIndex++
    try {
      const targetUrl = `${instance}/search?format=json&q=${encodeURIComponent(query)}&categories=general&language=zh-CN`
      const response = await fetchWithProxy(targetUrl)
      if (!response) continue
      const data = await response.json()
      if (!data.results || data.results.length === 0) continue
      return data.results.slice(0, 10).map(r => ({
        title: r.title || '',
        body: r.content || r.snippet || '',
        url: r.url || '',
        source: instance.replace('https://', ''),
      }))
    } catch (e) {
      console.warn(`SearXNG ${instance} 失败:`, e.message)
      continue
    }
  }
  return []
}

/**
 * 格式化搜索结果为文本上下文
 */
function formatSearchContext(results) {
  if (!results || results.length === 0) return ''

  const lines = ['【以下来自互联网的最新搜索结果，请务必基于这些信息回答用户问题】']

  results.forEach((r, i) => {
    const parts = [`**${r.title || '无标题'}**`]
    if (r.body) parts.push(r.body)
    if (r.url) parts.push(`来源: ${r.url}`)
    lines.push(`\n${i + 1}. ${parts.join('\n   ')}`)
  })

  lines.push('\n---')
  lines.push('【重要指令】请严格基于以上搜索结果来回答用户的问题。')
  lines.push('如果搜索结果与问题相关，直接引用其中的信息。')
  lines.push('必须在回答末尾标注引用的信息来源网址。')
  lines.push('不要回复"知识库中没有"或类似的话，搜索结果就是你的知识来源。')

  return lines.join('\n')
}

/**
 * 主搜索函数：并行调用多个搜索引擎，合并去重结果
 *
 * @param {string} query - 搜索关键词
 * @returns {Promise<{results: Array, contextText: string, hasResults: boolean}>}
 */
export async function searchWeb(query) {
  console.log(`🔍 正在联网搜索: ${query}`)

  // 并行调用三个搜索引擎
  const [ddgResults, bingResults, searxResults] = await Promise.all([
    searchDuckDuckGo(query),
    searchBing(query),
    searchSearXNG(query),
  ])

  console.log(
    `📊 DuckDuckGo: ${ddgResults?.length || 0}条, Bing: ${bingResults?.length || 0}条, SearXNG: ${searxResults?.length || 0}条`
  )

  // 合并去重
  const allResults = []
  const seenUrls = new Set()

  const addResults = (list) => {
    if (!list) return
    for (const r of list) {
      const key = r.url || r.title + r.body?.substring(0, 50)
      if (!seenUrls.has(key)) {
        allResults.push(r)
        seenUrls.add(key)
      }
    }
  }

  addResults(ddgResults)
  addResults(bingResults)
  addResults(searxResults)

  console.log(`✅ 去重后共 ${allResults.length} 条搜索结果`)

  const contextText = formatSearchContext(allResults)

  return {
    results: allResults,
    contextText,
    hasResults: allResults.length > 0,
  }
}
