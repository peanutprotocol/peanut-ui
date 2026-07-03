/**
 * ActivationCTAs — the provider-rejection override must respect that a user can
 * already transact.
 *
 * A Sumsub-approved user whose *bank* rail is rejected used to always get the
 * "Complete your setup → Upload document" (fixable) / "Verification issue"
 * (blocked) home card, even when they hold an active card or another enabled
 * rail. For a card-holder that's a nag on a capability they don't need — and,
 * for a terminally-rejected bank rail, one they can't fix. The gate below
 * suppresses the override whenever the user can already transact (any enabled
 * rail — the card's rail reads `enabled` — or BE-marked `isActivated`). A
 * genuinely-fixable bank RFI still surfaces in the /add-money bank flow.
 */
import React from 'react'
import { render, screen } from '@testing-library/react'

let mockRails: Array<{ id: string; channel: string; status: string; reason?: { userMessage: string } }> = []
let mockUser: { user?: { isActivated?: boolean; userId?: string } } | null = null

jest.mock('@/hooks/useCapabilities', () => ({
    useCapabilities: () => ({
        rails: mockRails,
        channelOf: (rail: { channel: string }) => rail.channel,
        nextActionsForRail: () => [],
    }),
}))
jest.mock('@/context/authContext', () => ({
    useAuth: () => ({ user: mockUser }),
}))
jest.mock('@/hooks/useIdentityVerification', () => ({
    useIdentityVerification: () => ({ isProcessing: false, needsAction: false }),
}))
jest.mock('@/context/ModalsContext', () => ({
    useModalsContext: () => ({ setIsQRScannerOpen: jest.fn(), openSupportWithMessage: jest.fn() }),
}))
jest.mock('next/navigation', () => ({
    useRouter: () => ({ push: jest.fn() }),
}))
jest.mock('posthog-js', () => ({ __esModule: true, default: { capture: jest.fn() } }))
jest.mock('@/components/Home/CardLaunchCTA/CardLaunchCTABanner', () => ({
    __esModule: true,
    default: () => null,
}))

import ActivationCTAs from '../ActivationCTAs'

const bankRejected = {
    id: 'bridge.sepa_eu',
    channel: 'bank',
    status: 'requires-info',
    reason: { userMessage: 'We need a valid proof of address document.' },
}
const enabledCardRail = { id: 'rain.card_rain', channel: 'card', status: 'enabled' }

beforeEach(() => {
    jest.clearAllMocks()
    mockRails = []
    mockUser = { user: { isActivated: false, userId: 'u1' } }
})

describe('ActivationCTAs — rejection override respects existing transacting ability', () => {
    it('a card-holder (enabled card rail) with a rejected bank rail does NOT see "Complete your setup"', () => {
        mockRails = [enabledCardRail, bankRejected]
        render(<ActivationCTAs activationStep="deposit" />)
        expect(screen.queryByText('Complete your setup')).not.toBeInTheDocument()
        // Falls through to the normal funnel step instead of the rejection card.
        expect(screen.getByText('Deposit')).toBeInTheDocument()
    })

    it('a BE-activated user with a rejected bank rail does NOT see the nag', () => {
        mockRails = [bankRejected]
        mockUser = { user: { isActivated: true, userId: 'u1' } }
        render(<ActivationCTAs activationStep="deposit" />)
        expect(screen.queryByText('Complete your setup')).not.toBeInTheDocument()
    })

    it('a user with NO working rail still sees the fixable-rejection nag (unchanged behavior)', () => {
        mockRails = [bankRejected]
        render(<ActivationCTAs activationStep="deposit" />)
        expect(screen.getByText('Complete your setup')).toBeInTheDocument()
        expect(screen.getByText('We need a valid proof of address document.')).toBeInTheDocument()
    })
})
