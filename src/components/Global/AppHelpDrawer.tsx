'use client'

import { createContext, useContext, useState, type ReactNode } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { Button } from '@/components/0_Bruddle/Button'
import { Drawer, DrawerClose, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/Global/Drawer'
import type { AppHelpDocuments, AppHelpSlug, HelpLocale } from './appHelpTypes'

const AppHelpContext = createContext<((slug: AppHelpSlug | null) => void) | null>(null)

export const useAppHelpDrawer = () => useContext(AppHelpContext)

/** Help articles are compiled from the same localized MDX as the public site. */
export function AppHelpProvider({ children, documents }: { children: ReactNode; documents: AppHelpDocuments }) {
    const [active, setActive] = useState<AppHelpSlug | null>(null)
    const locale = useLocale().toLowerCase()
    const helpLocale: HelpLocale = locale === 'es-419' || locale === 'es-ar' || locale === 'pt-br' ? locale : 'en'
    const tCommon = useTranslations('common')
    const document = active ? documents[active][helpLocale] : null

    return (
        <AppHelpContext.Provider value={setActive}>
            {children}
            <Drawer open={active !== null} onOpenChange={(open) => !open && setActive(null)} hideBottomNav>
                <DrawerContent>
                    <div className="sticky top-0 z-10 bg-white pb-2">
                        <DrawerHeader className="flex flex-row items-start justify-between gap-2 p-0 text-left">
                            <DrawerTitle className="text-heading-s text-foreground-primary">
                                {document?.title}
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
                    <article className="pb-6" aria-label={document?.title}>
                        {document?.content}
                    </article>
                </DrawerContent>
            </Drawer>
        </AppHelpContext.Provider>
    )
}
