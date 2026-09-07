import { act } from '@testing-library/react'
import { renderHookWithIntl } from '@/test-utils/intl'
import { MIGRATION_SURFACES } from '@/constants/migration.consts'
import { DeviceType } from '@/hooks/useGetDeviceType'
import { useGuestStoreHandoff } from '@/hooks/useGuestStoreHandoff'

const mockOpenStore = jest.fn()
const mockCapture = jest.fn()
let mockMigrationOn = true
let mockDeviceType: DeviceType = DeviceType.WEB
let mockIsCapacitor = false

jest.mock('@/hooks/useMigrationFlag', () => ({ useMigrationFlag: () => mockMigrationOn }))
jest.mock('@/hooks/useGetDeviceType', () => {
    const actual = jest.requireActual('@/hooks/useGetDeviceType')
    return { ...actual, useDeviceType: () => ({ deviceType: mockDeviceType }) }
})
jest.mock('@/utils/capacitor', () => ({ isCapacitor: () => mockIsCapacitor }))
jest.mock('@/utils/migration.utils', () => ({
    openStore: (...args: unknown[]) => mockOpenStore(...args),
}))
jest.mock('posthog-js', () => ({ __esModule: true, default: { capture: (...a: unknown[]) => mockCapture(...a) } }))
jest.mock('@/components/Migration/ScanToDownloadModal', () => ({
    __esModule: true,
    default: ({ surface }: { surface: string }) => <div data-testid="scan-modal" data-surface={surface} />,
}))

beforeEach(() => {
    jest.clearAllMocks()
    mockMigrationOn = true
    mockDeviceType = DeviceType.WEB
    mockIsCapacitor = false
})

describe('useGuestStoreHandoff surface', () => {
    it('labels the phone store bounce with the caller surface', () => {
        mockDeviceType = DeviceType.ANDROID
        const { result } = renderHookWithIntl(() => useGuestStoreHandoff({ surface: MIGRATION_SURFACES.LANDING_DOOR }))

        let handled = false
        act(() => {
            handled = result.current.interceptGuestCta({ dest: '/card' })
        })

        expect(handled).toBe(true)
        expect(mockOpenStore).toHaveBeenCalledWith('android', 'landing_door', { dest: '/card' })
    })

    it('defaults to the guest funnel surface when the caller passes none', () => {
        mockDeviceType = DeviceType.IOS
        const { result } = renderHookWithIntl(() => useGuestStoreHandoff())

        act(() => {
            result.current.interceptGuestCta()
        })

        expect(mockOpenStore).toHaveBeenCalledWith('ios', MIGRATION_SURFACES.GUEST_FLOW, undefined)
    })

    it('opens the QR modal on desktop with the caller surface', () => {
        const { result, rerender } = renderHookWithIntl(() =>
            useGuestStoreHandoff({ surface: MIGRATION_SURFACES.LANDING_DOOR })
        )

        act(() => {
            expect(result.current.interceptGuestCta({ dest: '/card' })).toBe(true)
        })
        rerender()

        expect(mockOpenStore).not.toHaveBeenCalled()
        expect(result.current.storeHandoffModal).not.toBeNull()
    })

    it('does not intercept while the migration flag is off', () => {
        mockMigrationOn = false
        const { result } = renderHookWithIntl(() => useGuestStoreHandoff({ surface: MIGRATION_SURFACES.LANDING_DOOR }))

        let handled = true
        act(() => {
            handled = result.current.interceptGuestCta({ dest: '/card' })
        })

        expect(handled).toBe(false)
        expect(mockOpenStore).not.toHaveBeenCalled()
        expect(result.current.storeHandoffModal).toBeNull()
    })

    it('tracks the guest impression against the caller surface', () => {
        renderHookWithIntl(() =>
            useGuestStoreHandoff({ trackImpressionWhenGuest: true, surface: MIGRATION_SURFACES.LANDING_DOOR })
        )

        expect(mockCapture).toHaveBeenCalledWith('migration_guest_cta_shown', { surface: 'landing_door' })
    })
})
