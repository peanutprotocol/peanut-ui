import { notFound } from 'next/navigation'
import { type Metadata } from 'next'
import Image from 'next/image'
import { generateMetadata as metadataHelper } from '@/app/metadata'
import { MarketingHero } from '@/components/Marketing/MarketingHero'
import { MarketingShell } from '@/components/Marketing/MarketingShell'
import { JsonLd } from '@/components/Marketing/JsonLd'
import { Card } from '@/components/0_Bruddle/Card'
import { Divider } from '@/components/0_Bruddle/Divider'
import { ListItem } from '@/components/0_Bruddle/ListItem'
import { Icon } from '@/components/Global/Icons/Icon'
import { getCardPosition } from '@/components/Global/Card/card.utils'
import { SUPPORTED_LOCALES, getAlternatesFor, isValidLocale } from '@/i18n/config'
import type { Locale } from '@/i18n/types'
import { getTranslations } from '@/i18n'
import {
    availableSingletonLocales,
    readSingletonContentLocalized,
    singletonLocaleFor,
    type TeamFrontmatter,
} from '@/lib/content'

// Press kit data lives in mono at content/press/{lang}.md frontmatter — singleton
// content authored by marketing/leadership, shipped via the mirror. Team member
// data comes from content/team/{lang}.md (one fact, one place); this page is the
// only surface for it since /team was removed.
//
// brand_assets/team_photos hrefs are author-supplied frontmatter that can be
// pushed straight to mono main without code review — only emit http(s) URLs
// so a `javascript:` or `data:` value can't reach a rendered href.
function safeHttpUrl(url: string | undefined): string | undefined {
    if (!url) return undefined
    try {
        const { protocol } = new URL(url, 'https://peanut.me')
        return protocol === 'https:' || protocol === 'http:' ? url : undefined
    } catch {
        return undefined
    }
}

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

    // A fallback-served page canonicalizes to the locale that owns the prose
    // (only content/press/en.md exists today) — see src/lib/content.ts.
    const contentLocale = singletonLocaleFor('press', locale)

    return {
        ...metadataHelper({
            locale: locale as Locale,
            title: `${i18n.pressTitle} | Peanut`,
            description: i18n.pressSubtitle,
            canonical: `/${contentLocale}/press`,
        }),
        alternates: {
            canonical: `/${contentLocale}/press`,
            languages: getAlternatesFor(availableSingletonLocales('press'), 'press'),
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
        member: members.map((member) => {
            const linkedin = safeHttpUrl(member.social?.linkedin)
            return {
                '@type': 'Person',
                name: member.name,
                jobTitle: member.role,
                ...(linkedin ? { sameAs: [linkedin] } : {}),
            }
        }),
    }

    return (
        <>
            <JsonLd data={orgSchema} />

            <MarketingHero title={i18n.pressTitle} subtitle={i18n.pressSubtitle} ctaText="" />

            <MarketingShell>
                <div className="flex flex-col gap-10">
                    {fm.boilerplate && (
                        <section className="flex flex-col gap-4">
                            <h2 className="text-heading-xs">{i18n.pressCompanyDescription}</h2>
                            <Card className="p-6" shadowSize="4">
                                {/* labels stay english — untranslated before this change too */}
                                {(
                                    [
                                        ['Short', fm.boilerplate.short],
                                        ['Medium', fm.boilerplate.medium],
                                        ['Press / Partner', fm.boilerplate.press],
                                    ] as const
                                )
                                    .filter(([, text]) => !!text)
                                    .map(([label, text], index) => (
                                        <div key={label}>
                                            {index > 0 && <Divider />}
                                            <h3 className="mb-2 text-label-m tracking-widest text-foreground-secondary uppercase">
                                                {label}
                                            </h3>
                                            <p className="text-body-s text-foreground-primary">{text}</p>
                                        </div>
                                    ))}
                            </Card>
                        </section>
                    )}

                    {fm.tagline && (
                        <section className="flex flex-col gap-4">
                            <h2 className="text-heading-xs">{i18n.pressTaglineHeadlines}</h2>
                            <Card className="gap-1 p-6" shadowSize="4">
                                <p className="text-heading-card text-foreground-primary">{fm.tagline}</p>
                                {fm.secondary_line && (
                                    <p className="text-body-s text-foreground-secondary">{fm.secondary_line}</p>
                                )}
                            </Card>
                            {fm.headlines && fm.headlines.length > 0 && (
                                <div className="grid gap-3 md:grid-cols-2">
                                    {fm.headlines.map((h) => (
                                        <Card key={h.text} className="gap-1 p-4" shadowSize="4">
                                            <p className="text-label-l text-foreground-primary">{h.text}</p>
                                            <p className="text-body-xs text-foreground-secondary">{h.context}</p>
                                        </Card>
                                    ))}
                                </div>
                            )}
                            {fm.one_liner && <p className="text-body-s text-foreground-secondary">{fm.one_liner}</p>}
                        </section>
                    )}

                    {fm.brand_assets && fm.brand_assets.length > 0 && (
                        <section className="flex flex-col gap-4">
                            <h2 className="text-heading-xs">{i18n.pressBrandAssets}</h2>
                            <div className="grid gap-8 md:grid-cols-2">
                                {fm.brand_assets.map((group) => {
                                    // gate the hrefs before numbering the rows — a dropped file
                                    // must not leave a gap in the top/middle/bottom rounding
                                    const files = group.files
                                        .map((file) => ({ name: file.name, href: safeHttpUrl(file.href) }))
                                        .filter((file): file is PressAssetFile => !!file.href)
                                    if (files.length === 0) return null
                                    return (
                                        <div key={group.label}>
                                            <h3 className="mb-4 text-label-m tracking-widest text-foreground-secondary uppercase">
                                                {group.label}
                                            </h3>
                                            <div className="flex flex-col">
                                                {files.map((file, index) => {
                                                    // an http href is someone else's page, not our file:
                                                    // link out to it, never offer it as a download
                                                    const isExternal = file.href.startsWith('http')
                                                    return (
                                                        <a
                                                            key={file.href}
                                                            href={file.href}
                                                            {...(isExternal
                                                                ? { target: '_blank', rel: 'noopener noreferrer' }
                                                                : { download: true })}
                                                            className="group block rounded-sm focus-visible:outline-[3px] focus-visible:outline-action-focus focus-visible:outline-solid"
                                                        >
                                                            <ListItem
                                                                position={getCardPosition(index, files.length)}
                                                                title={
                                                                    <span className="truncate group-hover:underline">
                                                                        {file.name}
                                                                    </span>
                                                                }
                                                                trailing={
                                                                    <Icon
                                                                        name={
                                                                            isExternal ? 'arrow-up-right' : 'download'
                                                                        }
                                                                        size={16}
                                                                        className="text-foreground-secondary"
                                                                    />
                                                                }
                                                                className="transition-colors duration-instant group-hover:bg-background-disabled group-active:bg-background-disabled"
                                                            />
                                                        </a>
                                                    )
                                                })}
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        </section>
                    )}

                    {members.length > 0 && (
                        <section className="flex flex-col gap-4">
                            <h2 className="text-heading-xs">{i18n.pressTeam}</h2>
                            <div className="grid gap-6 md:grid-cols-2">
                                {members.map((member) => (
                                    <Card key={member.slug} className="gap-3 p-6" shadowSize="4">
                                        <div>
                                            <h3 className="text-heading-card">{member.name}</h3>
                                            <p className="text-body-s text-foreground-secondary">{member.role}</p>
                                        </div>
                                        <p className="text-body-s text-foreground-primary">{member.bio}</p>
                                    </Card>
                                ))}
                            </div>
                            {fm.team_photos && fm.team_photos.length > 0 && (
                                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                                    {fm.team_photos.map((src, i) => {
                                        const href = safeHttpUrl(src)
                                        if (!href) return null
                                        return (
                                            <a
                                                key={href}
                                                href={href}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="relative aspect-square overflow-hidden rounded-sm border border-border-default focus-visible:outline-[3px] focus-visible:outline-action-focus focus-visible:outline-solid"
                                            >
                                                {/* photos are unlabeled in frontmatter — no member name to use */}
                                                <Image
                                                    src={href}
                                                    alt={`Peanut team photo ${i + 1}`}
                                                    fill
                                                    className="object-cover"
                                                />
                                            </a>
                                        )
                                    })}
                                </div>
                            )}
                            {fm.team_photos_note && (
                                <p className="text-body-xs text-foreground-secondary">{fm.team_photos_note}</p>
                            )}
                        </section>
                    )}

                    {fm.company_facts && fm.company_facts.length > 0 && (
                        <section className="flex flex-col gap-2">
                            <h2 className="text-heading-xs">{i18n.pressCompany}</h2>
                            {fm.company_facts.map((fact) => (
                                <p key={fact} className="text-body-s text-foreground-secondary">
                                    {fact}
                                </p>
                            ))}
                        </section>
                    )}

                    {fm.media_contact && (
                        <section className="flex flex-col gap-2">
                            <h2 className="text-heading-xs">{i18n.pressMediaContact}</h2>
                            <a
                                href={`mailto:${fm.media_contact}`}
                                className="w-fit text-body-s text-foreground-primary underline"
                            >
                                {fm.media_contact}
                            </a>
                        </section>
                    )}
                </div>
            </MarketingShell>
        </>
    )
}
