import { isAndroidNativeBridge } from '@/utils/capacitor'
import { ensureNativeCameraPermission } from '@/utils/camera-permission'
import { Camera } from '@capacitor/camera'

jest.mock('@/utils/capacitor', () => ({ isAndroidNativeBridge: jest.fn() }))
jest.mock('@capacitor/camera', () => ({
    Camera: {
        checkPermissions: jest.fn(),
        requestPermissions: jest.fn(),
    },
}))

const mockIsAndroidNativeBridge = jest.mocked(isAndroidNativeBridge)
const mockCamera = jest.mocked(Camera)

describe('ensureNativeCameraPermission', () => {
    beforeEach(() => {
        mockIsAndroidNativeBridge.mockReset().mockReturnValue(false)
        mockCamera.checkPermissions.mockReset()
        mockCamera.requestPermissions.mockReset()
    })

    it('lets the Android WebView own the camera prompt without calling the crashing Camera plugin', async () => {
        mockIsAndroidNativeBridge.mockReturnValue(true)

        await expect(ensureNativeCameraPermission()).resolves.toBe(true)

        expect(mockCamera.checkPermissions).not.toHaveBeenCalled()
        expect(mockCamera.requestPermissions).not.toHaveBeenCalled()
    })

    it('keeps an already granted permission on non-Android native platforms', async () => {
        mockCamera.checkPermissions.mockResolvedValue({ camera: 'granted', photos: 'prompt' })

        await expect(ensureNativeCameraPermission()).resolves.toBe(true)

        expect(mockCamera.requestPermissions).not.toHaveBeenCalled()
    })

    it('requests a promptable permission on non-Android native platforms', async () => {
        mockCamera.checkPermissions.mockResolvedValue({ camera: 'prompt', photos: 'prompt' })
        mockCamera.requestPermissions.mockResolvedValue({ camera: 'denied', photos: 'prompt' })

        await expect(ensureNativeCameraPermission()).resolves.toBe(false)

        expect(mockCamera.requestPermissions).toHaveBeenCalledWith({ permissions: ['camera'] })
    })
})
