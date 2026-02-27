import { notFound } from 'next/navigation'
import { type Metadata } from 'next'
import { generateMetadata as metadataHelper } from '@/app/metadata'
import { TEAM_MEMBERS } from '@/data/team'
import { MarketingHero } from '@/components/Marketing/MarketingHero'
import { MarketingShell } from '@/components/Marketing/MarketingShell'
import { JsonLd } from '@/components/Marketing/JsonLd'
import { Card } from '@/components/0_Bruddle/Card'
import { SUPPORTED_LOCALES, getAlternates, isValidLocale } from '@/i18n/config'
import type { Locale } from '@/i18n/types'
import { getTranslations } from '@/i18n'

interface PageProps {
    params: Promise<{ locale: string }>
}

export async function generateStaticParams() {
    if (process.env.NODE_ENV === 'production') return []
    return SUPPORTED_LOCALES.map((locale) => ({ locale }))
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
    const { locale } = await params
    if (!isValidLocale(locale)) return {}

    const i18n = getTranslations(locale as Locale)

    return {
        ...metadataHelper({
            title: `${i18n.teamTitle} | Peanut`,
            description: i18n.teamSubtitle,
            canonical: `/${locale}/team`,
        }),
        alternates: {
            canonical: `/${locale}/team`,
            languages: getAlternates('team'),
        },
    }
}

export default async function TeamPage({ params }: PageProps) {
    const { locale } = await params
    if (!isValidLocale(locale)) notFound()

    const i18n = getTranslations(locale as Locale)

    const orgSchema = {
        '@context': 'https://schema.org',
        '@type': 'Organization',
        name: 'Peanut',
        url: 'https://peanut.me',
        member: TEAM_MEMBERS.map((m) => ({
            '@type': 'Person',
            name: m.name,
            jobTitle: m.role,
            ...(m.social?.linkedin ? { sameAs: [m.social.linkedin] } : {}),
        })),
    }

    return (
        <>
            <JsonLd data={orgSchema} />

            <MarketingHero title={i18n.teamTitle} subtitle={i18n.teamSubtitle} ctaText="" />

            <MarketingShell>
                <div className="grid gap-6 md:grid-cols-2">
                    {TEAM_MEMBERS.map((member) => (
                        <Card key={member.slug} className="gap-3 p-6">
                            {member.image ? (
                                <img
                                    src={member.image}
                                    alt={member.name}
                                    width={80}
                                    height={80}
                                    className="rounded-full border border-n-1"
                                />
                            ) : (
                                <div className="flex size-20 items-center justify-center rounded-full bg-primary-1/30 text-2xl font-bold">
                                    {member.name.charAt(0)}
                                </div>
                            )}
                            <div>
                                <h2 className="text-lg font-bold">{member.name}</h2>
                                <p className="text-sm font-medium text-gray-500">{member.role}</p>
                            </div>
                            <p className="text-sm text-gray-700">{member.bio}</p>
                            {member.social && (
                                <div className="flex gap-3">
                                    {member.social.linkedin && (
                                        <a
                                            href={member.social.linkedin}
                                            className="text-sm text-black underline"
                                            target="_blank"
                                            rel="noopener noreferrer"
                                        >
                                            LinkedIn
                                        </a>
                                    )}
                                    {member.social.twitter && (
                                        <a
                                            href={member.social.twitter}
                                            className="text-sm text-black underline"
                                            target="_blank"
                                            rel="noopener noreferrer"
                                        >
                                            X / Twitter
                                        </a>
                                    )}
                                    {member.social.github && (
                                        <a
                                            href={member.social.github}
                                            className="text-sm text-black underline"
                                            target="_blank"
                                            rel="noopener noreferrer"
                                        >
                                            GitHub
                                        </a>
                                    )}
                                </div>
                            )}
                        </Card>
                    ))}
                </div>
            </MarketingShell>
        </>
    )
}
