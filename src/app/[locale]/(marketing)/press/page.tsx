import { notFound } from 'next/navigation'
import { type Metadata } from 'next'
import { generateMetadata as metadataHelper } from '@/app/metadata'
import { MarketingHero } from '@/components/Marketing/MarketingHero'
import { MarketingShell } from '@/components/Marketing/MarketingShell'
import { JsonLd } from '@/components/Marketing/JsonLd'
import { Card } from '@/components/0_Bruddle/Card'
import { SUPPORTED_LOCALES, getAlternates, isValidLocale } from '@/i18n/config'
import type { Locale } from '@/i18n/types'
import { getTranslations } from '@/i18n'
import { readSingletonContentLocalized } from '@/lib/content'

// Press kit data lives in mono at content/press/{lang}.md frontmatter — singleton
// content authored by marketing/leadership, shipped via the mirror. Team member
// data is reused as-is from content/team/{lang}.md (one fact, one place).
interface PressAssetFile {
    name: string
    href: string
}

interface PressAssetGroup {
    label: string
    files: PressAssetFile[]
}

interface PressHeadline {
    text: string
    context: string
}

interface PressFrontmatter {
    boilerplate?: {
        short?: string
        medium?: string
        press?: string
    }
    tagline?: string
    secondary_line?: string
    one_liner?: string
    headlines?: PressHeadline[]
    company_facts?: string[]
    brand_assets?: PressAssetGroup[]
    team_photos_note?: string
    team_photos?: string[]
    media_contact?: string
}

interface TeamMember {
    slug: string
    name: string
    role: string
    bio: string
}

interface TeamFrontmatter {
    members?: TeamMember[]
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
            title: `${i18n.pressTitle} | Peanut`,
            description: i18n.pressSubtitle,
            canonical: `/${locale}/press`,
        }),
        alternates: {
            canonical: `/${locale}/press`,
            languages: getAlternates('press'),
        },
    }
}

export default async function PressPage({ params }: PageProps) {
    const { locale } = await params
    if (!isValidLocale(locale)) notFound()

    const i18n = getTranslations(locale as Locale)
    const press = readSingletonContentLocalized<PressFrontmatter>('press', locale)
    const fm = press?.frontmatter ?? {}
    const team = readSingletonContentLocalized<TeamFrontmatter>('team', locale)
    const members = team?.frontmatter.members ?? []

    const orgSchema = {
        '@context': 'https://schema.org',
        '@type': 'Organization',
        name: 'Peanut',
        url: 'https://peanut.me',
        description: fm.boilerplate?.press,
    }

    return (
        <>
            <JsonLd data={orgSchema} />

            <MarketingHero title={i18n.pressTitle} subtitle={i18n.pressSubtitle} ctaText="" />

            <MarketingShell>
                <div className="flex flex-col gap-10">
                    {fm.boilerplate && (
                        <section className="flex flex-col gap-4">
                            <h2 className="text-xl font-bold">Company description</h2>
                            <div className="grid gap-4 md:grid-cols-3">
                                {fm.boilerplate.short && (
                                    <Card className="gap-2 p-6">
                                        <h3 className="text-sm font-bold text-grey-1">Short</h3>
                                        <p className="text-sm text-n-1">{fm.boilerplate.short}</p>
                                    </Card>
                                )}
                                {fm.boilerplate.medium && (
                                    <Card className="gap-2 p-6">
                                        <h3 className="text-sm font-bold text-grey-1">Medium</h3>
                                        <p className="text-sm text-n-1">{fm.boilerplate.medium}</p>
                                    </Card>
                                )}
                                {fm.boilerplate.press && (
                                    <Card className="gap-2 p-6">
                                        <h3 className="text-sm font-bold text-grey-1">Press / Partner</h3>
                                        <p className="text-sm text-n-1">{fm.boilerplate.press}</p>
                                    </Card>
                                )}
                            </div>
                        </section>
                    )}

                    {fm.tagline && (
                        <section className="flex flex-col gap-4">
                            <h2 className="text-xl font-bold">Tagline &amp; headlines</h2>
                            <Card className="gap-1 p-6">
                                <p className="text-lg font-bold text-n-1">{fm.tagline}</p>
                                {fm.secondary_line && <p className="text-sm text-grey-1">{fm.secondary_line}</p>}
                            </Card>
                            {fm.headlines && fm.headlines.length > 0 && (
                                <div className="grid gap-3 md:grid-cols-2">
                                    {fm.headlines.map((h) => (
                                        <Card key={h.text} className="gap-1 p-4">
                                            <p className="text-sm font-bold text-n-1">{h.text}</p>
                                            <p className="text-xs text-grey-1">{h.context}</p>
                                        </Card>
                                    ))}
                                </div>
                            )}
                            {fm.one_liner && <p className="text-sm text-grey-1">{fm.one_liner}</p>}
                        </section>
                    )}

                    {fm.brand_assets && fm.brand_assets.length > 0 && (
                        <section className="flex flex-col gap-4">
                            <h2 className="text-xl font-bold">Brand assets</h2>
                            <div className="grid gap-4 md:grid-cols-2">
                                {fm.brand_assets.map((group) => (
                                    <Card key={group.label} className="gap-3 p-6">
                                        <h3 className="text-sm font-bold text-n-1">{group.label}</h3>
                                        <div className="flex flex-wrap gap-2">
                                            {group.files.map((file) => (
                                                <a
                                                    key={file.href}
                                                    href={file.href}
                                                    target={file.href.startsWith('http') ? '_blank' : undefined}
                                                    rel={
                                                        file.href.startsWith('http') ? 'noopener noreferrer' : undefined
                                                    }
                                                    className="rounded-sm border border-n-1 px-3 py-1.5 text-xs font-medium text-n-1 hover:bg-primary-3"
                                                >
                                                    {file.name}
                                                </a>
                                            ))}
                                        </div>
                                    </Card>
                                ))}
                            </div>
                        </section>
                    )}

                    {members.length > 0 && (
                        <section className="flex flex-col gap-4">
                            <h2 className="text-xl font-bold">Team</h2>
                            <div className="grid gap-6 md:grid-cols-2">
                                {members.map((member) => (
                                    <Card key={member.slug} className="gap-3 p-6">
                                        <div>
                                            <h3 className="text-lg font-bold">{member.name}</h3>
                                            <p className="text-sm font-medium text-grey-1">{member.role}</p>
                                        </div>
                                        <p className="text-sm text-n-1">{member.bio}</p>
                                    </Card>
                                ))}
                            </div>
                            {fm.team_photos && fm.team_photos.length > 0 && (
                                <div className="grid grid-cols-4 gap-2">
                                    {fm.team_photos.map((src) => (
                                        <a key={src} href={src} target="_blank" rel="noopener noreferrer">
                                            <img
                                                src={src}
                                                alt="Peanut team"
                                                className="aspect-square rounded-sm border border-n-1 object-cover hover:opacity-80"
                                            />
                                        </a>
                                    ))}
                                </div>
                            )}
                            {fm.team_photos_note && <p className="text-xs text-grey-1">{fm.team_photos_note}</p>}
                        </section>
                    )}

                    {fm.company_facts && fm.company_facts.length > 0 && (
                        <section className="flex flex-col gap-2">
                            <h2 className="text-xl font-bold">Company</h2>
                            {fm.company_facts.map((fact) => (
                                <p key={fact} className="text-sm text-grey-1">
                                    {fact}
                                </p>
                            ))}
                        </section>
                    )}

                    {fm.media_contact && (
                        <section className="flex flex-col gap-2">
                            <h2 className="text-xl font-bold">Media contact</h2>
                            <a href={`mailto:${fm.media_contact}`} className="w-fit text-sm text-black underline">
                                {fm.media_contact}
                            </a>
                        </section>
                    )}
                </div>
            </MarketingShell>
        </>
    )
}
