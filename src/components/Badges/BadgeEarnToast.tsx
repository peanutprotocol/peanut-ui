'use client'

/**
 * <BadgeEarnToast /> — the non-intrusive "badge unlocked" moment (TASK-19791).
 *
 * Globally mounted (ClientProviders), self-contained. When the signed-in user
 * lands on /home with freshly-earned badges they haven't seen, it fires ONE
 * coalesced toast ("Badge unlocked: X" / "You unlocked N badges") that taps
 * through to the shared BadgeDetailModal (or the badges list for several). A
 * badge that ships avatars (TASK-22142) gets a SECOND toast, 500ms later, so
 * the two announcements read as sequential events rather than one crowded card.
 *
 * Why a toast (not a fullscreen): every badge that fires at/around the card
 * launch is incidental — BETA_TESTER (signup), SHHHHH (everyone getting the
 * card), EVENT_ALUMNI, NOT_SO_SHHHH. A fullscreen would stack 2-3 takeovers
 * mid-/shhhhh-registration. The toast surfaces the badge without blocking the
 * flow. Gated to /home so it never appears mid-onboarding (/setup, /shhhhh).
 * WAITLIST_SKIP is excluded upstream — it keeps its bespoke card celebration.
 */

import { useEffect, useRef, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import posthog from 'posthog-js'
import { useTranslations } from 'next-intl'
import { useToast } from '@/components/0_Bruddle/Toast'
import { BadgeDetailModal } from '@/components/Badges/BadgeDetailModal'
import { getBadgeIcon } from '@/components/Badges/badge.utils'
import { useBadgeCopy } from '@/components/Badges/useBadgeCopy'
import { useBadgeEarnToast } from '@/components/Badges/useBadgeEarnToast'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'
import { BadgeImage } from '@/components/Badges/BadgeImage'
import { badgeAvatarKeys } from '@/components/Avatar/avatar.utils'
import { avatarPickerPath } from '@/components/Avatar/avatar.consts'

const HOME_PATH = '/home'
/** Gap between the badge toast and the avatar-unlock toast that follows it. */
const AVATAR_TOAST_DELAY_MS = 500

type ModalBadge = { code: string; title: string; description: string; logo: string }

export default function BadgeEarnToast() {
    const t = useTranslations('badges')
    const badgeCopy = useBadgeCopy()
    const pathname = usePathname()
    const router = useRouter()
    const { toast, dismiss } = useToast()
    const { pending, markSeen } = useBadgeEarnToast()
    const [modalBadge, setModalBadge] = useState<ModalBadge | null>(null)
    // Ids of the toast(s) currently on screen, so we can dismiss them when the
    // user navigates away from /home (they'd otherwise linger over the next route).
    const liveToastIdsRef = useRef<string[]>([])
    // Pending timers for delayed avatar toasts, so a route change (or unmount)
    // before one fires can cancel it instead of popping a toast on the wrong
    // page. A Set (not a single ref) because a later batch's effect run must
    // not clobber an earlier batch's still-pending timer.
    const avatarTimeoutsRef = useRef<Set<ReturnType<typeof setTimeout>>>(new Set())

    useEffect(() => {
        // Only surface on /home (never mid-onboarding) and only when there's
        // something fresh to show. markSeen() empties `pending`, so this effect
        // fires the toast exactly once per batch.
        if (pathname !== HOME_PATH || pending.length === 0) return

        const badges = pending
        const codes = badges.map((b) => b.code)
        const count = badges.length
        const newest = badges[0]
        const newestCopy = badgeCopy(newest.code, newest.name, newest.description)
        const newestName = newestCopy.name
        const newestIcon = getBadgeIcon(newest.code, newest.iconUrl)
        // Per-batch id (not a fixed id): a fixed id de-dupes in the Toast layer,
        // so a second badge earned within the toast's window would be marked
        // seen but never shown. Keying on the codes lets a distinct later batch
        // surface, while still de-duping a re-render of the same batch.
        const toastId = `badge-earn:${codes.join(',')}`
        const avatarToastId = `badge-earn-avatar:${codes.join(',')}`

        const openInspect = () => {
            dismiss(toastId)
            posthog.capture(ANALYTICS_EVENTS.BADGE_EARN_TOAST_TAPPED, { count, target: 'badge_detail' })
            if (count === 1) {
                setModalBadge({
                    code: newest.code,
                    title: newestName,
                    description: newestCopy.description || '',
                    logo: newestIcon,
                })
            } else {
                router.push('/badges')
            }
        }

        const label = count === 1 ? t('toastSingle', { name: newestName }) : t('toastMultiple', { count })

        // A badge that ships avatars (TASK-22142) gets its own follow-up toast
        // linking to the picker, fired AVATAR_TOAST_DELAY_MS after the badge
        // toast so the two announcements read as sequential events. A badge
        // rides along in that link so the first hand the picker deals holds one
        // of its avatars — otherwise the user taps through to a hand that may
        // not hold the thing they just unlocked. It has to be a badge that HAS
        // art: most ship none, so a coalesced batch can pair an artless newest
        // with an older one that has three, and naming the artless code falls
        // back to any avatar already held. `codes` is newest-first, so the
        // first survivor is the right one.
        const withArt = codes.filter((code) => badgeAvatarKeys([code]).length > 0)
        const avatarCount = badgeAvatarKeys(withArt).length
        const chooseAvatar = () => {
            dismiss(avatarToastId)
            posthog.capture(ANALYTICS_EVENTS.BADGE_EARN_TOAST_TAPPED, { count, target: 'avatar_picker' })
            router.push(avatarPickerPath(withArt[0]))
        }

        toast({
            id: toastId,
            type: 'success',
            duration: 6000,
            // the compact notification carries no border of its own — this toast
            // draws its accent border explicitly. custom content suppresses the
            // priority icon by construction (ToastStack), no hideIcon needed.
            className: 'border border-action-secondary bg-background-default',
            content: (
                <button type="button" onClick={openInspect} className="flex items-center gap-3 text-left">
                    <BadgeImage
                        src={newestIcon}
                        alt=""
                        width={28}
                        height={28}
                        className="size-7 shrink-0 object-contain"
                        unoptimized
                    />
                    <span className="text-label-l">
                        {label}
                        <br />
                        <span className="font-medium underline">{t('toastTapToView')}</span>
                    </span>
                </button>
            ),
        })
        liveToastIdsRef.current.push(toastId)
        posthog.capture(ANALYTICS_EVENTS.BADGE_EARN_TOAST_SHOWN, { count })

        if (avatarCount > 0) {
            const avatarTimeout = setTimeout(() => {
                avatarTimeoutsRef.current.delete(avatarTimeout)
                toast({
                    id: avatarToastId,
                    type: 'success',
                    duration: 6000,
                    className: 'border border-action-secondary bg-background-default',
                    content: (
                        <button type="button" onClick={chooseAvatar} className="text-left text-label-l">
                            {t('toastAvatars', { count: avatarCount })}
                            <br />
                            <span className="font-medium underline">{t('toastChooseAvatar')}</span>
                        </button>
                    ),
                })
                liveToastIdsRef.current.push(avatarToastId)
            }, AVATAR_TOAST_DELAY_MS)
            avatarTimeoutsRef.current.add(avatarTimeout)
        }

        markSeen(codes)
    }, [pathname, pending, toast, dismiss, markSeen, router, t, badgeCopy])

    // Dismiss the toast(s) when the user leaves /home so they don't ride over
    // the next route for their remaining duration, and cancel a not-yet-fired
    // avatar toast so it can't pop up on the new page. Guarded on pathname so
    // the markSeen-triggered re-render (still on /home) never kills the live
    // toast.
    useEffect(() => {
        if (pathname === HOME_PATH) return
        avatarTimeoutsRef.current.forEach((timeout) => clearTimeout(timeout))
        avatarTimeoutsRef.current.clear()
        liveToastIdsRef.current.forEach((id) => dismiss(id))
        liveToastIdsRef.current = []
    }, [pathname, dismiss])

    // Unmount-only: cancel any still-pending avatar toast timers.
    useEffect(() => {
        return () => {
            avatarTimeoutsRef.current.forEach((timeout) => clearTimeout(timeout))
        }
    }, [])

    return modalBadge ? (
        <BadgeDetailModal
            isOpen
            onClose={() => setModalBadge(null)}
            code={modalBadge.code}
            title={modalBadge.title}
            description={modalBadge.description}
            logo={modalBadge.logo}
        />
    ) : null
}
