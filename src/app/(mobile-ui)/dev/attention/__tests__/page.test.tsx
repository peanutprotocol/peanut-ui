import React from 'react'
import { render, screen } from '@testing-library/react'
import AttentionDebugPage from '../page'

let mockUserId: string | null = 'alice'
let mockSelected = false
const mockDecision = {
    interrupt: null,
    zone: null,
    inline: null,
    banner: null,
    trace: { verdicts: { 'push-home-fallback': 'unknown' }, reasons: {}, candidates: [] },
}
jest.mock('@/context/authContext', () => ({
    useAuth: () => ({ user: mockUserId ? { user: { userId: mockUserId } } : null }),
}))
jest.mock('@/features/attention/AttentionProvider', () => ({
    useAttentionOptional: () => ({
        state: { userId: 'alice' },
        decision: mockDecision,
        asks: [],
        ledger: {},
        session: {},
    }),
}))
jest.mock('@/features/attention/serverAttention', () => ({ useServerAttention: () => undefined }))
jest.mock('@/features/attention/catalogue', () => ({
    getSettings: () => ({ settleMs: 4000 }),
    getCatalogue: () => [
        {
            id: 'push-home-fallback',
            tier: 4,
            rank: 2,
            surfaces: ['interrupt'],
            policy: { interrupt: 'session' },
            emailMappings: [],
        },
    ],
}))
const mockDecide = jest.fn((_state: unknown, _asks: unknown, _ledger: unknown, _session: unknown) =>
    mockSelected
        ? {
              ...mockDecision,
              interrupt: 'push-home-fallback',
              trace: { verdicts: { 'push-home-fallback': 'show' }, reasons: {}, candidates: ['push-home-fallback'] },
          }
        : mockDecision
)
jest.mock('@/features/attention/decide', () => ({
    isSilenced: () => false,
    decide: (state: unknown, asks: unknown, ledger: unknown, session: unknown) =>
        mockDecide(state, asks, ledger, session),
}))
jest.mock('../../_components/DevPageShell', () => ({
    __esModule: true,
    default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

test('shows policy and unknown explanation for the signed-in account without profile details', () => {
    mockSelected = false
    mockUserId = 'alice'
    render(<AttentionDebugPage />)
    expect(screen.getByText('push-home-fallback')).toBeInTheDocument()
    expect(screen.getByText(/Waiting for facts/)).toBeInTheDocument()
    expect(screen.getByText('Home decision preview')).toBeInTheDocument()
    expect(screen.getByText('Generated fallback (live catalogue unavailable/unsupported)')).toBeInTheDocument()
    expect(mockDecide).toHaveBeenCalledWith(
        expect.objectContaining({ route: 'home' }),
        expect.anything(),
        expect.anything(),
        expect.objectContaining({ route: 'home', openInterrupt: null, busy: false, gateUp: false })
    )
    expect(document.body.textContent).not.toContain('alice')
})

test('explains which surface selected an eligible ask and its priority', () => {
    mockSelected = true
    mockUserId = 'alice'
    render(<AttentionDebugPage />)
    expect(screen.getByText('Selected interrupt at tier 4, rank 2.')).toBeInTheDocument()
    expect(screen.getByText('Decision inputs')).toBeInTheDocument()
    mockSelected = false
})

test('does not expose a previous account decision after switching accounts', () => {
    mockUserId = 'bob'
    render(<AttentionDebugPage />)
    expect(screen.queryByText('push-home-fallback')).not.toBeInTheDocument()
    expect(screen.getByText(/Sign in/)).toBeInTheDocument()
})
