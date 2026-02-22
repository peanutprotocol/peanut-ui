import type { ReactNode } from 'react'
import Link from 'next/link'
import { JsonLd } from './JsonLd'
import { BASE_URL } from '@/constants/general.consts'

interface ContentPageProps {
    /** Compiled MDX content element */
    children: ReactNode
    /** Breadcrumb items: [{name, href}] */
    breadcrumbs: Array<{ name: string; href: string }>
}

/**
 * Universal wrapper for MDX-rendered marketing pages.
 * Handles BreadcrumbList JSON-LD + visible breadcrumb nav.
 * The MDX body owns all layout (Hero is full-bleed, prose sections are contained).
 */
export function ContentPage({ children, breadcrumbs }: ContentPageProps) {
    const breadcrumbSchema = {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: breadcrumbs.map((crumb, i) => ({
            '@type': 'ListItem',
            position: i + 1,
            name: crumb.name,
            item: crumb.href.startsWith('http') ? crumb.href : `${BASE_URL}${crumb.href}`,
        })),
    }

    return (
        <>
            <JsonLd data={breadcrumbSchema} />
            <nav aria-label="Breadcrumb" className="mx-auto max-w-[640px] px-6 pt-4 pb-2 md:px-4">
                <ol className="flex flex-wrap items-center gap-1 text-xs text-grey-1">
                    {breadcrumbs.map((crumb, i) => (
                        <li key={crumb.href} className="flex items-center gap-1">
                            {i > 0 && <span aria-hidden>/</span>}
                            {i < breadcrumbs.length - 1 ? (
                                <Link href={crumb.href} className="underline decoration-n-1/30 underline-offset-2 hover:text-n-1">
                                    {crumb.name}
                                </Link>
                            ) : (
                                <span className="text-n-1 font-medium">{crumb.name}</span>
                            )}
                        </li>
                    ))}
                </ol>
            </nav>
            <article className="content-page select-text bg-background">{children}</article>
        </>
    )
}
