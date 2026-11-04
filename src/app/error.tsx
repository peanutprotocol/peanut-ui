'use client'

import { useEffect } from 'react'
import { PageErrorScreen } from '@/components/Global/PageErrorScreen'
import { PAGE_ERROR_STRINGS } from '@/components/Global/pageErrorStrings'
import { useUrlLocale } from '@/i18n/useUrlLocale'
import { DEFAULT_LOCALE } from '@/i18n/types'
import { isChunkLoadError, recoverFromChunkError } from '@/utils/chunk-error-recovery'
import { captureException } from '@/utils/sentry-lazy'

/**
 * Root route boundary. Without it, an error under the root layout on a route
 * with no nearer error.tsx (/, /es-ar, /es-419, /pt-br, the star LPs, /lp,
 * /request-links, the app routes) fell through to global-error, which swaps
 * the whole document for Next's bare error page. It replaces everything below
 * app/layout.tsx, (mobile-ui)/layout.tsx included; the root providers stay
 * mounted. Nearer boundaries ([locale]/(marketing), [...recipient]) still
 * win; global-error still handles root layout failures.
 */
export default function RootError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
    // The localized homepages are literal root routes, so the locale comes
    // from the first path segment, as in the marketing boundary.
    const locale = useUrlLocale()

    useEffect(() => {
        console.error(error)
        // These errors used to reach global-error, which reports them; keep that.
        if (process.env.NODE_ENV !== 'development') captureException(error)
        // "Try again" re-renders against the same dead deployment under skew —
        // for chunk errors only a reload (re-pin to current deployment) works.
        recoverFromChunkError(error)
    }, [error])

    // reset() re-renders against the chunk that already failed, so it cannot
    // recover a chunk error. For any chunk error "Try again" hard-reloads:
    // it covers the case where the 60 s guard held back the automatic reload,
    // and installed PWAs, where the automatic reload is skipped by design.
    // A tap cannot loop.
    const retry = isChunkLoadError(error) ? () => window.location.reload() : reset

    return (
        <PageErrorScreen
            strings={PAGE_ERROR_STRINGS[locale]}
            homeHref={locale === DEFAULT_LOCALE ? '/' : `/${locale}`}
            onRetry={retry}
        />
    )
}
