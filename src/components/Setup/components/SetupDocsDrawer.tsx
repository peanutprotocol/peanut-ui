'use client'

import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/Global/Drawer'
import DocsLink from '@/components/Global/DocsLink'
import { createContext, useContext, useState, type ReactNode } from 'react'
import { useLocale, useTranslations } from 'next-intl'

export type SetupDocKind = 'terms' | 'privacy' | 'account-recovery' | 'passkeys'
type SetupDoc = { title: string; content: ReactNode }
type HelpLocale = 'en' | 'es-419' | 'es-ar' | 'pt-br'

export interface SetupDocuments {
    terms: SetupDoc
    privacy: SetupDoc
    'account-recovery': Record<HelpLocale, SetupDoc>
    passkeys: Record<HelpLocale, SetupDoc>
}

const SetupDocsContext = createContext<((kind: SetupDocKind) => void) | null>(null)

const helpLocale = (locale: string): HelpLocale => {
    const normalized = locale.toLowerCase()
    return normalized === 'es-ar' || normalized === 'es-419' || normalized === 'pt-br' ? normalized : 'en'
}

/** The content is compiled from the public MDX source at build time, so the
 * native static export can open it without leaving setup or needing a network. */
export function SetupDocsProvider({ children, documents }: { children: ReactNode; documents: SetupDocuments }) {
    const [active, setActive] = useState<SetupDocKind | null>(null)
    const locale = helpLocale(useLocale())
    const tCommon = useTranslations('common')
    const document = active
        ? active === 'terms' || active === 'privacy'
            ? documents[active]
            : documents[active][locale]
        : null

    return (
        <SetupDocsContext.Provider value={setActive}>
            {children}
            <Drawer open={active !== null} onOpenChange={(open) => !open && setActive(null)}>
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
        </SetupDocsContext.Provider>
    )
}

export function SetupDocLink({
    kind,
    href,
    className,
    children,
    onBeforeOpen,
}: {
    kind: SetupDocKind
    href: string
    className?: string
    children: ReactNode
    onBeforeOpen?: () => void
}) {
    const open = useContext(SetupDocsContext)
    // Isolated component previews can render setup steps without their route
    // layout. Keep the link working there rather than show an inert button.
    if (!open)
        return (
            <DocsLink href={href} className={className}>
                {children}
            </DocsLink>
        )

    return (
        <button
            type="button"
            className={className}
            onClick={() => {
                onBeforeOpen?.()
                open(kind)
            }}
        >
            {children}
        </button>
    )
}
