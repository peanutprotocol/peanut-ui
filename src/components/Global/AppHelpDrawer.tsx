'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/0_Bruddle/Button'
import { Drawer, DrawerClose, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/Global/Drawer'
import Loading from '@/components/Global/Loading'
import AppHelpArticleBody from './AppHelpMdx'
import { loadAppHelpArticle } from './appHelpArticle'
import type { AppHelpArticle, AppHelpSlug, HelpLocale } from './appHelpTypes'

type AppHelpDrawerProps = {
    slug: AppHelpSlug
    locale: HelpLocale
    open: boolean
    onClose: () => void
    onUnavailable: (slug: AppHelpSlug, error: unknown) => void
}

/** Loads only the requested article, from the same localized MDX as the public help page. */
export default function AppHelpDrawer({ slug, locale, open, onClose, onUnavailable }: AppHelpDrawerProps) {
    const tCommon = useTranslations('common')
    const key = `${locale}/${slug}`
    const [loaded, setLoaded] = useState<{ key: string; article: AppHelpArticle } | null>(null)
    const article = loaded?.key === key ? loaded.article : null

    // Load only while open: closing drops a pending result, so a late failure cannot
    // open the help page after the reader dismissed the drawer. Reopening retries.
    useEffect(() => {
        if (!open) return
        let current = true
        loadAppHelpArticle(slug, locale).then(
            (result) => {
                if (current) setLoaded({ key: `${locale}/${slug}`, article: result })
            },
            (error: unknown) => {
                if (current) onUnavailable(slug, error)
            }
        )
        return () => {
            current = false
        }
    }, [open, slug, locale, onUnavailable])

    return (
        <Drawer open={open} onOpenChange={(next) => !next && onClose()} hideBottomNav>
            <DrawerContent>
                <div className="sticky top-0 z-10 bg-white pb-2">
                    <DrawerHeader className="flex flex-row items-start justify-between gap-2 p-0 text-left">
                        <DrawerTitle className="text-heading-s text-foreground-primary">
                            {article?.title ?? tCommon('loading')}
                        </DrawerTitle>
                        <DrawerClose asChild>
                            <Button
                                variant="ghost"
                                shape="square"
                                size="small"
                                icon="cancel"
                                aria-label={tCommon('close')}
                                className="w-10 shrink-0"
                            />
                        </DrawerClose>
                    </DrawerHeader>
                </div>
                <article className="pb-6" aria-label={article?.title} aria-busy={!article}>
                    {article ? (
                        <AppHelpArticleBody body={article.body} />
                    ) : (
                        <div className="flex justify-center py-8">
                            <Loading className="h-6 w-6" />
                        </div>
                    )}
                </article>
            </DrawerContent>
        </Drawer>
    )
}
