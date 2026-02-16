import { PAYMENT_METHODS, getCountryName } from '@/data/seo'
import { getTranslations, t, localizedPath, localizedBarePath } from '@/i18n'
import type { Locale } from '@/i18n/types'
import { MarketingHero } from '@/components/Marketing/MarketingHero'
import { MarketingShell } from '@/components/Marketing/MarketingShell'
import { Section } from '@/components/Marketing/Section'
import { Steps } from '@/components/Marketing/Steps'
import { FAQSection } from '@/components/Marketing/FAQSection'
import { JsonLd } from '@/components/Marketing/JsonLd'
import { RelatedPages } from '@/components/Marketing/RelatedPages'

interface PayWithContentProps {
    method: string
    locale: Locale
}

export function PayWithContent({ method, locale }: PayWithContentProps) {
    const pm = PAYMENT_METHODS[method]
    if (!pm) return null

    const i18n = getTranslations(locale)

    const steps = pm.steps.map((step, i) => ({
        title: `${i + 1}`,
        description: step,
    }))

    const baseUrl = 'https://peanut.me'

    const howToSchema = {
        '@context': 'https://schema.org',
        '@type': 'HowTo',
        name: t(i18n.payWith, { method: pm.name }),
        description: pm.description,
        inLanguage: locale,
        step: steps.map((step, i) => ({
            '@type': 'HowToStep',
            position: i + 1,
            name: step.title,
            text: step.description,
        })),
    }

    const breadcrumbSchema = {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
            { '@type': 'ListItem', position: 1, name: i18n.home, item: baseUrl },
            {
                '@type': 'ListItem',
                position: 2,
                name: t(i18n.payWith, { method: pm.name }),
                item: `${baseUrl}/${locale}/pay-with/${method}`,
            },
        ],
    }

    // Related pages: hub pages for countries where this method is available
    const relatedPages = pm.countries.map((countrySlug) => ({
        title: t(i18n.hubTitle, { country: getCountryName(countrySlug, locale) }),
        href: localizedBarePath(locale, countrySlug),
    }))

    // Add send-money-to pages for related countries
    for (const countrySlug of pm.countries.slice(0, 3)) {
        relatedPages.push({
            title: t(i18n.sendMoneyTo, { country: getCountryName(countrySlug, locale) }),
            href: localizedPath('send-money-to', locale, countrySlug),
        })
    }

    const today = new Date().toISOString().split('T')[0]

    return (
        <>
            <JsonLd data={howToSchema} />
            <JsonLd data={breadcrumbSchema} />

            <MarketingHero
                title={t(i18n.payWith, { method: pm.name })}
                subtitle={t(i18n.payWithDesc, { method: pm.name })}
            />

            <MarketingShell>
                {/* Description */}
                <Section title={pm.name}>
                    <p className="text-gray-700">{pm.description}</p>
                </Section>

                {/* Steps */}
                <Section title={i18n.howItWorks}>
                    <Steps steps={steps} />
                </Section>

                {/* FAQs */}
                {pm.faqs.length > 0 && <FAQSection faqs={pm.faqs} title={i18n.frequentlyAskedQuestions} />}

                {/* Related pages */}
                <RelatedPages pages={relatedPages} title={i18n.relatedPages} />

                {/* Last updated */}
                <p className="py-4 text-xs text-gray-400">
                    {t(i18n.lastUpdated, { date: today })}
                </p>
            </MarketingShell>
        </>
    )
}
