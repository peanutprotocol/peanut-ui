'use client'
import { QueryClientProvider } from '@tanstack/react-query'
import dynamic from 'next/dynamic'
import { usePathname } from 'next/navigation'
import { queryClient } from '@/config/queryClient'
import { isMarketingRoute } from '@/utils/marketing-routes'
import { useEffect } from 'react'

import 'react-tooltip/dist/react-tooltip.css'
import { isCapacitor, getNativeRpId } from '@/utils/capacitor'
import { authReady } from '@/utils/auth-token'
import { installNativeAuthCapture } from '@/utils/native-auth-capture'
// Note: Sentry configs are auto-loaded by @sentry/nextjs via next.config.js
// DO NOT import them here - it bundles server/edge configs into client code

const AppStateProviders = dynamic(() => import('@/config/AppStateProviders').then((m) => m.AppStateProviders))

export function PeanutProvider({ children }: { children: React.ReactNode }) {
    useEffect(() => {
        if (process.env.NODE_ENV !== 'development') {
            // Loaded on demand: the country list plus its English locale table is
            // dead weight on the marketing site, which never renders one.
            void Promise.all([import('i18n-iso-countries'), import('i18n-iso-countries/langs/en.json')]).then(
                ([countries, enLocale]) => countries.default.registerLocale(enLocale.default)
            )
        }

        // in capacitor, install the passkey shim so navigator.credentials.create/get
        // routes through native APIs instead of the browser (which doesn't work in webview).
        // Session auth on native is header-based: the verify endpoints return the token
        // in the response body, the fetch wrapper below captures it into native
        // Preferences, and every api request sends it as Authorization
        // (see src/utils/auth-token.ts).
        if (isCapacitor()) {
            void authReady() // start Preferences hydration before any API call needs it
            installNativeAuthCapture()
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
                        const shimInstalled =
                            (globalThis as { __capgoPasskeyShimInstalled?: unknown }).__capgoPasskeyShimInstalled ===
                            true
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
                                    return (
                                        (
                                            this as PublicKeyCredential & {
                                                json?: {
                                                    clientExtensionResults?: AuthenticationExtensionsClientOutputs
                                                }
                                            }
                                        ).json?.clientExtensionResults ?? {}
                                    )
                                }
                            }
                        }
                    })
                    .catch((err: unknown) => {
                        console.warn('[PeanutProvider] passkey shim init failed:', err)
                    })
            })
        }
    }, [])

    // The query client is needed everywhere (auth, user profile); wagmi is not —
    // keep it off the marketing site. `isMarketingRoute` fails safe to the app tree.
    const marketing = isMarketingRoute(usePathname())

    /*
     * The query client is needed everywhere — the landing page's exchange-rate
     * widget is a react-query hook — but the redux store and wagmi are not:
     * nothing the marketing site renders reads either, and AuthProvider, which
     * did, now lives in AppFlowProviders.
     */
    return (
        <QueryClientProvider client={queryClient}>
            {marketing ? children : <AppStateProviders>{children}</AppStateProviders>}
        </QueryClientProvider>
    )
}
