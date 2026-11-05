/** @jest-environment jsdom */
import { renderHook } from '@testing-library/react'
import type { RailCapability } from '@/types/capabilities'

const mockRails: { current: RailCapability[] } = { current: [] }
jest.mock('@/hooks/useCapabilities', () => ({
    useCapabilities: () => ({
        rails: mockRails.current,
        channelOf: (rail: RailCapability) => rail.channel,
        nextActions: [],
    }),
}))
jest.mock('@/context/authContext', () => ({ useAuth: () => ({ user: { user: { isActivated: false } } }) }))
jest.mock('@/hooks/useCardSurfaceAccess', () => ({ useCardSurfaceAccess: () => ({ canSpendPathViaCard: false }) }))
jest.mock('@/hooks/useFeatureFlag', () => ({ useFeatureFlags: () => () => false }))
jest.mock('@/hooks/useIdentityVerification', () => ({
    useIdentityVerification: () => ({ isRegionRestricted: false, identity: {} }),
}))

import { useProviderRejection } from '../useProviderRejection'

const aveniaRail = (code: string): RailCapability => ({
    id: 'avenia.pix_br',
    provider: 'avenia',
    method: 'PIX_BR',
    channel: 'bank',
    country: 'BR',
    currency: 'BRL',
    status: 'blocked',
    reason: { code, userMessage: 'Pix with our Brazilian payments partner is not available.' },
})
const verifiedOnboarding = { verify: 'done', firstPaymentDone: false } as Parameters<typeof useProviderRejection>[0]

describe('useProviderRejection with an Avenia rail', () => {
    it.each(['avenia_not_available', 'avenia_paused'])('reads %s as no rejection: no contact-support card', (code) => {
        mockRails.current = [aveniaRail(code)]
        const { result } = renderHook(() => useProviderRejection(verifiedOnboarding))
        expect(result.current.hasBlockedRejection).toBe(false)
        expect(result.current.blockedCard).toBeNull()
    })

    it("still reads Avenia's own rejection as one", () => {
        mockRails.current = [aveniaRail('avenia_kyc_rejected')]
        const { result } = renderHook(() => useProviderRejection(verifiedOnboarding))
        expect(result.current.hasBlockedRejection).toBe(true)
    })
})
