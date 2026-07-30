'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { recoverFromChunkError } from '@/utils/chunk-error-recovery'
import { getTranslations } from '@/i18n'
import { useUrlLocale } from '@/i18n/useUrlLocale'

export default function MarketingError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
    const i18n = getTranslations(useUrlLocale())

    useEffect(() => {
        console.error(error)
        // "Try again" re-renders against the same dead deployment under skew —
        // for chunk errors only a reload (re-pin to current deployment) works.
        recoverFromChunkError(error)
    }, [error])

    return (
        <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
            <h1 className="text-2xl font-bold">{i18n.errorSomethingWentWrong}</h1>
            <p className="mt-2 max-w-md text-gray-600">{i18n.errorPageLoadBody}</p>
            <div className="mt-6 flex gap-3">
                <button
                    onClick={reset}
                    className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
                >
                    {i18n.errorTryAgain}
                </button>
                <Link
                    href="/"
                    className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium hover:bg-gray-50"
                >
                    {i18n.errorGoHome}
                </Link>
            </div>
        </div>
    )
}
