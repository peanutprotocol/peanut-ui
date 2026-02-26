import { Children, isValidElement, type ReactNode } from 'react'
import Link from 'next/link'
import { Card } from '@/components/0_Bruddle/Card'
import { PROSE_WIDTH, CARD_HOVER } from './constants'

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
export function RelatedPages({ title = 'Related Pages', children }: RelatedPagesProps) {
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
            <h2 className="mb-5 text-xl font-bold text-n-1 md:text-2xl">{title}</h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {links.map((link, i) => (
                    <Link
                        key={link.href}
                        href={link.href}
                        className={
                            links.length % 2 !== 0 && i === links.length - 1
                                ? 'sm:col-span-2'
                                : ''
                        }
                    >
                        <Card shadowSize="4" className={`flex-row items-center gap-3 p-4 ${CARD_HOVER}`}>
                            <span className="font-semibold">{link.text}</span>
                            <span className="ml-auto text-sm text-black/50">&rarr;</span>
                        </Card>
                    </Link>
                ))}
            </div>
        </nav>
    )
}
