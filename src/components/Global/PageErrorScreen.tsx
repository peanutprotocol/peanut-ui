'use client'

import { Button } from '@/components/0_Bruddle/Button'
import { TitleBlock } from '@/components/0_Bruddle/TitleBlock'
import type { PageErrorScreenStrings } from '@/components/Global/pageErrorScreen.types'

/**
 * "This page did not load" fallback shared by the route-level error.tsx
 * boundaries (root and marketing). Presentational only: the boundary owns
 * reporting, chunk recovery and the copy. Provider-free on purpose: a boundary
 * may render where the failing subtree took its providers down with it.
 */
export function PageErrorScreen({
    strings,
    homeHref,
    onRetry,
}: {
    strings: PageErrorScreenStrings
    homeHref: string
    onRetry: () => void
}) {
    return (
        // same container as MarketingErrorBoundary, the other marketing error
        // surface — one shape for "this page did not load".
        <div className="mx-auto max-w-2xl px-6 py-16">
            <TitleBlock align="center" size="s" title={strings.title} description={strings.body} />
            <div className="mt-6 flex flex-wrap justify-center gap-3">
                <Button variant="primary" onClick={onRetry} className="w-fit">
                    {strings.tryAgain}
                </Button>
                <Button variant="secondary" href={homeHref} className="w-fit">
                    {strings.goHome}
                </Button>
            </div>
        </div>
    )
}
