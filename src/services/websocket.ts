import { type HistoryEntry } from '@/hooks/useTransactionHistory'
import { type PendingPerk } from '@/services/perks'
import { isDemoMode } from '@/utils/demo'
import { isCapacitor } from '@/utils/capacitor'
import { getSessionTokenForSocket } from '@/utils/auth-token'
export type { PendingPerk }

function isValidWsUrl(url: string): boolean {
    if (!url) return false
    try {
        const { protocol } = new URL(url)
        return protocol === 'ws:' || protocol === 'wss:'
    } catch {
        return false
    }
}

// Native builds don't ship a dedicated WS URL — derive it from the backend API
// origin (https://api… → wss://api…, http → ws).
function apiUrlToWsUrl(apiUrl: string): string {
    if (!apiUrl) return ''
    try {
        const { protocol, host } = new URL(apiUrl)
        return `${protocol === 'http:' ? 'ws' : 'wss'}://${host}`
    } catch {
        return ''
    }
}

export interface RailStatusUpdate {
    railId: string
    status: string
    provider?: string
}

export type RainCardBalanceChangeReason =
    | 'transaction_created'
    | 'transaction_updated'
    | 'transaction_completed'
    | 'contract_created'
    | 'auto_balance_deposit'

export interface RainCardBalanceChangedData {
    reason: RainCardBalanceChangeReason
}

export type WebSocketMessage = {
    type:
        | 'ping'
        | 'pong'
        // Handshake: the server sends one of these in reply to our `auth` frame.
        | 'auth_ok'
        | 'auth_error'
        | 'history_entry'
        | 'kyc_status_update'
        | 'manteca_kyc_status_update'
        | 'sumsub_kyc_status_update'
        | 'persona_tos_status_update'
        | 'pending_perk'
        | 'user_rail_status_changed'
        | 'rain_card_balance_changed'
    data?: HistoryEntry | PendingPerk | RailStatusUpdate | RainCardBalanceChangedData
}

export class PeanutWebSocket {
    private socket: WebSocket | null = null
    private pingInterval: NodeJS.Timeout | null = null
    private reconnectTimeout: NodeJS.Timeout | null = null
    private eventListeners: Map<string, Set<(data: any) => void>> = new Map()
    private isConnected = false
    /** Set when the server refused our credential; suppresses the reconnect loop. */
    private authFailed = false
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

        // A caller reconnecting deliberately (e.g. after a fresh login) gets a
        // clean slate — the previous credential rejection should not stick.
        this.authFailed = false

        try {
            const fullUrl = new URL(this.path, this.url).toString()

            this.socket = new WebSocket(fullUrl)

            this.socket.onopen = this.handleOpen.bind(this)
            this.socket.onmessage = this.handleMessage.bind(this)
            this.socket.onclose = this.handleClose.bind(this)
            this.socket.onerror = this.handleError.bind(this)
        } catch (error) {
            // A throw here is a bad URL / mixed-content ctor failure — permanent, so
            // retrying only floods the main thread. Transient drops reconnect via onclose.
            console.error('WebSocket connection error:', error)
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

    /**
     * The server subscribes this socket to nothing until it receives an `auth`
     * frame carrying a session JWT that resolves to the user in the path, so
     * send it immediately on open. Async because native reads the token from
     * the native cookie jar — which is exactly why auth is a message frame and
     * not a header or query param.
     */
    private async handleOpen(): Promise<void> {
        this.isConnected = true
        this.reconnectAttempts = 0
        this.startPingInterval()
        this.emit('connect', null)

        const token = await getSessionTokenForSocket()
        if (!token) {
            // No session to present. The server would drop us on its auth
            // deadline anyway; close now and do not retry, or we would spin
            // reconnecting a socket that can never authenticate.
            this.authFailed = true
            this.emit('auth_error', { reason: 'no-session' })
            this.disconnect()
            return
        }

        if (this.socket?.readyState === WebSocket.OPEN) {
            this.socket.send(JSON.stringify({ type: 'auth', token }))
        }
    }

    private handleMessage(event: MessageEvent): void {
        try {
            const message = JSON.parse(event.data) as WebSocketMessage

            switch (message.type) {
                case 'pong':
                    // Server responded to our ping
                    this.emit('pong', null)
                    break

                case 'auth_ok':
                    // Handshake accepted — event frames start flowing now.
                    this.authFailed = false
                    this.emit('auth_ok', null)
                    break

                case 'auth_error':
                    // The credential was refused, not the transport. Reconnecting
                    // would present the same bad token again, so mark it
                    // permanent; handleClose reads this to skip the backoff loop.
                    this.authFailed = true
                    this.emit('auth_error', message.data ?? null)
                    break

                case 'history_entry':
                    if (message.data) {
                        // Process history entry
                        const historyEntry = message.data
                        this.emit('history_entry', historyEntry)
                    }
                    break

                case 'kyc_status_update':
                    if (message.data && 'status' in (message.data as object)) {
                        this.emit('kyc_status_update', message.data)
                    }
                    break

                case 'manteca_kyc_status_update':
                    if (message.data && 'status' in (message.data as object)) {
                        this.emit('manteca_kyc_status_update', message.data)
                    }
                    break

                case 'sumsub_kyc_status_update':
                    if (message.data && 'status' in (message.data as object)) {
                        this.emit('sumsub_kyc_status_update', message.data)
                    }
                    break

                case 'persona_tos_status_update':
                    if (message.data && 'status' in (message.data as object)) {
                        this.emit('persona_tos_status_update', message.data)
                    }
                    break

                case 'pending_perk':
                    if (message.data && 'id' in (message.data as object)) {
                        this.emit('pending_perk', message.data)
                    }
                    break

                case 'user_rail_status_changed':
                    if (message.data && 'railId' in (message.data as object)) {
                        this.emit('user_rail_status_changed', message.data)
                    }
                    break

                case 'rain_card_balance_changed':
                    if (message.data && 'reason' in (message.data as object)) {
                        this.emit('rain_card_balance_changed', message.data)
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

    /** Server-side auth close codes (see peanut-api-ts routes/charges-ws). */
    private static readonly CLOSE_AUTH_FAILED = 4401
    private static readonly CLOSE_AUTH_TIMEOUT = 4408

    private handleClose(event: CloseEvent): void {
        this.isConnected = false
        this.clearPingInterval()
        this.emit('disconnect', { code: event.code, reason: event.reason })

        const authRejected =
            this.authFailed ||
            event.code === PeanutWebSocket.CLOSE_AUTH_FAILED ||
            event.code === PeanutWebSocket.CLOSE_AUTH_TIMEOUT

        // An auth rejection arrives as a non-clean close, so without this check
        // it would fall straight into the 5x exponential-backoff loop and
        // hammer the API with a credential already known to be bad.
        if (authRejected) {
            this.authFailed = true
            this.emit('auth_error', { code: event.code, reason: event.reason })
            return
        }

        if (!event.wasClean) {
            this.scheduleReconnect()
        }
    }

    private handleError(event: Event): void {
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

// Singleton instance for app-wide usage. Keyed on username so that we
// don't bind the singleton to the wrong path if a caller mounts before
// auth has resolved, and so that logout → login rebuilds cleanly.
let websocketInstance: PeanutWebSocket | null = null
let websocketInstanceUsername: string | null = null

export const getWebSocketInstance = (username?: string): PeanutWebSocket | null => {
    if (typeof window === 'undefined') return null
    // Demo mode has no backend/charges socket — returning null is the no-op
    // (callers already handle it) and avoids the mixed-content wss:// failure.
    if (isDemoMode()) return null
    // Can't connect without a username — the server route is /ws/charges/:username.
    // Returning null lets callers bail out and re-try once auth is ready.
    if (!username) return null

    // If the singleton was created for a different user, tear it down before
    // returning a fresh one.
    if (websocketInstance && websocketInstanceUsername !== username) {
        websocketInstance.disconnect()
        websocketInstance = null
        websocketInstanceUsername = null
    }

    if (!websocketInstance) {
        let wsUrl = process.env.NEXT_PUBLIC_PEANUT_WS_URL || apiUrlToWsUrl(process.env.NEXT_PUBLIC_PEANUT_API_URL || '')
        const path = `/ws/charges/${username}`

        // Downgrade to ws:// only for local dev against a localhost WS server. Native
        // builds also run at https://localhost but connect to a remote wss:// host —
        // downgrading there is mixed content and gets blocked by the WebView.
        if (!isCapacitor() && window.location.hostname === 'localhost' && wsUrl.startsWith('wss://')) {
            wsUrl = wsUrl.replace('wss://', 'ws://')
        }

        // Without a valid absolute ws(s):// base, `new URL(path, wsUrl)` throws on every
        // connect and the reconnect loop pegs the main thread (freeze → crash). Bail out —
        // callers already treat null as "socket unavailable".
        if (!isValidWsUrl(wsUrl)) {
            console.warn(
                'WebSocket disabled: no valid WS URL from NEXT_PUBLIC_PEANUT_WS_URL / NEXT_PUBLIC_PEANUT_API_URL'
            )
            return null
        }

        websocketInstance = new PeanutWebSocket(wsUrl, path)
        websocketInstanceUsername = username
    }

    return websocketInstance
}
