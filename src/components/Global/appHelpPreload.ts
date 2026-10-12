import { APP_LEGAL_SLUGS, type HelpLocale } from './appHelpTypes'

const ABOUT_ARTICLES = [...APP_LEGAL_SLUGS, 'security-disclosure'] as const

type Connection = { saveData?: boolean; effectiveType?: string }

function canPreload() {
    const connection = (navigator as Navigator & { connection?: Connection }).connection
    return (
        document.visibilityState === 'visible' &&
        navigator.onLine !== false &&
        !connection?.saveData &&
        connection?.effectiveType !== 'slow-2g' &&
        connection?.effectiveType !== '2g'
    )
}

/** Menu-only warmup: defer until after paint, then do one low-priority job per idle period. */
export function scheduleAboutHelpPreload(locale: HelpLocale): () => void {
    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | undefined
    let idle: number | undefined
    let next = 0
    const tasks = [
        () => import('./AppHelpDrawer').then(() => undefined),
        ...ABOUT_ARTICLES.map((slug) => async () => {
            const { loadAppHelpArticle } = await import('./appHelpArticle')
            if (!cancelled && canPreload()) await loadAppHelpArticle(slug, locale, 'low')
        }),
    ]

    const schedule = () => {
        if (cancelled || next >= tasks.length || !canPreload()) return
        const run = () => {
            if (cancelled || !canPreload()) return
            // A speculative failure must never open a page or show an error.
            void tasks[next++]()
                .catch(() => undefined)
                .finally(schedule)
        }
        if (typeof window.requestIdleCallback === 'function') idle = window.requestIdleCallback(run)
        else timer = setTimeout(run, 1500)
    }

    // Let the menu's own render, transitions and requests take priority.
    timer = setTimeout(schedule, 1000)
    return () => {
        cancelled = true
        clearTimeout(timer)
        if (idle !== undefined) window.cancelIdleCallback(idle)
        // An in-flight article may finish into the shared cache; no further jobs start.
    }
}
