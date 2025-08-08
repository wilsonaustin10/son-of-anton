export interface ToolParameter {
  name: string
  type: 'string' | 'number' | 'boolean' | 'object' | 'array'
  description: string
  required?: boolean
  enum?: string[]
  default?: any
}

export interface ToolSchema {
  name: string
  description: string
  parameters: ToolParameter[]
}

export interface ToolResult<T = any> {
  success: boolean
  data?: T
  error?: string
  citations?: Citation[]
  metadata?: {
    executionTime: number
    cost?: number
    provider?: string
  }
}

export interface Citation {
  title: string
  url: string
  snippet?: string
  publishedAt?: string
  source?: string
}

export interface Tool<TParams = any, TResult = any> {
  name: string
  description: string
  parameters: ToolParameter[]
  timeoutMs?: number
  budgetCents?: number
  retryPolicy?: RetryPolicy
  safeParams?: (params: TParams) => TParams
  execute: (params: TParams, context: ToolContext) => Promise<ToolResult<TResult>>
  validate?: (params: TParams) => boolean | string
}

export interface ToolContext {
  userId?: string
  conversationId?: string
  requestId: string
  signal?: AbortSignal
  config: ToolConfig
}

export interface RetryPolicy {
  maxRetries: number
  backoffMs: number
  shouldRetry?: (error: any) => boolean
}

export interface ToolConfig {
  maxToolCallsPerTurn: number
  defaultTimeoutMs: number
  webProviderOrder: WebSearchProviderName[]
  perToolBudget: Record<string, number>
  retryPolicy: RetryPolicy
  userLocale?: string
  locationHints?: string
  cacheTTL?: number
  searchProfile?: 'news' | 'evergreen' | 'balanced'
  enableMCP?: boolean
  mcpServers?: MCPServerConfig[]
}

export type WebSearchProviderName = 'openai' | 'tavily' | 'serper'

export interface MCPServerConfig {
  label: string
  url: string
  auth?: {
    type: 'bearer' | 'basic'
    credentials: string
  }
}

export interface SearchOptions {
  maxResults?: number
  searchDepth?: 'basic' | 'advanced'
  includeRawContent?: boolean
  includeImages?: boolean
  locale?: string
  location?: string
  timeRange?: 'day' | 'week' | 'month' | 'year' | 'all'
  topic?: 'general' | 'news' | 'finance'
}

export interface SearchResult {
  query: string
  results: SearchResultItem[]
  totalResults?: number
  searchTime?: number
  provider: WebSearchProviderName
}

export interface SearchResultItem {
  title: string
  url: string
  snippet: string
  content?: string
  publishedAt?: string
  source?: string
  rank?: number
  images?: string[]
}

export interface IWebSearchProvider {
  name: WebSearchProviderName
  search(query: string, options?: SearchOptions): Promise<SearchResult>
  validateConfig?(): boolean
}

export interface ToolCallEvent {
  type: 'function_call_arguments_done'
  name: string
  arguments: string
  call_id: string
}

export interface ToolResultEvent {
  type: 'conversation.item.create'
  item: {
    type: 'function_call_output'
    call_id: string
    output: string
  }
}

export interface OpenAIFunction {
  type: 'function'
  function: {
    name: string
    description: string
    parameters: {
      type: 'object'
      properties: Record<string, any>
      required?: string[]
    }
  }
}

export interface ToolGuardrails {
  maxExecutionTime: number
  maxCostCents: number
  rateLimitPerMinute: number
  allowedDomains?: string[]
  blockedDomains?: string[]
  requireValidation: boolean
}

export interface ToolMetrics {
  toolName: string
  executionTime: number
  success: boolean
  error?: string
  cost?: number
  provider?: string
  timestamp: number
}