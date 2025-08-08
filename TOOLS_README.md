# Tools Feature Documentation

## Overview
The tools feature provides Anton with the ability to execute various functions including web search, with a robust orchestration layer that ensures reliability, safety, and observability.

## Architecture

### Core Components

1. **Tool Registry** (`lib/tools/registry.ts`)
   - Manages available tools
   - Generates OpenAI function schemas
   - Handles tool execution with timeouts and retries
   - Tracks metrics and performance

2. **Tool Orchestrator** (`lib/tools/orchestrator.ts`)
   - Coordinates tool execution
   - Enforces guardrails (rate limits, budgets)
   - Manages provider fallbacks
   - Handles Realtime API integration

3. **Search Providers** (`lib/tools/providers/`)
   - **Tavily**: Advanced web search with content extraction
   - **OpenAI Web**: Native OpenAI web search (via Responses API)
   - Extensible base class for adding new providers

## Configuration

### Environment Variables
```bash
# Required
OPENAI_API_KEY=your_key

# Optional - for Tavily search
TAVILY_API_KEY=your_tavily_key

# Tool Settings
MAX_TOOL_CALLS_PER_TURN=5
DEFAULT_TOOL_TIMEOUT_MS=10000
WEB_PROVIDER_ORDER=openai,tavily
SEARCH_PROFILE=balanced
```

### Tool Config Structure
```typescript
{
  maxToolCallsPerTurn: 5,        // Max tools per conversation turn
  defaultTimeoutMs: 10000,        // Default timeout for tools
  webProviderOrder: ['openai', 'tavily'],  // Provider priority
  perToolBudget: {                // Cost limits per tool
    web_search: 5
  },
  retryPolicy: {                  // Retry configuration
    maxRetries: 2,
    backoffMs: 1000
  }
}
```

## Features

### 1. Web Search
- Multiple provider support with automatic fallback
- Search depth control (basic/advanced)
- Location and locale awareness
- Citation tracking with sources

### 2. Guardrails & Safety
- Rate limiting per conversation turn
- Budget controls per tool
- Timeout protection
- Input validation and sanitization

### 3. Observability
- Execution time tracking
- Success/failure metrics
- Cost tracking per provider
- P95 latency monitoring

### 4. Realtime API Integration
- Seamless function calling during voice conversations
- Non-blocking tool execution
- Real-time status updates in UI

## Usage

### In Voice Conversations
When talking to Anton, you can ask questions that require current information:
- "What's the latest news about OpenAI?"
- "Search for recent developments in AI"
- "Find information about [topic]"

### Tool Execution Flow
1. Anton recognizes need for tool use
2. Sends function call via Realtime API
3. Client executes tool via `/api/tools/execute`
4. Results returned to Anton
5. Anton incorporates results in response

## Testing

Run the test suite:
```bash
npx ts-node lib/tools/test-utils.ts
```

Tests include:
- Web search functionality
- Rate limiting enforcement
- Provider fallback mechanisms
- Metrics collection

## Extending the System

### Adding a New Tool
1. Define the tool in the orchestrator:
```typescript
registry.register({
  name: 'my_tool',
  description: 'Tool description',
  parameters: [...],
  execute: async (params, context) => {
    // Tool logic
    return { success: true, data: result }
  }
})
```

### Adding a Search Provider
1. Create provider class extending `BaseSearchProvider`
2. Implement the `search` method
3. Register in `SearchProviderFactory`
4. Add to `webProviderOrder` config

## Performance Considerations

- **Timeouts**: Default 10s, configurable per tool
- **Retries**: Automatic retry on network failures
- **Caching**: 5-minute cache for identical queries
- **Rate Limits**: 5 tools per turn default

## Security

- API keys stored as environment variables
- Input validation on all tool parameters
- Domain filtering for web searches (configurable)
- No execution of arbitrary code

## Monitoring

Access metrics via:
```
GET /api/tools/execute
```

Returns:
- Total executions
- Success rates
- Average execution times
- P95 latencies
- Cost breakdown

## Future Enhancements

- [ ] MCP (Model Context Protocol) support
- [ ] Additional search providers (Serper, Bing)
- [ ] File search capabilities
- [ ] Custom tool definitions via UI
- [ ] Tool result caching strategies
- [ ] Advanced query rewriting