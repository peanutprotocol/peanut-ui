/**
 * CapNudgeCard — the limits-page surface for the Manteca cap-nudge.
 *
 * The nudge travelled from the backend to `railVerdict` and stopped there: no
 * component read it, so a capped AR user had no in-app route to a limit raise
 * at all. These pin the two states the backend emits and, above all, that the
 * `wait` state is not tappable — Sumsub accepting the document does not mean
 * Manteca raised the cap, so the review state must neither re-ask for the
 * document nor claim the limit changed.
 */
import React from 'react'
import { act, screen, fireEvent, waitFor } from '@testing-library/react'
import { renderWithIntl as render } from '@/test-utils/intl'
import type { NextAction, RailCapability } from '@/types/capabilities'
import CapNudgeCard from '../CapNudgeCard'

let mockRails: RailCapability[] = []
let mockNextActions: NextAction[] = []
const mockFetchUser = jest.fn(() => Promise.resolve(null))
const mockRefetchLimits = jest.fn()
const mockStartKycAction = jest.fn()
const mockMarkSubmitted = jest.fn()
let mockPrefs: Record<string, unknown> = {}
const mockUpdatePrefs = jest.fn((_userId: string, prefs: Record<string, unknown>) => {
    mockPrefs = { ...mockPrefs, ...prefs }
})

jest.mock('@/hooks/useCapabilities', () => ({
    useCapabilities: () => ({ rails: mockRails, nextActions: mockNextActions }),
}))
jest.mock('@/context/authContext', () => ({
    useAuth: () => ({ user: { user: { userId: 'user-1' } }, fetchUser: mockFetchUser }),
}))
jest.mock('@/hooks/useSubmissionWindow', () => ({
    markSubmitted: () => mockMarkSubmitted(),
}))
jest.mock('@/utils/general.utils', () => ({
    getUserPreferences: () => mockPrefs,
    updateUserPreferences: (userId: string, prefs: Record<string, unknown>) => mockUpdatePrefs(userId, prefs),
}))
jest.mock('@/hooks/useLimits', () => ({
    useLimits: () => ({ refetch: mockRefetchLimits }),
}))
jest.mock('@/app/actions/sumsub', () => ({
    startKycAction: (key: string) => mockStartKycAction(key),
}))
jest.mock('@/components/Kyc/SumsubKycWrapper', () => ({
    SumsubKycWrapper: (props: { visible: boolean; accessToken: string | null; onComplete: () => void }) =>
        props.visible ? (
            <div data-testid="sumsub-sdk">
                <span>{props.accessToken}</span>
                <button onClick={props.onComplete}>submit-document</button>
            </div>
        ) : null,
}))
jest.mock('@/utils/capacitor', () => ({
    isNativeBridge: () => false,
    isAndroidNative: () => false,
    isCapacitor: () => false,
}))

const mantecaRail = (overrides: Partial<RailCapability> = {}): RailCapability => ({
    id: 'manteca.bank_transfer_ar',
    provider: 'manteca',
    method: 'BANK_TRANSFER_AR',
    channel: 'bank',
    country: 'AR',
    currency: 'ARS',
    status: 'enabled',
    ...overrides,
})

const raiseAction: NextAction = {
    key: 'sumsub:source_of_funds',
    kind: 'sumsub',
    purpose: 'raise-manteca-limit',
    levelKey: 'source_of_funds',
}
const reviewAction: NextAction = {
    key: 'manteca:limit-review',
    kind: 'wait',
    purpose: 'manteca-limit-under-review',
}

describe('CapNudgeCard', () => {
    beforeEach(() => {
        mockRails = []
        mockNextActions = []
        mockFetchUser.mockReset()
        mockFetchUser.mockResolvedValue(null)
        mockRefetchLimits.mockReset()
        mockStartKycAction.mockReset()
        mockStartKycAction.mockResolvedValue({ data: { token: 'tok-1', levelName: 'source-of-funds' } })
        mockMarkSubmitted.mockReset()
        // mockClear, NOT mockReset: reset strips the implementation that
        // writes through to mockPrefs, and the remount cases depend on it.
        mockUpdatePrefs.mockClear()
        mockPrefs = {}
    })

    test('renders nothing when the user carries no cap-nudge', () => {
        mockRails = [mantecaRail()]
        const { container } = render(<CapNudgeCard />)
        expect(container).toBeEmptyDOMElement()
    })

    describe('fresh cap block → actionable CTA', () => {
        beforeEach(() => {
            mockRails = [mantecaRail({ hintActions: ['sumsub:source_of_funds'] })]
            mockNextActions = [raiseAction]
        })

        test('shows the raise copy and a tappable CTA', () => {
            render(<CapNudgeCard />)
            expect(screen.getByText(/hit your monthly limit/i)).toBeInTheDocument()
            expect(screen.getByRole('button', { name: /verify income/i })).toBeEnabled()
        })

        test('tapping the CTA starts the source-of-funds flow and opens the SDK', async () => {
            render(<CapNudgeCard />)
            fireEvent.click(screen.getByRole('button', { name: /verify income/i }))

            await waitFor(() => expect(screen.getByTestId('sumsub-sdk')).toBeInTheDocument())
            expect(mockStartKycAction).toHaveBeenCalledWith('sumsub:source_of_funds')
            expect(screen.getByText('tok-1')).toBeInTheDocument()
        })

        test('two taps in one tick mint exactly one Sumsub action', async () => {
            // `startingRef` is the ONLY synchronous guard: the disabled prop does
            // not apply until React renders again, so without a test that clicks
            // twice while the first promise is still pending, removing the guard
            // leaves the suite green and regresses into duplicate actions — which
            // the backend's create-action idempotency answers by minting a
            // suffixed second one.
            let release: (value: unknown) => void = () => {}
            mockStartKycAction.mockImplementationOnce(
                () =>
                    new Promise((resolve) => {
                        release = resolve
                    })
            )

            render(<CapNudgeCard />)
            const cta = screen.getByRole('button', { name: /verify income/i })
            // BOTH dispatches inside ONE act, so React has not re-rendered
            // between them. Two `fireEvent.click` calls flush in between, the
            // disabled prop lands, and the second click is swallowed by the
            // button — which makes the guard look tested when it is not.
            act(() => {
                cta.dispatchEvent(new MouseEvent('click', { bubbles: true }))
                cta.dispatchEvent(new MouseEvent('click', { bubbles: true }))
            })

            expect(mockStartKycAction).toHaveBeenCalledTimes(1)

            await act(async () => {
                release({ data: { token: 'tok-1', levelName: 'source-of-funds' } })
            })
            expect(mockStartKycAction).toHaveBeenCalledTimes(1)
        })

        test('a failed start surfaces inline instead of a dead CTA', async () => {
            mockStartKycAction.mockResolvedValue({ error: 'Sumsub is down' })
            render(<CapNudgeCard />)
            fireEvent.click(screen.getByRole('button', { name: /verify income/i }))

            expect(await screen.findByText('Sumsub is down')).toBeInTheDocument()
            expect(screen.queryByTestId('sumsub-sdk')).not.toBeInTheDocument()
        })

        test('submitting flips to the review state without waiting for the webhook', async () => {
            render(<CapNudgeCard />)
            fireEvent.click(screen.getByRole('button', { name: /verify income/i }))
            fireEvent.click(await screen.findByText('submit-document'))

            expect(await screen.findByText(/reviewing your limit/i)).toBeInTheDocument()
            expect(screen.queryByRole('button', { name: /verify income/i })).not.toBeInTheDocument()
            expect(mockFetchUser).toHaveBeenCalled()
            expect(mockRefetchLimits).toHaveBeenCalled()
        })

        test('submitting arms the post-write poller, not just one refetch', async () => {
            // This rail is ENABLED, so the auto-refresh predicate's pending-rail
            // arm never fires for it. Without the window a single refetch races
            // the webhook, and losing that race parks the actionable hint in the
            // user cache for its full staleTime with nothing to correct it.
            render(<CapNudgeCard />)
            fireEvent.click(screen.getByRole('button', { name: /verify income/i }))
            fireEvent.click(await screen.findByText('submit-document'))

            expect(mockMarkSubmitted).toHaveBeenCalled()
        })

        test('keeps the poller armed past the 30s window while the webhook is outstanding', async () => {
            // One markSubmitted() buys 30 seconds. This rail is ENABLED, so the
            // auto-refresh poller has no other predicate keeping it alive — and a
            // GREEN review webhook can land well after that, with nothing
            // scheduled to fetch the `wait` state it produced.
            jest.useFakeTimers()
            try {
                render(<CapNudgeCard />)
                fireEvent.click(screen.getByRole('button', { name: /verify income/i }))
                await act(async () => {})
                fireEvent.click(screen.getByText('submit-document'))

                const armedOnSubmit = mockMarkSubmitted.mock.calls.length
                expect(armedOnSubmit).toBeGreaterThan(0)

                act(() => {
                    jest.advanceTimersByTime(60_000)
                })
                expect(mockMarkSubmitted.mock.calls.length).toBeGreaterThan(armedOnSubmit)
            } finally {
                jest.useRealTimers()
            }
        })

        test('stops re-arming once the backend answers', async () => {
            jest.useFakeTimers()
            try {
                const { unmount } = render(<CapNudgeCard />)
                fireEvent.click(screen.getByRole('button', { name: /verify income/i }))
                await act(async () => {})
                fireEvent.click(screen.getByText('submit-document'))
                unmount()

                // The backend's `wait` state has landed — nothing left to poll for.
                mockRails = [mantecaRail({ hintActions: ['manteca:limit-review'] })]
                mockNextActions = [reviewAction]
                render(<CapNudgeCard />)
                const settled = mockMarkSubmitted.mock.calls.length

                act(() => {
                    jest.advanceTimersByTime(120_000)
                })
                expect(mockMarkSubmitted.mock.calls.length).toBe(settled)
            } finally {
                jest.useRealTimers()
            }
        })

        test('the TTL expires on its own, with no help from a re-render', async () => {
            // With a lost webhook the backend keeps returning the same `raise`
            // hint, React Query's structural sharing hands back an identical
            // object, and nothing re-renders — so a TTL read only at render time
            // never elapsed. The card stayed in the review state and the 20s
            // re-arm kept the 4s user poll alive indefinitely.
            jest.useFakeTimers()
            try {
                render(<CapNudgeCard />)
                fireEvent.click(screen.getByRole('button', { name: /verify income/i }))
                await act(async () => {})
                fireEvent.click(screen.getByText('submit-document'))
                expect(screen.getByText(/reviewing your limit/i)).toBeInTheDocument()

                // Past the 10-minute marker TTL, with no other state change.
                act(() => {
                    jest.advanceTimersByTime(11 * 60 * 1000)
                })

                expect(screen.getByRole('button', { name: /verify income/i })).toBeInTheDocument()
                expect(screen.queryByText(/reviewing your limit/i)).not.toBeInTheDocument()
            } finally {
                jest.useRealTimers()
            }
        })

        test('and the poller stops being re-armed once the TTL is gone', async () => {
            jest.useFakeTimers()
            try {
                render(<CapNudgeCard />)
                fireEvent.click(screen.getByRole('button', { name: /verify income/i }))
                await act(async () => {})
                fireEvent.click(screen.getByText('submit-document'))

                act(() => {
                    jest.advanceTimersByTime(11 * 60 * 1000)
                })
                const afterExpiry = mockMarkSubmitted.mock.calls.length

                act(() => {
                    jest.advanceTimersByTime(5 * 60 * 1000)
                })
                expect(mockMarkSubmitted.mock.calls.length).toBe(afterExpiry)
            } finally {
                jest.useRealTimers()
            }
        })

        test('the suppression survives a remount, so the same upload is not re-offered', async () => {
            const { unmount } = render(<CapNudgeCard />)
            fireEvent.click(screen.getByRole('button', { name: /verify income/i }))
            fireEvent.click(await screen.findByText('submit-document'))
            await screen.findByText(/reviewing your limit/i)
            unmount()

            // The backend still says `raise` — the webhook has not landed yet.
            render(<CapNudgeCard />)
            expect(await screen.findByText(/reviewing your limit/i)).toBeInTheDocument()
            expect(screen.queryByRole('button', { name: /verify income/i })).not.toBeInTheDocument()
        })

        test('a stale local submission ages out and the upload is offered again', async () => {
            // A lost webhook must re-offer the upload rather than hide it
            // forever — and must never be the reason a NEW cap block goes
            // unanswered.
            mockPrefs = { capNudgeSubmittedAt: new Date(Date.now() - 60 * 60 * 1000).toISOString() }

            render(<CapNudgeCard />)
            expect(await screen.findByRole('button', { name: /verify income/i })).toBeInTheDocument()
            // and the dead marker is cleared, not left to shadow a later block
            expect(mockUpdatePrefs).toHaveBeenCalledWith('user-1', { capNudgeSubmittedAt: undefined })
        })
    })

    describe('completed RFI → non-actionable review state', () => {
        beforeEach(() => {
            mockRails = [mantecaRail({ hintActions: ['manteca:limit-review'] })]
            mockNextActions = [reviewAction]
        })

        test('clears a local submission marker once the backend confirms', async () => {
            mockPrefs = { capNudgeSubmittedAt: new Date().toISOString() }
            render(<CapNudgeCard />)
            await waitFor(() =>
                expect(mockUpdatePrefs).toHaveBeenCalledWith('user-1', { capNudgeSubmittedAt: undefined })
            )
        })

        test('shows the review copy with no control at all', () => {
            render(<CapNudgeCard />)
            expect(screen.getByText(/reviewing your limit/i)).toBeInTheDocument()
            expect(screen.queryByRole('button')).not.toBeInTheDocument()
        })

        test('does not re-ask for the document, and claims no raise', () => {
            render(<CapNudgeCard />)
            expect(screen.queryByText(/hit your monthly limit/i)).not.toBeInTheDocument()
            expect(screen.queryByText(/verify income/i)).not.toBeInTheDocument()
            expect(screen.queryByTestId('sumsub-sdk')).not.toBeInTheDocument()
        })
    })

    test('a new cap block after a review flips the CTA back on', () => {
        mockRails = [
            mantecaRail({ hintActions: ['manteca:limit-review'] }),
            mantecaRail({ id: 'manteca.pix_br', method: 'PIX_BR', hintActions: ['sumsub:source_of_funds'] }),
        ]
        mockNextActions = [reviewAction, raiseAction]
        render(<CapNudgeCard />)
        expect(screen.getByRole('button', { name: /verify income/i })).toBeInTheDocument()
    })
})
