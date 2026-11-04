import type { Locale } from '@/i18n/types'
import type { PageErrorScreenStrings } from '@/components/Global/pageErrorScreen.types'

// Inlined rather than read from the catalogs: the error boundaries are client
// components, and importing '@/i18n' would ship every locale's full catalog
// with each route's client chunk for four fallback strings. Keep in sync with
// the error* keys in src/i18n/{locale}.json.
export const PAGE_ERROR_STRINGS: Record<Locale, PageErrorScreenStrings> = {
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
