// A direct authenticated web load of /card or /history mounts the BottomNav
// badge without ever mounting useNotifications, so this hook is the only
// thing standing between a foreground push and a stale badge there. Pin that
// it registers the delivery bridge and drives init on web, and stays out of
// the way on native (useNativeAppLinks owns that platform).
import { renderHook, waitFor } from '@testing-library/react'
import { useForegroundPushRefresh } from '@/hooks/useForegroundPushRefresh'
import { isCapacitor } from '@/utils/capacitor'
import { onForegroundPushDelivered } from '@/utils/notifications-events'

const mockInit = jest.fn(() => Promise.resolve())
const mockOnNotificationReceived = jest.fn((_listener: () => void) => () => {})
jest.mock('@/services/onesignal', () => ({
    getOneSignalAdapter: jest.fn(() =>
        Promise.resolve({
            init: mockInit,
            onNotificationReceived: mockOnNotificationReceived,
        })
    ),
}))

jest.mock('@/utils/capacitor', () => ({ isCapacitor: jest.fn(() => false) }))

const mockIsCapacitor = isCapacitor as jest.MockedFunction<typeof isCapacitor>

beforeEach(() => {
    jest.clearAllMocks()
    mockIsCapacitor.mockReturnValue(false)
})

describe('useForegroundPushRefresh', () => {
    it('registers the delivery bridge and drives init on web', async () => {
        renderHook(() => useForegroundPushRefresh())

        await waitFor(() => expect(mockInit).toHaveBeenCalledTimes(1))
        // the shared reference is the dedupe key across registration sites
        expect(mockOnNotificationReceived).toHaveBeenCalledWith(onForegroundPushDelivered)
    })

    it('does nothing on native, where useNativeAppLinks owns the bridge', async () => {
        mockIsCapacitor.mockReturnValue(true)
        renderHook(() => useForegroundPushRefresh())

        await Promise.resolve()
        expect(mockInit).not.toHaveBeenCalled()
        expect(mockOnNotificationReceived).not.toHaveBeenCalled()
    })
})
