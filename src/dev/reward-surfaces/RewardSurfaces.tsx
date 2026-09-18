'use client'

/**
 * Every reward / celebration / achievement overlay in one list, with the fact
 * that decides drawer vs modal vs full screen: who actually opens it in
 * production. Facts verified by grepping each exported name across src/,
 * ignoring src/dev/** and the /dev routes (TASK-22680).
 *
 * The surfaces themselves are already mounted by /dev/surfaces — every row
 * links there rather than re-mounting anything.
 */

import { IconBubble } from '@/components/0_Bruddle/IconBubble'
import { ListItem } from '@/components/0_Bruddle/ListItem'
import { Notification } from '@/components/0_Bruddle/Notification'
import { Section } from '@/components/0_Bruddle/Section'
import { getCardPosition } from '@/components/Global/Card/card.utils'
import Link from 'next/link'
import DevPageShell from '@/app/(mobile-ui)/dev/_components/DevPageShell'

type Row = {
    name: string
    file: string
    presentation: 'Drawer' | 'Modal' | 'Toast'
    /** Real production importers. Empty means dev-only. */
    importers: string[]
    gate: string
    galleryId?: string
    /** Why the gallery cannot open it, when it cannot. */
    galleryNote?: string
    history?: string
}

const GROUPS: { title: string; rows: Row[] }[] = [
    {
        title: 'Reward & celebration',
        rows: [
            {
                name: 'PerkClaimDrawer',
                file: 'src/components/Home/PerkClaimDrawer.tsx',
                presentation: 'Drawer',
                importers: [
                    'src/components/Home/HomeCarouselCTA/index.tsx (rendered by src/features/home/HomePage.tsx)',
                ],
                gate: 'A pending perk from perksApi.getPendingPerks() whose name contains "Card Pioneer", tapped in the home carousel. Referral and surprise-moment perks are claimed inline after QR pay, not here.',
                galleryId: '46-c-perkclaimmodal',
                history: 'Modal → Drawer in efb93f9ce (2026-09-10); renamed *Modal → *Drawer in 4c9e7528f.',
            },
            {
                name: 'PerkClaimSuccessDrawer',
                file: 'src/components/Home/PerkClaimSuccessDrawer.tsx',
                presentation: 'Drawer',
                importers: ['src/components/Home/PerkClaimDrawer.tsx'],
                gate: 'The success phase of the claim flow (usePerkClaimFlow). It replaces the gift-box sheet, so it is only reachable behind PerkClaimDrawer.',
                galleryId: '69-d-perkclaimsuccess',
                history: 'Modal → Drawer in efb93f9ce (2026-09-10); renamed in 4c9e7528f.',
            },
            {
                name: 'WelcomeUnlockDrawer',
                file: 'src/components/Home/WelcomeUnlockDrawer/index.tsx',
                presentation: 'Drawer',
                importers: ['src/features/home/components/HomeModals.tsx (lazy)'],
                gate: 'isKycApproved and user.activationCelebratedAt is null — once per account, stamped server-side on dismiss. Suppressed while the balance warning, migration prompt, jail celebration or early-user drawer is up.',
                galleryId: '47-c-welcomeunlockmodal',
                history: 'Modal → Drawer in 45d6f0d11 (2026-09-09); renamed in 4c9e7528f.',
            },
            {
                name: 'NoMoreJailDrawer',
                file: 'src/components/Global/NoMoreJailDrawer/index.tsx',
                presentation: 'Drawer',
                importers: ['src/features/home/components/HomeModals.tsx (lazy)'],
                gate: 'sessionStorage key showNoMoreJailModal === "true", cleared on dismiss. BadgeDetailDrawer only names it in a comment — that is not an importer.',
                galleryId: '17-a-nomorejailmodal',
                history: 'Modal → Drawer in efb93f9ce (2026-09-10).',
            },
            {
                name: 'InviteFriendsDrawer',
                file: 'src/components/Global/InviteFriendsDrawer/index.tsx',
                presentation: 'Drawer',
                importers: [
                    'src/components/Profile/index.tsx',
                    'src/components/Home/HomeCarouselCTA/index.tsx',
                    'src/app/(mobile-ui)/rewards/invites/page.tsx',
                    'src/features/rewards/RewardsPage.tsx',
                    'src/features/payments/flows/qr-pay/views/QrPaySuccessView.tsx',
                ],
                gate: 'User tap only — profile row, home CTA, rewards page, invites page, QR-pay success. The most-opened surface in this list.',
                galleryId: '15-a-invitefriendsmodal',
                history: 'Modal → Drawer in 45d6f0d11 (2026-09-09); renamed in 4c9e7528f.',
            },
            {
                name: 'BadgeDetailDrawer',
                file: 'src/components/Badges/BadgeDetailDrawer.tsx',
                presentation: 'Drawer',
                importers: [
                    'src/components/Badges/index.tsx (the /badges page)',
                    'src/components/Badges/BadgeEarnToast.tsx',
                    'src/components/Badges/BadgeStatusDrawer.tsx',
                ],
                gate: 'Tap a badge on /badges, tap the earn toast, or open it from the status drawer. Three entry points, so it opens on top of another drawer in one of them.',
                galleryId: '36-c-badgedetailmodal',
                history: 'Modal → Drawer in 45d6f0d11 (2026-09-09); renamed in 4c9e7528f.',
            },
            {
                name: 'BadgeStatusDrawer',
                file: 'src/components/Badges/BadgeStatusDrawer.tsx',
                presentation: 'Drawer',
                importers: [
                    'src/components/Badges/BadgeStatusItem.tsx (used by src/app/(mobile-ui)/history/page.tsx and src/components/Home/HomeHistory.tsx)',
                ],
                gate: 'Tap a badge status row in history or on home.',
                galleryId: '37-c-badgestatusdrawer',
                history: 'Always a drawer — never converted. 45d6f0d11 only re-pointed its BadgeDetail import.',
            },
        ],
    },
    {
        title: 'Related surfaces',
        rows: [
            {
                name: 'BadgeEarnToast',
                file: 'src/components/Badges/BadgeEarnToast.tsx',
                presentation: 'Toast',
                importers: ['src/app/AppGlobals.tsx (mounted globally, so it can fire on any route)'],
                gate: 'pickCelebrationBadges in badgeCelebration.utils.ts — a badge earned inside the 7-day freshness window whose code is not yet in the per-user seen-codes store.',
                galleryNote: 'No gallery id — it is a toast, not a surface the gallery can mount.',
            },
            {
                name: 'ConfirmInviteModal',
                file: 'src/components/Global/ConfirmInviteModal/index.tsx',
                presentation: 'Modal',
                importers: ['src/components/Claim/Link/SendLinkActionList.tsx'],
                gate: 'A claim-link recipient picks a payout method that would forfeit the invite.',
                galleryId: '10-a-confirminvitemodal',
                history: 'Still an ActionModal — it was in neither conversion commit.',
            },
            {
                name: 'MigrationDownloadModal',
                file: 'src/components/Migration/MigrationDownloadModal.tsx',
                presentation: 'Modal',
                importers: ['src/features/home/components/HomeModals.tsx (lazy, outranks every other home modal)'],
                gate: 'Migration flag on, signed in, web (not Capacitor), before the cutover time, not snoozed, and the legal consent gate clear.',
                galleryId: '41-c-migrationdownloadmodal',
                galleryNote:
                    'Marked blocked in the gallery: it opens itself off the sunset countdown and a stored dismissal, with no visible prop.',
                history:
                    'The one that went back: Modal → Drawer in efb93f9ce, then Drawer → Modal again in 4c9e7528f, both on 2026-09-10.',
            },
            {
                name: 'EasterEggDrawer',
                file: 'src/components/Global/EasterEggDrawer/index.tsx',
                presentation: 'Drawer',
                importers: ['src/components/Common/CountryList.tsx'],
                gate: 'The user picks a country listed in EASTER_EGG_COUNTRIES.',
                galleryId: '12-a-eastereggmodal',
                history: 'Modal → Drawer in 45d6f0d11 (2026-09-09); renamed in 4c9e7528f.',
            },
        ],
    },
]

const LABEL = 'text-body-xs font-mono text-foreground-secondary'
const VALUE = 'text-body-xs leading-snug text-foreground-primary'

function RowBody({ row }: { row: Row }) {
    const reachable = row.importers.length > 0
    return (
        <div className="flex flex-col gap-1 pt-1">
            <p className={VALUE}>
                {row.presentation} · {reachable ? 'reachable in production' : 'no production importer — dev only'}
            </p>
            <p className={`${LABEL} break-all`}>{row.file}</p>
            <p className={LABEL}>
                opened by:{' '}
                {reachable ? <span className="break-all">{row.importers.join(' · ')}</span> : 'nothing outside src/dev'}
            </p>
            <p className={VALUE}>
                <span className={LABEL}>gate: </span>
                {row.gate}
            </p>
            {row.history && (
                <p className={`${VALUE} italic`}>
                    <span className={LABEL}>history: </span>
                    {row.history}
                </p>
            )}
            {row.galleryNote && <p className={`${VALUE} italic`}>{row.galleryNote}</p>}
        </div>
    )
}

export default function RewardSurfaces() {
    return (
        <DevPageShell
            title="Reward surfaces"
            description="Every reward, celebration and achievement overlay — what opens it in production, how it is presented today, and a link to the live surface. For the drawer-vs-modal-vs-full-screen decision (TASK-22680)."
            width="prose"
        >
            <Notification priority="info" title="The App Store review prompt is not ours">
                It is the native OS sheet (src/utils/app-review.ts → CapgoInAppReview.requestReview). Guideline 5.6.1
                forbids a custom prompt, so nothing we choose about drawer size can affect it.
            </Notification>

            {GROUPS.map((group) => (
                <Section key={group.title} title={group.title}>
                    <div>
                        {group.rows.map((row, i) => {
                            const item = (
                                <ListItem
                                    className={row.galleryId ? 'cursor-pointer' : undefined}
                                    position={getCardPosition(i, group.rows.length)}
                                    leading={
                                        <IconBubble
                                            icon={row.importers.length > 0 ? 'check-circle' : 'alert'}
                                            size="s"
                                            color={row.importers.length > 0 ? 'green' : 'yellow'}
                                        />
                                    }
                                    title={row.name}
                                    body={<RowBody row={row} />}
                                    bodyWrap
                                    chevron={!!row.galleryId}
                                />
                            )
                            return row.galleryId ? (
                                <Link key={row.name} href={`/dev/surfaces?s=${row.galleryId}`}>
                                    {item}
                                </Link>
                            ) : (
                                <div key={row.name}>{item}</div>
                            )
                        })}
                    </div>
                </Section>
            ))}

            <Notification
                priority="helper"
                title="Already removed"
                items={[
                    'UnlockRegionModal — deleted in 45d6f0d11 (2026-09-09, TASK-22202) because no production importer was left. Only the DS audit data still names it.',
                    'src/components/Points/CashCard.tsx — deleted earlier, in 1a93de1e7 (2026-03-27, rewards v2 cleanup), for the same reason.',
                ]}
            />
        </DevPageShell>
    )
}
