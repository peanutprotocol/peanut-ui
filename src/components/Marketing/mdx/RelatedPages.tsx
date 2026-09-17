import { Children, isValidElement, type ReactNode } from 'react'
import Link from 'next/link'
import { Card } from '@/components/0_Bruddle/Card'
import { Icon } from '@/components/Global/Icons/Icon'
import { PROSE_WIDTH, CARD_HOVER } from '../constants'
import { getTranslations } from '@/i18n'
import { resolveContentHref } from '@/lib/content'
import { DEFAULT_LOCALE, type Locale } from '@/i18n/types'

interface RelatedLinkProps {
    href: string
    children: ReactNode
}

/** Individual related page link. Used as a child of <RelatedPages>. */
export function RelatedLink({ href, children }: RelatedLinkProps) {
    return <div data-href={href}>{children}</div>
}

interface RelatedPagesProps {
    title?: string
    /** Injected by createMdxComponents — never authored in MDX. */
    locale?: Locale
    children: ReactNode
}

/**
 * MDX Related Pages component. Renders a grid of internal link cards
 * at the bottom of content pages for SEO internal linking.
 *
 * Usage in MDX:
 *   <RelatedPages title="Related Guides">
 *   <RelatedLink href="/pay-with/mercadopago">Pay with Mercado Pago</RelatedLink>
 *   <RelatedLink href="/compare/wise">Peanut vs Wise</RelatedLink>
 *   </RelatedPages>
 */
export function RelatedPages({ title, children, locale = DEFAULT_LOCALE }: RelatedPagesProps) {
    const heading = title ?? getTranslations(locale).relatedPages
    const links: Array<{ href: string; text: string }> = []

    Children.forEach(children, (child) => {
        if (!isValidElement(child)) return
        if (child.type === RelatedLink || child.props?.href) {
            links.push({
                href: child.props.href,
                text:
                    typeof child.props.children === 'string'
                        ? child.props.children
                        : String(child.props.children ?? ''),
            })
        }
    })

    if (links.length === 0) return null

    return (
        <nav className={`mx-auto ${PROSE_WIDTH} px-6 py-10 md:px-4 md:py-14`}>
            <h2 className="mb-4 text-heading-xs text-foreground-primary md:text-heading-s">{heading}</h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {links.map((link) => (
                    <Link key={link.href} href={resolveContentHref(link.href, locale)} className="flex">
                        <Card shadowSize="4" className={`flex-1 flex-row items-center gap-3 p-4 ${CARD_HOVER}`}>
                            <span className="text-body-m-semibold">{link.text}</span>
                            <Icon name="chevron-right" size={20} className="ml-auto shrink-0" />
                        </Card>
                    </Link>
                ))}
            </div>
        </nav>
    )
}
