import { useEffect, useState, useCallback, useRef } from 'react'
import { PeanutWebSocket, getWebSocketInstance } from '@/services/websocket'
import { HistoryEntry } from './useTransactionHistory'

type WebSocketStatus = 'connecting' | 'connected' | 'disconnected' | 'error'

interface UseWebSocketOptions {
    autoConnect?: boolean
    username?: string
    onHistoryEntry?: (entry: HistoryEntry) => void
    onConnect?: () => void
    onDisconnect?: () => void
    onError?: (error: Event) => void
}

export const useWebSocket = (options: UseWebSocketOptions = {}) => {
    const { autoConnect = true, username, onHistoryEntry, onConnect, onDisconnect, onError } = options

    const [status, setStatus] = useState<WebSocketStatus>('disconnected')
    const [historyEntries, setHistoryEntries] = useState<HistoryEntry[]>([])
    const wsRef = useRef<PeanutWebSocket | null>(null)
    const callbacksRef = useRef({ onHistoryEntry, onConnect, onDisconnect, onError })

    // Update callbacks ref when props change
    useEffect(() => {
        callbacksRef.current = { onHistoryEntry, onConnect, onDisconnect, onError }
    }, [onHistoryEntry, onConnect, onDisconnect, onError])

    // Connect to WebSocket
    const connect = useCallback(() => {
        try {
            const ws = getWebSocketInstance(username)
            wsRef.current = ws

            setStatus('connecting')
            ws.connect()
        } catch (error) {
            console.error('Failed to connect to WebSocket:', error)
            setStatus('error')
        }
    }, [username])

    // Disconnect from WebSocket
    const disconnect = useCallback(() => {
        if (wsRef.current) {
            wsRef.current.disconnect()
            setStatus('disconnected')
        }
    }, [])

    // Listen for WebSocket events
    useEffect(() => {
        const ws = getWebSocketInstance(username)
        wsRef.current = ws

        // Ensure we're not connected with old credentials
        if (status === 'connected') {
            ws.disconnect()
            setStatus('disconnected')
        }

        const handleConnect = () => {
            setStatus('connected')
            if (callbacksRef.current.onConnect) {
                callbacksRef.current.onConnect()
            }
        }

        const handleDisconnect = () => {
            setStatus('disconnected')
            if (callbacksRef.current.onDisconnect) {
                callbacksRef.current.onDisconnect()
            }
        }

        const handleError = (error: Event) => {
            setStatus('error')
            if (callbacksRef.current.onError) {
                callbacksRef.current.onError(error)
            }
        }

        const handleHistoryEntry = (entry: HistoryEntry) => {
            if (entry.type === 'DIRECT_SEND' && entry.status === 'NEW' && !entry.senderAccount) {
                // Ignore pending requests from the server
                return
            }
            setHistoryEntries((prev) => [entry, ...prev])
            if (callbacksRef.current.onHistoryEntry) {
                callbacksRef.current.onHistoryEntry(entry)
            }
        }

        // Register event handlers
        ws.on('connect', handleConnect)
        ws.on('disconnect', handleDisconnect)
        ws.on('error', handleError)
        ws.on('history_entry', handleHistoryEntry)

        // Auto-connect if enabled
        if (autoConnect) {
            connect()
        }

        // Cleanup event handlers on unmount
        return () => {
            ws.off('connect', handleConnect)
            ws.off('disconnect', handleDisconnect)
            ws.off('error', handleError)
            ws.off('history_entry', handleHistoryEntry)
        }
    }, [autoConnect, connect, username])

    // Return exposed functionality
    return {
        status,
        connect,
        disconnect,
        historyEntries,
        clearHistoryEntries: () => setHistoryEntries([]),
    }
}
