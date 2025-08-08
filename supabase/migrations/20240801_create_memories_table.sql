-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Create memories table for storing conversation history
CREATE TABLE IF NOT EXISTS memories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  user_id TEXT NOT NULL DEFAULT 'austin',
  conversation_id UUID,
  speaker TEXT NOT NULL CHECK (speaker IN ('austin', 'anton')),
  content TEXT NOT NULL,
  embedding vector(1536), -- OpenAI embeddings are 1536 dimensions
  metadata JSONB DEFAULT '{}',
  importance_score FLOAT DEFAULT 0.5,
  tags TEXT[] DEFAULT '{}'
);

-- Create indexes for efficient querying
CREATE INDEX idx_memories_created_at ON memories(created_at DESC);
CREATE INDEX idx_memories_user_id ON memories(user_id);
CREATE INDEX idx_memories_conversation_id ON memories(conversation_id);
CREATE INDEX idx_memories_embedding ON memories USING ivfflat (embedding vector_cosine_ops);

-- Create a function to search memories by similarity
CREATE OR REPLACE FUNCTION search_memories(
  query_embedding vector(1536),
  match_count INT DEFAULT 10,
  similarity_threshold FLOAT DEFAULT 0.5
)
RETURNS TABLE (
  id UUID,
  created_at TIMESTAMP WITH TIME ZONE,
  speaker TEXT,
  content TEXT,
  similarity FLOAT,
  metadata JSONB
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    m.id,
    m.created_at,
    m.speaker,
    m.content,
    1 - (m.embedding <=> query_embedding) AS similarity,
    m.metadata
  FROM memories m
  WHERE m.embedding IS NOT NULL
    AND (1 - (m.embedding <=> query_embedding)) > similarity_threshold
  ORDER BY m.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Create conversation_summaries table for storing session summaries
CREATE TABLE IF NOT EXISTS conversation_summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  summary TEXT NOT NULL,
  key_topics TEXT[] DEFAULT '{}',
  action_items TEXT[] DEFAULT '{}',
  decisions TEXT[] DEFAULT '{}',
  embedding vector(1536)
);

-- Create index for conversation summaries
CREATE INDEX idx_conversation_summaries_conversation_id ON conversation_summaries(conversation_id);
CREATE INDEX idx_conversation_summaries_embedding ON conversation_summaries USING ivfflat (embedding vector_cosine_ops);

-- Create a view for recent memories
CREATE VIEW recent_memories AS
SELECT * FROM memories
WHERE created_at > NOW() - INTERVAL '7 days'
ORDER BY created_at DESC;