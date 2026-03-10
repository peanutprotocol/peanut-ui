import { Suspense } from 'react'
import { type Metadata } from 'next'
import { generateMetadata as metadataHelper } from '@/app/metadata'
import { SUPPORTED_LOCALES, isValidLocale, getAlternates } from '@/i18n/config'
import { getTranslations } from '@/i18n'
import { readPageContentLocalized, listContentSlugs } from '@/lib/content'
import { notFound } from 'next/navigation'
import { ContentPage } from '@/components/Marketing/ContentPage'
import { Hero } from '@/components/Marketing/mdx/Hero'
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

/** Lightweight skeleton shown while HelpLanding JS hydrates */
function HelpLandingSkeleton() {
    return (
        <div className="mx-auto mb-8 mt-10 max-w-[640px] px-6 md:mt-12 md:px-4">
            {/* Search bar placeholder */}
            <div className="h-12 w-full animate-pulse rounded-sm border border-n-1 bg-n-2" />

            {/* Category / article rows */}
            <div className="mt-10 flex flex-col gap-10">
                {[1, 2, 3].map((i) => (
                    <div key={i}>
                        <div className="mb-4 h-3 w-32 animate-pulse rounded bg-n-2" />
                        <div className="flex flex-col gap-px overflow-hidden rounded-sm border border-n-1">
                            {[1, 2, 3].map((j) => (
                                <div key={j} className="flex flex-col gap-1.5 bg-white px-5 py-4">
                                    <div className="h-4 w-3/4 animate-pulse rounded bg-n-2" />
                                    <div className="h-3 w-1/2 animate-pulse rounded bg-n-2" />
                                </div>
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
            const content = readPageContentLocalized<HelpFrontmatter>('help', slug, locale)
            if (!content || content.frontmatter.published === false) return null
            return {
                slug,
                title: content.frontmatter.title.replace(/\s*\|\s*Peanut Help$/, ''),
                description: content.frontmatter.description,
                category: content.frontmatter.category ?? 'General',
            }
        })
        .filter(Boolean) as Array<{ slug: string; title: string; description: string; category: string }>

    // Translate category names
    const translatedArticles = articles.map((a) => ({
        ...a,
        category: i18n[CATEGORY_I18N_KEYS[a.category] ?? 'help'] ?? a.category,
    }))
    const categories = [...new Set(translatedArticles.map((a) => a.category))]

    return (
        <ContentPage
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
                    locale={locale}
                    strings={{
                        searchPlaceholder: i18n.searchHelpArticles,
                        cantFind: i18n.cantFindAnswer,
                        cantFindDesc: i18n.cantFindAnswerDesc,
                    }}
                />
            </Suspense>
        </ContentPage>
    )
}
