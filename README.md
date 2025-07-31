# Anton - Personal AI Assistant

Anton is a highly advanced personal AI assistant modeled after Jarvis from Iron Man, built with Next.js, WebRTC, and OpenAI's Realtime API.

## Features

- Real-time voice conversations with Anton, your personal AI assistant
- Advanced capabilities including:
  - Technical project support and brainstorming
  - Sales strategies and go-to-market planning
  - Market analysis and strategic guidance
  - Multi-disciplinary reasoning and problem-solving
- WebRTC-based audio streaming for low latency
- Automatic speech recognition (STT) and text-to-speech (TTS)
- Live transcription display
- Voice activity detection for natural turn-taking

## Prerequisites

- Node.js 18+ installed
- OpenAI API key with access to the Realtime API

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Configure your OpenAI API key:
   - Copy `.env.local` and add your API key:
   ```
   OPENAI_API_KEY=your-openai-api-key-here
   ```

3. Start the development server:
   ```bash
   npm run dev
   ```

4. Open [http://localhost:3000](http://localhost:3000) in your browser

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

## Security

- Your OpenAI API key never reaches the browser
- Ephemeral tokens are used for WebRTC authentication
- All API calls are made through secure server-side routes