import { act, cleanup, fireEvent, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderWithIntl } from '@/test-utils/intl'
import { perksApi, type PendingPerk } from '@/services/perks'
import { DEFAULT_ACCESSIBILITY, updateAccessibilityPreferences } from '@/utils/accessibility-preferences'
import PerkClaimModal from '../PerkClaimModal'

jest.mock('@/services/perks', () => ({ perksApi: { claimPerk: jest.fn() } }))
jest.mock('@/context/authContext', () => ({ useAuth: () => ({ user: null }) }))
jest.mock('next/navigation', () => ({ useRouter: () => ({ push: jest.fn() }) }))
jest.mock('posthog-js', () => ({ capture: jest.fn() }))
jest.mock('@/utils/general.utils', () => ({
    extractInviteeName: () => null,
    getUserPreferences: () => null,
    updateUserPreferences: jest.fn(),
}))
jest.mock('@/utils/confetti', () => ({ shootDoubleStarConfetti: jest.fn() }))
jest.mock('@/utils/haptics', () => ({
    cancelHaptic: jest.fn(),
    vibrateHaptic: jest.fn(),
    notifyHaptic: jest.fn(),
}))
jest.mock('@/hooks/useAppHaptic', () => ({ useAppHaptic: () => ({ triggerHaptic: jest.fn() }) }))
jest.mock('@/components/Global/InviteFriendsModal', () => ({ __esModule: true, default: () => null }))
jest.mock('@/components/Global/SoundPlayer', () => ({ SoundPlayer: () => null }))

const perk: PendingPerk = {
    id: 'perk-test',
    amountUsd: 5,
    inviteeName: 'Alex',
    createdAt: '2026-09-08T00:00:00Z',
}
const claimPerk = jest.mocked(perksApi.claimPerk)

beforeEach(() => {
    jest.useFakeTimers()
    jest.clearAllMocks()
    localStorage.clear()
    act(() => updateAccessibilityPreferences(DEFAULT_ACCESSIBILITY))
    claimPerk.mockResolvedValue({ success: true })
})

afterEach(() => {
    cleanup()
    jest.useRealTimers()
})

function renderPerk() {
    const onClaimed = jest.fn()
    const queryClient = new QueryClient({ defaultOptions: { queries: { gcTime: Infinity } } })
    renderWithIntl(
        <QueryClientProvider client={queryClient}>
            <PerkClaimModal perk={perk} visible onClose={jest.fn()} onClaimed={onClaimed} />
        </QueryClientProvider>
    )
    return { onClaimed }
}

function tapGift() {
    const gift = screen.getByRole('button', { name: 'Unwrap reward' })
    fireEvent.pointerDown(gift)
    fireEvent.pointerUp(gift)
    fireEvent.click(gift, { detail: 1 })
    act(() => jest.advanceTimersByTime(16))
}

it('claims exactly once after ordinary pointer taps fill the actual gift', async () => {
    const { onClaimed } = renderPerk()
    for (let i = 0; i < 8; i++) tapGift()
    expect(claimPerk).not.toHaveBeenCalled()
    expect(screen.queryByRole('button', { name: 'Confirm' })).not.toBeInTheDocument()

    tapGift()
    expect(claimPerk).toHaveBeenCalledTimes(1)
    expect(claimPerk).toHaveBeenCalledWith(perk.id)
    expect(screen.getByRole('button', { name: 'Unwrap reward' })).toBeDisabled()
    tapGift()
    await act(async () => jest.advanceTimersByTime(1000))
    expect(claimPerk).toHaveBeenCalledTimes(1)
    expect(onClaimed).toHaveBeenCalledTimes(1)
    expect(onClaimed).toHaveBeenCalledWith(perk.id)
})

it('lets an unfinished tap sequence decay without claiming', () => {
    renderPerk()
    for (let i = 0; i < 4; i++) tapGift()
    act(() => jest.advanceTimersByTime(8000))
    expect(claimPerk).not.toHaveBeenCalled()

    // After decay, eight new taps still fall short of a claim.
    for (let i = 0; i < 8; i++) tapGift()
    expect(claimPerk).not.toHaveBeenCalled()
    expect(screen.queryByRole('button', { name: 'Confirm' })).not.toBeInTheDocument()
    tapGift()
    expect(claimPerk).toHaveBeenCalledTimes(1)
})

it.each([
    { mode: 'simplified pointer', simplifiedConfirmations: true },
    { mode: 'assistive click', simplifiedConfirmations: false },
])('wires $mode activation through the actual gift confirmation', async ({ simplifiedConfirmations }) => {
    act(() => updateAccessibilityPreferences({ simplifiedConfirmations }))
    const { onClaimed } = renderPerk()
    const activate = () => {
        if (simplifiedConfirmations) tapGift()
        else fireEvent.click(screen.getByRole('button', { name: 'Unwrap reward' }), { detail: 0 })
    }

    activate()
    expect(screen.getByRole('dialog', { name: 'Unwrap reward' })).toBeInTheDocument()
    expect(claimPerk).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(claimPerk).not.toHaveBeenCalled()
    activate()
    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }))
    expect(claimPerk).toHaveBeenCalledTimes(1)
    expect(claimPerk).toHaveBeenCalledWith(perk.id)
    expect(screen.getByRole('button', { name: 'Unwrap reward' })).toBeDisabled()
    activate()
    await act(async () => jest.advanceTimersByTime(1000))
    expect(claimPerk).toHaveBeenCalledTimes(1)
    expect(onClaimed).toHaveBeenCalledTimes(1)
})
