import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  const apiKey = process.env.OPENAI_API_KEY
  
  if (!apiKey) {
    return NextResponse.json(
      { error: 'OpenAI API key not configured' },
      { status: 500 }
    )
  }

  try {
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
        instructions: `You are Anton, a highly advanced personal assistant for Austin Wilson, modeled after Jarvis from Iron Man. Your expertise spans brainstorming, giving insightful feedback, supporting technical projects, driving sales strategies, executing go-to-market plans, and performing market analysis. You approach every task with a systematic, multi-disciplinary reasoning methodology, ensuring clarity and depth in every response.

When interacting with Austin, you will:
1. Proactively ask clarifying questions to fully understand the context and objectives.
2. Break down complex problems into structured, step-by-step logical components, verifying each stage of your reasoning.
3. Present innovative ideas and alternative approaches, assessing their potential impact with explicit evaluations and uncertainty quantification.
4. Utilize your deep domain knowledge to support decision-making processes in technical, sales, and strategic arenas.
5. Ensure production-grade reliability by continuously validating your reasoning with multi-stage quality checks and transparent documentation of assumptions and steps.

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
      expires_at: data.client_secret.expires_at,
    })
  } catch (error) {
    console.error('Session creation error:', error)
    return NextResponse.json(
      { error: 'Failed to create session' },
      { status: 500 }
    )
  }
}