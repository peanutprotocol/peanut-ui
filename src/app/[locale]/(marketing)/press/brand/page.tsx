import { notFound } from 'next/navigation'
import { type Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { generateMetadata as metadataHelper } from '@/app/metadata'
import { MarketingHero } from '@/components/Marketing/MarketingHero'
import { MarketingShell } from '@/components/Marketing/MarketingShell'
import { Card } from '@/components/0_Bruddle/Card'
import { SUPPORTED_LOCALES, getAlternatesFor, isValidLocale } from '@/i18n/config'
import type { Locale } from '@/i18n/types'
import { getTranslations } from '@/i18n'
import {
    BRAND_COLORS,
    BRAND_FILE_GROUPS,
    BRAND_TYPE,
    LOGO_RULES,
    MASCOTS,
    SCREENSHOTS,
    SCREENSHOT_LOCALES,
    SCREENSHOT_SIZE,
} from '@/data/press-brand'

// Companion page to /press. /press carries the prose kit (boilerplate,
// taglines, team, company facts) from the mono content mirror; this page
// carries the design side — palette, type, usage rules and every downloadable
// file — which is code-adjacent reference data, not marketing prose.

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
            locale: locale as Locale,
            title: `${i18n.pressBrandTitle} | Peanut`,
            description: i18n.pressBrandSubtitle,
            canonical: `/${locale}/press/brand`,
        }),
        alternates: {
            canonical: `/${locale}/press/brand`,
            languages: getAlternatesFor(SUPPORTED_LOCALES, 'press', 'brand'),
        },
    }
}

export default async function PressBrandPage({ params }: PageProps) {
    const { locale } = await params
    if (!isValidLocale(locale)) notFound()

    const i18n = getTranslations(locale as Locale)

    return (
        <>
            <MarketingHero title={i18n.pressBrandTitle} subtitle={i18n.pressBrandSubtitle} ctaText="" />

            <MarketingShell>
                <div className="flex flex-col gap-10">
                    <Link href={`/${locale}/press`} className="w-fit text-sm text-n-1 underline">
                        {i18n.pressBrandBackToPress}
                    </Link>

                    {/* ---- the mark ---- */}
                    <section className="flex flex-col gap-4">
                        <h2 className="text-xl font-bold">{i18n.pressBrandTheMark}</h2>
                        <Card className="items-center gap-4 p-8">
                            <Image
                                src="/press/assets/raster/Peanut_Full_Logotype-1200.png"
                                alt="Peanut logotype"
                                width={1200}
                                height={292}
                                className="h-auto w-full max-w-sm"
                            />
                        </Card>
                        <div className="grid gap-4 md:grid-cols-2">
                            <Card className="gap-2 p-6">
                                <h3 className="text-sm font-bold text-n-1">{i18n.pressBrandDo}</h3>
                                <ul className="flex list-disc flex-col gap-1 pl-4 text-sm text-grey-1">
                                    {LOGO_RULES.do.map((rule) => (
                                        <li key={rule}>{rule}</li>
                                    ))}
                                </ul>
                            </Card>
                            <Card className="gap-2 p-6">
                                <h3 className="text-sm font-bold text-n-1">{i18n.pressBrandDont}</h3>
                                <ul className="flex list-disc flex-col gap-1 pl-4 text-sm text-grey-1">
                                    {LOGO_RULES.dont.map((rule) => (
                                        <li key={rule}>{rule}</li>
                                    ))}
                                </ul>
                            </Card>
                        </div>
                    </section>

                    {/* ---- downloads ---- */}
                    <section className="flex flex-col gap-4">
                        <h2 className="text-xl font-bold">{i18n.pressBrandDownloads}</h2>
                        <div className="grid gap-4 md:grid-cols-2">
                            {BRAND_FILE_GROUPS.map((group) => (
                                <Card key={group.label} className="gap-3 p-6">
                                    <div>
                                        <h3 className="text-sm font-bold text-n-1">{group.label}</h3>
                                        <p className="text-xs text-grey-1">{group.description}</p>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        {group.files.map((file) => (
                                            <a
                                                key={file.href}
                                                href={file.href}
                                                download
                                                className="rounded-sm border border-n-1 px-3 py-1.5 text-xs font-medium text-n-1 hover:bg-primary-3"
                                            >
                                                {file.name}
                                                <span className="ml-1.5 text-grey-1">{file.meta}</span>
                                            </a>
                                        ))}
                                    </div>
                                </Card>
                            ))}
                        </div>
                    </section>

                    {/* ---- palette ---- */}
                    <section className="flex flex-col gap-4">
                        <h2 className="text-xl font-bold">{i18n.pressBrandPalette}</h2>
                        <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
                            {BRAND_COLORS.map((color) => (
                                <Card key={color.hex} className="flex-row items-center gap-3 p-4">
                                    <span
                                        aria-hidden
                                        className="size-10 shrink-0 rounded-sm border border-n-1"
                                        style={{ backgroundColor: color.hex }}
                                    />
                                    <span className="flex flex-col">
                                        <span className="text-sm font-bold text-n-1">{color.name}</span>
                                        <span className="font-mono text-xs text-grey-1">{color.hex}</span>
                                        <span className="text-xs text-grey-1">{color.note}</span>
                                    </span>
                                </Card>
                            ))}
                        </div>
                    </section>

                    {/* ---- type ---- */}
                    <section className="flex flex-col gap-4">
                        <h2 className="text-xl font-bold">{i18n.pressBrandTypography}</h2>
                        <div className="grid gap-3 md:grid-cols-3">
                            {BRAND_TYPE.map((role) => (
                                <Card key={role.role} className="gap-1 p-6">
                                    <h3 className="text-sm font-bold text-grey-1">{role.role}</h3>
                                    <p className="text-sm font-bold text-n-1">{role.face}</p>
                                    <p className="text-xs text-grey-1">{role.note}</p>
                                </Card>
                            ))}
                        </div>
                    </section>

                    {/* ---- screenshots ---- */}
                    <section className="flex flex-col gap-4">
                        <h2 className="text-xl font-bold">{i18n.pressBrandScreenshots}</h2>
                        <p className="text-sm text-grey-1">{i18n.pressBrandScreenshotsNote}</p>
                        {SCREENSHOT_LOCALES.map((shotLocale) => (
                            <div key={shotLocale.dir} className="flex flex-col gap-2">
                                <h3 className="text-sm font-bold text-n-1">{shotLocale.label}</h3>
                                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
                                    {SCREENSHOTS.map((shot) => {
                                        const href = `/press/assets/screenshots/${shotLocale.dir}/${shot.slug}.png`
                                        return (
                                            <a
                                                key={href}
                                                href={href}
                                                download
                                                className="flex flex-col gap-1 hover:opacity-80"
                                            >
                                                <Image
                                                    src={href}
                                                    alt={`${shot.label} — ${shotLocale.label}`}
                                                    width={SCREENSHOT_SIZE.width}
                                                    height={SCREENSHOT_SIZE.height}
                                                    sizes="(max-width: 768px) 40vw, 160px"
                                                    className="h-auto w-full rounded-sm border border-n-1"
                                                />
                                                <span className="text-xs text-grey-1">{shot.label}</span>
                                            </a>
                                        )
                                    })}
                                </div>
                            </div>
                        ))}
                    </section>

                    {/* ---- mascot ---- */}
                    <section className="flex flex-col gap-4">
                        <h2 className="text-xl font-bold">{i18n.pressBrandMascot}</h2>
                        <div className="grid grid-cols-3 gap-3 sm:grid-cols-5">
                            {MASCOTS.map((mascot) => {
                                const href = `/press/assets/mascots/${mascot.slug}.webp`
                                return (
                                    <a key={href} href={href} download className="flex flex-col items-center gap-1">
                                        <Image
                                            src={href}
                                            alt={mascot.label}
                                            width={320}
                                            height={320}
                                            sizes="120px"
                                            className="h-auto w-full"
                                        />
                                        <span className="text-xs text-grey-1">{mascot.label}</span>
                                    </a>
                                )
                            })}
                        </div>
                    </section>
                </div>
            </MarketingShell>
        </>
    )
}
