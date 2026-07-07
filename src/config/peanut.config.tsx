'use client'
import { ContextProvider } from '@/config'
import countries from 'i18n-iso-countries'
import enLocale from 'i18n-iso-countries/langs/en.json'
import { useEffect } from 'react'
import { Provider as ReduxProvider } from 'react-redux'

import store from '@/redux/store'
import 'react-tooltip/dist/react-tooltip.css'
import { isCapacitor, getNativeRpId } from '@/utils/capacitor'
import { CRISP_WEBSITE_ID } from '@/constants/crisp'
// Note: Sentry configs are auto-loaded by @sentry/nextjs via next.config.js
// DO NOT import them here - it bundles server/edge configs into client code

export function PeanutProvider({ children }: { children: React.ReactNode }) {
    useEffect(() => {
        if (process.env.NODE_ENV !== 'development') {
            countries.registerLocale(enLocale)
        }

        // in capacitor, install the passkey shim so navigator.credentials.create/get
        // routes through native APIs instead of the browser (which doesn't work in webview).
        if (isCapacitor()) {
            import('@capgo/capacitor-passkey').then(({ CapacitorPasskey }) => {
                const nativeRpId = getNativeRpId()

                // check native passkey support first
                CapacitorPasskey.isSupported()
                    .then((support) => {
                        console.log('[PeanutProvider] passkey support:', JSON.stringify(support))
                    })
                    .catch((err: unknown) => {
                        console.warn('[PeanutProvider] passkey isSupported check failed:', err)
                    })

                CapacitorPasskey.autoShimWebAuthn({ origin: `https://${nativeRpId}` })
                    .then(() => {
                        // verify the shim actually installed by checking if credentials was patched
                        const shimInstalled = (globalThis as any).__capgoPasskeyShimInstalled === true
                        console.log('[PeanutProvider] passkey shim installed:', shimInstalled)

                        // the shim's credentialFromJSON replaces its credential's prototype with
                        // PublicKeyCredential.prototype. WKWebView's native getClientExtensionResults
                        // brand-checks `this` and throws on shim credentials ("Can only call ... on
                        // instances of PublicKeyCredential"), breaking both registration and login.
                        // Wrap it unconditionally: native credentials keep the real behavior, shim
                        // credentials fall back to their JSON payload.
                        const PKC = globalThis.PublicKeyCredential
                        if (PKC) {
                            const nativeGetter = PKC.prototype.getClientExtensionResults
                            PKC.prototype.getClientExtensionResults = function () {
                                try {
                                    return nativeGetter ? nativeGetter.call(this) : {}
                                } catch {
                                    return (this as any).json?.clientExtensionResults ?? {}
                                }
                            }
                        }
                    })
                    .catch((err: unknown) => {
                        console.warn('[PeanutProvider] passkey shim init failed:', err)
                    })
            })

            // initialize native crisp chat sdk
            import('@capgo/capacitor-crisp').then(({ CapacitorCrisp }) => {
                CapacitorCrisp.configure({ websiteID: CRISP_WEBSITE_ID }).catch((err: unknown) => {
                    console.warn('[PeanutProvider] crisp init failed:', err)
                })
            })
        }
    }, [])

    return (
        <ReduxProvider store={store}>
            <ContextProvider cookies={null}>{children}</ContextProvider>
        </ReduxProvider>
    )
}
