'use client'

import { useState, useEffect } from 'react'
import { useRealtimeAgent, RealtimeEvent } from '../hooks/useRealtimeAgent'

export default function VoiceAgent() {
  const [transcripts, setTranscripts] = useState<Array<{ text: string; speaker: 'user' | 'assistant'; timestamp: Date }>>([])
  const [currentUserTranscript, setCurrentUserTranscript] = useState('')
  const [currentAssistantTranscript, setCurrentAssistantTranscript] = useState('')
  const [events, setEvents] = useState<RealtimeEvent[]>([])
  
  const {
    isConnected,
    isConnecting,
    error,
    connect,
    disconnect,
    sendMessage,
  } = useRealtimeAgent({
    onEvent: (event) => {
      setEvents(prev => [...prev.slice(-50), event]) // Keep last 50 events
      
      // Handle assistant responses
      if (event.type === 'response.audio_transcript.delta' && event.delta) {
        setCurrentAssistantTranscript(prev => prev + event.delta)
      } else if (event.type === 'response.audio_transcript.done' && event.transcript) {
        setTranscripts(prev => [...prev, {
          text: event.transcript,
          speaker: 'assistant',
          timestamp: new Date(),
        }])
        setCurrentAssistantTranscript('')
      }
    },
    onTranscript: (transcript, isFinal) => {
      if (isFinal) {
        setTranscripts(prev => [...prev, {
          text: transcript,
          speaker: 'user',
          timestamp: new Date(),
        }])
        setCurrentUserTranscript('')
      } else {
        setCurrentUserTranscript(transcript)
      }
    },
    onError: (err) => {
      console.error('Voice agent error:', err)
    },
  })

  const handleConnect = async () => {
    await connect()
  }

  const handleDisconnect = () => {
    disconnect()
    setTranscripts([])
    setCurrentUserTranscript('')
    setCurrentAssistantTranscript('')
    setEvents([])
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Anton - Personal AI Assistant</h1>
        
        {/* Connection Status */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-xl font-semibold text-gray-800">Connection Status</h2>
              <p className="text-sm text-gray-600 mt-1">
                {isConnected ? 'Anton is ready to assist you' : 'Anton is offline'}
              </p>
            </div>
            <div className="flex items-center space-x-2">
              <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500' : 'bg-gray-400'}`} />
              <span className="text-sm font-medium text-gray-700">
                {isConnected ? 'Online' : 'Offline'}
              </span>
            </div>
          </div>
          
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
              <p className="text-sm text-red-700">Error: {error.message}</p>
            </div>
          )}
          
          <button
            onClick={isConnected ? handleDisconnect : handleConnect}
            disabled={isConnecting}
            className={`w-full py-2 px-4 rounded-md font-medium transition-colors ${
              isConnected
                ? 'bg-red-500 hover:bg-red-600 text-white'
                : isConnecting
                ? 'bg-gray-400 text-gray-200 cursor-not-allowed'
                : 'bg-blue-500 hover:bg-blue-600 text-white'
            }`}
          >
            {isConnecting ? 'Connecting...' : isConnected ? 'Disconnect' : 'Connect'}
          </button>
        </div>

        {/* Conversation */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">Conversation</h2>
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {transcripts.length === 0 && !currentUserTranscript && !currentAssistantTranscript && (
              <p className="text-gray-500 text-center py-8">
                {isConnected ? 'Start speaking to begin the conversation...' : 'Connect to start a conversation'}
              </p>
            )}
            
            {transcripts.map((transcript, index) => (
              <div
                key={index}
                className={`p-3 rounded-lg ${
                  transcript.speaker === 'user'
                    ? 'bg-blue-50 ml-auto max-w-[80%]'
                    : 'bg-gray-50 mr-auto max-w-[80%]'
                }`}
              >
                <p className="text-sm font-medium text-gray-600 mb-1">
                  {transcript.speaker === 'user' ? 'Austin' : 'Anton'}
                </p>
                <p className="text-gray-800">{transcript.text}</p>
                <p className="text-xs text-gray-500 mt-1">
                  {transcript.timestamp.toLocaleTimeString()}
                </p>
              </div>
            ))}
            
            {currentUserTranscript && (
              <div className="p-3 rounded-lg bg-blue-50 ml-auto max-w-[80%] opacity-70">
                <p className="text-sm font-medium text-gray-600 mb-1">Austin (speaking...)</p>
                <p className="text-gray-800">{currentUserTranscript}</p>
              </div>
            )}
            
            {currentAssistantTranscript && (
              <div className="p-3 rounded-lg bg-gray-50 mr-auto max-w-[80%] opacity-70">
                <p className="text-sm font-medium text-gray-600 mb-1">Anton (speaking...)</p>
                <p className="text-gray-800">{currentAssistantTranscript}</p>
              </div>
            )}
          </div>
        </div>

        {/* Debug Events (collapsible) */}
        <details className="bg-white rounded-lg shadow-md p-6">
          <summary className="cursor-pointer text-xl font-semibold text-gray-800">
            Debug Events ({events.length})
          </summary>
          <div className="mt-4 space-y-2 max-h-64 overflow-y-auto">
            {events.map((event, index) => (
              <div key={index} className="p-2 bg-gray-50 rounded text-xs font-mono">
                <span className="font-semibold">{event.type}</span>
                {event.event_id && <span className="text-gray-500 ml-2">({event.event_id})</span>}
              </div>
            ))}
          </div>
        </details>
      </div>
    </div>
  )
}