import { getStoreUpdateOffer } from '@/utils/store-update'
import { getForcedUpdatePlatform } from '../force-update'

jest.mock('@/utils/capacitor', () => ({ isIOSNativeBridge: () => false, isAndroidNativeBridge: () => false }))

const floor = { ios: '1.40.0', android: '140' }
const android = (installedVersion: string, availableVersion = '141') => ({
    platform: 'android' as const,
    installedVersion,
    availableVersion,
})
const ios = (installedVersion: string, availableVersion = '1.40.1') => ({
    platform: 'ios' as const,
    installedVersion,
    availableVersion,
})

describe('getForcedUpdatePlatform', () => {
    it('forces the store update below the floor when the store offers a build that reaches it', () => {
        expect(getForcedUpdatePlatform(android('139'), floor)).toBe('android')
        expect(getForcedUpdatePlatform(android('139', '140'), floor)).toBe('android')
        expect(getForcedUpdatePlatform(ios('1.39.9'), floor)).toBe('ios')
    })

    it('shows nothing at or above the floor', () => {
        expect(getForcedUpdatePlatform(android('140'), floor)).toBeNull()
        expect(getForcedUpdatePlatform(android('141', '142'), floor)).toBeNull()
        expect(getForcedUpdatePlatform(ios('1.40'), floor)).toBeNull()
    })

    it('shows nothing when the store cannot deliver the floor (old OS, staged rollout)', () => {
        expect(getForcedUpdatePlatform(android('130', '139'), floor)).toBeNull()
        expect(getForcedUpdatePlatform(null, floor)).toBeNull()
    })

    it('shows nothing on web: no native bridge means no store offer', async () => {
        const offer = await getStoreUpdateOffer()
        expect(offer).toBeNull()
        expect(getForcedUpdatePlatform(offer, floor)).toBeNull()
    })

    it.each([undefined, null, {}, 'android:140', { android: 140 }, { android: '0' }, { web: '1' }])(
        'shows nothing when the floor is missing or unreadable: %p',
        (rawFloor) => {
            expect(getForcedUpdatePlatform(android('1'), rawFloor)).toBeNull()
        }
    )

    it('applies only the platform the floor names', () => {
        expect(getForcedUpdatePlatform(android('1'), { ios: '1.40.0' })).toBeNull()
    })
})
