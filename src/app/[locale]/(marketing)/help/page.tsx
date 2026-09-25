import { Suspense } from 'react'
import { type Metadata } from 'next'
import { generateMetadata as metadataHelper } from '@/app/metadata'
import { SUPPORTED_LOCALES, isValidLocale, getAlternates } from '@/i18n/config'
import { getTranslations } from '@/i18n'
import { readPageContentLocalizedResolved, listContentSlugs, helpArticleTitle } from '@/lib/content'
import { notFound } from 'next/navigation'
import { ContentPage } from '@/components/Marketing/ContentPage'
import { Hero } from '@/components/Marketing/mdx/Hero'
import { PROSE_WIDTH } from '@/components/Marketing/constants'
import { ListItem } from '@/components/0_Bruddle/ListItem'
import { Icon } from '@/components/Global/Icons/Icon'
import { getCardPosition } from '@/components/Global/Card/card.utils'
import HelpLanding from '@/components/Marketing/HelpLanding'

interface PageProps {
    params: Promise<{ locale: string }>
}

interface HelpFrontmatter {
    title: string
    description: string
    slug: string
    category?: string
    published?: boolean
}

/** Map frontmatter category keys → i18n translation keys */
const CATEGORY_I18N_KEYS: Record<string, keyof import('@/i18n/types').Translations> = {
    'Getting Started': 'categoryGettingStarted',
    'Account & Security': 'categoryAccountSecurity',
    Payments: 'categoryPayments',
    'Deposits & Withdrawals': 'categoryDepositsWithdrawals',
    'Sending & Receiving': 'categorySendingReceiving',
    Troubleshooting: 'categoryTroubleshooting',
}

export async function generateStaticParams() {
    return SUPPORTED_LOCALES.map((locale) => ({ locale }))
}
export const dynamicParams = false

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
    const { locale } = await params
    if (!isValidLocale(locale)) return {}

    const i18n = getTranslations(locale)

    return {
        ...metadataHelper({
            locale,
            title: `${i18n.helpCenter} | Peanut`,
            description: i18n.helpCenterDescription,
            canonical: `/${locale}/help`,
        }),
        alternates: {
            canonical: `/${locale}/help`,
            languages: getAlternates('help'),
        },
    }
}

const SKELETON_ROWS = 3

/** Lightweight skeleton shown while HelpLanding JS hydrates. Real ListItem rows
 *  with placeholder spans in the slots, so the swap to the loaded list does not
 *  jump (design.md skeleton recipe). */
function HelpLandingSkeleton() {
    return (
        <div className={`mx-auto mt-10 mb-8 ${PROSE_WIDTH} px-6 md:mt-12 md:px-4`}>
            {/* Search bar placeholder — h-10 is SearchInput's height */}
            <div className="h-10 w-full animate-pulse rounded-sm border border-border-default bg-foreground-primary/10" />

            {/* Category / article rows */}
            <div className="mt-10 flex flex-col gap-10">
                {[1, 2, 3].map((i) => (
                    <div key={i}>
                        <div className="mb-4 h-3 w-32 animate-pulse rounded bg-foreground-primary/10" />
                        <div className="flex flex-col">
                            {Array.from({ length: SKELETON_ROWS }).map((_, j) => (
                                <ListItem
                                    key={j}
                                    position={getCardPosition(j, SKELETON_ROWS)}
                                    title={<div className="h-4 w-48 animate-pulse rounded bg-foreground-primary/10" />}
                                    body={<div className="h-3 w-32 animate-pulse rounded bg-foreground-primary/10" />}
                                    trailing={
                                        <Icon name="arrow-up-right" size={20} className="text-foreground-secondary" />
                                    }
                                />
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    )
}

export default async function HelpPage({ params }: PageProps) {
    const { locale } = await params
    if (!isValidLocale(locale)) notFound()

    const i18n = getTranslations(locale)
    const slugs = listContentSlugs('help')
    const articles = slugs
        .map((slug) => {
            const resolved = readPageContentLocalizedResolved<HelpFrontmatter>('help', slug, locale)
            if (!resolved || resolved.content.frontmatter.published === false) return null
            const { content, lang } = resolved
            return {
                slug,
                // The serving locale owns the prose, so link it directly.
                href: `/${lang}/help/${encodeURIComponent(slug)}`,
                title: helpArticleTitle(content.frontmatter.title),
                description: content.frontmatter.description,
                category: content.frontmatter.category ?? 'General',
            }
        })
        .filter(Boolean) as Array<{ slug: string; href: string; title: string; description: string; category: string }>

    // Translate category names
    const translatedArticles = articles.map((a) => ({
        ...a,
        category: i18n[CATEGORY_I18N_KEYS[a.category] ?? 'help'] ?? a.category,
    }))
    const categories = [...new Set(translatedArticles.map((a) => a.category))]

    return (
        <ContentPage
            locale={locale}
            breadcrumbs={[
                { name: i18n.home, href: `/${locale}` },
                { name: i18n.help, href: `/${locale}/help` },
            ]}
        >
            <Hero title={i18n.helpCenter} subtitle={i18n.helpCenterDescription} />
            <Suspense fallback={<HelpLandingSkeleton />}>
                <HelpLanding
                    articles={translatedArticles}
                    categories={categories}
                    strings={{
                        searchPlaceholder: i18n.searchHelpArticles,
                        clearSearch: i18n.clearSearch,
                        // both hubs say the same sentence, so one key serves
                        // both rather than a second copy to keep translated.
                        noResults: i18n.noContentResults,
                        cantFind: i18n.cantFindAnswer,
                        cantFindDesc: i18n.cantFindAnswerDesc,
                    }}
                />
            </Suspense>
        </ContentPage>
    )
}
