import { notFound } from 'next/navigation'
import { type Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { generateMetadata as metadataHelper } from '@/app/metadata'
import { MarketingHero } from '@/components/Marketing/MarketingHero'
import { MarketingShell } from '@/components/Marketing/MarketingShell'
import { JsonLd } from '@/components/Marketing/JsonLd'
import { PressAssetGroupCard } from '@/components/Marketing/PressAssetGroupCard'
import { downloadLinkProps, safeHttpUrl, type PressAssetGroup } from '@/components/Marketing/pressAssets'
import { Card } from '@/components/0_Bruddle/Card'
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
// pushed straight to mono main without code review — safeHttpUrl (in
// pressAssets.ts, shared with the asset cards) is what keeps them safe.

const JUMP_PILL =
    'inline-flex min-h-11 items-center rounded-sm border border-n-1 px-3 text-xs font-medium text-n-1 hover:bg-primary-3'

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

    const brandAssets = Array.isArray(fm.brand_assets) ? fm.brand_assets : []
    const teamPhotos = (fm.team_photos ?? []).map(safeHttpUrl).filter((href): href is string => Boolean(href))
    // fm.tagline and fm.headlines[0].text are the same string in content today.
    const otherHeadlines = (Array.isArray(fm.headlines) ? fm.headlines : []).filter(
        (headline) => headline.text !== fm.tagline
    )

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
                    {(brandAssets.length > 0 || fm.media_contact) && (
                        <nav aria-label={i18n.pressTitle} className="-mt-2 flex flex-wrap gap-2">
                            {brandAssets.length > 0 && (
                                <a href="#assets" className={JUMP_PILL}>
                                    {i18n.pressBrandAssets}
                                </a>
                            )}
                            {fm.media_contact && (
                                <a href="#contact" className={JUMP_PILL}>
                                    {i18n.pressMediaContact}
                                </a>
                            )}
                        </nav>
                    )}

                    {fm.boilerplate && (
                        <section className="flex flex-col gap-4">
                            <h2 className="text-h4">{i18n.pressCompanyDescription}</h2>
                            <div className="grid items-start gap-4 md:grid-cols-3">
                                {fm.boilerplate.short && (
                                    <Card className="gap-2 p-6">
                                        <h3 className="text-sm font-bold text-grey-1">{i18n.pressBoilerplateShort}</h3>
                                        <p className="text-sm text-n-1">{fm.boilerplate.short}</p>
                                    </Card>
                                )}
                                {fm.boilerplate.medium && (
                                    <Card className="gap-2 p-6">
                                        <h3 className="text-sm font-bold text-grey-1">{i18n.pressBoilerplateMedium}</h3>
                                        <p className="text-sm text-n-1">{fm.boilerplate.medium}</p>
                                    </Card>
                                )}
                                {fm.boilerplate.press && (
                                    <Card className="gap-2 p-6">
                                        <h3 className="text-sm font-bold text-grey-1">{i18n.pressBoilerplatePress}</h3>
                                        <p className="text-sm text-n-1">{fm.boilerplate.press}</p>
                                    </Card>
                                )}
                            </div>
                        </section>
                    )}

                    {brandAssets.length > 0 && (
                        <section id="assets" className="flex scroll-mt-20 flex-col gap-4">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                                <h2 className="text-h4">{i18n.pressBrandAssets}</h2>
                                <Link
                                    href={`/${locale}/press/brand`}
                                    className="btn-shadow-primary-4 w-fit rounded-sm border border-n-1 bg-secondary-1 px-4 py-2 text-sm font-bold text-n-1 hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none"
                                >
                                    {i18n.pressBrandLink}
                                </Link>
                            </div>
                            <p className="text-sm text-grey-1">{i18n.pressBrandAssetsNote}</p>
                            <div className="grid items-start gap-4 md:grid-cols-2">
                                {brandAssets.map((group) => (
                                    <PressAssetGroupCard key={group.label} group={group} />
                                ))}
                            </div>
                        </section>
                    )}

                    {fm.tagline && (
                        <section className="flex flex-col gap-4">
                            <h2 className="text-h4">{i18n.pressTaglineHeadlines}</h2>
                            <Card className="gap-1 p-6">
                                <p className="text-lg font-bold text-n-1">{fm.tagline}</p>
                                {fm.secondary_line && <p className="text-sm text-grey-1">{fm.secondary_line}</p>}
                                {fm.one_liner && (
                                    <>
                                        <p className="mt-3 text-xs font-bold uppercase text-grey-1">
                                            {i18n.pressOneLiner}
                                        </p>
                                        <p className="text-sm text-n-1">{fm.one_liner}</p>
                                    </>
                                )}
                            </Card>
                            {otherHeadlines.length > 0 && (
                                <div className="grid items-start gap-3 md:grid-cols-2">
                                    {otherHeadlines.map((headline) => (
                                        <Card key={headline.text} className="gap-1 p-4">
                                            <p className="text-sm font-bold text-n-1">{headline.text}</p>
                                            <p className="text-xs text-grey-1">{headline.context}</p>
                                        </Card>
                                    ))}
                                </div>
                            )}
                        </section>
                    )}

                    {members.length > 0 && (
                        <section className="flex flex-col gap-4">
                            <h2 className="text-h4">{i18n.pressTeam}</h2>
                            <div className="grid items-start gap-6 md:grid-cols-2">
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
                            {fm.team_photos_note && <p className="text-xs text-grey-1">{fm.team_photos_note}</p>}
                            {teamPhotos.length > 0 && (
                                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                                    {teamPhotos.map((href, index) => (
                                        <a
                                            key={href}
                                            href={href}
                                            {...downloadLinkProps(href)}
                                            className="relative aspect-square overflow-hidden rounded-sm border border-n-1 hover:opacity-80"
                                        >
                                            <Image
                                                src={href}
                                                alt={`${i18n.pressTeamPhotoAlt} ${index + 1}`}
                                                fill
                                                sizes="(max-width: 640px) 50vw, 172px"
                                                className="object-cover"
                                            />
                                        </a>
                                    ))}
                                </div>
                            )}
                        </section>
                    )}

                    <div className="grid items-start gap-6 md:grid-cols-2">
                        {fm.company_facts && fm.company_facts.length > 0 && (
                            <section className="flex flex-col gap-2">
                                <h2 className="text-h4">{i18n.pressCompany}</h2>
                                {fm.company_facts.map((fact, index) => (
                                    <p key={index} className="text-sm text-grey-1">
                                        {fact}
                                    </p>
                                ))}
                            </section>
                        )}

                        {fm.media_contact && (
                            <section id="contact" className="scroll-mt-20">
                                <Card shadowSize="4" className="gap-2 bg-primary-1 p-6 dark:bg-primary-1">
                                    <h2 className="text-h4">{i18n.pressMediaContact}</h2>
                                    <a
                                        href={`mailto:${fm.media_contact}`}
                                        className="inline-flex min-h-11 w-fit items-center text-lg font-bold text-n-1 underline"
                                    >
                                        {fm.media_contact}
                                    </a>
                                </Card>
                            </section>
                        )}
                    </div>
                </div>
            </MarketingShell>
        </>
    )
}
