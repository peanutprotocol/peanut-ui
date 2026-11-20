'use client'

import Image from 'next/image'
import { Card } from '@/components/0_Bruddle/Card'
import { BadgeImage } from '@/components/Badges/BadgeImage'
import { Icon } from '@/components/Global/Icons/Icon'
import PeanutMascot from '@/components/Global/PeanutMascot'
import { AVATAR_SIZE_CLASSES, type AvatarSize } from '@/components/Profile/avatar-size.consts'
import OnboardingAnimation from '@/components/Setup/redesign/shell/OnboardingAnimation'
import { CodeBlock } from '../../_components/CodeBlock'
import { DesignNote } from '../../_components/DesignNote'
import { DocHeader } from '../../_components/DocHeader'
import { DocPage } from '../../_components/DocPage'
import { DocSection } from '../../_components/DocSection'
import { COLOR_TOKENS } from '../../foundations/tokens.generated'
import {
    APP_ICON_ENTRIES,
    APP_ICON_RULE,
    AVATAR_BADGE_ENTRIES,
    AVATAR_BADGE_RULE,
    AVATAR_BASIC_ENTRIES,
    AVATAR_LETTER_ENTRIES,
    AVATAR_SIZE_RULE,
    BADGE_ENTRIES,
    BADGE_VARIANT_ENTRIES,
    COIN_ENTRIES,
    COIN_RULE,
    DOODLE_ENTRIES,
    EASTER_EGG_ENTRIES,
    EASTER_EGG_RULE,
    GLOVE_ENTRIES,
    HERO_ART_ENTRIES,
    INVITE_HEART_ENTRY,
    LANDING_ILLUSTRATION_ENTRIES,
    LOGO_ENTRIES,
    MASCOT_ENTRIES,
    MASCOT_STILL_ENTRIES,
    OG_DOODLE_ENTRIES,
    OG_DOODLE_RULE,
    PRESS_STILL_ENTRIES,
    RESIDENCE_STICKER_ENTRIES,
    RESIDENCE_STICKER_RULE,
    TIER_BADGE_ENTRIES,
    type ArtEntry,
    type PublicArtEntry,
} from './assets-data'

const tokenValue = (name: string) => COLOR_TOKENS.find((t) => t.name === name)?.value ?? '—'

function ArtGrid({ entries, children }: { entries: ArtEntry[]; children?: React.ReactNode }) {
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
            {children}
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
                            width={288}
                            height={288}
                            unoptimized
                            className={`${tile} w-auto`}
                        />
                    </div>
                    <p className="font-mono text-label-m break-all">{entry.label}</p>
                    <p className="font-mono text-body-xs break-all text-foreground-secondary">{entry.src}</p>
                    <p className="text-body-xs text-foreground-secondary">{entry.usedIn}</p>
                </Card>
            ))}
        </div>
    )
}

/** Many small tiles at an avatar size, no per-tile caption; hover a tile for its label. */
function ContactSheet({ entries, size }: { entries: PublicArtEntry[]; size: AvatarSize }) {
    return (
        <div className="flex flex-wrap gap-2">
            {entries.map((entry) => (
                <span key={entry.label} className={`inline-flex ${AVATAR_SIZE_CLASSES[size]}`} title={entry.label}>
                    <Image
                        src={entry.src}
                        alt=""
                        width={288}
                        height={288}
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
                description="The art you may put on a marketing surface: mascot, coin characters, doodles, gloves, logo set, link-preview doodles, app icons, easter eggs, avatars, badges. Not on this page = not approved."
            />

            <DesignNote type="warning">
                Need something new? Send Konrad the asset plus a screenshot of the whole screen it will sit on. Once
                approved, add it here, then use it.
            </DesignNote>

            <DocSection
                title="Mascot"
                description={`10 poses. Body ${tokenValue('background-accent-yellow')}, sneakers and accents ${tokenValue('action-primary')}.`}
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
                    <p className="text-label-m">Press kit stills — one render per pose, press downloads only</p>
                    <PublicArtGrid entries={PRESS_STILL_ENTRIES} tile="h-12" />
                </DocSection.Content>
                <DocSection.Code>
                    <CodeBlock
                        label="mascot"
                        code={`import PeanutMascot from '@/components/Global/PeanutMascot'\n\n<PeanutMascot pose="waving-chill" className="h-32" />`}
                    />
                </DocSection.Code>
            </DocSection>

            <DocSection title="Coin characters" description="The $ and € coin faces of sign-up.">
                <DesignNote type="info">{COIN_RULE}</DesignNote>
                <ArtGrid entries={COIN_ENTRIES} />
                <p className="text-label-m">Accounts loop — the source of the moving coins</p>
                <Card className="flex w-fit flex-col gap-2 p-3">
                    <div className="flex h-48 items-center justify-center overflow-hidden rounded-sm bg-background-page">
                        <div className="h-40">
                            <OnboardingAnimation name="accounts" />
                        </div>
                    </div>
                    <p className="font-mono text-label-m">accounts</p>
                    <p className="font-mono text-body-xs break-all text-foreground-secondary">
                        assets/onboarding/accounts.json
                    </p>
                    <p className="text-body-xs text-foreground-secondary">
                        Sign-up Accounts step, desktop side panel; CoinCharacter cuts its coins from it
                    </p>
                </Card>
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

            <DocSection
                title="Link-preview doodles"
                description="The scribble loop and arrows on the cards shown when a Peanut link is pasted in a chat."
            >
                <DesignNote type="warning">{OG_DOODLE_RULE}</DesignNote>
                <PublicArtGrid entries={OG_DOODLE_ENTRIES} />
            </DocSection>

            <DocSection title="App icons" description="Picture icons with one job each: points, regions, invites.">
                <DesignNote type="info">{APP_ICON_RULE}</DesignNote>
                <ArtGrid entries={APP_ICON_ENTRIES}>
                    <Card className="flex h-full flex-col gap-2 p-3">
                        <div className="flex h-16 items-center justify-center rounded-sm bg-background-page p-2">
                            <Icon name="invite-heart" size={40} />
                        </div>
                        <p className="font-mono text-label-m">{INVITE_HEART_ENTRY.label}</p>
                        <p className="font-mono text-body-xs break-all text-foreground-secondary">
                            {INVITE_HEART_ENTRY.path}
                        </p>
                        <p className="text-body-xs text-foreground-secondary">{INVITE_HEART_ENTRY.usedIn}</p>
                    </Card>
                </ArtGrid>
            </DocSection>

            <DocSection title="Easter eggs" description="Hidden. Eight no-banking territories in EasterEggDrawer.">
                <DesignNote type="info">{EASTER_EGG_RULE}</DesignNote>
                <PublicArtGrid entries={EASTER_EGG_ENTRIES} tile="h-16" />
            </DocSection>

            <DocSection
                title="Residence stickers"
                description="Three per country, 20 countries. Slapped around the mascot on the sign-up Residence step."
            >
                <DesignNote type="info">{RESIDENCE_STICKER_RULE}</DesignNote>
                <PublicArtGrid entries={RESIDENCE_STICKER_ENTRIES} tile="h-16" />
            </DocSection>

            <DocSection
                title="Avatars"
                description="Sticker avatars. Basics and badge avatars mirror the API manifest badge-assets.json; the a–z letters come from avatar.utils. Nothing is listed twice by hand. Each set is shown at the two avatar sizes."
            >
                <DocSection.Content>
                    <DesignNote type="info">{AVATAR_SIZE_RULE}</DesignNote>

                    <p className="text-label-m">Sticker set — {AVATAR_BASIC_ENTRIES.length}, every user</p>
                    <ContactSheet entries={AVATAR_BASIC_ENTRIES} size="s" />
                    <ContactSheet entries={AVATAR_BASIC_ENTRIES} size="xl" />
                    <p className="font-mono text-body-xs text-foreground-secondary">
                        public/avatars/basic/&lt;slug&gt;.webp
                    </p>

                    <p className="text-label-m">Letter stickers — a–z, the day-0 initial</p>
                    <ContactSheet entries={AVATAR_LETTER_ENTRIES} size="s" />
                    <ContactSheet entries={AVATAR_LETTER_ENTRIES} size="xl" />
                    <p className="font-mono text-body-xs text-foreground-secondary">
                        public/avatars/letter/&lt;a-z&gt;.webp
                    </p>

                    <p className="text-label-m">Badge avatars — {AVATAR_BADGE_ENTRIES.length}, one per badge</p>
                    <DesignNote type="info">{AVATAR_BADGE_RULE}</DesignNote>
                    <ContactSheet entries={AVATAR_BADGE_ENTRIES} size="s" />
                    <ContactSheet entries={AVATAR_BADGE_ENTRIES} size="xl" />
                    <PublicArtGrid entries={AVATAR_BADGE_ENTRIES} tile="h-8" />
                    <p className="font-mono text-body-xs text-foreground-secondary">
                        public/avatars/badge/&lt;CODE&gt;/&lt;slug&gt;.webp
                    </p>
                </DocSection.Content>
                <DocSection.Code>
                    <CodeBlock
                        label="avatar"
                        code={`import { UserAvatar } from '@/components/Avatar/UserAvatar'\nimport { personFrom } from '@/lib/person/person'\n\n// lists, rows and cards: 32 px (the default)\n<UserAvatar person={personFrom(user)} size="s" />\n\n// profiles and the payment details header: 96 px\n<UserAvatar person={personFrom(user)} size="xl" />`}
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
                    <p className="text-label-m">Badge variants — one named use each</p>
                    <ArtGrid entries={BADGE_VARIANT_ENTRIES} />
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
