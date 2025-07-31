# OpenAI Realtime Voice Agent

A real-time voice conversation agent built with Next.js, WebRTC, and OpenAI's Realtime API.

## Features

- Real-time voice conversations with OpenAI's GPT-4
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

1. Click "Connect" to establish a connection with OpenAI's Realtime API
2. Allow microphone access when prompted
3. Start speaking naturally - the AI will respond in real-time
4. View live transcriptions of both your speech and the AI's responses
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