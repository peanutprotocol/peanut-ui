import type { ReactNode } from 'react'
import { Breadcrumb } from '@/components/0_Bruddle/Breadcrumb'
import { JsonLd } from './JsonLd'
import { articleSchema, type ArticleMeta } from '@/lib/seo/schemas'
import { BASE_URL } from '@/constants/general.consts'
import { MarketingErrorBoundary } from './MarketingErrorBoundary'
import { getTranslations } from '@/i18n'
import { DEFAULT_LOCALE, type Locale } from '@/i18n/types'
import { PROSE_WIDTH } from './mdx/constants'

interface ContentPageProps {
    /** Compiled MDX content element */
    children: ReactNode
    /** Breadcrumb items: [{name, href}] */
    breadcrumbs: Array<{ name: string; href: string }>
    /** Article schema data for freshness signals */
    article?: ArticleMeta
    /** Page locale — used for the error-boundary fallback copy. */
    locale?: Locale
}

/**
 * Universal wrapper for MDX-rendered marketing pages.
 * Handles BreadcrumbList JSON-LD + visible breadcrumb nav.
 * The MDX body owns all layout (Hero is full-bleed, prose sections are contained).
 */
export function ContentPage({ children, breadcrumbs, article, locale = DEFAULT_LOCALE }: ContentPageProps) {
    const i18n = getTranslations(locale)
    const breadcrumbSchema = {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        inLanguage: locale,
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
            {article && <JsonLd data={articleSchema({ inLanguage: locale, ...article })} />}
            <MarketingErrorBoundary strings={{ title: i18n.errorContentUnavailable, body: i18n.errorTryRefreshing }}>
                <article className="content-page bg-background-page select-text">
                    {children}
                    {/* the trail sits at the bottom of the page: the header already
                        gives the way back, so the crumbs are a footer affordance */}
                    <Breadcrumb items={breadcrumbs} className={`mx-auto ${PROSE_WIDTH} px-6 pt-4 pb-8 md:px-4`} />
                </article>
            </MarketingErrorBoundary>
        </>
    )
}
