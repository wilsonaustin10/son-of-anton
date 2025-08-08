import { ToolOrchestrator } from './orchestrator'
import { ToolConfig, ToolContext, ToolCallEvent } from './types'
import { defaultToolConfig } from './config'

export class ToolTestRunner {
  private orchestrator: ToolOrchestrator
  
  constructor(config?: Partial<ToolConfig>) {
    const testConfig = {
      ...defaultToolConfig,
      ...config
    }
    this.orchestrator = new ToolOrchestrator(testConfig)
  }
  
  async testWebSearch(query: string = 'OpenAI latest news') {
    console.log('\n=== Testing Web Search Tool ===')
    console.log(`Query: ${query}`)
    
    const context: ToolContext = {
      requestId: 'test-' + Date.now(),
      config: this.orchestrator.getConfig()
    }
    
    const event: ToolCallEvent = {
      type: 'function_call_arguments_done',
      name: 'web_search',
      arguments: JSON.stringify({ query, maxResults: 3 }),
      call_id: 'test-call-' + Date.now()
    }
    
    try {
      const startTime = Date.now()
      const result = await this.orchestrator.handleToolCall(event, context)
      const executionTime = Date.now() - startTime
      
      const output = JSON.parse(result.item.output)
      
      console.log(`\nExecution time: ${executionTime}ms`)
      console.log(`Success: ${output.success}`)
      
      if (output.success) {
        console.log(`Provider: ${output.metadata?.provider}`)
        console.log(`Results found: ${output.data?.results?.length || 0}`)
        
        if (output.citations) {
          console.log('\nTop results:')
          output.citations.slice(0, 3).forEach((citation: any, i: number) => {
            console.log(`${i + 1}. ${citation.title}`)
            console.log(`   ${citation.url}`)
            console.log(`   ${citation.snippet?.substring(0, 100)}...`)
          })
        }
      } else {
        console.log(`Error: ${output.error}`)
      }
      
      return output
    } catch (error) {
      console.error('Test failed:', error)
      throw error
    }
  }
  
  async testRateLimiting() {
    console.log('\n=== Testing Rate Limiting ===')
    
    const context: ToolContext = {
      requestId: 'rate-test',
      conversationId: 'rate-test-conv',
      config: this.orchestrator.getConfig()
    }
    
    const promises = []
    const maxCalls = this.orchestrator.getConfig().maxToolCallsPerTurn + 2
    
    for (let i = 0; i < maxCalls; i++) {
      const event: ToolCallEvent = {
        type: 'function_call_arguments_done',
        name: 'web_search',
        arguments: JSON.stringify({ query: `test query ${i}` }),
        call_id: `rate-test-${i}`
      }
      promises.push(this.orchestrator.handleToolCall(event, context))
    }
    
    const results = await Promise.all(promises)
    
    let successCount = 0
    let rateLimitedCount = 0
    
    results.forEach((result, i) => {
      const output = JSON.parse(result.item.output)
      if (output.success) {
        successCount++
      } else if (output.error?.includes('Maximum tool calls')) {
        rateLimitedCount++
      }
    })
    
    console.log(`Attempted calls: ${maxCalls}`)
    console.log(`Successful calls: ${successCount}`)
    console.log(`Rate limited calls: ${rateLimitedCount}`)
    
    // Reset turn counters
    this.orchestrator.resetTurnCounters('rate-test-conv')
    
    return {
      attempted: maxCalls,
      successful: successCount,
      rateLimited: rateLimitedCount
    }
  }
  
  async testProviderFallback() {
    console.log('\n=== Testing Provider Fallback ===')
    
    // Temporarily modify config to test fallback
    const originalConfig = this.orchestrator.getConfig()
    this.orchestrator.updateConfig({
      webProviderOrder: ['openai', 'tavily'] // Will try OpenAI first, then Tavily
    })
    
    const context: ToolContext = {
      requestId: 'fallback-test',
      config: this.orchestrator.getConfig()
    }
    
    const event: ToolCallEvent = {
      type: 'function_call_arguments_done',
      name: 'web_search',
      arguments: JSON.stringify({ query: 'test fallback mechanism' }),
      call_id: 'fallback-test-call'
    }
    
    const result = await this.orchestrator.handleToolCall(event, context)
    const output = JSON.parse(result.item.output)
    
    console.log(`Success: ${output.success}`)
    console.log(`Provider used: ${output.metadata?.provider || 'unknown'}`)
    
    // Restore original config
    this.orchestrator.updateConfig(originalConfig)
    
    return output
  }
  
  getMetrics() {
    return this.orchestrator.getMetrics()
  }
}

// CLI test runner
if (require.main === module) {
  async function runTests() {
    const runner = new ToolTestRunner()
    
    try {
      // Test web search
      await runner.testWebSearch('OpenAI GPT-4 news 2025')
      
      // Test rate limiting
      await runner.testRateLimiting()
      
      // Test provider fallback
      await runner.testProviderFallback()
      
      // Show metrics
      console.log('\n=== Overall Metrics ===')
      console.log(JSON.stringify(runner.getMetrics(), null, 2))
      
    } catch (error) {
      console.error('Test suite failed:', error)
      process.exit(1)
    }
  }
  
  runTests()
}