import { localDb, type LocalAiConfig } from './localDb'
import { GoogleGenerativeAI } from '@google/generative-ai'

// Check if running on server-side or client-side
const isServer = typeof window === 'undefined'

export async function callActiveLlm(prompt: string, systemPrompt?: string): Promise<string> {
  let config: LocalAiConfig = {
    provider: 'gemini',
    ollamaUrl: 'http://localhost:11434',
    ollamaModel: 'llama3',
    openAiKey: '',
    geminiKey: '',
  }

  // Load configuration from localDb if on client, or fall back gracefully
  if (!isServer) {
    config = localDb.getAiConfig()
  } else {
    // On server, we can look up environment variables or mock the config
    config.geminiKey = process.env.GEMINI_API_KEY || ''
    config.openAiKey = process.env.OPENAI_API_KEY || ''
  }

  const combinedPrompt = systemPrompt ? `${systemPrompt}\n\nUser Input:\n${prompt}` : prompt

  switch (config.provider) {
    case 'ollama':
      return callOllama(config.ollamaUrl, config.ollamaModel, combinedPrompt)
    case 'lmstudio':
      return callLmStudio(combinedPrompt)
    case 'openai':
      return callOpenAi(config.openAiKey, combinedPrompt)
    case 'gemini':
    default:
      return callGemini(config.geminiKey, combinedPrompt)
  }
}

async function callOllama(url: string, model: string, prompt: string): Promise<string> {
  const cleanUrl = url.replace(/\/$/, '')
  try {
    const res = await fetch(`${cleanUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: model || 'llama3',
        prompt: prompt,
        stream: false,
      }),
    })

    if (!res.ok) throw new Error(`Ollama returned status ${res.status}`)
    const data = await res.json()
    return data.response || ''
  } catch (e) {
    console.error('Ollama connection failed:', e)
    throw new Error('Local Ollama instance not running or model not found. Ensure "ollama run llama3" is active.')
  }
}

async function callLmStudio(prompt: string): Promise<string> {
  try {
    const res = await fetch('http://localhost:1234/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
        max_tokens: 1500,
        stream: false,
      }),
    })

    if (!res.ok) throw new Error(`LM Studio returned status ${res.status}`)
    const data = await res.json()
    return data.choices[0]?.message?.content || ''
  } catch (e) {
    console.error('LM Studio connection failed:', e)
    throw new Error('Local LM Studio API server is not running on port 1234.')
  }
}

async function callOpenAi(apiKey: string, prompt: string): Promise<string> {
  const token = apiKey || process.env.OPENAI_API_KEY
  if (!token) throw new Error('OpenAI API key not configured.')

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
      }),
    })

    if (!res.ok) throw new Error(`OpenAI API returned status ${res.status}`)
    const data = await res.json()
    return data.choices[0]?.message?.content || ''
  } catch (e) {
    console.error('OpenAI call failed:', e)
    throw e
  }
}

async function callGemini(apiKey: string, prompt: string): Promise<string> {
  const token = apiKey || process.env.GEMINI_API_KEY
  if (!token) {
    // If no Gemini key is provided, we throw so the caller handles fallback
    throw new Error('Gemini API Key is not set.')
  }

  try {
    const genAI = new GoogleGenerativeAI(token)
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' })
    const result = await model.generateContent(prompt)
    return result.response.text()
  } catch (e) {
    console.error('Gemini call failed:', e)
    throw e
  }
}
