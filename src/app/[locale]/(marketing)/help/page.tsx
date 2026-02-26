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
                { name: i18n.home, href: '/' },
                { name: i18n.help, href: `/${locale}/help` },
            ]}
        >
            <Hero title={i18n.helpCenter} subtitle={i18n.helpCenterDescription} />
            <Suspense>
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
