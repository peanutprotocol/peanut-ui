'use client'

import Image from 'next/image'
import { Card } from '@/components/0_Bruddle/Card'
import { BadgeImage } from '@/components/Badges/BadgeImage'
import PeanutMascot from '@/components/Global/PeanutMascot'
import { CodeBlock } from '../../_components/CodeBlock'
import { DesignNote } from '../../_components/DesignNote'
import { DocHeader } from '../../_components/DocHeader'
import { DocPage } from '../../_components/DocPage'
import { DocSection } from '../../_components/DocSection'
import { COLOR_TOKENS } from '../../foundations/tokens.generated'
import {
    AVATAR_BADGE_ENTRIES,
    AVATAR_BASIC_ENTRIES,
    AVATAR_LETTER_ENTRIES,
    BADGE_ENTRIES,
    DOODLE_ENTRIES,
    EASTER_EGG_ENTRIES,
    EASTER_EGG_RULE,
    GLOVE_ENTRIES,
    HERO_ART_ENTRIES,
    LANDING_ILLUSTRATION_ENTRIES,
    LOGO_ENTRIES,
    MASCOT_ENTRIES,
    MASCOT_STILL_ENTRIES,
    TIER_BADGE_ENTRIES,
    type ArtEntry,
    type PublicArtEntry,
} from './assets-data'

const tokenValue = (name: string) => COLOR_TOKENS.find((t) => t.name === name)?.value ?? '—'

function ArtGrid({ entries }: { entries: ArtEntry[] }) {
    return (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {entries.map((entry) => (
                <Card key={entry.label} className="flex h-full flex-col gap-2 p-3">
                    <div className="flex h-16 items-center justify-center rounded-sm bg-background-page p-2">
                        <Image src={entry.asset} alt="" className="h-10 w-auto" />
                    </div>
                    <p className="font-mono text-label-m">{entry.label}</p>
                    <p className="font-mono text-body-xs break-all text-foreground-secondary">{entry.path}</p>
                    <p className="text-body-xs text-foreground-secondary">{entry.usedIn}</p>
                </Card>
            ))}
        </div>
    )
}

function PublicArtGrid({ entries, tile = 'h-10' }: { entries: PublicArtEntry[]; tile?: string }) {
    return (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {entries.map((entry) => (
                <Card key={entry.label} className="flex h-full flex-col gap-2 p-3">
                    <div className="flex h-16 items-center justify-center rounded-sm bg-background-page p-2">
                        <Image
                            src={entry.src}
                            alt=""
                            width={176}
                            height={176}
                            unoptimized
                            className={`${tile} w-auto`}
                        />
                    </div>
                    <p className="font-mono text-label-m">{entry.label}</p>
                    <p className="font-mono text-body-xs break-all text-foreground-secondary">{entry.src}</p>
                    <p className="text-body-xs text-foreground-secondary">{entry.usedIn}</p>
                </Card>
            ))}
        </div>
    )
}

/** Many small tiles, no per-tile caption; hover a tile for its label. */
function ContactSheet({ entries, size }: { entries: PublicArtEntry[]; size: 'h-6 w-6' | 'h-10 w-10' | 'h-12 w-12' }) {
    return (
        <div className="flex flex-wrap gap-2">
            {entries.map((entry) => (
                <span key={entry.label} className={`inline-flex ${size}`} title={entry.label}>
                    <Image
                        src={entry.src}
                        alt=""
                        width={176}
                        height={176}
                        unoptimized
                        className="size-full object-contain"
                    />
                </span>
            ))}
        </div>
    )
}

export default function MarketingAssetsPage() {
    return (
        <DocPage>
            <DocHeader
                title="Assets"
                description="The art you may put on a marketing surface: mascot, doodles, gloves, logo set, easter eggs, avatars, badges. Not on this page = not approved."
            />

            <DesignNote type="warning">
                Need something new? Send Konrad the asset plus a screenshot of the whole screen it will sit on. Once
                approved, add it here, then use it.
            </DesignNote>

            <DocSection
                title="Mascot"
                description={`10 poses. Body ${tokenValue('action-secondary')}, sneakers and accents ${tokenValue('action-primary')}.`}
            >
                <DocSection.Content>
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                        {MASCOT_ENTRIES.map((entry) => (
                            <Card key={entry.pose} className="flex h-full flex-col items-center gap-2 p-3 text-center">
                                <div className="flex h-32 items-end justify-center">
                                    <PeanutMascot pose={entry.pose} className="h-32" />
                                </div>
                                <p className="font-mono text-label-m">{entry.pose}</p>
                                <p className="text-body-xs text-foreground-secondary">{entry.usedFor}</p>
                            </Card>
                        ))}
                    </div>
                    <p className="text-body-s text-foreground-secondary">
                        Source files: mono/assets/mascot/lottie. Recolour there, never the export.
                    </p>
                    <p className="text-label-m">Stills — the two approved rasters</p>
                    <ArtGrid entries={MASCOT_STILL_ENTRIES} />
                </DocSection.Content>
                <DocSection.Code>
                    <CodeBlock
                        label="mascot"
                        code={`import PeanutMascot from '@/components/Global/PeanutMascot'\n\n<PeanutMascot pose="waving-chill" className="h-32" />`}
                    />
                </DocSection.Code>
            </DocSection>

            <DocSection
                title="Hero artwork"
                description="The key visual is a Title lockup rendered to an image. Home and /lp only."
            >
                <ArtGrid entries={HERO_ART_ENTRIES} />
            </DocSection>

            <DocSection title="Doodles" description="Yellow with a black outline, or plain black.">
                <DocSection.Content>
                    <ArtGrid entries={DOODLE_ENTRIES} />
                    <p className="text-label-m">Landing illustrations — multicolour, landing folds only</p>
                    <ArtGrid entries={LANDING_ILLUSTRATION_ENTRIES} />
                </DocSection.Content>
                <DocSection.Code>
                    <CodeBlock
                        label="doodle"
                        code={`import Sparkle from '@/assets/illustrations/sparkle.svg'\n\n<Image src={Sparkle} alt="" className="h-10 w-auto" />`}
                    />
                </DocSection.Code>
            </DocSection>

            <DocSection title="Gloves" description="Flat white with a black outline. No shading.">
                <ArtGrid entries={GLOVE_ENTRIES} />
            </DocSection>

            <DocSection
                title="Logo set"
                description="Icon mark, wordmark (black, tint in CSS) and lockup. Masters in src/assets/brand; the press kit serves copies under its public names."
            >
                <DocSection.Content>
                    <ArtGrid entries={LOGO_ENTRIES} />
                </DocSection.Content>
                <DocSection.Code>
                    <CodeBlock
                        label="logo"
                        code={`import { WORDMARK } from '@/assets/brand'\n\n<Image src={WORDMARK} alt="Peanut" className="h-3 w-auto" />`}
                    />
                </DocSection.Code>
            </DocSection>

            <DocSection title="Easter eggs" description="Hidden. Eight no-banking territories in EasterEggDrawer.">
                <DesignNote type="info">{EASTER_EGG_RULE}</DesignNote>
                <PublicArtGrid entries={EASTER_EGG_ENTRIES} tile="h-16" />
            </DocSection>

            <DocSection
                title="Avatars"
                description="Sticker avatars. Basics and badge-unlocked poses mirror the API manifest badge-assets.json; the a–z letters come from avatar.utils. Nothing is listed twice by hand."
            >
                <DocSection.Content>
                    <p className="text-label-m">Sticker set — {AVATAR_BASIC_ENTRIES.length}, every user</p>
                    <ContactSheet entries={AVATAR_BASIC_ENTRIES} size="h-12 w-12" />
                    <p className="font-mono text-body-xs text-foreground-secondary">
                        public/avatars/basic/&lt;slug&gt;.webp
                    </p>

                    <p className="text-label-m">Letter stickers — a–z, the day-0 initial</p>
                    <ContactSheet entries={AVATAR_LETTER_ENTRIES} size="h-6 w-6" />
                    <p className="font-mono text-body-xs text-foreground-secondary">
                        public/avatars/letter/&lt;a-z&gt;.webp
                    </p>

                    <p className="text-label-m">
                        Badge-unlocked poses — {AVATAR_BADGE_ENTRIES.length} badges,{' '}
                        {AVATAR_BADGE_ENTRIES.reduce((n, entry) => n + entry.slugs.length, 0)} files
                    </p>
                    <ul className="space-y-1">
                        {AVATAR_BADGE_ENTRIES.map(({ code, slugs, sample }) => (
                            <li key={code} className="flex items-center gap-2 text-body-xs">
                                <Image
                                    src={sample}
                                    alt=""
                                    width={176}
                                    height={176}
                                    unoptimized
                                    className="h-8 w-8 object-contain"
                                />
                                <span className="font-mono">{code}</span>
                                <span className="text-foreground-secondary">{slugs.join(', ')}</span>
                            </li>
                        ))}
                    </ul>
                    <p className="font-mono text-body-xs text-foreground-secondary">
                        public/avatars/badge/&lt;CODE&gt;/&lt;slug&gt;.webp
                    </p>
                </DocSection.Content>
                <DocSection.Code>
                    <CodeBlock
                        label="avatar"
                        code={`import { UserAvatar } from '@/components/Avatar/UserAvatar'\n\n<UserAvatar name={user.username} avatarKey={user.avatarKey} size="m" />`}
                    />
                </DocSection.Code>
            </DocSection>

            <DocSection
                title="Badges"
                description={`The production set: ${BADGE_ENTRIES.reduce((n, entry) => n + entry.codes.length, 0)} codes, ${BADGE_ENTRIES.length} files, from src/types/badge-assets.json (generated by the API's badge:check). Rendered through BadgeImage, which falls back to the icon mark.`}
            >
                <DocSection.Content>
                    <div className="flex flex-wrap gap-2">
                        {BADGE_ENTRIES.map((badge) => (
                            <span key={badge.src} className="inline-flex h-12 w-12" title={badge.codes.join(', ')}>
                                <BadgeImage
                                    src={badge.src}
                                    alt=""
                                    width={96}
                                    height={96}
                                    className="size-full object-contain"
                                />
                            </span>
                        ))}
                    </div>
                    <p className="font-mono text-body-xs text-foreground-secondary">
                        public/badges/&lt;file&gt; — hover a tile for its code(s)
                    </p>
                    <p className="text-label-m">Points tiers</p>
                    <ArtGrid entries={TIER_BADGE_ENTRIES} />
                </DocSection.Content>
                <DocSection.Code>
                    <CodeBlock
                        label="badge"
                        code={`import { BadgeImage } from '@/components/Badges/BadgeImage'\nimport { getBadgeIcon } from '@/components/Badges/badge.utils'\n\n<BadgeImage src={getBadgeIcon(badge.code, badge.iconUrl)} alt={badge.name} width={48} height={48} />`}
                    />
                </DocSection.Code>
            </DocSection>
        </DocPage>
    )
}
