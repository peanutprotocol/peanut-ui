'use client'

import { useEffect, useLayoutEffect, useRef } from 'react'
import posthog from 'posthog-js'
import { SetupShell } from '@/components/Setup/redesign/shell/SetupShell'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'
import { type KycControlFlow, useKycControl } from '@/features/paperwork-verification/analytics'
import { restoreNativeStatusBar } from '@/features/paperwork-verification/useInsetColor'
import { startVerifySource, type VerifySource } from '@/features/paperwork-verification/verifySource'
import { VerifyStartScreen, type VerifyStartScreenProps } from './VerifyStartScreen'

/**
 * Verify start outside sign-up, in a shell of its own: /verify's intro and the intro in front of today's ID check.
 * There "Remind me later" goes back to where the person came from.
 *
 * It opens the verification funnel (TASK-25063): `signup_verify_start_shown` once per view, and
 * `signup_verify_start_tapped` with `choice` verify or later, both with `entry` (where the person came from) and
 * `steps_left`. The entry then rides on every event of the check (verifySource).
 */
export function VerifyStartIntro({
    controlScreen,
    controlFlow,
    source,
    onVerify,
    onLater,
    ...view
}: VerifyStartScreenProps & {
    /** the analytics screen id the intro reports its taps under, and its flow off /verify */
    controlScreen: string
    controlFlow?: KycControlFlow
    /** where the person came from, when the caller knows (today's check); /verify takes what its caller left */
    source?: VerifySource
}) {
    const control = useKycControl(controlScreen, controlFlow)
    const entry = useRef<VerifySource | null>(null)
    const stepsLeft = view.questions ? 2 : 1
    useEffect(() => {
        if (entry.current) return
        entry.current = startVerifySource(source)
        posthog.capture(ANALYTICS_EVENTS.SIGNUP_VERIFY_START_SHOWN, { entry: entry.current, steps_left: stepsLeft })
        // once per view: a later change of the steps left is not a new view
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])
    const tapped = (choice: 'verify' | 'later') =>
        posthog.capture(ANALYTICS_EVENTS.SIGNUP_VERIFY_START_TAPPED, {
            choice,
            entry: entry.current,
            steps_left: stepsLeft,
        })
    // the shell paints the native status bar pink; a layout cleanup runs before the next screen paints its own
    useLayoutEffect(() => restoreNativeStatusBar, [])
    return (
        // the step sign-up shows Verify start on (FinalStep), so both run as the same screen
        <SetupShell screenId="advantage-control">
            <VerifyStartScreen
                {...view}
                onVerify={() => {
                    tapped('verify')
                    control.track('continue', 'tap')
                    onVerify()
                }}
                onLater={() => {
                    tapped('later')
                    control.track('later', 'tap')
                    onLater()
                }}
            />
        </SetupShell>
    )
}
