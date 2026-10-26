'use client'

import { useSyncExternalStore } from 'react'
import { getPlatform, isAndroidNativeBridge, isCapacitor, isNativeBridge } from './capacitor'

export interface NativePlatform {
    isCapacitor: boolean
    isNativeBridge: boolean
    platform: ReturnType<typeof getPlatform>
    isIOSNative: boolean
    isAndroidNative: boolean
    isAndroidNativeBridge: boolean
    isHydrated: boolean
}

const subscribe = () => () => {}
const serverSnapshot: NativePlatform = {
    isCapacitor: false,
    isNativeBridge: false,
    platform: 'web',
    isIOSNative: false,
    isAndroidNative: false,
    isAndroidNativeBridge: false,
    isHydrated: false,
}
let clientSnapshot = serverSnapshot

function getClientSnapshot(): NativePlatform {
    const native = isCapacitor()
    const bridge = isNativeBridge()
    const platform = getPlatform()
    const androidBridge = isAndroidNativeBridge()
    if (
        !clientSnapshot.isHydrated ||
        clientSnapshot.isCapacitor !== native ||
        clientSnapshot.isNativeBridge !== bridge ||
        clientSnapshot.platform !== platform ||
        clientSnapshot.isAndroidNativeBridge !== androidBridge
    ) {
        clientSnapshot = {
            isCapacitor: native,
            isNativeBridge: bridge,
            platform,
            isIOSNative: platform === 'ios-native',
            isAndroidNative: platform === 'android-native',
            isAndroidNativeBridge: androidBridge,
            isHydrated: true,
        }
    }
    return clientSnapshot
}

export function useNativePlatform(): NativePlatform {
    return useSyncExternalStore(subscribe, getClientSnapshot, () => serverSnapshot)
}

export function useHydrationSnapshot<T>(getClientSnapshot: () => T, getServerSnapshot: () => T): T {
    return useSyncExternalStore(subscribe, getClientSnapshot, getServerSnapshot)
}
