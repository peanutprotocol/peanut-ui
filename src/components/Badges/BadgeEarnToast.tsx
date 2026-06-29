'use client'

/**
 * <BadgeEarnToast /> — the non-intrusive "badge unlocked" moment (TASK-19791).
 *
 * Globally mounted (ClientProviders), self-contained. When the signed-in user
 * lands on /home with freshly-earned badges they haven't seen, it fires ONE
 * coalesced toast ("Badge unlocked: X" / "You unlocked N badges") that taps
 * through to the shared BadgeDetailModal (or the badges list for several).
 *
 * Why a toast (not a fullscreen): every badge that fires at/around the card
 * launch is incidental — BETA_TESTER (signup), SHHHHH (everyone getting the
 * card), EVENT_ALUMNI, NOT_SO_SHHHH. A fullscreen would stack 2-3 takeovers
 * mid-/shhhhh-registration. The toast surfaces the badge without blocking the
 * flow. Gated to /home so it never appears mid-onboarding (/setup, /shhhhh).
 * WAITLIST_SKIP is excluded upstream — it keeps its bespoke card celebration.
 */

import { useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import Image from 'next/image'
import posthog from 'posthog-js'
import { useToast } from '@/components/0_Bruddle/Toast'
import { BadgeDetailModal } from '@/components/Badges/BadgeDetailModal'
import { getBadgeDisplayName, getBadgeIcon, getPublicBadgeDescription } from '@/components/Badges/badge.utils'
import { useBadgeEarnToast } from '@/components/Badges/useBadgeEarnToast'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'

const TOAST_ID = 'badge-earn'
const HOME_PATH = '/home'

type ModalBadge = { title: string; description: string; logo: string }

export default function BadgeEarnToast() {
    const pathname = usePathname()
    const router = useRouter()
    const { toast, dismiss } = useToast()
    const { pending, markSeen } = useBadgeEarnToast()
    const [modalBadge, setModalBadge] = useState<ModalBadge | null>(null)

    useEffect(() => {
        // Only surface on /home (never mid-onboarding) and only when there's
        // something fresh to show. markSeen() empties `pending`, so this effect
        // fires the toast exactly once per batch.
        if (pathname !== HOME_PATH || pending.length === 0) return

        const badges = pending
        const codes = badges.map((b) => b.code)
        const count = badges.length
        const newest = badges[0]

        const openInspect = () => {
            dismiss(TOAST_ID)
            posthog.capture(ANALYTICS_EVENTS.BADGE_EARN_TOAST_TAPPED, { count })
            if (count === 1) {
                setModalBadge({
                    title: getBadgeDisplayName(newest.code, newest.name),
                    description: newest.description || getPublicBadgeDescription(newest.code) || '',
                    logo: getBadgeIcon(newest.code),
                })
            } else {
                router.push('/badges')
            }
        }

        const label =
            count === 1
                ? `Badge unlocked: ${getBadgeDisplayName(newest.code, newest.name)}`
                : `You unlocked ${count} badges 🎉`

        toast({
            id: TOAST_ID,
            type: 'success',
            duration: 6000,
            className: 'border-yellow-1',
            content: (
                <button type="button" onClick={openInspect} className="flex items-center gap-3 text-left">
                    <Image
                        src={getBadgeIcon(newest.code)}
                        alt=""
                        width={28}
                        height={28}
                        className="size-7 shrink-0 object-contain"
                        unoptimized
                    />
                    <span className="text-sm font-bold">
                        {label} <span className="font-medium underline">— tap to view</span>
                    </span>
                </button>
            ),
        })
        posthog.capture(ANALYTICS_EVENTS.BADGE_EARN_TOAST_SHOWN, { count })
        markSeen(codes)
    }, [pathname, pending, toast, dismiss, markSeen, router])

    return modalBadge ? (
        <BadgeDetailModal
            isOpen
            onClose={() => setModalBadge(null)}
            title={modalBadge.title}
            description={modalBadge.description}
            logo={modalBadge.logo}
        />
    ) : null
}
