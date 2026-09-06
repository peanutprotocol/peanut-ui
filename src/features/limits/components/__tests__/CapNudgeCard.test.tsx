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
import { screen, fireEvent, waitFor } from '@testing-library/react'
import { renderWithIntl as render } from '@/test-utils/intl'
import type { NextAction, RailCapability } from '@/types/capabilities'
import CapNudgeCard from '../CapNudgeCard'

let mockRails: RailCapability[] = []
let mockNextActions: NextAction[] = []
const mockFetchUser = jest.fn(() => Promise.resolve(null))
const mockRefetchLimits = jest.fn()
const mockStartKycAction = jest.fn()

jest.mock('@/hooks/useCapabilities', () => ({
    useCapabilities: () => ({ rails: mockRails, nextActions: mockNextActions }),
}))
jest.mock('@/context/authContext', () => ({
    useAuth: () => ({ fetchUser: mockFetchUser }),
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
    })

    describe('completed RFI → non-actionable review state', () => {
        beforeEach(() => {
            mockRails = [mantecaRail({ hintActions: ['manteca:limit-review'] })]
            mockNextActions = [reviewAction]
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
