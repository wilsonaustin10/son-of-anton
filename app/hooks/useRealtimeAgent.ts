import { useState, useRef, useCallback, useEffect } from 'react'

export interface RealtimeEvent {
  type: string
  event_id?: string
  [key: string]: any
}

export interface UseRealtimeAgentOptions {
  onEvent?: (event: RealtimeEvent) => void
  onTranscript?: (transcript: string, isFinal: boolean, speaker: 'austin' | 'anton') => void
  onError?: (error: Error) => void
  onToolCall?: (toolName: string, args: any, callId: string) => void
  onToolResult?: (result: any, callId: string) => void
  conversationId?: string
}

export function useRealtimeAgent(options: UseRealtimeAgentOptions = {}) {
  const [isConnected, setIsConnected] = useState(false)
  const [isConnecting, setIsConnecting] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null)
  const dataChannelRef = useRef<RTCDataChannel | null>(null)
  const localStreamRef = useRef<MediaStream | null>(null)
  const audioElementRef = useRef<HTMLAudioElement | null>(null)
  
  const { onEvent, onTranscript, onError, onToolCall, onToolResult, conversationId } = options
  const [pendingToolCalls, setPendingToolCalls] = useState<Map<string, any>>(new Map())

  // Get ephemeral token from API
  const getSessionToken = async () => {
    const response = await fetch('/api/session', {
      method: 'POST',
    })
    
    if (!response.ok) {
      throw new Error('Failed to get session token')
    }
    
    const data = await response.json()
    return data.token
  }

  // Setup audio element for playback
  const setupAudioElement = useCallback(() => {
    if (!audioElementRef.current) {
      audioElementRef.current = new Audio()
      audioElementRef.current.autoplay = true
    }
  }, [])

  // Handle data channel messages
  const handleDataChannelMessage = useCallback((event: MessageEvent) => {
    try {
      const message = JSON.parse(event.data)
      console.log('Received event:', message)
      
      onEvent?.(message)
      
      // Handle specific event types
      switch (message.type) {
        case 'session.created':
          console.log('Session created:', message.session)
          break
          
        case 'conversation.item.created':
          if (message.item?.role === 'user' && message.item?.formatted?.transcript) {
            onTranscript?.(message.item.formatted.transcript, false, 'austin')
          }
          break
          
        case 'conversation.item.input_audio_transcription.completed':
          if (message.transcript) {
            onTranscript?.(message.transcript, true, 'austin')
            // Store user message in memory
            if (conversationId) {
              fetch('/api/memory', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  conversation_id: conversationId,
                  speaker: 'austin',
                  content: message.transcript,
                  metadata: { event_type: 'input_audio_transcription' }
                })
              }).catch(err => console.error('Failed to store memory:', err))
            }
          }
          break
          
        case 'response.text.delta':
          // Handle streaming text response
          break
          
        case 'response.audio_transcript.delta':
          // Handle streaming audio transcript
          if (message.delta) {
            onTranscript?.(message.delta, false, 'anton')
          }
          break
          
        case 'response.audio_transcript.done':
          // Store Anton's complete response
          if (message.transcript && conversationId) {
            onTranscript?.(message.transcript, true, 'anton')
            fetch('/api/memory', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                conversation_id: conversationId,
                speaker: 'anton',
                content: message.transcript,
                metadata: { event_type: 'response_audio_transcript' }
              })
            }).catch(err => console.error('Failed to store memory:', err))
          }
          break
          
        case 'response.function_call_arguments.done':
          // Handle function call from the model
          if (message.call_id && message.name && message.arguments) {
            console.log('Function call:', message.name, message.arguments)
            onToolCall?.(message.name, message.arguments, message.call_id)
            
            // Execute the tool call
            handleToolExecution(message.name, message.arguments, message.call_id)
          }
          break
          
        case 'error':
          console.error('Realtime API error:', message.error)
          onError?.(new Error(message.error?.message || 'Unknown error'))
          break
      }
    } catch (err) {
      console.error('Failed to parse data channel message:', err)
    }
  }, [onEvent, onTranscript, onError, onToolCall, conversationId])
  
  // Handle tool execution
  const handleToolExecution = useCallback(async (
    toolName: string,
    args: string,
    callId: string
  ) => {
    try {
      // Parse arguments
      const parsedArgs = JSON.parse(args)
      
      // Call the tool execution API
      const response = await fetch('/api/tools/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          toolName,
          args: parsedArgs,
          callId,
          conversationId
        })
      })
      
      if (!response.ok) {
        throw new Error('Tool execution failed')
      }
      
      const result = await response.json()
      onToolResult?.(result, callId)
      
      // Send the result back to the Realtime API
      if (dataChannelRef.current && dataChannelRef.current.readyState === 'open') {
        dataChannelRef.current.send(JSON.stringify({
          type: 'conversation.item.create',
          item: {
            type: 'function_call_output',
            call_id: callId,
            output: JSON.stringify(result)
          }
        }))
      }
    } catch (error) {
      console.error('Tool execution error:', error)
      
      // Send error result back
      if (dataChannelRef.current && dataChannelRef.current.readyState === 'open') {
        dataChannelRef.current.send(JSON.stringify({
          type: 'conversation.item.create',
          item: {
            type: 'function_call_output',
            call_id: callId,
            output: JSON.stringify({
              success: false,
              error: error instanceof Error ? error.message : 'Unknown error'
            })
          }
        }))
      }
    }
  }, [conversationId, onToolResult])

  // Setup data channel
  const setupDataChannel = useCallback((pc: RTCPeerConnection) => {
    const dataChannel = pc.createDataChannel('oai-events', {
      ordered: true,
    })
    
    dataChannel.onopen = () => {
      console.log('Data channel opened')
      dataChannelRef.current = dataChannel
    }
    
    dataChannel.onmessage = handleDataChannelMessage
    
    dataChannel.onerror = (error) => {
      console.error('Data channel error:', error)
      onError?.(new Error('Data channel error'))
    }
    
    dataChannel.onclose = () => {
      console.log('Data channel closed')
      dataChannelRef.current = null
    }
  }, [handleDataChannelMessage, onError])

  // Connect to OpenAI Realtime API
  const connect = useCallback(async () => {
    try {
      setIsConnecting(true)
      setError(null)
      
      // Get ephemeral token
      const token = await getSessionToken()
      
      // Get user media
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      })
      localStreamRef.current = stream
      
      // Create peer connection
      const pc = new RTCPeerConnection({
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
      })
      peerConnectionRef.current = pc
      
      // Add local audio track
      stream.getTracks().forEach(track => {
        pc.addTrack(track, stream)
      })
      
      // Setup data channel
      setupDataChannel(pc)
      
      // Handle remote stream
      pc.ontrack = (event) => {
        console.log('Received remote track')
        setupAudioElement()
        if (audioElementRef.current && event.streams[0]) {
          audioElementRef.current.srcObject = event.streams[0]
        }
      }
      
      // Create offer
      const offer = await pc.createOffer()
      await pc.setLocalDescription(offer)
      
      // Send offer to OpenAI
      const response = await fetch(
        `https://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-12-17`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/sdp',
          },
          body: offer.sdp,
        }
      )
      
      if (!response.ok) {
        throw new Error('Failed to connect to OpenAI Realtime API')
      }
      
      // Set remote description
      const answerSdp = await response.text()
      const answer = new RTCSessionDescription({
        type: 'answer',
        sdp: answerSdp,
      })
      await pc.setRemoteDescription(answer)
      
      setIsConnected(true)
      setIsConnecting(false)
      
    } catch (err) {
      console.error('Connection error:', err)
      setError(err as Error)
      setIsConnecting(false)
      onError?.(err as Error)
      disconnect()
    }
  }, [setupDataChannel, setupAudioElement, onError])

  // Disconnect from OpenAI
  const disconnect = useCallback(() => {
    // Stop local stream
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop())
      localStreamRef.current = null
    }
    
    // Close data channel
    if (dataChannelRef.current) {
      dataChannelRef.current.close()
      dataChannelRef.current = null
    }
    
    // Close peer connection
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close()
      peerConnectionRef.current = null
    }
    
    // Stop audio playback
    if (audioElementRef.current) {
      audioElementRef.current.pause()
      audioElementRef.current.srcObject = null
    }
    
    setIsConnected(false)
    setIsConnecting(false)
  }, [])

  // Send message to OpenAI
  const sendMessage = useCallback((message: any) => {
    if (dataChannelRef.current && dataChannelRef.current.readyState === 'open') {
      dataChannelRef.current.send(JSON.stringify(message))
    } else {
      console.error('Data channel not open')
    }
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnect()
    }
  }, [disconnect])

  return {
    isConnected,
    isConnecting,
    error,
    connect,
    disconnect,
    sendMessage,
  }
}