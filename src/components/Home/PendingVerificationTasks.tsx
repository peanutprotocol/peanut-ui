'use client'

import { useCallback, useEffect, useState } from 'react'
import { startBridgeHostedVerification } from '@/app/actions/sumsub'
import { Button } from '@/components/0_Bruddle/Button'
import Carousel from '@/components/Global/Carousel'
import { Icon } from '@/components/Global/Icons/Icon'
import { BridgeTosStep } from '@/components/Kyc/BridgeTosStep'
import { useAuth } from '@/context/authContext'
import { useCapabilities } from '@/hooks/useCapabilities'
import type { NextAction } from '@/types/capabilities'
import { bridgeTaskDismissalKey, selectBridgeTasks } from '@/utils/bridge-tasks.utils'
import { openExternalUrl } from '@/utils/capacitor'
import { formatEffectiveDate } from '@/utils/format.utils'
import { getUserPreferences, updateUserPreferences } from '@/utils/general.utils'
import Card from '../Global/Card'

function taskCopy(task: NextAction): { title: string; description: string } {
    // Advisory tasks (future-dated, rails still usable) are about KEEPING
    // access; blocking tasks are about ENABLING it — don't tell a blocked
    // user their transfers are "available".
    const advisory = !!task.effectiveDate
    if (task.kind === 'accept-tos') {
        if (task.key === 'accept-tos:sepa') {
            return {
                title: 'Accept SEPA Terms of Service',
                description: advisory
                    ? "Accept our payment partner's updated terms to keep EUR and GBP bank transfers available."
                    : "Accept our payment partner's updated terms to enable EUR and GBP bank transfers.",
            }
        }
        return {
            title: 'Accept Terms of Service',
            description: advisory
                ? "Accept our payment partner's terms to keep bank transfers available."
                : "Accept our payment partner's terms to enable bank transfers.",
        }
    }
    return {
        title: 'Additional verification needed',
        description: advisory
            ? 'Complete a quick verification with our payment partner to keep bank transfers available.'
            : 'Complete a quick verification with our payment partner to enable bank transfers.',
    }
}

/**
 * Home card listing the user's pending Bridge verification tasks — the in-app
 * mirror of Bridge's "additional verification needed" dashboard state. Reads
 * top-level capability `nextActions` (NOT rail gates), so it also catches the
 * orphan actions no rail references (both blocking hosted tasks and advisory
 * future-dated ones) and sidesteps ActivationCTAs' can-already-transact
 * stand-down. Renders nothing when no task is pending. Multiple tasks render
 * as full-width horizontal carousel slides (same embla setup as
 * HomeCarouselCTA); a single task looks identical to a static card.
 *
 * The ToS flow is SNAPSHOTTED at tap time: the task list re-derives from every
 * user refetch (~4s auto-refresh while rails are pending), and the open modal
 * must survive its task disappearing mid-flow — the card hides, the flow keeps
 * running. The hosted flow leaves the app entirely (see handleOpenTask).
 *
 * `dismissible` (the /home mount): each ADVISORY (future-dated) slide carries
 * its own X that dismisses ONLY that task — the other slides stay. Dismissals
 * persist per task FINGERPRINT (key + requirement + due state, see
 * bridgeTaskDismissalKey), so a task that changes substance re-surfaces
 * despite an old dismissal. BLOCKING (due-now) tasks are never dismissible
 * and ignore stored fingerprints — their fingerprint is constant over time,
 * and their rails are gated NOW; the Profile → Unlocked regions mount is
 * non-dismissible for everything.
 */
export default function PendingVerificationTasks({ dismissible = false }: { dismissible?: boolean }) {
    const { nextActions } = useCapabilities()
    const { user, fetchUser } = useAuth()
    const [activeTosTask, setActiveTosTask] = useState<NextAction | null>(null)
    const [isStartingHosted, setIsStartingHosted] = useState(false)
    const [awaitingReturn, setAwaitingReturn] = useState(false)
    const [error, setError] = useState<string | null>(null)
    // Stored dismissals, tagged with the user they were loaded for
    // (localStorage is unreadable during SSR, hence the post-render effect).
    // The dismissible mount must not paint until the CURRENT user's entry is
    // hydrated: an empty list would flash already-dismissed tasks, and an
    // untagged list would leak the previous user's dismissals for one render
    // after a logout/login.
    const [storedDismissals, setStoredDismissals] = useState<{ forUserId: string; keys: string[] } | null>(null)

    const userId = user?.user?.userId
    const tasks = selectBridgeTasks(nextActions)
    const taskKeys = tasks
        .map((task) => task.key)
        .sort()
        .join(',')

    // A new task set means the previous failure context is gone.
    useEffect(() => {
        setError(null)
    }, [taskKeys])

    useEffect(() => {
        if (!dismissible || !userId) return
        setStoredDismissals({
            forUserId: userId,
            keys: getUserPreferences(userId)?.pendingVerificationTasksDismissed ?? [],
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
    const visibleTasks = !dismissible
        ? tasks
        : tasks.filter(
              (task) =>
                  !task.effectiveDate ||
                  (dismissedKeys !== null && !dismissedKeys.includes(bridgeTaskDismissalKey(task)))
          )

    const handleOpenTask = useCallback(
        async (task: NextAction) => {
            setError(null)
            if (task.kind === 'accept-tos') {
                setActiveTosTask(task)
                return
            }
            setIsStartingHosted(true)
            const { url } = await startBridgeHostedVerification()
            setIsStartingHosted(false)
            if (!url) {
                // Friendly copy regardless of the server detail (a 403 here just
                // means the action aged out); refetch so a stale card self-corrects.
                setError("We couldn't start the verification. Please try again in a moment.")
                void fetchUser()
                return
            }
            // NOT an iframe: `bridge.withpersona.com` serves
            // `X-Frame-Options: SAMEORIGIN`, so embedding it rendered
            // "refused to connect" for EVERY user. It has to be a real
            // top-level page (native: the in-app browser). Bridge's ToS link
            // (`compliance.bridge.xyz`) sends no framing header, which is why
            // BridgeTosStep keeps its iframe.
            await openExternalUrl(url)
            setAwaitingReturn(true)
        },
        [fetchUser]
    )

    // Nothing polls for this cohort — the ~4s user auto-refresh only runs
    // while a rail is `pending`, and these are `requires-info` — so pick the
    // result up when the user comes back from the hosted flow.
    useEffect(() => {
        if (!awaitingReturn) return
        const onReturn = () => {
            if (document.visibilityState !== 'visible') return
            // Detach here, not just on the state flip: the re-render is async,
            // so a second visibility event could otherwise refetch twice.
            document.removeEventListener('visibilitychange', onReturn)
            setAwaitingReturn(false)
            void fetchUser()
        }
        document.addEventListener('visibilitychange', onReturn)
        return () => document.removeEventListener('visibilitychange', onReturn)
    }, [awaitingReturn, fetchUser])

    const closeTos = useCallback(() => setActiveTosTask(null), [])

    if (visibleTasks.length === 0 && !activeTosTask) return null

    return (
        <>
            {visibleTasks.length > 0 && (
                <div>
                    <Carousel>
                        {visibleTasks.map((task) => {
                            const copy = taskCopy(task)
                            const isHosted = task.kind === 'bridge-hosted'
                            const deadline = formatEffectiveDate(task.effectiveDate)
                            return (
                                <Card key={task.key} position="single" className="embla__slide relative p-0">
                                    <div className="flex flex-col items-center gap-2 px-4 py-5 text-center">
                                        {dismissible && !!task.effectiveDate && (
                                            <button
                                                type="button"
                                                aria-label={`Dismiss ${copy.title}`}
                                                onClick={() => handleDismissTask(task)}
                                                className="absolute right-3 top-3 z-10 cursor-pointer p-0 text-black outline-none"
                                            >
                                                <Icon name="cancel" size={16} />
                                            </button>
                                        )}
                                        <div className="flex size-10 items-center justify-center rounded-full bg-secondary-1">
                                            <Icon name={isHosted ? 'user-id' : 'badge'} size={20} />
                                        </div>
                                        <div className="w-full">
                                            <div className="text-base font-bold">{copy.title}</div>
                                            <div className="text-sm text-grey-1">{copy.description}</div>
                                            {deadline && (
                                                <div className="mt-1 text-xs font-medium">
                                                    Complete before {deadline}
                                                </div>
                                            )}
                                        </div>
                                        <Button
                                            variant="purple"
                                            shadowSize="4"
                                            className="mt-1 w-full"
                                            disabled={isStartingHosted}
                                            onClick={() => handleOpenTask(task)}
                                        >
                                            {isHosted
                                                ? isStartingHosted
                                                    ? 'Loading...'
                                                    : 'Complete verification'
                                                : 'Review terms'}
                                        </Button>
                                    </div>
                                </Card>
                            )
                        })}
                    </Carousel>
                    {error && <p className="mt-2 text-center text-sm text-error">{error}</p>}
                </div>
            )}

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
