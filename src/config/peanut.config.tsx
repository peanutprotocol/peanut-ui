'use client'
import { ContextProvider } from '@/config'
import peanut from '@squirrel-labs/peanut-sdk'
import { Analytics } from '@vercel/analytics/react'
import countries from 'i18n-iso-countries'
import enLocale from 'i18n-iso-countries/langs/en.json'
import { useEffect } from 'react'
import { Provider as ReduxProvider } from 'react-redux'

import store from '@/redux/store'
import 'react-tooltip/dist/react-tooltip.css'
import { isCapacitor } from '@/utils/capacitor'
// Note: Sentry configs are auto-loaded by @sentry/nextjs via next.config.js
// DO NOT import them here - it bundles server/edge configs into client code

export function PeanutProvider({ children }: { children: React.ReactNode }) {
    useEffect(() => {
        if (process.env.NODE_ENV !== 'development') {
            peanut.toggleVerbose(true)
            // LogRocket.init('x2zwq1/peanut-protocol')
            countries.registerLocale(enLocale)
        }

        // in capacitor, install the passkey shim so navigator.credentials.create/get
        // routes through native APIs instead of the browser (which doesn't work in webview).
        if (isCapacitor()) {
            import('@capgo/capacitor-passkey').then(({ CapacitorPasskey }) => {
                const nativeRpId = process.env.NEXT_PUBLIC_NATIVE_RP_ID || 'peanut.me'
                CapacitorPasskey.autoShimWebAuthn({ origin: `https://${nativeRpId}` })
                    .then(() => {
                        // the shim's credentialFromJSON overrides the prototype with
                        // PublicKeyCredential.prototype, which in webview is a stub without
                        // getClientExtensionResults. patch it so @simplewebauthn/browser works.
                        const PKC = globalThis.PublicKeyCredential
                        if (PKC && !PKC.prototype.getClientExtensionResults) {
                            PKC.prototype.getClientExtensionResults = function () {
                                return (this as any).json?.clientExtensionResults ?? {}
                            }
                        }
                    })
                    .catch((err: unknown) => {
                        console.warn('[PeanutProvider] passkey shim init failed:', err)
                    })
            })
        }
    }, [])

    return (
        <ReduxProvider store={store}>
            <ContextProvider cookies={null}>
                {children}
                <Analytics />
            </ContextProvider>
        </ReduxProvider>
    )
}
