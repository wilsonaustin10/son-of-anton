import { ToolConfig } from './types'

export const defaultToolConfig: ToolConfig = {
  maxToolCallsPerTurn: 5,
  defaultTimeoutMs: 10000,
  webProviderOrder: ['openai', 'tavily'],
  perToolBudget: {
    web_search: 5,
    file_search: 3,
    memory_search: 2,
  },
  retryPolicy: {
    maxRetries: 2,
    backoffMs: 1000,
    shouldRetry: (error: any) => {
      // Retry on network errors and timeouts
      return error.code === 'ECONNRESET' || 
             error.code === 'ETIMEDOUT' ||
             error.message?.includes('timeout') ||
             error.message?.includes('network')
    }
  },
  userLocale: process.env.USER_LOCALE || 'en-US',
  locationHints: process.env.USER_LOCATION,
  cacheTTL: 300000, // 5 minutes
  searchProfile: 'balanced',
  enableMCP: false,
  mcpServers: []
}

export function getToolConfigFromEnv(): Partial<ToolConfig> {
  const config: Partial<ToolConfig> = {}
  
  if (process.env.MAX_TOOL_CALLS_PER_TURN) {
    config.maxToolCallsPerTurn = parseInt(process.env.MAX_TOOL_CALLS_PER_TURN)
  }
  
  if (process.env.DEFAULT_TOOL_TIMEOUT_MS) {
    config.defaultTimeoutMs = parseInt(process.env.DEFAULT_TOOL_TIMEOUT_MS)
  }
  
  if (process.env.WEB_PROVIDER_ORDER) {
    config.webProviderOrder = process.env.WEB_PROVIDER_ORDER.split(',') as any
  }
  
  if (process.env.SEARCH_PROFILE) {
    config.searchProfile = process.env.SEARCH_PROFILE as any
  }
  
  if (process.env.ENABLE_MCP) {
    config.enableMCP = process.env.ENABLE_MCP === 'true'
  }
  
  return config
}

export function mergeToolConfig(
  base: ToolConfig,
  ...overrides: Partial<ToolConfig>[]
): ToolConfig {
  return overrides.reduce((acc, override) => ({
    ...acc,
    ...override,
    perToolBudget: {
      ...acc.perToolBudget,
      ...override.perToolBudget
    },
    retryPolicy: {
      ...acc.retryPolicy,
      ...override.retryPolicy
    }
  }), base)
}