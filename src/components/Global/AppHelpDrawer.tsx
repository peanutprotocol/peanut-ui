'use client'

import { createContext, useContext, useState, type ReactNode } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/Global/Drawer'
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
                        <DrawerHeader className="relative p-0 text-left sm:text-left">
                            <DrawerTitle className="pr-16">{document?.title}</DrawerTitle>
                            <button
                                type="button"
                                onClick={() => setActive(null)}
                                className="absolute top-0 right-0 text-body-s underline underline-offset-2 focus-visible:outline-[3px] focus-visible:outline-action-focus"
                            >
                                {tCommon('close')}
                            </button>
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
