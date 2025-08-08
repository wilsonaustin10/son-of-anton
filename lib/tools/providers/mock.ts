import { BaseSearchProvider } from './base'
import { SearchOptions, SearchResult, SearchResultItem } from '../types'

export class MockSearchProvider extends BaseSearchProvider {
  constructor(apiKey?: string, config: Record<string, any> = {}) {
    super('tavily', apiKey, config) // Pretend to be Tavily for compatibility
  }
  
  async search(query: string, options?: SearchOptions): Promise<SearchResult> {
    const startTime = Date.now()
    
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 500))
    
    // Generate mock results based on query
    const mockResults: SearchResultItem[] = [
      {
        title: `Latest news about ${query}`,
        url: `https://example.com/news/${encodeURIComponent(query)}`,
        snippet: `This is a mock search result about ${query}. In a real implementation, this would contain actual search results from the web.`,
        publishedAt: new Date().toISOString(),
        source: 'example.com',
        rank: 1
      },
      {
        title: `${query} - Wikipedia`,
        url: `https://en.wikipedia.org/wiki/${encodeURIComponent(query)}`,
        snippet: `${query} is a topic with many interesting aspects. This mock result simulates a Wikipedia entry.`,
        publishedAt: new Date(Date.now() - 86400000).toISOString(),
        source: 'wikipedia.org',
        rank: 2
      },
      {
        title: `Understanding ${query} in 2024`,
        url: `https://blog.example.com/${encodeURIComponent(query)}-guide`,
        snippet: `A comprehensive guide to ${query} covering all the important aspects you need to know.`,
        publishedAt: new Date(Date.now() - 172800000).toISOString(),
        source: 'blog.example.com',
        rank: 3
      }
    ]
    
    return this.formatResult(
      query,
      mockResults.slice(0, options?.maxResults || 5),
      Date.now() - startTime,
      mockResults.length
    )
  }
  
  protected requiresApiKey(): boolean {
    return false // Mock provider doesn't need API key
  }
}