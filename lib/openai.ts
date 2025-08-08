import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

export async function generateEmbedding(text: string): Promise<number[]> {
  try {
    const response = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: text,
    })
    
    return response.data[0].embedding
  } catch (error) {
    console.error('Error generating embedding:', error)
    throw new Error('Failed to generate embedding')
  }
}

export async function generateSummary(messages: string[]): Promise<{
  summary: string
  keyTopics: string[]
  actionItems: string[]
  decisions: string[]
}> {
  try {
    const prompt = `Analyze this conversation and provide:
1. A concise summary (2-3 sentences)
2. Key topics discussed (as an array)
3. Action items mentioned (as an array)
4. Important decisions made (as an array)

Conversation:
${messages.join('\n')}

Respond in JSON format:
{
  "summary": "...",
  "keyTopics": ["..."],
  "actionItems": ["..."],
  "decisions": ["..."]
}`

    const response = await openai.chat.completions.create({
      model: 'gpt-4-turbo-preview',
      messages: [
        {
          role: 'system',
          content: 'You are a conversation analyzer. Extract key information from conversations in a structured format.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.3,
    })

    const result = JSON.parse(response.choices[0].message.content || '{}')
    
    return {
      summary: result.summary || '',
      keyTopics: result.keyTopics || [],
      actionItems: result.actionItems || [],
      decisions: result.decisions || [],
    }
  } catch (error) {
    console.error('Error generating summary:', error)
    throw new Error('Failed to generate summary')
  }
}