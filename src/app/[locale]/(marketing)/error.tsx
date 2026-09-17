'use client'

import { useEffect } from 'react'
import { Button } from '@/components/0_Bruddle/Button'
import { TitleBlock } from '@/components/0_Bruddle/TitleBlock'
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
        // same container as MarketingErrorBoundary, the other marketing error
        // surface — one shape for "this page did not load".
        <div className="mx-auto max-w-2xl px-6 py-16">
            <TitleBlock align="center" size="s" title={i18n.title} description={i18n.body} />
            <div className="mt-6 flex flex-wrap justify-center gap-3">
                <Button variant="purple" onClick={reset}>
                    {i18n.tryAgain}
                </Button>
                <Button variant="stroke" href={locale === DEFAULT_LOCALE ? '/' : `/${locale}`}>
                    {i18n.goHome}
                </Button>
            </div>
        </div>
    )
}
