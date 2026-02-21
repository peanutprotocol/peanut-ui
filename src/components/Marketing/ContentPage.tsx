import type { ReactNode } from 'react'
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
 * Handles BreadcrumbList JSON-LD only — the MDX body owns all layout
 * (Hero is full-bleed, prose sections are contained, Steps/FAQ break out).
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
            <article className="content-page select-text bg-background">{children}</article>
        </>
    )
}
