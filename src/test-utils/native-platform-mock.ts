export function createNativePlatformMock() {
    const capacitor = jest.requireMock('@/utils/capacitor')
    return {
        ...jest.requireActual('@/utils/native-platform'),
        useNativePlatform: () => {
            const ios = capacitor.isIOSNative?.() ?? false
            const android = capacitor.isAndroidNative?.() ?? false
            const platform = capacitor.getPlatform?.() ?? (ios ? 'ios-native' : android ? 'android-native' : 'web')
            return {
                isCapacitor: capacitor.isCapacitor?.() ?? false,
                isNativeBridge: capacitor.isNativeBridge?.() ?? false,
                platform,
                isIOSNative: capacitor.isIOSNative?.() ?? platform === 'ios-native',
                isAndroidNative: capacitor.isAndroidNative?.() ?? platform === 'android-native',
                isAndroidNativeBridge: capacitor.isAndroidNativeBridge?.() ?? false,
                isHydrated: true,
            }
        },
    }
}
