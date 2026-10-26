import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { withNuqsTestingAdapter } from 'nuqs/adapters/testing'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'
import { CardAcquisitionScreen } from '../components/CardAcquisitionScreen'

const mockHaptic = jest.fn()
const mockCapture = jest.fn()
jest.mock('posthog-js', () => ({
    __esModule: true,
    default: { capture: (...args: unknown[]) => mockCapture(...args) },
}))
const mockPush = jest.fn()
const mockApply = jest.fn()
jest.mock('next/navigation', () => ({ useRouter: () => ({ push: mockPush }) }))
jest.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }))
jest.mock('framer-motion', () => ({ useReducedMotion: () => false }))
jest.mock('@/hooks/useAppHaptic', () => ({ useAppHaptic: () => ({ triggerHaptic: mockHaptic }) }))
jest.mock('@/utils/confetti', () => ({ shootDoubleStarConfetti: jest.fn() }))
jest.mock('@/components/Global/NavHeader', () => ({ __esModule: true, default: () => null }))
jest.mock('@/components/Card/share-asset/ScaledPixelatedCardFace', () => ({ ScaledPixelatedCardFace: () => null }))
// The real hold gesture has its own keyboard/pointer/haptic tests. This seam
// completes the gesture so this suite can verify ordering and API boundaries.
jest.mock('@/components/Global/HoldToClaimButton', () => ({
    HoldToClaimButton: ({ onComplete }: { onComplete: () => void }) => (
        <button onClick={onComplete}>Hold complete</button>
    ),
}))
jest.mock('@/components/Card/AddCardEntryScreen', () => ({
    __esModule: true,
    default: ({ onApply, needsFundingBeforeApply }: { onApply: () => void; needsFundingBeforeApply?: boolean }) => (
        <button onClick={onApply}>{needsFundingBeforeApply ? 'Add money' : 'Apply'}</button>
    ),
}))

const props = {
    userId: 'alice',
    eligible: true,
    funded: false,
    fundingRequired: false,
    onApply: mockApply,
    onPrev: jest.fn(),
}

beforeEach(() => {
    jest.clearAllMocks()
    localStorage.clear()
})

afterEach(() => {
    jest.useRealTimers()
})

it('runs hold, anticipation, availability and funding before exposing the application', async () => {
    jest.useFakeTimers()
    const { rerender } = render(<CardAcquisitionScreen {...props} />, {
        wrapper: withNuqsTestingAdapter({ hasMemory: true }),
    })
    fireEvent.click(screen.getByText('Hold complete'))
    await act(async () => {
        jest.advanceTimersByTime(100)
    })
    expect(screen.getByText('onboarding.lookingUpTitle')).toBeInTheDocument()
    await act(async () => {
        jest.advanceTimersByTime(1200)
    })
    await act(async () => {
        jest.advanceTimersByTime(100)
    })
    expect(screen.getByText('availableTitle')).toBeInTheDocument()
    expect(mockApply).not.toHaveBeenCalled()
    fireEvent.click(screen.getByText('addFunds'))
    await act(async () => {
        jest.advanceTimersByTime(100)
    })
    expect(screen.getByText('methods.bankTransfer')).toBeInTheDocument()
    expect(screen.getByText('continue')).toBeDisabled()
    rerender(<CardAcquisitionScreen {...props} funded />)
    fireEvent.click(screen.getByText('continue'))
    await act(async () => {
        jest.advanceTimersByTime(100)
    })
    fireEvent.click(screen.getByText('Apply'))
    expect(mockApply).toHaveBeenCalledTimes(1)
})

it.each([
    ['methods.bankTransfer', '/add-money?method=bank&returnTo=%2Fcard%3Fcard_step%3Dfunding'],
    ['methods.crypto', '/add-money/crypto?returnTo=%2Fcard%3Fcard_step%3Dfunding'],
])('carries the card return path through %s', (label, href) => {
    render(<CardAcquisitionScreen {...props} />, {
        wrapper: withNuqsTestingAdapter({ searchParams: '?card_step=funding' }),
    })
    fireEvent.click(screen.getByText(label))
    expect(mockPush).toHaveBeenCalledWith(href)
    expect(mockApply).not.toHaveBeenCalled()
})

it('does not promise availability for an unknown residence', () => {
    render(<CardAcquisitionScreen {...props} eligible={false} />, {
        wrapper: withNuqsTestingAdapter({ searchParams: '?card_step=available' }),
    })
    expect(screen.queryByText('availableTitle')).not.toBeInTheDocument()
    expect(screen.getByText('Apply')).toBeInTheDocument()
})

it('does not repeat anticipation for a returning funded user', async () => {
    localStorage.setItem('card_anticipation_completed_v1:alice', '1')
    render(<CardAcquisitionScreen {...props} funded />, { wrapper: withNuqsTestingAdapter({ hasMemory: true }) })
    await waitFor(() => expect(screen.getByText('Apply')).toBeInTheDocument())
})

it('explains the funding destination on the returning entry path', () => {
    localStorage.setItem('card_anticipation_completed_v1:alice', '1')
    render(<CardAcquisitionScreen {...props} needsFundingBeforeApply />, {
        wrapper: withNuqsTestingAdapter({ searchParams: '?card_step=entry' }),
    })
    fireEvent.click(screen.getByText('Add money'))
    expect(mockApply).toHaveBeenCalledTimes(1)
    expect(screen.queryByText('Hold complete')).not.toBeInTheDocument()
})

describe('card gate analytics', () => {
    const gateEvents = () =>
        mockCapture.mock.calls.filter(([name]) =>
            [ANALYTICS_EVENTS.CARD_GATE_STEP_VIEWED, ANALYTICS_EVENTS.CARD_GATE_ADD_FUNDS_TAPPED].includes(name)
        )

    it('reports each gate screen once, with the funding state and the minimum-balance notice', async () => {
        jest.useFakeTimers()
        const { rerender } = render(<CardAcquisitionScreen {...props} />, {
            wrapper: withNuqsTestingAdapter({ hasMemory: true }),
        })
        fireEvent.click(screen.getByText('Hold complete'))
        await act(async () => {
            jest.advanceTimersByTime(1400)
        })
        await act(async () => {
            jest.advanceTimersByTime(100)
        })
        fireEvent.click(screen.getByText('addFunds'))
        await act(async () => {
            jest.advanceTimersByTime(100)
        })
        rerender(<CardAcquisitionScreen {...props} funded />)
        rerender(<CardAcquisitionScreen {...props} funded />)

        expect(gateEvents()).toEqual([
            ['card_gate_step_viewed', { step: 'eligibility', funded: false, min_balance_shown: false }],
            ['card_gate_step_viewed', { step: 'available', funded: false, min_balance_shown: true }],
            ['card_gate_add_funds_tapped', { step: 'available', method: null, funded: false }],
            ['card_gate_step_viewed', { step: 'funding', funded: false, min_balance_shown: true }],
            ['card_gate_step_viewed', { step: 'funding', funded: true, min_balance_shown: true }],
        ])
    })

    it.each([
        ['methods.bankTransfer', 'bank'],
        ['methods.crypto', 'crypto'],
    ])('reports the deposit method picked on the funding screen: %s', (label, method) => {
        render(<CardAcquisitionScreen {...props} />, {
            wrapper: withNuqsTestingAdapter({ searchParams: '?card_step=funding' }),
        })
        fireEvent.click(screen.getByText(label))
        expect(gateEvents()).toEqual([
            ['card_gate_step_viewed', { step: 'funding', funded: false, min_balance_shown: true }],
            ['card_gate_add_funds_tapped', { step: 'funding', method, funded: false }],
        ])
    })

    it('reports the entry "Add money" tap before it opens the funding screen', () => {
        localStorage.setItem('card_anticipation_completed_v1:alice', '1')
        render(<CardAcquisitionScreen {...props} needsFundingBeforeApply />, {
            wrapper: withNuqsTestingAdapter({ searchParams: '?card_step=entry' }),
        })
        fireEvent.click(screen.getByText('Add money'))
        expect(gateEvents()).toEqual([
            ['card_gate_step_viewed', { step: 'entry', funded: false, min_balance_shown: true }],
            ['card_gate_add_funds_tapped', { step: 'entry', method: null, funded: false }],
        ])
        expect(mockApply).toHaveBeenCalledTimes(1)
    })

    it('does not count an apply tap from a funded user as an add-funds tap', () => {
        localStorage.setItem('card_anticipation_completed_v1:alice', '1')
        render(<CardAcquisitionScreen {...props} funded />, {
            wrapper: withNuqsTestingAdapter({ searchParams: '?card_step=entry' }),
        })
        fireEvent.click(screen.getByText('Apply'))
        expect(gateEvents()).toEqual([
            ['card_gate_step_viewed', { step: 'entry', funded: true, min_balance_shown: false }],
        ])
    })

    it('waits for the first balance read before it reports a screen', () => {
        localStorage.setItem('card_anticipation_completed_v1:alice', '1')
        const { rerender } = render(<CardAcquisitionScreen {...props} balanceKnown={false} />, {
            wrapper: withNuqsTestingAdapter({ hasMemory: true }),
        })
        expect(gateEvents()).toEqual([])
        rerender(<CardAcquisitionScreen {...props} funded balanceKnown />)
        expect(gateEvents()).toEqual([
            ['card_gate_step_viewed', { step: 'entry', funded: true, min_balance_shown: false }],
        ])
    })
})

it.each([
    [false, 'fundingBody', 'addFunds'],
    [true, 'fundedBody', 'continue'],
])('asks for money on the availability screen only while unfunded (funded=%s)', (funded, body, cta) => {
    render(<CardAcquisitionScreen {...props} funded={funded} />, {
        wrapper: withNuqsTestingAdapter({ searchParams: '?card_step=available' }),
    })
    expect(screen.getByText(body)).toBeInTheDocument()
    expect(screen.getByText(cta)).toBeInTheDocument()
})
