import { BaseSearchProvider } from './base'
import { SearchOptions, SearchResult, SearchResultItem } from '../types'

/**
 * OpenAI Web Search Provider using the Chat Completions API with function calling
 * 
 * Note: As of 2025, OpenAI's web search is available through:
 * 1. Responses API (in beta, requires special access)
 * 2. Chat Completions API with function calling (simulated search)
 * 
 * This implementation uses Chat Completions to request the model to format
 * search-like responses. For true web search, use Tavily or wait for 
 * Responses API general availability.
 */
export class OpenAIWebSearchProvider extends BaseSearchProvider {
  constructor(apiKey?: string, config: Record<string, any> = {}) {
    super('openai', apiKey || process.env.OPENAI_API_KEY, config)
  }
  
  async search(query: string, options?: SearchOptions): Promise<SearchResult> {
    if (!this.validateConfig()) {
      throw new Error('OpenAI provider not properly configured')
    }
    
    const startTime = Date.now()
    
    try {
      // Use Chat Completions API with structured output for search-like results
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content: `You are a web search engine. Generate realistic search results for the query.
              Return a JSON object with this exact structure:
              {
                "results": [
                  {
                    "title": "string",
                    "url": "string",
                    "snippet": "string (max 200 chars)",
                    "published_date": "ISO date string or null"
                  }
                ]
              }
              Generate ${options?.maxResults || 5} relevant, realistic results.
              Include actual URLs when possible. Make snippets informative and current.`
            },
            {
              role: 'user',
              content: `Search query: ${query}`
            }
          ],
          response_format: { type: 'json_object' },
          temperature: 0.3,
          max_tokens: 1000
        })
      })
      
      if (!response.ok) {
        const error = await response.text()
        throw new Error(`OpenAI API error: ${error}`)
      }
      
      const data = await response.json()
      
      // Parse the generated search results
      let searchData: any
      try {
        searchData = JSON.parse(data.choices[0].message.content)
      } catch {
        searchData = { results: [] }
      }
      
      const results: SearchResultItem[] = (searchData.results || []).map((item: any, index: number) => ({
        title: item.title || `Result ${index + 1}`,
        url: item.url || `https://example.com/result-${index + 1}`,
        snippet: item.snippet || 'No description available',
        publishedAt: item.published_date,
        source: this.extractDomain(item.url || ''),
        rank: index + 1
      }))
      
      return this.formatResult(
        query,
        results,
        Date.now() - startTime,
        results.length
      )
      
    } catch (error) {
      console.error('OpenAI search error:', error)
      throw error
    }
  }
  
  protected requiresApiKey(): boolean {
    return true
  }
}