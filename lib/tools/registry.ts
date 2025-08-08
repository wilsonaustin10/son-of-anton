import { 
  Tool, 
  ToolConfig, 
  ToolContext, 
  ToolResult, 
  OpenAIFunction,
  ToolMetrics,
  ToolGuardrails
} from './types'

export class ToolRegistry {
  private tools: Map<string, Tool> = new Map()
  private config: ToolConfig
  private metrics: ToolMetrics[] = []
  private rateLimitMap: Map<string, number[]> = new Map()
  
  constructor(config: ToolConfig) {
    this.config = config
  }
  
  register<TParams = any, TResult = any>(tool: Tool<TParams, TResult>): void {
    if (this.tools.has(tool.name)) {
      throw new Error(`Tool ${tool.name} is already registered`)
    }
    this.tools.set(tool.name, tool)
  }
  
  unregister(name: string): void {
    this.tools.delete(name)
  }
  
  getAvailableTools(context?: Partial<ToolContext>): Tool[] {
    const tools = Array.from(this.tools.values())
    
    // Filter tools based on context (e.g., user permissions, device capabilities)
    return tools.filter(tool => {
      // Add filtering logic here based on context
      return true
    })
  }
  
  getTool(name: string): Tool | undefined {
    return this.tools.get(name)
  }
  
  getOpenAISchema(): OpenAIFunction[] {
    return Array.from(this.tools.values()).map(tool => ({
      type: 'function',
      function: {
        name: tool.name,
        description: tool.description,
        parameters: {
          type: 'object',
          properties: tool.parameters.reduce((acc, param) => {
            acc[param.name] = {
              type: param.type,
              description: param.description,
              enum: param.enum,
              default: param.default
            }
            return acc
          }, {} as Record<string, any>),
          required: tool.parameters
            .filter(p => p.required !== false)
            .map(p => p.name)
        }
      }
    }))
  }
  
  async execute(
    name: string, 
    params: any, 
    context: ToolContext
  ): Promise<ToolResult> {
    const startTime = Date.now()
    const tool = this.tools.get(name)
    
    if (!tool) {
      return {
        success: false,
        error: `Tool ${name} not found`
      }
    }
    
    try {
      // Check rate limits
      if (!this.checkRateLimit(name)) {
        return {
          success: false,
          error: `Rate limit exceeded for tool ${name}`
        }
      }
      
      // Validate parameters
      if (tool.validate) {
        const validation = tool.validate(params)
        if (validation !== true) {
          return {
            success: false,
            error: typeof validation === 'string' ? validation : 'Invalid parameters'
          }
        }
      }
      
      // Apply safe parameters transformation
      const safeParams = tool.safeParams ? tool.safeParams(params) : params
      
      // Create timeout signal
      const timeoutMs = tool.timeoutMs || this.config.defaultTimeoutMs
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs)
      
      // Merge abort signals
      const signal = context.signal 
        ? AbortSignal.any([context.signal, controller.signal])
        : controller.signal
      
      // Execute tool with timeout
      const result = await tool.execute(safeParams, {
        ...context,
        signal
      })
      
      clearTimeout(timeoutId)
      
      // Record metrics
      const executionTime = Date.now() - startTime
      this.recordMetrics({
        toolName: name,
        executionTime,
        success: result.success,
        error: result.error,
        cost: result.metadata?.cost,
        provider: result.metadata?.provider,
        timestamp: Date.now()
      })
      
      // Add execution time to metadata
      return {
        ...result,
        metadata: {
          ...result.metadata,
          executionTime
        }
      }
      
    } catch (error) {
      const executionTime = Date.now() - startTime
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      
      // Record error metrics
      this.recordMetrics({
        toolName: name,
        executionTime,
        success: false,
        error: errorMessage,
        timestamp: Date.now()
      })
      
      // Handle retries if configured
      if (tool.retryPolicy && this.shouldRetry(error, tool.retryPolicy)) {
        // Implement retry logic here
        await new Promise(resolve => setTimeout(resolve, tool.retryPolicy.backoffMs))
        return this.execute(name, params, context)
      }
      
      return {
        success: false,
        error: errorMessage,
        metadata: {
          executionTime
        }
      }
    }
  }
  
  private checkRateLimit(toolName: string): boolean {
    const now = Date.now()
    const windowMs = 60000 // 1 minute window
    const limit = this.config.perToolBudget[toolName] || 10
    
    const calls = this.rateLimitMap.get(toolName) || []
    const recentCalls = calls.filter(time => now - time < windowMs)
    
    if (recentCalls.length >= limit) {
      return false
    }
    
    recentCalls.push(now)
    this.rateLimitMap.set(toolName, recentCalls)
    return true
  }
  
  private shouldRetry(error: any, retryPolicy: any): boolean {
    if (retryPolicy.shouldRetry) {
      return retryPolicy.shouldRetry(error)
    }
    
    // Default retry logic for network errors
    return error.code === 'ECONNRESET' || 
           error.code === 'ETIMEDOUT' ||
           error.message?.includes('timeout')
  }
  
  private recordMetrics(metrics: ToolMetrics): void {
    this.metrics.push(metrics)
    
    // Keep only last 1000 metrics
    if (this.metrics.length > 1000) {
      this.metrics = this.metrics.slice(-1000)
    }
  }
  
  getMetrics(toolName?: string): ToolMetrics[] {
    if (toolName) {
      return this.metrics.filter(m => m.toolName === toolName)
    }
    return this.metrics
  }
  
  getMetricsSummary(toolName?: string) {
    const metrics = this.getMetrics(toolName)
    
    if (metrics.length === 0) {
      return null
    }
    
    const successCount = metrics.filter(m => m.success).length
    const totalTime = metrics.reduce((sum, m) => sum + m.executionTime, 0)
    const totalCost = metrics.reduce((sum, m) => sum + (m.cost || 0), 0)
    
    return {
      totalCalls: metrics.length,
      successRate: successCount / metrics.length,
      averageExecutionTime: totalTime / metrics.length,
      totalCost,
      p95ExecutionTime: this.calculatePercentile(
        metrics.map(m => m.executionTime), 
        0.95
      ),
      errorRate: 1 - (successCount / metrics.length),
      errors: metrics
        .filter(m => !m.success)
        .map(m => m.error)
        .filter((v, i, a) => a.indexOf(v) === i) // unique errors
    }
  }
  
  private calculatePercentile(values: number[], percentile: number): number {
    const sorted = values.sort((a, b) => a - b)
    const index = Math.ceil(sorted.length * percentile) - 1
    return sorted[index] || 0
  }
  
  clearMetrics(): void {
    this.metrics = []
  }
  
  updateConfig(config: Partial<ToolConfig>): void {
    this.config = { ...this.config, ...config }
  }
  
  getConfig(): ToolConfig {
    return this.config
  }
}