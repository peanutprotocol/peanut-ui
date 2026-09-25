'use client'

import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'
import { useLocale } from 'next-intl'
import { captureException } from '@/utils/sentry-lazy'
import { openAppHelpPage } from './appHelpArticle'
import { toHelpLocale, type AppHelpSlug } from './appHelpTypes'
import type AppHelpDrawerComponent from './AppHelpDrawer'

const AppHelpContext = createContext<((slug: AppHelpSlug | null) => void) | null>(null)

export const useAppHelpDrawer = () => useContext(AppHelpContext)

/**
 * Lets any app screen open a help article in a drawer instead of leaving the
 * app. The drawer, vaul and the article renderer load on the first open, not
 * with the page. When the drawer or the article cannot load, the public help
 * page opens instead, so a missing article never breaks the screen.
 */
export function AppHelpProvider({ children }: { children: ReactNode }) {
    const locale = toHelpLocale(useLocale())
    const [Drawer, setDrawer] = useState<typeof AppHelpDrawerComponent | null>(null)
    // The last slug stays after close so the drawer keeps its content while it animates out.
    const [help, setHelp] = useState<{ slug: AppHelpSlug; open: boolean } | null>(null)

    const close = useCallback(() => setHelp((current) => current && { ...current, open: false }), [])

    const showHelpPage = useCallback(
        (slug: AppHelpSlug, error: unknown) => {
            captureException(error, { tags: { feature: 'app-help' }, extra: { slug, locale } })
            close()
            openAppHelpPage(slug, locale)
        },
        [close, locale]
    )

    const setActive = useCallback(
        (slug: AppHelpSlug | null) => {
            if (!slug) return close()
            setHelp({ slug, open: true })
            if (Drawer) return
            import('./AppHelpDrawer').then(
                (drawer) => setDrawer(() => drawer.default),
                (error: unknown) => showHelpPage(slug, error)
            )
        },
        [Drawer, close, showHelpPage]
    )

    return (
        <AppHelpContext.Provider value={setActive}>
            {children}
            {Drawer && help && (
                <Drawer
                    slug={help.slug}
                    locale={locale}
                    open={help.open}
                    onClose={close}
                    onUnavailable={showHelpPage}
                />
            )}
        </AppHelpContext.Provider>
    )
}
