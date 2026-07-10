'use client'

import { type ReactNode } from 'react'
import Image from 'next/image'
import NavHeader from '@/components/Global/NavHeader'
import { Card } from '@/components/0_Bruddle/Card'
import { Icon } from '@/components/Global/Icons/Icon'
import ProfileMenuItem from '@/components/Profile/components/ProfileMenuItem'
import STAR_STRAIGHT_ICON from '@/assets/icons/starStraight.svg'

/**
 * /dev/profile-card-row — 1:1 preview of the profile "first group" (card row +
 * Badges + Points) in both card states, using the REAL ProfileMenuItem the
 * profile screen renders. This is the exact JSX from Profile/index.tsx with
 * `hasCardAccess` pinned to each value, so what you see here is what ships.
 *
 * The card row logic (Profile/index.tsx):
 *   label = hasCardAccess ? 'Your Card'  : 'Peanut Card'
 *   href  = hasCardAccess ? '/card'      : '/shhhhh'
 *   badge = hasCardAccess ? undefined    : 'New!'
 *
 * `hasCardAccess` is `undefined` while useCardInfo loads → falls into the
 * non-holder branch (safe default), so the loading view == non-holder view.
 *
 * The rows are real <Link>s — clicking navigates for real (that's deliberate,
 * you can verify the routing end-to-end from here).
 */

// The exact first-group as rendered in Profile/index.tsx, parameterised on the
// one variable that changes: whether the user holds a card.
function ProfileFirstGroup({ hasCardAccess }: { hasCardAccess: boolean }) {
    return (
        <div>
            <ProfileMenuItem
                icon="credit-card"
                label={hasCardAccess ? 'Your Card' : 'Peanut Card'}
                href={hasCardAccess ? '/card' : '/shhhhh'}
                badge={hasCardAccess ? undefined : 'New!'}
                position="first"
            />
            <ProfileMenuItem icon="achievements" label="Your Badges" href="/badges" position="middle" />
            <ProfileMenuItem
                icon={<Image src={STAR_STRAIGHT_ICON} alt="star" width={20} height={20} />}
                label="Points"
                href="/rewards"
                position="last"
            />
        </div>
    )
}

function SectionLabel({ children }: { children: ReactNode }) {
    return <p className="text-xs font-bold uppercase tracking-wide text-grey-1">{children}</p>
}

export default function ProfileCardRowPreviewPage() {
    return (
        <div className="flex min-h-[inherit] flex-col gap-6 pb-8">
            <div className="px-4 pt-4">
                <NavHeader title="Profile card row" />
            </div>

            <div className="flex flex-col gap-8 px-4">
                <p className="text-sm text-grey-1">
                    The profile &ldquo;first group&rdquo; in both card states, rendered with the real{' '}
                    <code>ProfileMenuItem</code>. Rows are live links.
                </p>

                {/* Non-holder — the new default for most users */}
                <section className="flex flex-col gap-3">
                    <SectionLabel>Non-holder (no card yet) — also the loading state</SectionLabel>
                    <p className="text-[11px] text-grey-1">
                        &ldquo;Peanut Card&rdquo; · <span className="font-semibold">New!</span> badge · → /shhhhh
                    </p>
                    <ProfileFirstGroup hasCardAccess={false} />
                </section>

                {/* Holder — unchanged from today */}
                <section className="flex flex-col gap-3">
                    <SectionLabel>Card holder (hasCardAccess) — unchanged</SectionLabel>
                    <p className="text-[11px] text-grey-1">&ldquo;Your Card&rdquo; · no badge · → /card</p>
                    <ProfileFirstGroup hasCardAccess={true} />
                </section>

                <Card className="bg-primary-3/20 p-3">
                    <div className="mb-1 flex items-center gap-2">
                        <Icon name="info" size={14} />
                        <span className="text-xs font-bold">Note</span>
                    </div>
                    <p className="text-xs text-grey-1">
                        The <span className="font-semibold">New!</span> pill is the shared StatusBadge{' '}
                        <code>custom</code> style (lavender <code>primary-3</code>) — the same tag ProfileEdit uses for{' '}
                        <span className="font-semibold">Soon!</span>. No new design surface.
                    </p>
                </Card>
            </div>
        </div>
    )
}
