'use client'

import { useState, useEffect } from 'react'
import { useRealtimeAgent, RealtimeEvent } from '../hooks/useRealtimeAgent'

export default function VoiceAgent() {
  const [transcripts, setTranscripts] = useState<Array<{ text: string; speaker: 'austin' | 'anton'; timestamp: Date }>>([])
  const [currentUserTranscript, setCurrentUserTranscript] = useState('')
  const [currentAssistantTranscript, setCurrentAssistantTranscript] = useState('')
  const [events, setEvents] = useState<RealtimeEvent[]>([])
  const [conversationId, setConversationId] = useState<string>('')
  const [showMemory, setShowMemory] = useState(false)
  const [recentMemories, setRecentMemories] = useState<any[]>([])
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [isListening, setIsListening] = useState(false)
  
  // Generate a new conversation ID when component mounts
  useEffect(() => {
    setConversationId(crypto.randomUUID())
  }, [])
  
  const {
    isConnected,
    isConnecting,
    error,
    connect,
    disconnect,
    sendMessage,
  } = useRealtimeAgent({
    conversationId,
    onEvent: (event) => {
      setEvents(prev => [...prev.slice(-50), event]) // Keep last 50 events
      
      // Handle assistant responses
      if (event.type === 'response.audio_transcript.delta' && event.delta) {
        setCurrentAssistantTranscript(prev => prev + event.delta)
        setIsSpeaking(true)
        setIsListening(false)
      } else if (event.type === 'response.audio_transcript.done' && event.transcript) {
        setTranscripts(prev => [...prev, {
          text: event.transcript,
          speaker: 'anton',
          timestamp: new Date(),
        }])
        setCurrentAssistantTranscript('')
        setIsSpeaking(false)
      } else if (event.type === 'input_audio_buffer.speech_started') {
        setIsListening(true)
        setIsSpeaking(false)
      } else if (event.type === 'input_audio_buffer.speech_stopped') {
        setIsListening(false)
      }
    },
    onTranscript: (transcript, isFinal, speaker) => {
      if (speaker === 'austin') {
        if (isFinal) {
          setTranscripts(prev => [...prev, {
            text: transcript,
            speaker: 'austin',
            timestamp: new Date(),
          }])
          setCurrentUserTranscript('')
        } else {
          setCurrentUserTranscript(transcript)
        }
      } else if (speaker === 'anton') {
        if (isFinal) {
          setTranscripts(prev => [...prev, {
            text: transcript,
            speaker: 'anton',
            timestamp: new Date(),
          }])
          setCurrentAssistantTranscript('')
        } else {
          setCurrentAssistantTranscript(prev => prev + transcript)
        }
      }
    },
    onError: (err) => {
      console.error('Voice agent error:', err)
    },
  })

  const handleConnect = async () => {
    await connect()
  }

  const handleDisconnect = async () => {
    // Generate conversation summary if there are transcripts
    if (transcripts.length > 0 && conversationId) {
      try {
        await fetch('/api/conversation-summary', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ conversationId }),
        })
      } catch (error) {
        console.error('Failed to generate summary:', error)
      }
    }
    
    disconnect()
    setTranscripts([])
    setCurrentUserTranscript('')
    setCurrentAssistantTranscript('')
    setEvents([])
    // Generate new conversation ID for next session
    setConversationId(crypto.randomUUID())
  }
  
  const fetchRecentMemories = async () => {
    try {
      const response = await fetch('/api/memory?limit=20')
      const data = await response.json()
      setRecentMemories(data.memories || [])
    } catch (error) {
      console.error('Failed to fetch memories:', error)
    }
  }
  
  useEffect(() => {
    if (showMemory) {
      fetchRecentMemories()
    }
  }, [showMemory])

  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center relative">
      {/* Main Voice Interface */}
      <div className="flex flex-col items-center space-y-8">
        {/* Animated Circle */}
        <button
          onClick={isConnected ? handleDisconnect : handleConnect}
          disabled={isConnecting}
          className={`relative w-64 h-64 rounded-full transition-all duration-500 ${
            isConnected 
              ? 'bg-gradient-to-br from-blue-600/30 to-purple-600/30 hover:scale-110 shadow-2xl shadow-blue-500/20' 
              : 'bg-gradient-to-br from-gray-800 to-gray-700 hover:from-gray-700 hover:to-gray-600'
          } ${isConnecting ? 'cursor-not-allowed' : 'cursor-pointer'}`}
        >
          {/* Outer ring animation */}
          {isConnected && (isSpeaking || isListening) && (
            <div className={`absolute inset-0 rounded-full ${
              isSpeaking ? 'bg-gradient-to-r from-blue-500 to-purple-500' : 'bg-gradient-to-r from-green-400 to-teal-400'
            } animate-ping opacity-30`} />
          )}
          
          {/* Inner circle */}
          <div className={`absolute inset-4 rounded-full ${
            isConnected 
              ? isSpeaking 
                ? 'bg-gradient-to-br from-blue-500 to-purple-600 shadow-inner shadow-blue-500/50' 
                : isListening
                ? 'bg-gradient-to-br from-green-500 to-teal-600 shadow-inner shadow-green-500/50'
                : 'bg-gradient-to-br from-gray-700 to-gray-900'
              : 'bg-gradient-to-br from-gray-800/50 to-gray-700/50'
          } transition-all duration-500`} />
          
          {/* Status icon */}
          <div className="absolute inset-0 flex items-center justify-center">
            {isConnecting ? (
              <div className="w-20 h-20 border-4 border-blue-400/30 border-t-blue-400 rounded-full animate-spin" />
            ) : !isConnected ? (
              <svg className="w-24 h-24 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
              </svg>
            ) : (
              <div className={`w-16 h-16 rounded-full transition-all duration-300 ${
                isSpeaking ? 'bg-gradient-to-r from-blue-400 to-purple-400 animate-pulse shadow-lg shadow-blue-500/50' : 
                isListening ? 'bg-gradient-to-r from-green-400 to-teal-400 shadow-lg shadow-green-500/50' : 
                'bg-gray-600/50'
              }`} />
            )}
          </div>
        </button>
        
        {/* Status Text */}
        <p className="text-gray-400 text-xl font-light tracking-wide">
          {isConnecting ? 'Connecting...' : 
           isConnected ? (
             isSpeaking ? 'Anton is speaking' : 
             isListening ? 'Listening...' : 
             'Connected'
           ) : 'Tap to talk'}
        </p>
      </div>
      
      {/* Error Message */}
      {error && (
        <div className="absolute top-8 left-1/2 transform -translate-x-1/2 bg-red-900/30 backdrop-blur-xl border border-red-500/30 rounded-2xl px-6 py-4 shadow-2xl">
          <p className="text-red-300 text-base">{error.message}</p>
        </div>
      )}
      
      {/* Current Transcript Display */}
      {isConnected && (currentUserTranscript || currentAssistantTranscript) && (
        <div className="fixed bottom-40 left-1/2 transform -translate-x-1/2 w-full max-w-4xl px-8 z-10">
          <div className="bg-gradient-to-br from-gray-900/90 to-black/90 backdrop-blur-xl rounded-3xl p-8 border border-gray-700/50 shadow-2xl">
            {currentUserTranscript && (
              <p className="text-blue-300 text-center text-xl font-light leading-relaxed">{currentUserTranscript}</p>
            )}
            {currentAssistantTranscript && (
              <p className="text-purple-300 text-center text-xl font-light leading-relaxed">{currentAssistantTranscript}</p>
            )}
          </div>
        </div>
      )}
      
      {/* Minimal controls */}
      <div className="fixed bottom-8 left-1/2 transform -translate-x-1/2 flex items-center space-x-8 z-20">
        <button
          onClick={() => setShowMemory(!showMemory)}
          className="text-gray-500 hover:text-gray-300 transition-all text-lg px-6 py-3 rounded-full hover:bg-gray-800/50 backdrop-blur-sm"
        >
          History
        </button>
        <span className="text-gray-600">•</span>
        <button
          onClick={() => {
            setTranscripts([])
            setCurrentUserTranscript('')
            setCurrentAssistantTranscript('')
          }}
          className="text-gray-500 hover:text-gray-300 transition-all text-lg px-6 py-3 rounded-full hover:bg-gray-800/50 backdrop-blur-sm"
        >
          Clear
        </button>
      </div>
      
      {/* Slide-out panel for history/memory */}
      {showMemory && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-md z-50" onClick={() => setShowMemory(false)}>
          <div 
            className="fixed right-0 top-0 h-full w-full max-w-lg bg-gradient-to-b from-gray-900 to-black shadow-2xl border-l border-gray-800"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="h-full overflow-y-auto p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-light text-gray-300">Conversation History</h2>
                <button
                  onClick={() => setShowMemory(false)}
                  className="text-white/50 hover:text-white/70 p-2"
                >
                  <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              
              <div className="space-y-3">
                {transcripts.length === 0 ? (
                  <p className="text-gray-500 text-center py-12 text-lg">No conversation history yet</p>
                ) : (
                  transcripts.map((transcript, index) => (
                    <div
                      key={index}
                      className={`p-5 rounded-2xl transition-all hover:scale-[1.02] ${
                        transcript.speaker === 'austin'
                          ? 'bg-gradient-to-r from-blue-900/50 to-blue-800/50 text-blue-200 border border-blue-700/30'
                          : 'bg-gradient-to-r from-purple-900/50 to-purple-800/50 text-purple-200 border border-purple-700/30'
                      }`}
                    >
                      <p className="text-sm font-semibold mb-2 opacity-80">
                        {transcript.speaker === 'austin' ? 'You' : 'Anton'}
                      </p>
                      <p className="text-lg font-light leading-relaxed">{transcript.text}</p>
                      <p className="text-xs opacity-40 mt-3">
                        {transcript.timestamp.toLocaleTimeString()}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}