import { notFound } from 'next/navigation'
import { type Metadata } from 'next'
import Image from 'next/image'
import { generateMetadata as metadataHelper } from '@/app/metadata'
import { MarketingHero } from '@/components/Marketing/MarketingHero'
import { MarketingShell } from '@/components/Marketing/MarketingShell'
import { JsonLd } from '@/components/Marketing/JsonLd'
import { Card } from '@/components/0_Bruddle/Card'
import { SUPPORTED_LOCALES, getAlternates, isValidLocale } from '@/i18n/config'
import type { Locale } from '@/i18n/types'
import { getTranslations } from '@/i18n'
import { readSingletonContentLocalized } from '@/lib/content'

// Team data lives in mono at content/team/{lang}.md frontmatter — singleton
// content authored by marketing/leadership, shipped via the mirror.
interface TeamMember {
    slug: string
    name: string
    role: string
    bio: string
    image?: string
    social?: {
        linkedin?: string
        twitter?: string
        github?: string
    }
}

interface TeamFrontmatter {
    members?: TeamMember[]
}

// `members` is authored frontmatter — only emit http(s) URLs so a `javascript:`
// or `data:` value can't reach an href or a JSON-LD `sameAs`.
function safeHttpUrl(url: string | undefined): string | undefined {
    if (!url) return undefined
    try {
        const { protocol } = new URL(url)
        return protocol === 'https:' || protocol === 'http:' ? url : undefined
    } catch {
        return undefined
    }
}

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
    const team = readSingletonContentLocalized<TeamFrontmatter>('team', locale)
    const members = team?.frontmatter.members ?? []

    const orgSchema = {
        '@context': 'https://schema.org',
        '@type': 'Organization',
        name: 'Peanut',
        url: 'https://peanut.me',
        member: members.map((m) => {
            const linkedin = safeHttpUrl(m.social?.linkedin)
            return {
                '@type': 'Person',
                name: m.name,
                jobTitle: m.role,
                ...(linkedin ? { sameAs: [linkedin] } : {}),
            }
        }),
    }

    return (
        <>
            <JsonLd data={orgSchema} />

            <MarketingHero title={i18n.teamTitle} subtitle={i18n.teamSubtitle} ctaText="" />

            <MarketingShell>
                <div className="grid gap-6 md:grid-cols-2">
                    {members.map((member) => {
                        const linkedin = safeHttpUrl(member.social?.linkedin)
                        const twitter = safeHttpUrl(member.social?.twitter)
                        const github = safeHttpUrl(member.social?.github)
                        return (
                            <Card key={member.slug} className="gap-3 p-6">
                                {member.image ? (
                                    <Image
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
                                {(linkedin || twitter || github) && (
                                    <div className="flex gap-3">
                                        {linkedin && (
                                            <a
                                                href={linkedin}
                                                className="text-sm text-black underline"
                                                target="_blank"
                                                rel="noopener noreferrer"
                                            >
                                                LinkedIn
                                            </a>
                                        )}
                                        {twitter && (
                                            <a
                                                href={twitter}
                                                className="text-sm text-black underline"
                                                target="_blank"
                                                rel="noopener noreferrer"
                                            >
                                                X / Twitter
                                            </a>
                                        )}
                                        {github && (
                                            <a
                                                href={github}
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
                        )
                    })}
                </div>
            </MarketingShell>
        </>
    )
}
