import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
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
jest.mock('next-intl', () => ({
    useTranslations: () => (key: string) => key,
    useFormatter: () => ({ list: (items: string[]) => items.join(' or ') }),
}))
jest.mock('@/context/authContext', () => ({ useAuth: () => ({ user: null }) }))
// a US resident not verified yet: the Bank row is tappable and its drawer asks for the ID check (a row
// whose plan is still loading waits disabled). The picker rows and readiness change per test (TASK-25444).
let mockPickerMethods = ['bank', 'crypto']
let mockMethodsLoading = false
let mockResidence = ['US']
let mockReady = { account: [] as string[], transfer: [] as string[], pix: [] as string[], ars: [] as string[] }
let mockAchGate = 'needs-identity'
jest.mock('@/features/add-money/useAddMoneyReadiness', () => ({
    useAddMoneyReadiness: () => ({
        isLoading: mockMethodsLoading,
        residenceIso2s: mockResidence,
        pickerMethods: mockPickerMethods,
        ready: mockReady,
        topUpGates: Object.fromEntries(
            jest
                .requireActual<typeof import('@/features/deposit-accounts/rails')>('@/features/deposit-accounts/rails')
                .DEPOSIT_RAIL_ORDER.map((corridor) => [
                    corridor,
                    { kind: corridor === 'ACH_US' ? mockAchGate : 'blocked-rejection' },
                ])
        ),
    }),
}))
// the drawer names a held account in its title; no account is held here
jest.mock('@/features/deposit-accounts/useDepositAccounts', () => ({
    ...jest.requireActual('@/features/deposit-accounts/useDepositAccounts'),
    useDepositAccounts: () => ({ accounts: {} }),
}))
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
    mockPickerMethods = ['bank', 'crypto']
    mockMethodsLoading = false
    mockResidence = ['US']
    mockReady = { account: [], transfer: [], pix: [], ars: [] }
    mockAchGate = 'needs-identity'
})

const STEP_ROWS = ['card-add-money-bank', 'card-add-money-crypto']
const stepRows = () =>
    screen.getAllByTestId(/^card-add-money-(bank|crypto)$/).map((item) => item.getAttribute('data-testid'))
const drawerRails = () => screen.getAllByTestId(/^card-add-money-rail-/).map((item) => item.getAttribute('data-testid'))
const renderFunding = () =>
    render(<CardAcquisitionScreen {...props} />, {
        wrapper: withNuqsTestingAdapter({ searchParams: '?card_step=funding' }),
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
    expect(screen.getByTestId('card-add-money-bank')).toBeInTheDocument()
    expect(screen.getByText('continue')).toBeDisabled()
    rerender(<CardAcquisitionScreen {...props} funded />)
    fireEvent.click(screen.getByText('continue'))
    await act(async () => {
        jest.advanceTimersByTime(100)
    })
    fireEvent.click(screen.getByText('Apply'))
    expect(mockApply).toHaveBeenCalledTimes(1)
})

it.each(['methods.bankTransfer', 'methods.crypto'])('adds money through %s in a drawer, on the card page', (label) => {
    render(<CardAcquisitionScreen {...props} />, {
        wrapper: withNuqsTestingAdapter({ searchParams: '?card_step=funding' }),
    })
    fireEvent.click(screen.getByText(label))
    expect(screen.getByTestId('card-add-money-drawer')).toBeInTheDocument()
    expect(mockPush).not.toHaveBeenCalled()
    expect(mockApply).not.toHaveBeenCalled()
})

// TASK-25444: the step offered only "Bank transfer" and "Crypto", so a resident of Argentina or Brazil who
// needed the balance for a card found no peso or Pix row. The step keeps its two rows (TASK-25169); its
// Bank row opens the drawer with the Add picker's ARS and Pix rows where the picker leads with them.
describe('the funding rows', () => {
    it.each([
        ['a resident of Argentina', ['AR'], ['ars', 'bank', 'crypto'], ['bank_transfer_ar', 'ach_us', 'sepa_eu']],
        ['a user offered Pix on Avenia', ['BR'], ['pix', 'bank', 'crypto'], ['pix_br', 'ach_us', 'sepa_eu']],
        [
            'a resident of Brazil whose Pix comes after the bank',
            ['BR'],
            ['bank', 'pix', 'crypto'],
            ['ach_us', 'sepa_eu', 'pix_br'],
        ],
        ['anybody else', ['US'], ['bank', 'crypto'], ['ach_us', 'sepa_eu']],
    ])('follow the Add picker order in the bank drawer for %s', (_who, residence, methods, rails) => {
        mockResidence = residence
        mockPickerMethods = methods
        // a held account and a transfer, so the Bank row opens the drawer's list
        mockReady = { account: ['USD'], transfer: ['EUR'], pix: [], ars: [] }
        renderFunding()
        expect(stepRows()).toEqual(STEP_ROWS)
        fireEvent.click(screen.getByTestId('card-add-money-bank'))
        expect(drawerRails()).toEqual(rails.map((rail) => `card-add-money-rail-${rail}`))
    })

    // Aleks, 26 Nov: Bank transfer and Crypto showed while the methods loaded, then ARS or Pix appeared
    // above them, so a fast tap could open the wrong deposit. The Bank row waits disabled instead.
    it('hold until the methods resolve, then show them in their final order', () => {
        mockMethodsLoading = true
        mockResidence = ['AR']
        const { rerender } = renderFunding()
        expect(stepRows()).toEqual(STEP_ROWS)
        expect(screen.getByTestId('card-add-money-bank')).toHaveAttribute('aria-disabled', 'true')
        fireEvent.click(screen.getByTestId('card-add-money-bank'))
        expect(screen.queryByTestId('card-add-money-drawer')).not.toBeInTheDocument()
        expect(mockPush).not.toHaveBeenCalled()
        mockMethodsLoading = false
        mockPickerMethods = ['ars', 'bank', 'crypto']
        mockReady = { account: [], transfer: ['USD'], pix: [], ars: [] }
        rerender(<CardAcquisitionScreen {...props} />)
        expect(stepRows()).toEqual(STEP_ROWS)
        fireEvent.click(screen.getByTestId('card-add-money-bank'))
        expect(drawerRails()).toEqual(['card-add-money-rail-bank_transfer_ar', 'card-add-money-rail-ach_us'])
    })

    // Chip, 27 Nov: a placeholder count that differs from the rows to come made the list jump. The step's
    // rows do not depend on the residence, so the same two rows hold for everybody.
    it.each([[['AR']], [['BR']], [['PT']], [[]]])('hold the same two rows for a resident of %j', (residence) => {
        mockMethodsLoading = true
        mockResidence = residence
        renderFunding()
        expect(stepRows()).toEqual(STEP_ROWS)
    })

    it.each([
        ['ars', '/add-money/argentina/manteca?returnTo=%2Fcard%3Fcard_step%3Dfunding'],
        ['pix', '/add-money/pix?returnTo=%2Fcard%3Fcard_step%3Dfunding'],
    ])('carry the card return path through %s, from the drawer row and as the one bank way', (method, href) => {
        mockResidence = method === 'ars' ? ['AR'] : ['BR']
        mockPickerMethods = [method, 'bank', 'crypto']
        mockReady = { account: [], transfer: ['USD'], pix: [], ars: [] }
        const { unmount } = renderFunding()
        fireEvent.click(screen.getByTestId('card-add-money-bank'))
        fireEvent.click(screen.getByTestId(`card-add-money-rail-${method === 'ars' ? 'bank_transfer_ar' : 'pix_br'}`))
        expect(mockPush).toHaveBeenLastCalledWith(href)
        unmount()
        mockReady = { account: [], transfer: [], pix: [], ars: [] }
        renderFunding()
        fireEvent.click(screen.getByTestId('card-add-money-bank'))
        expect(screen.queryByTestId('card-add-money-drawer')).not.toBeInTheDocument()
        expect(mockPush).toHaveBeenLastCalledWith(href)
        expect(mockApply).not.toHaveBeenCalled()
    })

    it('carry the card return path through bank, to the bank page for a step left there', () => {
        mockAchGate = 'accept-tos'
        renderFunding()
        fireEvent.click(screen.getByTestId('card-add-money-bank'))
        fireEvent.click(within(screen.getByTestId('card-add-money-drawer')).getByText('continue'))
        expect(mockPush).toHaveBeenCalledWith('/add-money?method=bank&returnTo=%2Fcard%3Fcard_step%3Dfunding')
        expect(mockApply).not.toHaveBeenCalled()
    })

    it('carry no return path through crypto: it stays on the card page', () => {
        renderFunding()
        fireEvent.click(screen.getByTestId('card-add-money-crypto'))
        expect(screen.getByTestId('card-add-money-drawer')).toBeInTheDocument()
        expect(mockPush).not.toHaveBeenCalled()
    })
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

    it.each(['bank', 'crypto'])('reports the deposit method picked on the funding screen: %s', (method) => {
        renderFunding()
        fireEvent.click(screen.getByTestId(`card-add-money-${method}`))
        expect(gateEvents()).toEqual([
            ['card_gate_step_viewed', { step: 'funding', funded: false, min_balance_shown: true }],
            ['card_gate_add_funds_tapped', { step: 'funding', method, funded: false }],
        ])
    })

    // TASK-25444's values: ARS and Pix are picked in the bank drawer, so that pick reports them after the
    // Bank tap; a Bank tap that goes straight to their page (the one bank way) reports them alone
    it.each(['ars', 'pix'])('reports the deposit method picked on the funding screen: %s', (method) => {
        const rail = method === 'ars' ? 'bank_transfer_ar' : 'pix_br'
        mockResidence = method === 'ars' ? ['AR'] : ['BR']
        mockPickerMethods = [method, 'bank', 'crypto']
        mockReady = { account: [], transfer: ['USD'], pix: [], ars: [] }
        const { unmount } = renderFunding()
        fireEvent.click(screen.getByTestId('card-add-money-bank'))
        fireEvent.click(screen.getByTestId(`card-add-money-rail-${rail}`))
        expect(gateEvents()).toEqual([
            ['card_gate_step_viewed', { step: 'funding', funded: false, min_balance_shown: true }],
            ['card_gate_add_funds_tapped', { step: 'funding', method: 'bank', funded: false }],
            ['card_gate_add_funds_tapped', { step: 'funding', method, funded: false }],
        ])
        unmount()
        mockCapture.mockClear()
        mockReady = { account: [], transfer: [], pix: [], ars: [] }
        renderFunding()
        fireEvent.click(screen.getByTestId('card-add-money-bank'))
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
