import { HistoryEntry } from '@/hooks/useTransactionHistory'

export type WebSocketMessage = {
    type: 'ping' | 'pong' | 'history_entry'
    data?: HistoryEntry
}

export class PeanutWebSocket {
    private socket: WebSocket | null = null
    private pingInterval: NodeJS.Timeout | null = null
    private reconnectTimeout: NodeJS.Timeout | null = null
    private eventListeners: Map<string, Set<(data: any) => void>> = new Map()
    private isConnected = false
    private reconnectAttempts = 0
    private readonly maxReconnectAttempts = 5
    private readonly reconnectDelay = 3000 // 3 seconds
    private readonly pingIntervalTime = 30000 // 30 seconds

    constructor(
        private readonly url: string,
        private readonly path: string
    ) {}

    public connect(): void {
        if (
            this.socket &&
            (this.socket.readyState === WebSocket.OPEN || this.socket.readyState === WebSocket.CONNECTING)
        ) {
            return
        }

        try {
            const fullUrl = new URL(this.path, this.url).toString()

            this.socket = new WebSocket(fullUrl)

            this.socket.onopen = this.handleOpen.bind(this)
            this.socket.onmessage = this.handleMessage.bind(this)
            this.socket.onclose = this.handleClose.bind(this)
            this.socket.onerror = this.handleError.bind(this)
        } catch (error) {
            console.error('WebSocket connection error:', error)
            this.scheduleReconnect()
        }
    }

    public disconnect(): void {
        this.clearPingInterval()
        this.clearReconnectTimeout()

        if (this.socket) {
            this.socket.onopen = null
            this.socket.onmessage = null
            this.socket.onclose = null
            this.socket.onerror = null

            if (this.socket.readyState === WebSocket.OPEN) {
                this.socket.close()
            }

            this.socket = null
        }

        this.isConnected = false
        this.reconnectAttempts = 0
    }

    public on<T>(event: string, callback: (data: T) => void): void {
        if (!this.eventListeners.has(event)) {
            this.eventListeners.set(event, new Set())
        }

        this.eventListeners.get(event)?.add(callback as (data: any) => void)
    }

    public off<T>(event: string, callback: (data: T) => void): void {
        if (this.eventListeners.has(event)) {
            this.eventListeners.get(event)?.delete(callback as (data: any) => void)
        }
    }

    private handleOpen(): void {
        this.isConnected = true
        this.reconnectAttempts = 0
        this.startPingInterval()
        this.emit('connect', null)
    }

    private handleMessage(event: MessageEvent): void {
        try {
            const message = JSON.parse(event.data) as WebSocketMessage

            switch (message.type) {
                case 'pong':
                    // Server responded to our ping
                    this.emit('pong', null)
                    break

                case 'history_entry':
                    if (message.data) {
                        // Process history entry
                        const historyEntry = message.data
                        this.emit('history_entry', historyEntry)
                    }
                    break

                default:
                    // Handle other message types if needed
                    this.emit(message.type, message.data)
                    break
            }
        } catch (error) {
            console.error('Error parsing WebSocket message:', error, event.data)
        }
    }

    private handleClose(event: CloseEvent): void {
        this.isConnected = false
        this.clearPingInterval()
        this.emit('disconnect', { code: event.code, reason: event.reason })

        if (!event.wasClean) {
            this.scheduleReconnect()
        }
    }

    private handleError(event: Event): void {
        console.error('WebSocket error:', event)
        this.emit('error', event)
    }

    private startPingInterval(): void {
        this.clearPingInterval()

        this.pingInterval = setInterval(() => {
            this.sendPing()
        }, this.pingIntervalTime)
    }

    private sendPing(): void {
        if (this.socket && this.socket.readyState === WebSocket.OPEN) {
            this.socket.send(JSON.stringify({ type: 'ping' }))
        }
    }

    private scheduleReconnect(): void {
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            this.emit('max_reconnect_attempts', null)
            return
        }

        this.clearReconnectTimeout()

        this.reconnectTimeout = setTimeout(
            () => {
                this.reconnectAttempts += 1
                this.connect()
            },
            this.reconnectDelay * Math.pow(2, this.reconnectAttempts)
        ) // Exponential backoff
    }

    private clearPingInterval(): void {
        if (this.pingInterval) {
            clearInterval(this.pingInterval)
            this.pingInterval = null
        }
    }

    private clearReconnectTimeout(): void {
        if (this.reconnectTimeout) {
            clearTimeout(this.reconnectTimeout)
            this.reconnectTimeout = null
        }
    }

    private emit(event: string, data: any): void {
        if (this.eventListeners.has(event)) {
            this.eventListeners.get(event)?.forEach((callback) => {
                try {
                    callback(data)
                } catch (error) {
                    console.error(`Error in ${event} event handler:`, error)
                }
            })
        }
    }
}

// Singleton instance for app-wide usage
let websocketInstance: PeanutWebSocket | null = null

export const getWebSocketInstance = (username?: string): PeanutWebSocket => {
    if (!websocketInstance && typeof window !== 'undefined') {
        const wsUrl = process.env.NEXT_PUBLIC_PEANUT_WS_URL || ''
        const path = username ? `/ws/charges/${username}` : '/ws/charges'
        websocketInstance = new PeanutWebSocket(wsUrl, path)
    }

    return websocketInstance as PeanutWebSocket
}
