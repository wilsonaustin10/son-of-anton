import { 
  SearchOptions, 
  SearchResult, 
  SearchResultItem,
  WebSearchProviderName as ProviderType 
} from '../types'

export abstract class BaseSearchProvider {
  protected name: ProviderType
  protected apiKey?: string
  protected config: Record<string, any>
  
  constructor(name: ProviderType, apiKey?: string, config: Record<string, any> = {}) {
    this.name = name
    this.apiKey = apiKey
    this.config = config
  }
  
  abstract search(query: string, options?: SearchOptions): Promise<SearchResult>
  
  validateConfig(): boolean {
    if (this.requiresApiKey() && !this.apiKey) {
      console.error(`${this.name} provider requires an API key`)
      return false
    }
    return true
  }
  
  protected requiresApiKey(): boolean {
    return true
  }
  
  protected formatResult(
    query: string,
    items: SearchResultItem[],
    searchTime?: number,
    totalResults?: number
  ): SearchResult {
    return {
      query,
      results: items,
      totalResults,
      searchTime,
      provider: this.name
    }
  }
  
  protected truncateContent(content: string, maxLength: number = 500): string {
    if (content.length <= maxLength) return content
    return content.substring(0, maxLength) + '...'
  }
  
  protected cleanHtml(html: string): string {
    // Simple HTML tag removal
    return html.replace(/<[^>]*>/g, '').trim()
  }
  
  protected extractDomain(url: string): string {
    try {
      const urlObj = new URL(url)
      return urlObj.hostname.replace('www.', '')
    } catch {
      return 'unknown'
    }
  }
}

export class SearchProviderFactory {
  private static providers: Map<ProviderType, typeof BaseSearchProvider> = new Map()
  
  static register(name: ProviderType, providerClass: typeof BaseSearchProvider): void {
    this.providers.set(name, providerClass)
  }
  
  static create(
    name: ProviderType, 
    apiKey?: string, 
    config?: Record<string, any>
  ): BaseSearchProvider {
    const ProviderClass = this.providers.get(name)
    if (!ProviderClass) {
      throw new Error(`Search provider ${name} not registered`)
    }
    return new (ProviderClass as any)(apiKey, config)
  }
  
  static getAvailableProviders(): ProviderType[] {
    return Array.from(this.providers.keys())
  }
}