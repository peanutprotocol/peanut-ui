'use client'

import { useLayoutEffect } from 'react'
import { SetupShell } from '@/components/Setup/redesign/shell/SetupShell'
import { type KycControlFlow, useKycControl } from '@/features/paperwork-verification/analytics'
import { restoreNativeStatusBar } from '@/features/paperwork-verification/useInsetColor'
import { VerifyStartScreen, type VerifyStartScreenProps } from './VerifyStartScreen'

/**
 * Verify start outside sign-up, in a shell of its own: /verify's intro and the intro in front of today's ID check.
 * There "Remind me later" goes back to where the person came from.
 */
export function VerifyStartIntro({
    controlScreen,
    controlFlow,
    onVerify,
    onLater,
    ...view
}: VerifyStartScreenProps & {
    /** the analytics screen id the intro reports its taps under, and its flow off /verify */
    controlScreen: string
    controlFlow?: KycControlFlow
}) {
    const control = useKycControl(controlScreen, controlFlow)
    // the shell paints the native status bar pink; a layout cleanup runs before the next screen paints its own
    useLayoutEffect(() => restoreNativeStatusBar, [])
    return (
        // the step sign-up shows Verify start on (FinalStep), so both run as the same screen
        <SetupShell screenId="advantage-control">
            <VerifyStartScreen
                {...view}
                onVerify={() => {
                    control.track('continue', 'tap')
                    onVerify()
                }}
                onLater={() => {
                    control.track('later', 'tap')
                    onLater()
                }}
            />
        </SetupShell>
    )
}
