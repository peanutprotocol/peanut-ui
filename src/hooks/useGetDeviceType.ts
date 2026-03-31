'use client'
import { useState } from 'react'

export enum DeviceType {
    IOS = 'ios',
    ANDROID = 'android',
    WEB = 'web',
}

function detectDeviceType(): DeviceType {
    if (typeof window === 'undefined') {
        return DeviceType.WEB // SSR fallback
    }

    const ua = navigator.userAgent

    // iPadOS 13+ often reports "Macintosh" in UA; detect via touch support.
    // exclude desktop chrome in responsive mode — it emulates touch points
    // but still has "Chrome" in UA (real ios chrome uses "CriOS" not "Chrome").
    const isDesktopChrome = /Macintosh/.test(ua) && /Chrome\//.test(ua) && !/CriOS/.test(ua)
    const isTraditionalIOS = /iPad|iPhone|iPod/.test(ua)
    const isIPadOS = /Macintosh/.test(ua) && navigator.maxTouchPoints > 1 && !isDesktopChrome
    const isIos = isTraditionalIOS || isIPadOS

    const isAndroid = /android/i.test(ua)

    if (isIos) {
        return DeviceType.IOS
    } else if (isAndroid) {
        return DeviceType.ANDROID
    } else {
        return DeviceType.WEB
    }
}

/**
 * Used to get the user's device type
 * @returns {object} An object with the device type
 */
export const useDeviceType = () => {
    // Initialize with detected value immediately (no null state)
    const [deviceType] = useState<DeviceType>(() => detectDeviceType())

    return { deviceType }
}
