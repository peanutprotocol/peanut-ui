'use client'

import { useCallback, useEffect, useState } from 'react'
import { startBridgeHostedVerification } from '@/app/actions/sumsub'
import { Button } from '@/components/0_Bruddle/Button'
import Carousel from '@/components/Global/Carousel'
import IframeWrapper from '@/components/Global/IframeWrapper'
import { Icon } from '@/components/Global/Icons/Icon'
import { BridgeTosStep } from '@/components/Kyc/BridgeTosStep'
import { useAuth } from '@/context/authContext'
import { useCapabilities } from '@/hooks/useCapabilities'
import type { NextAction } from '@/types/capabilities'
import { selectBridgeTasks } from '@/utils/bridge-tasks.utils'
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

/** "2099-03-01" → "Mar 1, 2099" — UTC so the date never shifts across timezones. */
function formatDeadline(isoDate: string): string | null {
    const parsed = new Date(`${isoDate.slice(0, 10)}T00:00:00Z`)
    if (Number.isNaN(parsed.getTime())) return null
    return parsed.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        timeZone: 'UTC',
    })
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
 * Open flows are SNAPSHOTTED at tap time: the task list re-derives from every
 * user refetch (~4s auto-refresh while rails are pending), and an open
 * modal/iframe must survive its task disappearing mid-flow — the card hides,
 * the flow keeps running.
 *
 * `dismissible` (the /home mount): an X persists the dismissal per task-key
 * set (carousel-CTA pattern) — a DIFFERENT set of pending tasks re-shows the
 * card. The Profile → Unlocked regions mount is non-dismissible, so dismissed
 * tasks stay reachable there.
 */
export default function PendingVerificationTasks({ dismissible = false }: { dismissible?: boolean }) {
    const { nextActions } = useCapabilities()
    const { user, fetchUser } = useAuth()
    const [activeTosTask, setActiveTosTask] = useState<NextAction | null>(null)
    const [hostedUrl, setHostedUrl] = useState<string | null>(null)
    const [isStartingHosted, setIsStartingHosted] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [dismissedKeys, setDismissedKeys] = useState<string | null>(null)

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
        setDismissedKeys(getUserPreferences(userId)?.pendingVerificationTasksDismissed ?? null)
    }, [dismissible, userId])

    const handleDismiss = useCallback(() => {
        updateUserPreferences(userId, { pendingVerificationTasksDismissed: taskKeys })
        setDismissedKeys(taskKeys)
    }, [userId, taskKeys])

    const isDismissed = dismissible && dismissedKeys !== null && dismissedKeys === taskKeys

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
            setHostedUrl(url)
        },
        [fetchUser]
    )

    const handleHostedClose = useCallback(
        (source?: 'manual' | 'completed' | 'tos_accepted') => {
            setHostedUrl(null)
            if (source === 'completed') {
                // Bridge re-checks the customer asynchronously — refresh so the
                // task clears as soon as the capability model catches up.
                void fetchUser()
            }
        },
        [fetchUser]
    )

    const closeTos = useCallback(() => setActiveTosTask(null), [])

    if ((tasks.length === 0 || isDismissed) && !activeTosTask && !hostedUrl) return null

    return (
        <>
            {tasks.length > 0 && !isDismissed && (
                <div className="relative">
                    {dismissible && (
                        <button
                            type="button"
                            aria-label="Dismiss pending verification tasks"
                            onClick={handleDismiss}
                            className="absolute right-3 top-3 z-10 cursor-pointer p-0 text-black outline-none"
                        >
                            <Icon name="cancel" size={16} />
                        </button>
                    )}
                    <Carousel>
                        {tasks.map((task) => {
                            const copy = taskCopy(task)
                            const isHosted = task.kind === 'bridge-hosted'
                            const deadline = task.effectiveDate ? formatDeadline(task.effectiveDate) : null
                            return (
                                <Card key={task.key} position="single" className="embla__slide p-0">
                                    <div className="flex flex-col items-center gap-2 px-4 py-5 text-center">
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

            {hostedUrl && <IframeWrapper src={hostedUrl} visible onClose={handleHostedClose} />}
        </>
    )
}
