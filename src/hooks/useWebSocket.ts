import { useEffect, useState, useCallback, useRef } from 'react'
import { PeanutWebSocket, getWebSocketInstance, type PendingPerk, type RailStatusUpdate } from '@/services/websocket'
import { type HistoryEntry } from './useTransactionHistory'

type WebSocketStatus = 'connecting' | 'connected' | 'disconnected' | 'error'

interface UseWebSocketOptions {
    autoConnect?: boolean
    username?: string
    onHistoryEntry?: (entry: HistoryEntry) => void
    onKycStatusUpdate?: (status: string) => void
    onMantecaKycStatusUpdate?: (status: string) => void
    onSumsubKycStatusUpdate?: (status: string, rejectLabels?: string[]) => void
    onTosUpdate?: (data: { accepted: boolean }) => void
    onPendingPerk?: (perk: PendingPerk) => void
    onRailStatusUpdate?: (data: RailStatusUpdate) => void
    onConnect?: () => void
    onDisconnect?: () => void
    onError?: (error: Event) => void
}

export const useWebSocket = (options: UseWebSocketOptions = {}) => {
    const {
        autoConnect = true,
        username,
        onHistoryEntry,
        onKycStatusUpdate,
        onMantecaKycStatusUpdate,
        onSumsubKycStatusUpdate,
        onTosUpdate,
        onPendingPerk,
        onRailStatusUpdate,
        onConnect,
        onDisconnect,
        onError,
    } = options

    const [status, setStatus] = useState<WebSocketStatus>('disconnected')
    const [historyEntries, setHistoryEntries] = useState<HistoryEntry[]>([])
    const wsRef = useRef<PeanutWebSocket | null>(null)

    const callbacksRef = useRef({
        onHistoryEntry,
        onKycStatusUpdate,
        onMantecaKycStatusUpdate,
        onSumsubKycStatusUpdate,
        onTosUpdate,
        onPendingPerk,
        onRailStatusUpdate,
        onConnect,
        onDisconnect,
        onError,
    })

    // Update callbacks ref when
    useEffect(() => {
        callbacksRef.current = {
            onHistoryEntry,
            onKycStatusUpdate,
            onMantecaKycStatusUpdate,
            onSumsubKycStatusUpdate,
            onTosUpdate,
            onPendingPerk,
            onRailStatusUpdate,
            onConnect,
            onDisconnect,
            onError,
        }
    }, [
        onHistoryEntry,
        onKycStatusUpdate,
        onMantecaKycStatusUpdate,
        onSumsubKycStatusUpdate,
        onTosUpdate,
        onPendingPerk,
        onRailStatusUpdate,
        onConnect,
        onDisconnect,
        onError,
    ])

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
            if (
                (entry.type === 'DIRECT_SEND' || entry.type === 'REQUEST') &&
                entry.status === 'NEW' &&
                !entry.senderAccount
            ) {
                // Ignore pending requests from the server
                return
            }
            setHistoryEntries((prev) => [entry, ...prev])
            if (callbacksRef.current.onHistoryEntry) {
                callbacksRef.current.onHistoryEntry(entry)
            }
        }

        const handleKycStatusUpdate = (data: { status: string }) => {
            if (callbacksRef.current.onKycStatusUpdate) {
                callbacksRef.current.onKycStatusUpdate(data.status)
            } else {
                console.log(`[WebSocket] No onKycStatusUpdate callback registered for user: ${username}`)
            }
        }

        const handleMantecaKycStatusUpdate = (data: { status: string }) => {
            if (callbacksRef.current.onMantecaKycStatusUpdate) {
                callbacksRef.current.onMantecaKycStatusUpdate(data.status)
            } else {
                console.log(`[WebSocket] No onMantecaKycStatusUpdate callback registered for user: ${username}`)
            }
        }

        const handleSumsubKycStatusUpdate = (data: { status: string; rejectLabels?: string[] }) => {
            if (callbacksRef.current.onSumsubKycStatusUpdate) {
                callbacksRef.current.onSumsubKycStatusUpdate(data.status, data.rejectLabels)
            } else {
                console.log(`[WebSocket] No onSumsubKycStatusUpdate callback registered for user: ${username}`)
            }
        }

        const handleTosUpdate = (data: { status: string }) => {
            if (callbacksRef.current.onTosUpdate) {
                callbacksRef.current.onTosUpdate({ accepted: data.status === 'approved' })
            } else {
                console.log(`[WebSocket] No onTosUpdate callback registered for user: ${username}`)
            }
        }

        const handlePendingPerk = (perk: PendingPerk) => {
            if (callbacksRef.current.onPendingPerk) {
                callbacksRef.current.onPendingPerk(perk)
            }
        }

        const handleRailStatusUpdate = (data: RailStatusUpdate) => {
            if (callbacksRef.current.onRailStatusUpdate) {
                callbacksRef.current.onRailStatusUpdate(data)
            }
        }

        // Register event handlers
        ws.on('connect', handleConnect)
        ws.on('disconnect', handleDisconnect)
        ws.on('error', handleError)
        ws.on('history_entry', handleHistoryEntry)
        ws.on('kyc_status_update', handleKycStatusUpdate)
        ws.on('manteca_kyc_status_update', handleMantecaKycStatusUpdate)
        ws.on('sumsub_kyc_status_update', handleSumsubKycStatusUpdate)
        ws.on('persona_tos_status_update', handleTosUpdate)
        ws.on('pending_perk', handlePendingPerk)
        ws.on('user_rail_status_changed', handleRailStatusUpdate)

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
            ws.off('kyc_status_update', handleKycStatusUpdate)
            ws.off('manteca_kyc_status_update', handleMantecaKycStatusUpdate)
            ws.off('sumsub_kyc_status_update', handleSumsubKycStatusUpdate)
            ws.off('persona_tos_status_update', handleTosUpdate)
            ws.off('pending_perk', handlePendingPerk)
            ws.off('user_rail_status_changed', handleRailStatusUpdate)
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
