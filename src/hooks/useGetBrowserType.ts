'use client'
import { useEffect, useState } from 'react'

export enum BrowserType {
    SAFARI = 'safari',
    CHROME = 'chrome',
    FIREFOX = 'firefox',
    EDGE = 'edge',
    BRAVE = 'brave',
    OPERA = 'opera',
    SAMSUNG = 'samsung',
    UNKNOWN = 'unknown',
}

/**
 * Used to detect the user's browser type
 * @returns {object} An object with the browser type and a loading state
 */
export const useGetBrowserType = () => {
    const [browserType, setBrowserType] = useState<BrowserType | null>(null)
    const [isLoading, setIsLoading] = useState(true)

    useEffect(() => {
        // Only access navigator when we're in the browser
        if (typeof window === 'undefined') {
            setIsLoading(false)
            return
        }

        const detectBrowser = async (): Promise<BrowserType> => {
            const userAgent = navigator.userAgent.toLowerCase()

            // Check for Firefox (desktop and mobile)
            // FxiOS = Firefox on iOS
            if (userAgent.includes('firefox') || userAgent.includes('fxios')) {
                return BrowserType.FIREFOX
            }

            // Check for Edge (Chromium-based, desktop and mobile)
            // EdgiOS = Edge on iOS
            if (userAgent.includes('edg/') || userAgent.includes('edge/') || userAgent.includes('edgios')) {
                return BrowserType.EDGE
            }

            // Check for Opera (desktop and mobile)
            // OPiOS = Opera on iOS
            if (userAgent.includes('opr/') || userAgent.includes('opera') || userAgent.includes('opios')) {
                return BrowserType.OPERA
            }

            // Check for Samsung Internet
            if (userAgent.includes('samsungbrowser')) {
                return BrowserType.SAMSUNG
            }

            // Check for Brave browser BEFORE Chrome (Brave uses Chrome UA so must check first)
            if ((navigator as any).brave && (await (navigator as any).brave.isBrave?.()) === true) {
                return BrowserType.BRAVE
            }

            // Check for Chrome (desktop and mobile)
            // CriOS = Chrome on iOS
            if (userAgent.includes('chrome') || userAgent.includes('crios')) {
                return BrowserType.CHROME
            }

            // Check for Safari (desktop and mobile - must be last since all iOS browsers include "safari" in UA)
            if (userAgent.includes('safari')) {
                return BrowserType.SAFARI
            }

            return BrowserType.UNKNOWN
        }

        const initBrowser = async () => {
            const browser = await detectBrowser()
            setBrowserType(browser)
            setIsLoading(false)
        }

        initBrowser()
    }, [])

    return { browserType, isLoading }
}
