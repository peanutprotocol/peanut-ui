import type { ReactNode } from 'react'
import Link from 'next/link'
import { JsonLd } from './JsonLd'
import { articleSchema, type ArticleMeta } from '@/lib/seo/schemas'
import { BASE_URL } from '@/constants/general.consts'
import { MarketingErrorBoundary } from './MarketingErrorBoundary'

interface ContentPageProps {
    /** Compiled MDX content element */
    children: ReactNode
    /** Breadcrumb items: [{name, href}] */
    breadcrumbs: Array<{ name: string; href: string }>
    /** Article schema data for freshness signals */
    article?: ArticleMeta
}

/**
 * Universal wrapper for MDX-rendered marketing pages.
 * Handles BreadcrumbList JSON-LD + visible breadcrumb nav.
 * The MDX body owns all layout (Hero is full-bleed, prose sections are contained).
 */
export function ContentPage({ children, breadcrumbs, article }: ContentPageProps) {
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
            {article && <JsonLd data={articleSchema(article)} />}
            <MarketingErrorBoundary>
                <article className="content-page select-text bg-background">
                    {children}
                    <nav aria-label="Breadcrumb" className="mx-auto max-w-[640px] px-6 pb-8 pt-4 md:px-4">
                        <ol className="flex flex-wrap items-center gap-1 text-xs text-grey-1">
                            {breadcrumbs.map((crumb, i) => (
                                <li key={crumb.href} className="flex items-center gap-1">
                                    {i > 0 && <span aria-hidden>/</span>}
                                    {i < breadcrumbs.length - 1 ? (
                                        <Link
                                            href={crumb.href}
                                            className="underline decoration-n-1/30 underline-offset-2 hover:text-n-1"
                                        >
                                            {crumb.name}
                                        </Link>
                                    ) : (
                                        <span className="font-medium text-n-1">{crumb.name}</span>
                                    )}
                                </li>
                            ))}
                        </ol>
                    </nav>
                </article>
            </MarketingErrorBoundary>
        </>
    )
}
