'use client'

import { useEffect } from 'react'
import { PageErrorScreen } from '@/components/Global/PageErrorScreen'
import { recoverFromChunkError } from '@/utils/chunk-error-recovery'
import { captureException } from '@/utils/sentry-lazy'

// English only: the routes that reach this boundary are the root landing page,
// the English star LPs and the app. Localized marketing has its own boundary
// in [locale]/(marketing)/error.tsx. Same copy as that file's `en` strings.
const STRINGS = {
    title: 'Something went wrong',
    body: 'We had trouble loading this page. Please try again or go back to the homepage.',
    tryAgain: 'Try again',
    goHome: 'Go home',
}

/**
 * Root route boundary. Without it, an error under the root layout on a route
 * with no nearer error.tsx (/, the star LPs, /lp, /request-links, the app
 * routes) fell through to global-error, which swaps the whole document for
 * Next's bare error page. Nearer boundaries ([locale]/(marketing),
 * [...recipient]) still win; global-error still handles root layout failures.
 */
export default function RootError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
    useEffect(() => {
        console.error(error)
        // These errors used to reach global-error, which reports them; keep that.
        if (process.env.NODE_ENV !== 'development') captureException(error)
        // "Try again" re-renders against the same dead deployment under skew —
        // for chunk errors only a reload (re-pin to current deployment) works.
        recoverFromChunkError(error)
    }, [error])

    return <PageErrorScreen strings={STRINGS} homeHref="/" onRetry={reset} />
}
