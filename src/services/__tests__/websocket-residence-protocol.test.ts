import { PeanutWebSocket } from '@/services/websocket'

jest.mock('@/utils/auth-token', () => ({ getSessionTokenForSocket: async () => 'test-credential' }))
jest.mock('@/utils/demo', () => ({ isDemoMode: () => false }))
jest.mock('@/dev/fixtures/active', () => ({ ensureActiveFixture: () => false }))

it('identifies the current residence protocol on the authenticated websocket', async () => {
    jest.useFakeTimers()
    const original = global.WebSocket
    const transport = { readyState: 1, send: jest.fn(), close: jest.fn(), onopen: null as null | (() => void) }
    global.WebSocket = Object.assign(jest.fn(() => transport), { OPEN: 1 }) as unknown as typeof WebSocket
    const socket = new PeanutWebSocket('https://api.peanut.test', '/ws')
    try {
        socket.connect()
        transport.onopen?.()
        await Promise.resolve()
        await Promise.resolve()
        expect(transport.send).toHaveBeenCalledWith(
            JSON.stringify({ type: 'auth', token: 'test-credential', residenceFormat: 'compact' })
        )
    } finally {
        socket.disconnect()
        global.WebSocket = original
        jest.useRealTimers()
    }
})
