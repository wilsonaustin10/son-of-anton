import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { generateEmbedding } from '@/lib/openai'
import type { Memory } from '@/lib/supabase'

// Store a new memory
export async function POST(request: NextRequest) {
  try {
    // Check if Supabase is configured
    if (!supabaseAdmin) {
      console.error('Supabase admin client not initialized')
      return NextResponse.json({ error: 'Database not configured' }, { status: 500 })
    }
    
    const body: Memory = await request.json()
    console.log('Storing memory:', { speaker: body.speaker, contentLength: body.content?.length })
    
    // Generate embedding for the content
    let embedding: number[] | undefined
    try {
      embedding = await generateEmbedding(body.content)
    } catch (embError) {
      console.error('Failed to generate embedding:', embError)
      // Continue without embedding rather than failing completely
    }
    
    // Store memory with or without embedding
    const { data, error } = await supabaseAdmin
      .from('memories')
      .insert({
        ...body,
        embedding,
        user_id: body.user_id || 'austin',
      })
      .select()
      .single()
    
    if (error) {
      console.error('Supabase error storing memory:', {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint
      })
      return NextResponse.json({ 
        error: 'Failed to store memory', 
        details: error.message 
      }, { status: 500 })
    }
    
    return NextResponse.json({ success: true, data })
  } catch (error) {
    console.error('Memory storage error:', error)
    return NextResponse.json({ 
      error: 'Failed to process memory',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

// Search memories
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const query = searchParams.get('query')
    const limit = parseInt(searchParams.get('limit') || '10')
    const conversationId = searchParams.get('conversation_id')
    
    if (query) {
      // Search by similarity
      const queryEmbedding = await generateEmbedding(query)
      
      const { data, error } = await supabaseAdmin.rpc('search_memories', {
        query_embedding: queryEmbedding,
        match_count: limit,
        similarity_threshold: 0.5,
      })
      
      if (error) {
        console.error('Error searching memories:', error)
        return NextResponse.json({ error: 'Failed to search memories' }, { status: 500 })
      }
      
      return NextResponse.json({ memories: data })
    } else if (conversationId) {
      // Get memories for a specific conversation
      const { data, error } = await supabaseAdmin
        .from('memories')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true })
      
      if (error) {
        console.error('Error fetching conversation memories:', error)
        return NextResponse.json({ error: 'Failed to fetch memories' }, { status: 500 })
      }
      
      return NextResponse.json({ memories: data })
    } else {
      // Get recent memories
      const { data, error } = await supabaseAdmin
        .from('memories')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit)
      
      if (error) {
        console.error('Error fetching recent memories:', error)
        return NextResponse.json({ error: 'Failed to fetch memories' }, { status: 500 })
      }
      
      return NextResponse.json({ memories: data })
    }
  } catch (error) {
    console.error('Memory retrieval error:', error)
    return NextResponse.json({ error: 'Failed to retrieve memories' }, { status: 500 })
  }
}