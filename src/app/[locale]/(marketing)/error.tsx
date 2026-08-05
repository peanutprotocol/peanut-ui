'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { recoverFromChunkError } from '@/utils/chunk-error-recovery'
import { useUrlLocale } from '@/i18n/useUrlLocale'
import { DEFAULT_LOCALE, type Locale } from '@/i18n/types'

// Inlined rather than read from the catalogs: this is a client component, and
// importing '@/i18n' would ship every locale's full catalog with each marketing
// route's client chunk for four fallback strings. Keep in sync with the
// error* keys in src/i18n/{locale}.json.
const STRINGS: Record<Locale, { title: string; body: string; tryAgain: string; goHome: string }> = {
    en: {
        title: 'Something went wrong',
        body: 'We had trouble loading this page. Please try again or go back to the homepage.',
        tryAgain: 'Try again',
        goHome: 'Go home',
    },
    'es-419': {
        title: 'Algo salió mal',
        body: 'Tuvimos problemas para cargar esta página. Inténtalo de nuevo o vuelve al inicio.',
        tryAgain: 'Intentar de nuevo',
        goHome: 'Ir al inicio',
    },
    'es-ar': {
        title: 'Algo salió mal',
        body: 'Tuvimos problemas para cargar esta página. Probá de nuevo o volvé al inicio.',
        tryAgain: 'Intentar de nuevo',
        goHome: 'Ir al inicio',
    },
    'pt-br': {
        title: 'Algo deu errado',
        body: 'Tivemos um problema para carregar esta página. Tente novamente ou volte para a página inicial.',
        tryAgain: 'Tentar novamente',
        goHome: 'Ir para o início',
    },
}

export default function MarketingError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
    const locale = useUrlLocale()
    const i18n = STRINGS[locale]

    useEffect(() => {
        console.error(error)
        // "Try again" re-renders against the same dead deployment under skew —
        // for chunk errors only a reload (re-pin to current deployment) works.
        recoverFromChunkError(error)
    }, [error])

    return (
        <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
            <h1 className="text-2xl font-bold">{i18n.title}</h1>
            <p className="mt-2 max-w-md text-gray-600">{i18n.body}</p>
            <div className="mt-6 flex gap-3">
                <button
                    onClick={reset}
                    className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
                >
                    {i18n.tryAgain}
                </button>
                <Link
                    href={locale === DEFAULT_LOCALE ? '/' : `/${locale}`}
                    className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium hover:bg-gray-50"
                >
                    {i18n.goHome}
                </Link>
            </div>
        </div>
    )
}
