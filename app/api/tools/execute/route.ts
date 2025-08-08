import { NextRequest, NextResponse } from 'next/server'
import { ToolOrchestrator } from '@/lib/tools/orchestrator'
import { ToolConfig, ToolContext } from '@/lib/tools/types'

// Initialize tool orchestrator as singleton
let orchestrator: ToolOrchestrator | null = null

function getOrchestrator(): ToolOrchestrator {
  if (!orchestrator) {
    const toolConfig: ToolConfig = {
      maxToolCallsPerTurn: 5,
      defaultTimeoutMs: 10000,
      webProviderOrder: ['tavily', 'openai'],  // Try Tavily (real search) first, then OpenAI (simulated)
      perToolBudget: {
        web_search: 5,
      },
      retryPolicy: {
        maxRetries: 2,
        backoffMs: 1000
      },
      userLocale: 'en-US',
      searchProfile: 'balanced',
      enableMCP: false
    }
    orchestrator = new ToolOrchestrator(toolConfig)
  }
  return orchestrator
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { toolName, args, callId, conversationId } = body
    
    if (!toolName || !callId) {
      return NextResponse.json(
        { error: 'Missing required parameters' },
        { status: 400 }
      )
    }
    
    // Create tool context
    const context: ToolContext = {
      conversationId,
      requestId: callId,
      config: getOrchestrator().getConfig()
    }
    
    // Handle the tool call
    const toolCallEvent = {
      type: 'function_call_arguments_done' as const,
      name: toolName,
      arguments: JSON.stringify(args),
      call_id: callId
    }
    
    const result = await getOrchestrator().handleToolCall(toolCallEvent, context)
    
    // Parse the output from the result
    let output
    try {
      output = JSON.parse(result.item.output)
    } catch {
      output = result.item.output
    }
    
    // Log tool execution for observability
    console.log('Tool execution:', {
      toolName,
      callId,
      conversationId,
      success: output.success,
      executionTime: output.metadata?.executionTime,
      provider: output.metadata?.provider
    })
    
    return NextResponse.json(output)
    
  } catch (error) {
    console.error('Tool execution error:', error)
    return NextResponse.json(
      { 
        success: false,
        error: error instanceof Error ? error.message : 'Tool execution failed'
      },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  // Return tool metrics
  const metrics = getOrchestrator().getMetrics()
  return NextResponse.json(metrics)
}