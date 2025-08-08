# Anton - Personal AI Assistant

Anton is a highly advanced personal AI assistant modeled after Jarvis from Iron Man, built with Next.js, WebRTC, and OpenAI's Realtime API.

## Features

- Real-time voice conversations with Anton, your personal AI assistant
- Advanced capabilities including:
  - Technical project support and brainstorming
  - Sales strategies and go-to-market planning
  - Market analysis and strategic guidance
  - Multi-disciplinary reasoning and problem-solving
- **Long-term memory** powered by Supabase and pgvector:
  - Automatic conversation storage with embeddings
  - Semantic search for relevant past conversations
  - Session summaries with key topics and action items
  - Context-aware responses based on conversation history
- WebRTC-based audio streaming for low latency
- Automatic speech recognition (STT) and text-to-speech (TTS)
- Live transcription display
- Voice activity detection for natural turn-taking

## Prerequisites

- Node.js 18+ installed
- OpenAI API key with access to the Realtime API
- Supabase project with pgvector extension enabled

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Configure your environment variables in `.env.local`:
   ```
   # OpenAI API Key
   OPENAI_API_KEY=your-openai-api-key-here
   
   # Supabase Configuration
   NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
   SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key
   ```

3. Set up Supabase database:
   - Go to your Supabase project dashboard
   - Navigate to Database > Extensions and enable "vector" extension
   - Go to SQL Editor and run the migration from `supabase/migrations/20240801_create_memories_table.sql`
   - See `SETUP_DATABASE.md` for detailed instructions

4. Start the development server:
   ```bash
   npm run dev
   ```

5. Open [http://localhost:3000](http://localhost:3000) in your browser

## Usage

1. Click "Connect" to wake up Anton
2. Allow microphone access when prompted
3. Start speaking naturally - Anton will respond with:
   - Clarifying questions to understand your needs
   - Structured analysis and step-by-step breakdowns
   - Innovative ideas and alternative approaches
   - Strategic guidance and actionable insights
4. View live transcriptions of your conversation
5. Click "Disconnect" to end the session

## Architecture

- **Frontend**: Next.js with React hooks for state management
- **WebRTC**: Direct peer connection to OpenAI for minimal latency
- **Authentication**: Ephemeral tokens minted server-side for security
- **Audio Processing**: Browser-native echo cancellation and noise suppression
- **Memory System**: 
  - Supabase with pgvector for vector storage and similarity search
  - OpenAI embeddings for semantic search capabilities
  - Automatic conversation summarization
  - Context injection into system prompts

## Security

- Your OpenAI API key never reaches the browser
- Ephemeral tokens are used for WebRTC authentication
- All API calls are made through secure server-side routes