import {
    buildExplorerRequest,
    buildExplorerSearchParams,
    consumeLegacyGraphUsername,
    defaultExplorerFilters,
    ExplorerWindowError,
    isOpaqueFocusToken,
    resolveExplorerWindow,
} from '../query'

const NOW = new Date('2026-08-06T12:00:00.000Z')

describe('payment explorer query contract', () => {
    it('defaults to a settled 30-day live window and the safe 5k cap', () => {
        const request = buildExplorerRequest(defaultExplorerFilters(), NOW)
        expect(request).toMatchObject({
            from: '2026-07-07T12:00:00.000Z',
            to: NOW.toISOString(),
            states: ['SETTLED'],
            includeHubs: false,
            limit: 5000,
            focus: null,
        })
    })

    it('enforces custom UTC windows from 24 hours through 120 days', () => {
        expect(() =>
            resolveExplorerWindow(
                { range: 'custom', customFrom: '2026-08-06T00:00:00.000Z', customTo: '2026-08-06T12:00:00.000Z' },
                NOW
            )
        ).toThrow('at least 24 hours')
        expect(() =>
            resolveExplorerWindow(
                { range: 'custom', customFrom: '2026-04-07T11:59:59.999Z', customTo: NOW.toISOString() },
                NOW
            )
        ).toThrow(ExplorerWindowError)
        expect(
            resolveExplorerWindow(
                { range: 'custom', customFrom: '2026-08-05T12:00:00.000Z', customTo: NOW.toISOString() },
                NOW
            )
        ).toEqual({ from: '2026-08-05T12:00:00.000Z', to: NOW.toISOString() })
    })

    it('serializes only frozen server fields and never a username or password', () => {
        const request = buildExplorerRequest(
            {
                ...defaultExplorerFilters(),
                methods: ['QR'],
                rails: ['PIX_BR', 'BANK_TRANSFER_BR'],
                providers: ['MANTECA'],
                states: ['SETTLED', 'REFUNDED'],
                infrastructure: 'hubs',
                focus: 'opaque-focus-token-that-is-long-enough',
            },
            NOW
        )
        const params = buildExplorerSearchParams(request)
        expect(params.get('mode')).toBe('payment')
        expect(params.get('methods')).toBe('QR')
        expect(params.get('rails')).toBe('BANK_TRANSFER_BR,PIX_BR')
        expect(params.get('providers')).toBe('MANTECA')
        expect(params.get('states')).toBe('SETTLED,REFUNDED')
        expect(params.get('includeHubs')).toBe('true')
        expect(params.get('focus')).toBe('opaque-focus-token-that-is-long-enough')
        expect(params.has('user')).toBe(false)
        expect(params.has('username')).toBe(false)
        expect(params.has('password')).toBe(false)
    })

    it('scrubs legacy username and password before returning the in-memory username', () => {
        const replaceState = jest.fn()
        const username = consumeLegacyGraphUsername(
            { href: 'https://peanut.me/dev/payment-graph?user=alice&password=old-secret&range=7d#graph' },
            { state: { safe: true }, replaceState }
        )
        expect(username).toBe('alice')
        expect(replaceState).toHaveBeenCalledWith({ safe: true }, '', '/dev/payment-graph?range=7d#graph')
        expect(replaceState.mock.calls[0][2]).not.toContain('alice')
        expect(replaceState.mock.calls[0][2]).not.toContain('old-secret')
    })

    it('accepts opaque focus tokens and rejects readable identifiers', () => {
        expect(isOpaqueFocusToken('opaque-focus-token-that-is-long-enough')).toBe(true)
        expect(isOpaqueFocusToken('alice')).toBe(false)
        expect(isOpaqueFocusToken('alice@example.com')).toBe(false)
    })
})
