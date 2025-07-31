import { useState, useRef, useCallback, useEffect } from 'react'

export interface RealtimeEvent {
  type: string
  event_id?: string
  [key: string]: any
}

export interface UseRealtimeAgentOptions {
  onEvent?: (event: RealtimeEvent) => void
  onTranscript?: (transcript: string, isFinal: boolean) => void
  onError?: (error: Error) => void
}

export function useRealtimeAgent(options: UseRealtimeAgentOptions = {}) {
  const [isConnected, setIsConnected] = useState(false)
  const [isConnecting, setIsConnecting] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null)
  const dataChannelRef = useRef<RTCDataChannel | null>(null)
  const localStreamRef = useRef<MediaStream | null>(null)
  const audioElementRef = useRef<HTMLAudioElement | null>(null)
  
  const { onEvent, onTranscript, onError } = options

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
            onTranscript?.(message.item.formatted.transcript, false)
          }
          break
          
        case 'conversation.item.input_audio_transcription.completed':
          if (message.transcript) {
            onTranscript?.(message.transcript, true)
          }
          break
          
        case 'response.text.delta':
          // Handle streaming text response
          break
          
        case 'response.audio_transcript.delta':
          // Handle streaming audio transcript
          break
          
        case 'error':
          console.error('Realtime API error:', message.error)
          onError?.(new Error(message.error?.message || 'Unknown error'))
          break
      }
    } catch (err) {
      console.error('Failed to parse data channel message:', err)
    }
  }, [onEvent, onTranscript, onError])

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