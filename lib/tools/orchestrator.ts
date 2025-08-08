import { ToolRegistry } from './registry'
import { 
  Tool,
  ToolConfig,
  ToolContext,
  ToolResult,
  ToolCallEvent,
  ToolResultEvent,
  ToolGuardrails,
  WebSearchProviderName,
  SearchOptions
} from './types'
import { BaseSearchProvider, SearchProviderFactory } from './providers/base'
import { TavilyProvider } from './providers/tavily'
import { OpenAIWebSearchProvider } from './providers/openai-web-fixed'
import { MockSearchProvider } from './providers/mock'

export class ToolOrchestrator {
  private registry: ToolRegistry
  private config: ToolConfig
  private searchProviders: Map<WebSearchProviderName, BaseSearchProvider> = new Map()
  private executionCount: number = 0
  private turnExecutionCount: Map<string, number> = new Map()
  private costTracker: Map<string, number> = new Map()
  
  constructor(config: ToolConfig) {
    this.config = config
    this.registry = new ToolRegistry(config)
    this.initializeProviders()
    this.registerBuiltInTools()
  }
  
  private initializeProviders(): void {
    // Register search providers
    SearchProviderFactory.register('tavily', TavilyProvider as any)
    SearchProviderFactory.register('openai', OpenAIWebSearchProvider as any)
    
    // Initialize configured providers
    for (const providerName of this.config.webProviderOrder) {
      try {
        // Pass undefined for apiKey to let providers use their default env vars
        const provider = SearchProviderFactory.create(providerName, undefined)
        if (provider.validateConfig()) {
          this.searchProviders.set(providerName, provider)
        }
      } catch (error) {
        console.warn(`Failed to initialize ${providerName} provider:`, error)
      }
    }
    
    // If no providers initialized successfully, use mock provider
    if (this.searchProviders.size === 0) {
      console.warn('No search providers available, using mock provider')
      const mockProvider = new MockSearchProvider()
      this.searchProviders.set('tavily', mockProvider)
    }
  }
  
  private registerBuiltInTools(): void {
    // Register web search tool
    this.registry.register<{ query: string; options?: SearchOptions }, any>({
      name: 'web_search',
      description: 'Search the web for current information',
      parameters: [
        {
          name: 'query',
          type: 'string',
          description: 'The search query',
          required: true
        },
        {
          name: 'maxResults',
          type: 'number',
          description: 'Maximum number of results to return',
          default: 5
        },
        {
          name: 'searchDepth',
          type: 'string',
          description: 'Search depth (basic or advanced)',
          enum: ['basic', 'advanced'],
          default: 'basic'
        }
      ],
      timeoutMs: 10000,
      budgetCents: 1,
      execute: async (params, context) => {
        return this.executeWebSearch(params.query, params.options, context)
      }
    })
  }
  
  async executeWebSearch(
    query: string,
    options?: SearchOptions,
    context?: ToolContext
  ): Promise<ToolResult> {
    const startTime = Date.now()
    let lastError: Error | null = null
    
    // Try providers in order
    for (const providerName of this.config.webProviderOrder) {
      const provider = this.searchProviders.get(providerName)
      if (!provider) continue
      
      try {
        const result = await provider.search(query, {
          ...options,
          locale: options?.locale || this.config.userLocale,
          location: options?.location || this.config.locationHints
        })
        
        // Format citations
        const citations = result.results.map(item => ({
          title: item.title,
          url: item.url,
          snippet: item.snippet,
          publishedAt: item.publishedAt,
          source: item.source
        }))
        
        return {
          success: true,
          data: result,
          citations,
          metadata: {
            executionTime: Date.now() - startTime,
            provider: providerName,
            cost: this.estimateSearchCost(providerName, options)
          }
        }
      } catch (error) {
        console.warn(`${providerName} search failed:`, error)
        lastError = error as Error
        // Continue to next provider
      }
    }
    
    // All providers failed
    return {
      success: false,
      error: lastError?.message || 'All search providers failed',
      metadata: {
        executionTime: Date.now() - startTime
      }
    }
  }
  
  private estimateSearchCost(
    provider: WebSearchProviderName,
    options?: SearchOptions
  ): number {
    // Cost estimates in cents
    const costs = {
      openai: 0.5,
      tavily: options?.searchDepth === 'advanced' ? 0.2 : 0.1,
      serper: 0.3
    }
    return costs[provider] || 0
  }
  
  async handleToolCall(
    event: ToolCallEvent,
    context: ToolContext
  ): Promise<ToolResultEvent> {
    const turnId = context.conversationId || 'default'
    
    // Check turn-level rate limits
    const turnCount = this.turnExecutionCount.get(turnId) || 0
    if (turnCount >= this.config.maxToolCallsPerTurn) {
      return this.createErrorResult(
        event.call_id,
        `Maximum tool calls per turn (${this.config.maxToolCallsPerTurn}) exceeded`
      )
    }
    
    // Parse arguments
    let args: any
    try {
      args = JSON.parse(event.arguments)
    } catch (error) {
      return this.createErrorResult(
        event.call_id,
        'Invalid tool arguments: ' + error
      )
    }
    
    // Check budget
    const tool = this.registry.getTool(event.name)
    if (tool?.budgetCents) {
      const currentCost = this.costTracker.get(turnId) || 0
      const toolBudget = this.config.perToolBudget[event.name] || tool.budgetCents
      
      if (currentCost + toolBudget > 100) { // Max $1 per turn
        return this.createErrorResult(
          event.call_id,
          'Budget limit exceeded for this conversation turn'
        )
      }
    }
    
    // Execute tool
    const result = await this.registry.execute(event.name, args, context)
    
    // Update counters
    this.turnExecutionCount.set(turnId, turnCount + 1)
    if (result.metadata?.cost) {
      const currentCost = this.costTracker.get(turnId) || 0
      this.costTracker.set(turnId, currentCost + result.metadata.cost)
    }
    
    // Format result for Realtime API
    return {
      type: 'conversation.item.create',
      item: {
        type: 'function_call_output',
        call_id: event.call_id,
        output: JSON.stringify(result)
      }
    }
  }
  
  private createErrorResult(callId: string, error: string): ToolResultEvent {
    return {
      type: 'conversation.item.create',
      item: {
        type: 'function_call_output',
        call_id: callId,
        output: JSON.stringify({
          success: false,
          error
        })
      }
    }
  }
  
  resetTurnCounters(conversationId?: string): void {
    const turnId = conversationId || 'default'
    this.turnExecutionCount.delete(turnId)
    this.costTracker.delete(turnId)
  }
  
  getRegistry(): ToolRegistry {
    return this.registry
  }
  
  getConfig(): ToolConfig {
    return this.config
  }
  
  updateConfig(config: Partial<ToolConfig>): void {
    this.config = { ...this.config, ...config }
    this.registry.updateConfig(this.config)
    
    // Reinitialize providers if web provider order changed
    if (config.webProviderOrder) {
      this.searchProviders.clear()
      this.initializeProviders()
    }
  }
  
  getMetrics() {
    return {
      totalExecutions: this.executionCount,
      registryMetrics: this.registry.getMetricsSummary(),
      activeTurns: this.turnExecutionCount.size,
      totalCost: Array.from(this.costTracker.values()).reduce((a, b) => a + b, 0)
    }
  }
}