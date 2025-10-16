'use client'
import { useEffect, useState } from 'react'

export enum DeviceType {
    IOS = 'ios',
    ANDROID = 'android',
    WEB = 'web',
}

/**
 * Used to get the user's device type
 * @returns {object} An object with the device type
 */
export const useDeviceType = () => {
    const [deviceType, setDeviceType] = useState<DeviceType | null>(null)

    // check if the user is on ios or android or web
    useEffect(() => {
        // Only access navigator when we're in the browser
        if (typeof window === 'undefined') return

        const isIos = /iPad|iPhone|iPod/.test(navigator.userAgent)
        const isAndroid = /android/i.test(navigator.userAgent)

        if (isIos) {
            setDeviceType(DeviceType.IOS)
        } else if (isAndroid) {
            setDeviceType(DeviceType.ANDROID)
        } else {
            setDeviceType(DeviceType.WEB)
        }
    }, [])

    return { deviceType }
}
