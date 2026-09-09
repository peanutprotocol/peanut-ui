/**
 * @jest-environment jsdom
 */
import { act, renderHook } from '@testing-library/react'
import { usePerkClaimFlow } from '../usePerkClaimFlow'

const capture = jest.fn()
jest.mock('posthog-js', () => ({ __esModule: true, default: { capture: (...a: unknown[]) => capture(...a) } }))

const claimPerk = jest.fn()
jest.mock('@/services/perks', () => ({ perksApi: { claimPerk: (...a: unknown[]) => claimPerk(...a) } }))

const invalidateQueries = jest.fn()
jest.mock('@tanstack/react-query', () => ({ useQueryClient: () => ({ invalidateQueries }) }))

const shootDoubleStarConfetti = jest.fn()
jest.mock('@/utils/confetti', () => ({ shootDoubleStarConfetti: (...a: unknown[]) => shootDoubleStarConfetti(...a) }))

const notifyHaptic = jest.fn()
jest.mock('@/utils/haptics', () => ({ notifyHaptic: (...a: unknown[]) => notifyHaptic(...a) }))

jest.mock('@/context/authContext', () => ({ useAuth: () => ({ user: { user: { userId: 'u1' } } }) }))

jest.mock('@/utils/general.utils', () => ({
    getUserPreferences: jest.fn(() => ({})),
    extractInviteeName: jest.fn(() => null),
}))

const perk = { id: 'perk-1', amountUsd: 5, name: 'referral', reason: '', inviteeName: 'ana' } as never

describe('usePerkClaimFlow', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        jest.useFakeTimers()
        claimPerk.mockResolvedValue({ success: true })
    })

    afterEach(() => {
        jest.useRealTimers()
    })

    it('starts idle and captures the claim-shown event when visible', () => {
        const { result } = renderHook(() =>
            usePerkClaimFlow({ perk, visible: true, onClose: jest.fn(), onClaimed: jest.fn() })
        )
        expect(result.current.claimPhase).toBe('idle')
        expect(result.current.isSuccessPhase).toBe(false)
        expect(capture).toHaveBeenCalledWith('reward_claim_shown', { amount_usd: 5, perk_name: 'referral' })
    })

    it('hold-complete opens, fires the claim in the background, then reveals after 600ms', async () => {
        const onClaimed = jest.fn()
        const { result } = renderHook(() => usePerkClaimFlow({ perk, visible: true, onClose: jest.fn(), onClaimed }))

        await act(async () => {
            await result.current.handleHoldComplete()
        })
        expect(result.current.claimPhase).toBe('opening')
        expect(claimPerk).toHaveBeenCalledWith('perk-1')
        expect(onClaimed).toHaveBeenCalledWith('perk-1')
        expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ['pendingPerks'] })

        act(() => {
            jest.advanceTimersByTime(600)
        })
        expect(notifyHaptic).toHaveBeenCalledWith('success')
        expect(shootDoubleStarConfetti).toHaveBeenCalled()
        expect(result.current.claimPhase).toBe('revealed')
        expect(result.current.lastClaimedPerk).toBe(perk)
        expect(result.current.isSuccessPhase).toBe(true)
    })

    it('close in idle captures the dismissed event and closes immediately', () => {
        const onClose = jest.fn()
        const { result } = renderHook(() => usePerkClaimFlow({ perk, visible: true, onClose, onClaimed: jest.fn() }))

        act(() => {
            result.current.handleModalClose()
        })
        expect(capture).toHaveBeenCalledWith('reward_claim_dismissed', { amount_usd: 5, perk_name: 'referral' })
        expect(onClose).toHaveBeenCalledTimes(1)
    })

    it('dismiss from revealed exits, then closes after 400ms', async () => {
        const onClose = jest.fn()
        const { result } = renderHook(() => usePerkClaimFlow({ perk, visible: true, onClose, onClaimed: jest.fn() }))

        await act(async () => {
            await result.current.handleHoldComplete()
        })
        act(() => {
            jest.advanceTimersByTime(600)
        })
        expect(result.current.claimPhase).toBe('revealed')

        act(() => {
            result.current.handleModalClose()
        })
        expect(result.current.claimPhase).toBe('exiting')
        // still success phase so the modal keeps rendering during the exit animation
        expect(result.current.isSuccessPhase).toBe(true)
        expect(onClose).not.toHaveBeenCalled()

        act(() => {
            jest.advanceTimersByTime(400)
        })
        expect(onClose).toHaveBeenCalledTimes(1)
    })

    it('does not close during the opening phase', async () => {
        const onClose = jest.fn()
        const { result } = renderHook(() => usePerkClaimFlow({ perk, visible: true, onClose, onClaimed: jest.fn() }))

        await act(async () => {
            await result.current.handleHoldComplete()
        })
        act(() => {
            result.current.handleModalClose()
        })
        expect(onClose).not.toHaveBeenCalled()
    })
})
