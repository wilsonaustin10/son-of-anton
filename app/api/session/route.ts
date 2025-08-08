import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { generateEmbedding } from '@/lib/openai'

// Helper function to retrieve relevant memories
async function getRelevantMemories(initialContext?: string): Promise<string> {
  try {
    // Get recent memories
    const { data: recentMemories } = await supabaseAdmin
      .from('memories')
      .select('speaker, content, created_at')
      .order('created_at', { ascending: false })
      .limit(5)
    
    // Get recent summaries
    const { data: recentSummaries } = await supabaseAdmin
      .from('conversation_summaries')
      .select('summary, key_topics, action_items')
      .order('created_at', { ascending: false })
      .limit(3)
    
    // If there's initial context, search for relevant memories
    let relevantMemories: any[] = []
    if (initialContext) {
      const embedding = await generateEmbedding(initialContext)
      const { data: searchResults } = await supabaseAdmin.rpc('search_memories', {
        query_embedding: embedding,
        match_count: 5,
        similarity_threshold: 0.6,
      })
      relevantMemories = searchResults || []
    }
    
    // Format memory context
    let memoryContext = ''
    
    if (recentSummaries && recentSummaries.length > 0) {
      memoryContext += 'Recent conversation summaries:\n'
      recentSummaries.forEach(s => {
        memoryContext += `- ${s.summary}\n`
        if (s.key_topics?.length > 0) {
          memoryContext += `  Topics: ${s.key_topics.join(', ')}\n`
        }
        if (s.action_items?.length > 0) {
          memoryContext += `  Action items: ${s.action_items.join(', ')}\n`
        }
      })
      memoryContext += '\n'
    }
    
    if (relevantMemories.length > 0) {
      memoryContext += 'Relevant past conversations:\n'
      relevantMemories.forEach(m => {
        memoryContext += `- ${m.speaker}: ${m.content}\n`
      })
      memoryContext += '\n'
    }
    
    if (recentMemories && recentMemories.length > 0) {
      memoryContext += 'Recent interactions:\n'
      recentMemories.forEach(m => {
        memoryContext += `- ${m.speaker}: ${m.content}\n`
      })
    }
    
    return memoryContext
  } catch (error) {
    console.error('Error retrieving memories:', error)
    return ''
  }
}

export async function POST(request: NextRequest) {
  const apiKey = process.env.OPENAI_API_KEY
  
  if (!apiKey) {
    return NextResponse.json(
      { error: 'OpenAI API key not configured' },
      { status: 500 }
    )
  }

  try {
    // Get request body if available
    const body = await request.json().catch(() => ({}))
    const initialContext = body.context || ''
    
    // Retrieve relevant memories
    const memoryContext = await getRelevantMemories(initialContext)
    // Mint ephemeral token from OpenAI
    const response = await fetch('https://api.openai.com/v1/realtime/sessions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-realtime-preview-2024-12-17',
        voice: 'echo',
        tools: [
          {
            type: 'function',
            name: 'web_search',
            description: 'Search the web for current information',
            parameters: {
              type: 'object',
              properties: {
                query: {
                  type: 'string',
                  description: 'The search query'
                },
                maxResults: {
                  type: 'number',
                  description: 'Maximum number of results to return'
                },
                searchDepth: {
                  type: 'string',
                  description: 'Search depth (basic or advanced)',
                  enum: ['basic', 'advanced']
                }
              },
              required: ['query']
            }
          }
        ],
        tool_choice: 'auto',
        instructions: `You are Anton, a highly advanced personal assistant for Austin Wilson, modeled after Jarvis from Iron Man. Your expertise spans brainstorming, giving insightful feedback, supporting technical projects, driving sales strategies, executing go-to-market plans, and performing market analysis. You approach every task with a systematic, multi-disciplinary reasoning methodology, ensuring clarity and depth in every response.

IMPORTANT: You have access to a web_search tool that provides REAL-TIME, CURRENT information from the internet. Always use this tool when:
- Asked about current events, news, or who holds political offices
- Needing information after your knowledge cutoff
- Verifying facts that may have changed
- Austin asks anything requiring up-to-date information

The web search tool returns actual search results from the internet, not simulated data. Trust and use these results to provide accurate, current information.

${memoryContext ? `Based on our previous interactions:\n${memoryContext}\n` : ''}

When interacting with Austin, you will:
1. Proactively ask clarifying questions to fully understand the context and objectives.
2. Break down complex problems into structured, step-by-step logical components, verifying each stage of your reasoning.
3. Present innovative ideas and alternative approaches, assessing their potential impact with explicit evaluations and uncertainty quantification.
4. Utilize your deep domain knowledge to support decision-making processes in technical, sales, and strategic arenas.
5. Ensure production-grade reliability by continuously validating your reasoning with multi-stage quality checks and transparent documentation of assumptions and steps.
6. Reference relevant past conversations, decisions, and action items when appropriate to maintain continuity and build upon previous discussions.

Your responses should be thorough, articulate, and grounded in a robust analytical framework, always aiming to deliver actionable insights and strategic guidance in a clear and methodical manner.`,
        turn_detection: {
          type: 'server_vad',
          threshold: 0.5,
          prefix_padding_ms: 300,
          silence_duration_ms: 500,
        },
        input_audio_transcription: {
          model: 'whisper-1',
        },
      }),
    })

    if (!response.ok) {
      const error = await response.json()
      return NextResponse.json(
        { error: 'Failed to create session', details: error },
        { status: response.status }
      )
    }

    const data = await response.json()
    
    // Return the ephemeral token to the client
    return NextResponse.json({
      token: data.client_secret.value,
      expires_at: data.client_secret.expires_at
    })
  } catch (error) {
    console.error('Session creation error:', error)
    return NextResponse.json(
      { error: 'Failed to create session' },
      { status: 500 }
    )
  }
}