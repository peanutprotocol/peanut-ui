import React from 'react'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query'
import {
    AttentionProvider,
    resetAttentionSessionForTests,
    useAttentionOptional,
} from '@/features/attention/AttentionProvider'
import { run, state } from '@/features/attention/__tests__/legacy-manager.fixture'

const mockGetStatus = jest.fn<Promise<{ needsReConsent: boolean }>, []>()
let mockUser: { user: { userId: string } } | null
let mockJourney: ReturnType<typeof state>
let mockMigrationOn = true
jest.mock('@/features/attention/journeyState', () => ({ useJourneyState: () => mockJourney }))
jest.mock('@/features/attention/serverAttention', () => ({
    ...jest.requireActual('@/features/attention/serverAttention'),
    useServerAttention: () => undefined,
}))
jest.mock('@/context/ModalsContext', () => ({ useModalsContextOptional: () => undefined }))
jest.mock('@/utils/overlay-visibility', () => ({ useAnyOverlayOpen: () => false }))
jest.mock('next/navigation', () => ({ usePathname: () => '/home' }))
jest.mock('posthog-js', () => ({ capture: jest.fn() }))
jest.mock('@sentry/nextjs', () => ({ captureException: jest.fn(), captureMessage: jest.fn() }))

const deferred = () => {
    let resolve!: (value: { needsReConsent: boolean }) => void
    let reject!: (reason?: unknown) => void
    const promise = new Promise<{ needsReConsent: boolean }>((res, rej) => {
        resolve = res
        reject = rej
    })
    return { promise, resolve, reject }
}
function Probe() {
    const attention = useAttentionOptional()
    return (
        <>
            <span data-testid="pick">{attention?.decision.interrupt ?? 'none'}</span>
            <span data-testid="consent">{attention?.state.consent.status ?? 'unavailable'}</span>
            <button
                onClick={() => {
                    attention?.opened('legal-reconsent')
                    attention?.snoozed('legal-reconsent')
                }}
            >
                Defer legal
            </button>
        </>
    )
}
function Source({ withConsent = true }: { withConsent?: boolean }) {
    const userId = mockUser?.user.userId ?? null
    // Consent belongs to the account query, not to the presentation component.
    const query = useQuery({
        queryKey: ['legacy-consent-test', userId],
        queryFn: () => mockGetStatus(),
        enabled: !!userId,
        retry: false,
    })
    const status = query.data ? (query.data.needsReConsent ? 'needed' : 'clear') : 'unknown'
    mockJourney = state({
        userId,
        userLoaded: !!userId,
        isNative: false,
        migration: { on: mockMigrationOn },
        consent: {
            status,
            versions: status === 'needed' ? ['2026-07-15'] : [],
            documents: status === 'needed' ? [{ slug: 'terms', currentVersion: '2026-07-15' }] : [],
        },
    })
    return (
        <AttentionProvider>
            <Probe />
            {withConsent && <span data-testid="presentation" />}
        </AttentionProvider>
    )
}
let client: QueryClient
function Tree({ withConsent = true }: { withConsent?: boolean }) {
    return (
        <QueryClientProvider client={client}>
            <Source withConsent={withConsent} />
        </QueryClientProvider>
    )
}
const flush = () => act(async () => {})
beforeEach(() => {
    jest.clearAllMocks()
    window.localStorage.clear()
    resetAttentionSessionForTests()
    mockUser = { user: { userId: 'user-a' } }
    mockMigrationOn = true
    client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
})

// PR #3667 makes install-app rank ahead of legal. Unknown consent remains
// unknown, and the four-second deadline only releases lower-priority ordering.
describe('legal re-consent and download under the attention manager', () => {
    test('higher-priority unknown holds a lower announcement until the settle deadline without becoming consent', () => {
        const facts = {
            consent: { status: 'unknown', versions: [], documents: [] },
            showEarlyUserModal: true,
            onboarding: {
                verify: 'done',
                addMoneyDone: true,
                firstPaymentDone: true,
                firstPaymentRoute: 'card_qr',
                step: 'completed',
            },
        } satisfies Partial<import('@/features/attention/types').JourneyState>
        expect(run(facts, { settleDeadlinePassed: false }).interrupt).toBeNull()
        const after = run(facts, { settleDeadlinePassed: true })
        expect(after.interrupt).toBe('early-user')
        expect(after.trace.verdicts['legal-reconsent']).toBe('unknown')
    })
    test('a pending consent check is unknown while higher-ranked install is selected; legal remains needed after its response', async () => {
        const pending = deferred()
        mockGetStatus.mockReturnValue(pending.promise)
        render(<Tree />)
        await flush()
        expect(screen.getByTestId('consent')).toHaveTextContent('unknown')
        expect(screen.getByTestId('pick')).toHaveTextContent('install-app')
        await act(async () => {
            pending.resolve({ needsReConsent: true })
        })
        await act(async () => {})
        await waitFor(() => expect(screen.getByTestId('consent')).toHaveTextContent('needed'))
        expect(screen.getByTestId('pick')).toHaveTextContent('install-app')
    })
    test('a no-change consent check leaves the download prompt eligible', async () => {
        mockGetStatus.mockResolvedValue({ needsReConsent: false })
        render(<Tree />)
        await flush()
        expect(screen.getByTestId('pick')).toHaveTextContent('install-app')
    })
    test('a failed consent check never fabricates acceptance and does not block higher-ranked install', async () => {
        mockGetStatus.mockRejectedValue(new Error('api down'))
        render(<Tree />)
        await flush()
        expect(screen.getByTestId('consent')).toHaveTextContent('unknown')
        expect(screen.getByTestId('pick')).toHaveTextContent('install-app')
    })
    test('unmounting presentation mid-check does not resolve the account consent query', async () => {
        const pending = deferred()
        mockGetStatus.mockReturnValue(pending.promise)
        const view = render(<Tree />)
        await flush()
        view.rerender(<Tree withConsent={false} />)
        await flush()
        expect(screen.queryByTestId('presentation')).not.toBeInTheDocument()
        expect(screen.getByTestId('consent')).toHaveTextContent('unknown')
        expect(screen.getByTestId('pick')).toHaveTextContent('install-app')
    })
    test('an account switch does not reuse the previous account consent result', async () => {
        mockGetStatus.mockResolvedValueOnce({ needsReConsent: false })
        const view = render(<Tree />)
        await flush()
        const pending = deferred()
        mockGetStatus.mockReturnValue(pending.promise)
        mockUser = { user: { userId: 'user-b' } }
        view.rerender(<Tree />)
        await flush()
        expect(screen.getByTestId('consent')).toHaveTextContent('unknown')
        await act(async () => {
            pending.resolve({ needsReConsent: true })
        })
        await flush()
        await waitFor(() => expect(screen.getByTestId('consent')).toHaveTextContent('needed'))
    })
    test('a new account check failure remains unknown, not the previous clear', async () => {
        mockGetStatus.mockResolvedValueOnce({ needsReConsent: false })
        const view = render(<Tree />)
        await flush()
        const pending = deferred()
        mockGetStatus.mockReturnValue(pending.promise)
        mockUser = { user: { userId: 'user-b' } }
        view.rerender(<Tree />)
        await flush()
        await act(async () => {
            pending.reject(new Error('api down'))
        })
        await flush()
        expect(screen.getByTestId('consent')).toHaveTextContent('unknown')
        expect(screen.getByTestId('pick')).toHaveTextContent('install-app')
    })
    test('a late result for account A cannot set the consent state for account B', async () => {
        const first = deferred()
        const second = deferred()
        mockGetStatus.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise)
        const view = render(<Tree />)
        await flush()
        mockUser = { user: { userId: 'user-b' } }
        view.rerender(<Tree />)
        await flush()
        await act(async () => {
            first.resolve({ needsReConsent: true })
        })
        await flush()
        expect(screen.getByTestId('consent')).toHaveTextContent('unknown')
        await act(async () => {
            second.resolve({ needsReConsent: false })
        })
        await flush()
        await waitFor(() => expect(screen.getByTestId('consent')).toHaveTextContent('clear'))
    })
    test('a legal prompt deferred by account A does not latch account B', async () => {
        mockMigrationOn = false
        mockGetStatus.mockResolvedValueOnce({ needsReConsent: true })
        const view = render(<Tree />)
        await waitFor(() => expect(screen.getByTestId('pick')).toHaveTextContent('legal-reconsent'))
        fireEvent.click(screen.getByText('Defer legal'))
        await waitFor(() => expect(screen.getByTestId('pick')).not.toHaveTextContent('legal-reconsent'))
        mockUser = { user: { userId: 'user-b' } }
        mockMigrationOn = true
        mockGetStatus.mockResolvedValueOnce({ needsReConsent: false })
        view.rerender(<Tree />)
        await waitFor(() => expect(screen.getByTestId('pick')).toHaveTextContent('install-app'))
    })
})
