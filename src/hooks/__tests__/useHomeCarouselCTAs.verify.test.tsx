/** @jest-environment jsdom */
/**
 * The carousel's "Unlock QR code payments" slide reads the shared QR-pay gate
 * (TASK-23054). A region-refused user who hides the region card lands on the
 * carousel, and must not be asked to verify for something they can never do.
 */
import React from 'react'
import { renderHook, waitFor } from '@testing-library/react'
import { IntlWrapper } from '@/test-utils/intl'
import { useHomeCarouselCTAs } from '@/hooks/useHomeCarouselCTAs'
import { HOME_CHECKLIST_CTA_ID, blockedCardCtaId, hideHomeCta } from '@/utils/home-carousel.utils'

// Every mocked value is stable across renders: the hook's effects and
// callbacks depend on their identity, and fresh objects would loop.
let mockRegionRestricted = false
let mockRails: Array<Record<string, unknown>> = []
const mockNoActions: never[] = []
const mockChannelOf = (rail: { channel: string }) => rail.channel
const mockBankRails = () => []
const mockCanDo = () => false
jest.mock('@/hooks/useIdentityVerification', () => ({
    useIdentityVerification: () => ({ isRegionRestricted: mockRegionRestricted }),
}))
jest.mock('@/hooks/useCapabilities', () => ({
    useCapabilities: () => ({
        rails: mockRails,
        nextActions: mockNoActions,
        channelOf: mockChannelOf,
        bankRails: mockBankRails,
        canDo: mockCanDo,
    }),
}))
const mockUser = { user: { userId: 'u1', badges: [] }, invitesSent: [] }
jest.mock('@/context/authContext', () => ({ useAuth: () => ({ user: mockUser }) }))
const mockNotifications = {
    requestPermission: jest.fn(),
    afterPermissionAttempt: jest.fn(),
    isPermissionGranted: true,
    isPushOptedIn: true,
    oneSignalInitialized: false,
}
jest.mock('@/hooks/useNotifications', () => ({ useNotifications: () => mockNotifications }))
const mockToast = { error: jest.fn(), success: jest.fn() }
jest.mock('@/components/0_Bruddle/Toast', () => ({ useToast: () => mockToast }))
const mockRouter = { push: jest.fn() }
jest.mock('next/navigation', () => ({ useRouter: () => mockRouter }))
const mockModals = { openSupportWithMessage: jest.fn(), setIsGetAppModalOpen: jest.fn(), setIsQRScannerOpen: jest.fn() }
jest.mock('@/context/ModalsContext', () => ({ useModalsContext: () => mockModals }))
const mockDevice = { deviceType: 'web' }
jest.mock('@/hooks/useGetDeviceType', () => ({
    DeviceType: { WEB: 'web', ANDROID: 'android', IOS: 'ios' },
    useDeviceType: () => mockDevice,
}))
const mockGeo = { countryCode: 'US' }
jest.mock('@/hooks/useGeoLocation', () => ({ useGeoLocation: () => mockGeo }))
const mockCardInfo = { isEligible: false, cardInfo: { isEligible: false, geoProhibited: true } }
jest.mock('@/hooks/useCardInfo', () => ({ useCardInfo: () => mockCardInfo }))
const mockActivation = { isActivated: false }
jest.mock('@/hooks/useActivationStatus', () => ({ useActivationStatus: () => mockActivation }))
const mockHistory = { data: { entries: [] } }
jest.mock('@/hooks/useTransactionHistory', () => ({ useTransactionHistory: () => mockHistory }))
jest.mock('@/hooks/useMigrationFlag', () => ({ useMigrationFlag: () => false }))
const mockFlag = () => false
jest.mock('@/hooks/useFeatureFlag', () => ({ useFeatureFlags: () => mockFlag }))
jest.mock('@/utils/capacitor', () => ({
    isCapacitor: () => false,
    isIOSNative: () => false,
    openExternalUrl: jest.fn(),
}))
jest.mock('posthog-js', () => ({ __esModule: true, default: { capture: jest.fn() } }))

const ids = () => {
    const { result } = renderHook(() => useHomeCarouselCTAs(), {
        wrapper: ({ children }: { children: React.ReactNode }) => <IntlWrapper>{children}</IntlWrapper>,
    })
    return result
}

beforeEach(() => {
    localStorage.clear()
    mockRegionRestricted = false
    mockRails = []
})

describe('useHomeCarouselCTAs — the verify slide follows the QR-pay gate', () => {
    it('an unverified user who can verify gets the slide', async () => {
        const result = ids()
        await waitFor(() => expect(result.current.carouselCTAs.map((cta) => cta.id)).toContain('kyc-prompt'))
    })

    it('region refused → hide the region card → the carousel has no kyc-prompt', async () => {
        mockRegionRestricted = true
        hideHomeCta('u1', blockedCardCtaId('region-restricted', 'identity_region_restricted'))
        hideHomeCta('u1', HOME_CHECKLIST_CTA_ID)
        const result = ids()
        await waitFor(() => expect(result.current.carouselCTAs).toBeDefined())
        expect(result.current.carouselCTAs.map((cta) => cta.id)).not.toContain('kyc-prompt')
    })

    it('a blocked QR provider → no kyc-prompt', async () => {
        mockRails = [{ id: 'manteca.pix_br', provider: 'manteca', channel: 'bank', status: 'blocked' }]
        const result = ids()
        await waitFor(() => expect(result.current.carouselCTAs).toBeDefined())
        expect(result.current.carouselCTAs.map((cta) => cta.id)).not.toContain('kyc-prompt')
    })
})
