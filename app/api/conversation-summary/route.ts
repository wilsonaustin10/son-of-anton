import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { generateEmbedding, generateSummary } from '@/lib/openai'

export async function POST(request: NextRequest) {
  try {
    // Check if Supabase is configured
    if (!supabaseAdmin) {
      console.error('Supabase admin client not initialized')
      return NextResponse.json({ error: 'Database not configured' }, { status: 500 })
    }
    
    const { conversationId } = await request.json()
    
    if (!conversationId) {
      return NextResponse.json({ error: 'Conversation ID required' }, { status: 400 })
    }
    
    // Fetch all memories for this conversation
    const { data: memories, error: fetchError } = await supabaseAdmin
      .from('memories')
      .select('speaker, content')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })
    
    if (fetchError || !memories || memories.length === 0) {
      return NextResponse.json({ error: 'No memories found for conversation' }, { status: 404 })
    }
    
    // Format messages for summary
    const messages = memories.map((m: { speaker: string; content: string }) => `${m.speaker}: ${m.content}`)
    
    // Generate summary using OpenAI
    const { summary, keyTopics, actionItems, decisions } = await generateSummary(messages)
    
    // Generate embedding for the summary
    const embedding = await generateEmbedding(summary)
    
    // Store the summary
    const { data, error } = await supabaseAdmin
      .from('conversation_summaries')
      .insert({
        conversation_id: conversationId,
        summary,
        key_topics: keyTopics,
        action_items: actionItems,
        decisions,
        embedding,
      })
      .select()
      .single()
    
    if (error) {
      console.error('Error storing summary:', error)
      return NextResponse.json({ error: 'Failed to store summary' }, { status: 500 })
    }
    
    return NextResponse.json({ success: true, data })
  } catch (error) {
    console.error('Summary generation error:', error)
    return NextResponse.json({ error: 'Failed to generate summary' }, { status: 500 })
  }
}

// Get conversation summaries
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const conversationId = searchParams.get('conversation_id')
    const limit = parseInt(searchParams.get('limit') || '10')
    
    if (conversationId) {
      // Get summary for specific conversation
      const { data, error } = await supabaseAdmin
        .from('conversation_summaries')
        .select('*')
        .eq('conversation_id', conversationId)
        .single()
      
      if (error) {
        return NextResponse.json({ error: 'Summary not found' }, { status: 404 })
      }
      
      return NextResponse.json({ summary: data })
    } else {
      // Get recent summaries
      const { data, error } = await supabaseAdmin
        .from('conversation_summaries')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit)
      
      if (error) {
        console.error('Error fetching summaries:', error)
        return NextResponse.json({ error: 'Failed to fetch summaries' }, { status: 500 })
      }
      
      return NextResponse.json({ summaries: data })
    }
  } catch (error) {
    console.error('Summary retrieval error:', error)
    return NextResponse.json({ error: 'Failed to retrieve summaries' }, { status: 500 })
  }
}