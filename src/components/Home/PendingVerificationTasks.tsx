'use client'

import { useCallback, useState } from 'react'
import { startBridgeHostedVerification } from '@/app/actions/sumsub'
import { Button } from '@/components/0_Bruddle/Button'
import IframeWrapper from '@/components/Global/IframeWrapper'
import { Icon } from '@/components/Global/Icons/Icon'
import { BridgeTosStep } from '@/components/Kyc/BridgeTosStep'
import { useAuth } from '@/context/authContext'
import { useCapabilities } from '@/hooks/useCapabilities'
import type { NextAction } from '@/types/capabilities'
import { selectBridgeTasks } from '@/utils/bridge-tasks.utils'
import Card from '../Global/Card'

const TASK_COPY = {
    tosBase: {
        title: 'Accept Terms of Service',
        description: "Accept our payment partner's terms to keep bank transfers available.",
    },
    tosSepa: {
        title: 'Accept SEPA Terms of Service',
        description: "Accept our payment partner's updated terms to keep EUR and GBP bank transfers available.",
    },
    hosted: {
        title: 'Additional verification needed',
        description: 'Complete a quick verification with our payment partner to keep bank transfers available.',
    },
} as const

function taskCopy(task: NextAction): { title: string; description: string } {
    if (task.kind === 'accept-tos') {
        return task.key === 'accept-tos:sepa' ? TASK_COPY.tosSepa : TASK_COPY.tosBase
    }
    return TASK_COPY.hosted
}

/** "2099-03-01" → "Mar 1, 2099" — UTC so the date never shifts across timezones. */
function formatDeadline(isoDate: string): string {
    return new Date(`${isoDate}T00:00:00Z`).toLocaleDateString('en-US', {
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
 * advisory orphans (future-dated tasks on fully-enabled users) and sidesteps
 * ActivationCTAs' can-already-transact stand-down. Renders nothing when no
 * task is pending.
 */
export default function PendingVerificationTasks() {
    const { nextActions } = useCapabilities()
    const { fetchUser } = useAuth()
    const [tosOpen, setTosOpen] = useState(false)
    const [hostedUrl, setHostedUrl] = useState<string | null>(null)
    const [isStartingHosted, setIsStartingHosted] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const tasks = selectBridgeTasks(nextActions)
    const tosTask = tasks.find((task) => task.kind === 'accept-tos')

    const handleOpenTask = useCallback(async (task: NextAction) => {
        setError(null)
        if (task.kind === 'accept-tos') {
            setTosOpen(true)
            return
        }
        setIsStartingHosted(true)
        const { url, error: startError } = await startBridgeHostedVerification()
        setIsStartingHosted(false)
        if (!url) {
            setError(startError ?? 'Something went wrong. Please try again.')
            return
        }
        setHostedUrl(url)
    }, [])

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

    if (tasks.length === 0) return null

    return (
        <>
            <Card position="single" className="p-0">
                <div className="flex flex-col gap-5 px-4 py-5">
                    {tasks.map((task) => {
                        const copy = taskCopy(task)
                        const isHosted = task.kind === 'bridge-hosted'
                        return (
                            <div key={task.key} className="flex flex-col items-center gap-2 text-center">
                                <div className="flex size-10 items-center justify-center rounded-full bg-secondary-1">
                                    <Icon name={isHosted ? 'user-id' : 'badge'} size={20} />
                                </div>
                                <div className="w-full">
                                    <div className="text-base font-bold">{copy.title}</div>
                                    <div className="text-sm text-grey-1">{copy.description}</div>
                                    {task.effectiveDate && (
                                        <div className="mt-1 text-xs font-medium">
                                            Complete before {formatDeadline(task.effectiveDate)}
                                        </div>
                                    )}
                                </div>
                                <Button
                                    variant="purple"
                                    shadowSize="4"
                                    className="mt-1 w-full"
                                    disabled={isHosted && isStartingHosted}
                                    onClick={() => handleOpenTask(task)}
                                >
                                    {isHosted
                                        ? isStartingHosted
                                            ? 'Loading...'
                                            : 'Complete verification'
                                        : 'Review terms'}
                                </Button>
                            </div>
                        )
                    })}
                    {error && <p className="text-center text-sm text-error">{error}</p>}
                </div>
            </Card>

            {tosTask && (
                <BridgeTosStep
                    visible={tosOpen}
                    onComplete={() => setTosOpen(false)}
                    onSkip={() => setTosOpen(false)}
                    reasonCode={tosTask.key === 'accept-tos:sepa' ? 'bridge_tos_v2_required' : 'bridge_tos_required'}
                />
            )}

            {hostedUrl && <IframeWrapper src={hostedUrl} visible onClose={handleHostedClose} />}
        </>
    )
}
