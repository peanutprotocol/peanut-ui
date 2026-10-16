import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { withNuqsTestingAdapter } from 'nuqs/adapters/testing'
import { CardAcquisitionScreen } from '../components/CardAcquisitionScreen'

const mockHaptic = jest.fn()
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
