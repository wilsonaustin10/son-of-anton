import { BaseSearchProvider } from './base'
import { SearchOptions, SearchResult, SearchResultItem } from '../types'

interface TavilySearchOptions {
  search_depth?: 'basic' | 'advanced'
  include_answer?: boolean
  include_raw_content?: boolean
  max_results?: number
  include_images?: boolean
  topic?: 'general' | 'news' | 'finance'
  days?: number
  location?: string
}

interface TavilySearchResponse {
  query: string
  answer?: string
  results: Array<{
    title: string
    url: string
    content: string
    raw_content?: string
    score: number
    published_date?: string
  }>
  images?: string[]
  response_time: number
}

export class TavilyProvider extends BaseSearchProvider {
  private baseUrl = 'https://api.tavily.com/search'
  
  constructor(apiKey?: string, config: Record<string, any> = {}) {
    super('tavily', apiKey || process.env.TAVILY_API_KEY, config)
  }
  
  async search(query: string, options?: SearchOptions): Promise<SearchResult> {
    if (!this.validateConfig()) {
      throw new Error('Tavily provider not properly configured')
    }
    
    const startTime = Date.now()
    
    try {
      const tavilyOptions: TavilySearchOptions = {
        search_depth: options?.searchDepth || 'basic',
        include_answer: false,
        include_raw_content: options?.includeRawContent || false,
        max_results: options?.maxResults || 5,
        include_images: options?.includeImages || false,
        topic: options?.topic || 'general',
        location: options?.location,
      }
      
      // Add time range filtering
      if (options?.timeRange) {
        const daysMap = {
          'day': 1,
          'week': 7,
          'month': 30,
          'year': 365,
          'all': undefined
        }
        tavilyOptions.days = daysMap[options.timeRange]
      }
      
      const response = await fetch(this.baseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          api_key: this.apiKey,
          query,
          ...tavilyOptions
        })
      })
      
      if (!response.ok) {
        const error = await response.text()
        throw new Error(`Tavily API error: ${error}`)
      }
      
      const data: TavilySearchResponse = await response.json()
      
      const results: SearchResultItem[] = data.results.map((item, index) => ({
        title: item.title,
        url: item.url,
        snippet: this.truncateContent(item.content),
        content: item.raw_content,
        publishedAt: item.published_date,
        source: this.extractDomain(item.url),
        rank: index + 1
      }))
      
      return this.formatResult(
        query,
        results,
        Date.now() - startTime,
        results.length
      )
      
    } catch (error) {
      console.error('Tavily search error:', error)
      throw error
    }
  }
  
  getCostEstimate(searchDepth: 'basic' | 'advanced' = 'basic'): number {
    // Tavily pricing: basic = 1 credit, advanced = 2 credits
    // Assuming 1 credit = $0.001
    return searchDepth === 'advanced' ? 0.002 : 0.001
  }
}