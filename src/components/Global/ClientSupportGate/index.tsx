'use client'

import dynamic from 'next/dynamic'
import { useRef } from 'react'
import Loading from '@/components/Global/Loading'
import { useClientSupport } from '@/hooks/useClientSupport'
import { PolicyUnavailableScreen } from './PolicyUnavailableScreen'
import { RequiredUpdateScreen } from './RequiredUpdateScreen'

// Its own intl instance, like the unsupported-WebView branch in ClientProviders:
// the gate sits above the app's provider tree, so nothing below it exists yet
// when the screens render. Dynamic for the same reason as there — the full
// catalog must stay out of the marketing chunk, and the gate is mounted
// (disabled) on marketing routes too.
const AppIntlProvider = dynamic(() => import('@/i18n/app/AppIntlProvider').then((m) => m.AppIntlProvider))

// React 19 knows `inert` as a boolean attribute; @types/react 18 does not, so
// it goes in through a spread rather than a typed prop.
const INERT = { inert: true }

/**
 * Client-side mandatory-update gate. Sits below OtaUpdateProvider (so the
 * update screen can restart onto a staged bundle) and above every
 * API-dependent provider (so an unsupported client makes no wallet calls).
 *
 * The app tree mounts only on a live `supported` verdict, and always in the
 * same DOM position (one wrapper div, present from the first render), so a
 * later overlay never changes its ancestry — remounting the wallet providers
 * on a tab focus would throw away their state. While a resume check runs, or
 * after one fails, the tree stays mounted but inert under a cover: nothing
 * behind it can be reached until a fresh read admits it again. A known
 * `unsupported` verdict unmounts the tree and shows the required-update
 * screen; nothing dismisses that.
 */
export function ClientSupportGate({ enabled, children }: { enabled: boolean; children: React.ReactNode }) {
    // Leaving the wallet destroys its authorization state. Returning starts
    // a fresh live check before any wallet providers can mount again.
    return enabled ? <ActiveClientSupportGate>{children}</ActiveClientSupportGate> : children
}

function ActiveClientSupportGate({ children }: { children: React.ReactNode }) {
    const { status, checking, recheck } = useClientSupport()
    // Admitted once by a live verdict; a benign recheck or a failed read keeps
    // the tree, only a block drops it.
    const admitted = useRef(false)

    if (status === 'supported') admitted.current = true

    const blocked = status === 'unsupported'
    const cover = blocked
        ? 'update'
        : status === 'unavailable'
          ? 'retry'
          : status === 'checking' || checking
            ? 'loading'
            : null
    const showTree = admitted.current && !blocked

    return (
        <>
            <div aria-hidden={cover ? true : undefined} {...(cover ? INERT : {})}>
                {showTree ? children : null}
            </div>
            {cover && (
                <div className="fixed inset-0 z-[9999] flex items-center justify-center overflow-y-auto bg-background-page">
                    {cover === 'loading' ? (
                        <Loading variant="mascot" />
                    ) : (
                        <AppIntlProvider>
                            {cover === 'update' ? (
                                <RequiredUpdateScreen />
                            ) : (
                                <PolicyUnavailableScreen checking={checking} onRetry={recheck} />
                            )}
                        </AppIntlProvider>
                    )}
                </div>
            )}
        </>
    )
}
