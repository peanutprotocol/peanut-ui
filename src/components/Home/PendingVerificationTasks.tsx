'use client'

import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/0_Bruddle/Button'
import { Callout } from '@/components/0_Bruddle/Callout'
import Carousel from '@/components/Global/Carousel'
import { Icon } from '@/components/Global/Icons/Icon'
import { BridgeTosStep } from '@/components/Kyc/BridgeTosStep'
import { useAuth } from '@/context/authContext'
import { useCapabilities } from '@/hooks/useCapabilities'
import { useDocumentRequestFlow } from '@/hooks/useDocumentRequestFlow'
import type { NextAction } from '@/types/capabilities'
import { bridgeTaskDismissalKey, selectBridgeTasks, selectHomeTasks } from '@/utils/bridge-tasks.utils'
import { formatEffectiveDate } from '@/utils/format.utils'
import { getUserPreferences, updateUserPreferences } from '@/utils/general.utils'
import Card from '../Global/Card'

// Currencies whose corridor a hosted-verification task can NAME. The backend
// sets `NextAction.currency` on the bridge-hosted catch-all; anything outside
// this set falls back to the generic "bank transfers" copy.
type CorridorCurrency = 'USD' | 'EUR' | 'GBP' | 'MXN'
const CORRIDOR_CURRENCIES = new Set<string>(['USD', 'EUR', 'GBP', 'MXN'])

// Advisory ToS and hosted tasks can be dismissed. The document request cannot:
// it reaches this card only in its final week, and the bank-screen notice sends
// the user here to complete it.
const isDismissibleTask = (task: NextAction): boolean => !!task.effectiveDate && task.kind !== 'sumsub'

/**
 * Home card listing the user's pending Bridge verification tasks — the in-app
 * mirror of Bridge's "additional verification needed" dashboard state. Reads
 * top-level capability `nextActions` (NOT rail gates), so it also catches the
 * orphan actions no rail references (both blocking hosted tasks and advisory
 * future-dated ones) and sidesteps ActivationCTAs' can-already-transact
 * stand-down. A blocking hosted task itself stands down while a Bridge rail
 * carries a native step (selectBridgeTasks) — the native step is the one that
 * can clear the requirement. Renders nothing when no task is pending. Multiple tasks render
 * as full-width horizontal carousel slides (same embla setup as
 * HomeCarouselCTA); a single task looks identical to a static card.
 *
 * A future-dated `sumsub` task (Bridge asks for one more document by a date;
 * the rails keep working until then) starts the document flow right here. Bank
 * screens only show a heads-up and never hold a transfer for it. On Home it is
 * a large card only in its final week; before that it is a small carousel slide
 * (selectHomeTasks). The Sumsub modals stay mounted after the task disappears,
 * so a flow in progress survives the list refetching. A failed start shows its
 * error in the slide, never a silent no-op.
 *
 * Home shows one CTA surface at a time: this card, or `whenEmpty` (the carousel
 * or the activation card) when no task is visible — never both.
 *
 * The ToS flow is SNAPSHOTTED at tap time: the task list re-derives from every
 * user refetch (~4s auto-refresh while rails are pending), and the open modal
 * must survive its task disappearing mid-flow — the card hides, the flow keeps
 * running. The hosted flow hands off to the vendor, so it goes through the
 * additional-verification screen first (see AdditionalVerificationView).
 *
 * `placement="home"`: each ADVISORY (future-dated) slide carries
 * its own X that dismisses ONLY that task — the other slides stay. Dismissals
 * persist per task FINGERPRINT (key + requirement + due state, see
 * bridgeTaskDismissalKey), so a task that changes substance re-surfaces
 * despite an old dismissal. BLOCKING (due-now) tasks are never dismissible
 * and ignore stored fingerprints — their fingerprint is constant over time,
 * and their rails are gated NOW; the Profile → Unlocked regions mount is
 * non-dismissible for everything.
 */
export default function PendingVerificationTasks({
    placement = 'profile',
    whenEmpty = null,
    whenEmptyShowsDocumentRequest = false,
}: {
    placement?: 'home' | 'profile'
    /** rendered in place of the card when no task is visible (Home: the carousel or the activation card) */
    whenEmpty?: ReactNode
    /**
     * Home: `whenEmpty` is the carousel, which carries a document request before
     * its final week. When it is not (the activation card), or when another task
     * card hides it, this card carries the request instead, so it stays reachable.
     */
    whenEmptyShowsDocumentRequest?: boolean
}) {
    const dismissible = placement === 'home'
    const t = useTranslations('home')
    const { nextActions, rails } = useCapabilities()
    const { user } = useAuth()
    const [activeTosTask, setActiveTosTask] = useState<NextAction | null>(null)
    const router = useRouter()
    const documentFlow = useDocumentRequestFlow()
    // Stored dismissals, tagged with the user they were loaded for
    // (localStorage is unreadable during SSR, hence the post-render effect).
    // The dismissible mount must not paint until the CURRENT user's entry is
    // hydrated: an empty list would flash already-dismissed tasks, and an
    // untagged list would leak the previous user's dismissals for one render
    // after a logout/login.
    const [storedDismissals, setStoredDismissals] = useState<{ forUserId: string; keys: string[] } | null>(null)

    const userId = user?.user?.userId
    const homeTasks = placement === 'home' ? selectHomeTasks(nextActions, rails ?? []) : null
    const tasks = homeTasks ? homeTasks.largeTasks : selectBridgeTasks(nextActions, rails ?? [])
    useEffect(() => {
        if (!dismissible || !userId) return
        // Pre-fingerprint native builds (≤1.0.50) persisted this preference as a
        // comma-joined STRING of task keys. Those dismissals can't be mapped to
        // fingerprints, so drop them (the card resurfaces once) — without the
        // guard a later dismiss would spread the string char-by-char into the
        // stored array.
        const stored = getUserPreferences(userId)?.pendingVerificationTasksDismissed
        setStoredDismissals({
            forUserId: userId,
            keys: Array.isArray(stored) ? stored : [],
        })
    }, [dismissible, userId])

    // Hydrated only when the stored entry belongs to the current user.
    const dismissedKeys = storedDismissals && storedDismissals.forUserId === userId ? storedDismissals.keys : null

    const handleDismissTask = useCallback(
        (task: NextAction) => {
            if (!userId) return
            setStoredDismissals((prev) => {
                const keys = prev && prev.forUserId === userId ? prev.keys : []
                const next = [...keys, bridgeTaskDismissalKey(task)]
                updateUserPreferences(userId, { pendingVerificationTasksDismissed: next })
                return { forUserId: userId, keys: next }
            })
        },
        [userId]
    )

    // Only ADVISORY (future-dated) tasks honor dismissals. A blocking task's
    // fingerprint is constant over time (`accept-tos||due-now`), so an old
    // stored dismissal would silently hide a NEW same-variant requirement
    // months later while the user's rails are gated — and for the orphan
    // bridge-hosted task this card is the only actionable surface outside
    // Profile (/code-review 08-04). Blocking tasks therefore always render;
    // advisory ones hold the first paint until stored dismissals hydrate
    // (an empty list would flash already-dismissed slides).
    const visibleLargeTasks = !dismissible
        ? tasks
        : tasks.filter(
              (task) =>
                  !isDismissibleTask(task) ||
                  (dismissedKeys !== null && !dismissedKeys.includes(bridgeTaskDismissalKey(task)))
          )
    const documentSlide = homeTasks?.documentSlide
    const visibleTasks =
        documentSlide && (!whenEmptyShowsDocumentRequest || visibleLargeTasks.length > 0)
            ? [...visibleLargeTasks, documentSlide]
            : visibleLargeTasks

    const handleOpenTask = useCallback(
        (task: NextAction) => {
            if (task.kind === 'accept-tos') {
                setActiveTosTask(task)
                return
            }
            if (task.kind === 'sumsub') {
                documentFlow.start(task)
                return
            }
            // The hosted flow gets its own screen first. It runs at the vendor,
            // in a browser we don't control, and keeps no partial progress — a
            // user who leaves mid-check to find a document restarts from step
            // one. That is a page's worth of prep, and it owns the handoff.
            router.push('/profile/accounts-and-payments/additional')
        },
        [router, documentFlow]
    )

    const closeTos = useCallback(() => setActiveTosTask(null), [])

    // Advisory tasks (future-dated, rails still usable) are about KEEPING
    // access; blocking tasks are about ENABLING it — don't tell a blocked user
    // their transfers are "available". A hosted task carries the rail currency,
    // so name the corridor ("unlock euro bank transfers") instead of the generic
    // "bank transfers" when we know it.
    const corridorLabel = (currency: CorridorCurrency): string => {
        switch (currency) {
            case 'USD':
                return t('pendingTasks.corridors.USD')
            case 'EUR':
                return t('pendingTasks.corridors.EUR')
            case 'GBP':
                return t('pendingTasks.corridors.GBP')
            case 'MXN':
                return t('pendingTasks.corridors.MXN')
        }
    }
    const taskCopy = (task: NextAction): { title: string; description: string } => {
        const advisory = !!task.effectiveDate
        if (task.kind === 'sumsub') {
            return { title: t('pendingTasks.documentTitle'), description: t('pendingTasks.documentDescription') }
        }
        if (task.kind === 'accept-tos') {
            if (task.key === 'accept-tos:sepa') {
                return {
                    title: t('pendingTasks.tosSepaTitle'),
                    description: advisory
                        ? t('pendingTasks.tosSepaDescriptionAdvisory')
                        : t('pendingTasks.tosSepaDescription'),
                }
            }
            return {
                title: t('pendingTasks.tosTitle'),
                description: advisory ? t('pendingTasks.tosDescriptionAdvisory') : t('pendingTasks.tosDescription'),
            }
        }
        if (task.currency && CORRIDOR_CURRENCIES.has(task.currency)) {
            const corridor = corridorLabel(task.currency as CorridorCurrency)
            return {
                title: t('pendingTasks.verifyTitleCorridor', { corridor }),
                description: advisory
                    ? t('pendingTasks.verifyDescriptionCorridorAdvisory', { corridor })
                    : t('pendingTasks.verifyDescriptionCorridor', { corridor }),
            }
        }
        return {
            title: t('pendingTasks.verifyTitle'),
            description: advisory ? t('pendingTasks.verifyDescriptionAdvisory') : t('pendingTasks.verifyDescription'),
        }
    }

    // Advisory tasks wait for stored dismissals (see above). Until then neither
    // the card nor `whenEmpty` paints, or the carousel would flash in and out.
    const isHydratingDismissals = dismissible && dismissedKeys === null && tasks.some((task) => isDismissibleTask(task))

    if (visibleTasks.length === 0 && !activeTosTask) {
        return (
            <>
                {!isHydratingDismissals && whenEmpty}
                {documentFlow.modals}
            </>
        )
    }

    return (
        <>
            {visibleTasks.length > 0 && (
                <div>
                    <Carousel>
                        {visibleTasks.map((task) => {
                            const copy = taskCopy(task)
                            const isHosted = task.kind === 'bridge-hosted'
                            const isDocument = task.kind === 'sumsub'
                            const deadline = formatEffectiveDate(task.effectiveDate)
                            const startError =
                                isDocument && documentFlow.startedTaskKey === task.key ? documentFlow.error : null
                            return (
                                <Card key={task.key} position="solo" className="embla__slide relative p-0">
                                    <div className="flex flex-col items-center gap-2 px-4 py-4 text-center">
                                        {dismissible && isDismissibleTask(task) && (
                                            <button
                                                type="button"
                                                aria-label={t('pendingTasks.dismiss', { task: copy.title })}
                                                onClick={() => handleDismissTask(task)}
                                                className="absolute top-3 right-3 z-10 cursor-pointer p-0 text-black transition-opacity duration-instant after:absolute after:-inset-4 focus-visible:outline-[3px] focus-visible:outline-action-focus active:opacity-60"
                                            >
                                                <Icon name="cancel" size={16} />
                                            </button>
                                        )}
                                        <div className="flex size-10 items-center justify-center rounded-full bg-background-icon-bubble-yellow">
                                            <Icon name={isHosted || isDocument ? 'user-id' : 'badge'} size={20} />
                                        </div>
                                        <div className="w-full">
                                            <div className="text-body-m-semibold">{copy.title}</div>
                                            <div className="text-body-s text-foreground-secondary">
                                                {copy.description}
                                            </div>
                                            {deadline && (
                                                <div className="mt-1 text-body-xs font-medium">
                                                    {t('pendingTasks.completeBefore', { deadline })}
                                                </div>
                                            )}
                                        </div>
                                        <Button
                                            variant="primary"
                                            shadowSize="4"
                                            className="mt-1 w-full"
                                            loading={isDocument && documentFlow.isLoading}
                                            disabled={isDocument && documentFlow.isLoading}
                                            onClick={() => handleOpenTask(task)}
                                        >
                                            {isDocument
                                                ? t('pendingTasks.documentCta')
                                                : isHosted
                                                  ? 'Complete verification'
                                                  : 'Review terms'}
                                        </Button>
                                        {startError && (
                                            <Callout
                                                priority="error"
                                                className="w-full text-left"
                                                data-testid="document-task-start-error"
                                            >
                                                {startError}
                                            </Callout>
                                        )}
                                    </div>
                                </Card>
                            )
                        })}
                    </Carousel>
                </div>
            )}

            {visibleTasks.length === 0 && !isHydratingDismissals && whenEmpty}

            {documentFlow.modals}

            {activeTosTask && (
                <BridgeTosStep
                    visible
                    onComplete={closeTos}
                    onSkip={closeTos}
                    reasonCode={
                        activeTosTask.key === 'accept-tos:sepa' ? 'bridge_tos_v2_required' : 'bridge_tos_required'
                    }
                />
            )}
        </>
    )
}
