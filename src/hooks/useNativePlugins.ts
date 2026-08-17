'use client'

import { useEffect } from 'react'
import { isCapacitor, getPlatform } from '@/utils/capacitor'

/**
 * Native chrome configuration for the signed-in app shell (status bar,
 * keyboard). Mounted in (mobile-ui)/layout only — the (setup) layout styles
 * the status bar itself, so this must not run there. App-lifecycle and
 * deep-link listeners live in useNativeAppLinks (ClientProviders), which
 * covers every route including /setup.
 */
export function useNativePlugins() {
    useEffect(() => {
        if (!isCapacitor()) return

        const init = async () => {
            try {
                const { StatusBar, Style } = await import('@capacitor/status-bar')
                await StatusBar.setOverlaysWebView({ overlay: false })
                // Black status-bar strip with light icons, everywhere. On Android 15+
                // edge-to-edge these are no-ops and the CSS safe zone in the layout
                // paints the black behind the status bar instead.
                await StatusBar.setStyle({ style: Style.Dark })
                await StatusBar.setBackgroundColor({ color: '#000000' })
            } catch (e) {
                console.warn('failed to init status bar:', e)
            }

            // Resize the webview when the soft keyboard appears so inputs on
            // amount / send / invite screens aren't hidden behind it. setResizeMode
            // is an iOS API — Android throws "not implemented" and handles resize via
            // the manifest's windowSoftInputMode=adjustResize instead.
            if (getPlatform() === 'ios-native') {
                try {
                    const { Keyboard, KeyboardResize } = await import('@capacitor/keyboard')
                    await Keyboard.setResizeMode({ mode: KeyboardResize.Native })
                } catch (e) {
                    console.warn('failed to configure keyboard:', e)
                }
            }
        }

        init()
    }, [])
}
