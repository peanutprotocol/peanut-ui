'use client'

import { useEffect } from 'react'
import { PageErrorScreen } from '@/components/Global/PageErrorScreen'
import { PAGE_ERROR_STRINGS } from '@/components/Global/pageErrorStrings'
import { recoverFromChunkError } from '@/utils/chunk-error-recovery'
import { useUrlLocale } from '@/i18n/useUrlLocale'
import { DEFAULT_LOCALE } from '@/i18n/types'

export default function MarketingError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
    const locale = useUrlLocale()

    useEffect(() => {
        console.error(error)
        // "Try again" re-renders against the same dead deployment under skew —
        // for chunk errors only a reload (re-pin to current deployment) works.
        recoverFromChunkError(error)
    }, [error])

    return (
        <PageErrorScreen
            strings={PAGE_ERROR_STRINGS[locale]}
            homeHref={locale === DEFAULT_LOCALE ? '/' : `/${locale}`}
            onRetry={reset}
        />
    )
}
