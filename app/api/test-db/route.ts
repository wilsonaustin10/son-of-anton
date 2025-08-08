import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  try {
    // Test environment variables
    const envCheck = {
      NEXT_PUBLIC_SUPABASE_URL: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      SUPABASE_SERVICE_ROLE_KEY: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
      OPENAI_API_KEY: !!process.env.OPENAI_API_KEY,
    }
    
    // Check if Supabase client is initialized
    if (!supabaseAdmin) {
      return NextResponse.json({ 
        error: 'Supabase not initialized',
        envCheck 
      }, { status: 500 })
    }
    
    // Test database connection by checking if memories table exists
    const { data: tables, error: tablesError } = await supabaseAdmin
      .from('memories')
      .select('id')
      .limit(1)
    
    if (tablesError) {
      // Check if it's a "table doesn't exist" error
      if (tablesError.message.includes('relation') && tablesError.message.includes('does not exist')) {
        return NextResponse.json({ 
          error: 'Database tables not created',
          message: 'Please run the migration in supabase/migrations/20240801_create_memories_table.sql',
          envCheck,
          dbError: tablesError.message
        }, { status: 500 })
      }
      
      return NextResponse.json({ 
        error: 'Database connection error',
        envCheck,
        dbError: tablesError.message 
      }, { status: 500 })
    }
    
    // Test pgvector extension
    let vectorEnabled = false
    try {
      const { data: extensions, error: extError } = await supabaseAdmin
        .rpc('get_available_extensions')
      
      if (!extError && extensions) {
        vectorEnabled = extensions.some((ext: any) => ext.name === 'vector' && ext.installed_version)
      }
    } catch (e) {
      // Extension check failed, but that's okay
      vectorEnabled = false
    }
    
    return NextResponse.json({ 
      success: true,
      envCheck,
      database: 'Connected',
      tablesExist: !tablesError,
      pgvectorEnabled: vectorEnabled || 'Could not verify',
      message: 'Database connection successful'
    })
    
  } catch (error) {
    return NextResponse.json({ 
      error: 'Test failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}