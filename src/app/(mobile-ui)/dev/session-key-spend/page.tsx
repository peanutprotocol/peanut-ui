'use client'

/**
 * Dev page: opt this device into the one-tap mixed spend
 * (SESSION_KEY_SPEND — see src/constants/session-key-spend.consts.ts).
 *
 * The build gate must be on (NEXT_PUBLIC_SESSION_KEY_SPEND=true) or the spend
 * path contains no ephemeral-key code at all. At runtime the path is on when
 * the PostHog flag targets this user OR this device is opted in here. Verify
 * by making a mixed spend (amount above the smart-account balance, covered by
 * card collateral): one passkey tap, and PostHog shows
 * session_key_spend_attempted without a _fallback.
 */

import { useState } from 'react'
import { Button } from '@/components/0_Bruddle/Button'
import {
    SESSION_KEY_SPEND_BUILD_ENABLED,
    SESSION_KEY_SPEND_FLAG,
    sessionKeySpendDeviceOptIn,
    setSessionKeySpendDeviceOptIn,
} from '@/constants/session-key-spend.consts'
import { useFeatureFlags } from '@/hooks/useFeatureFlag'
import DevPageShell from '../_components/DevPageShell'

export default function SessionKeySpendPage() {
    const [, setTick] = useState(0)
    const isFlagEnabled = useFeatureFlags()
    const deviceOn = sessionKeySpendDeviceOptIn()
    const flagOn = isFlagEnabled(SESSION_KEY_SPEND_FLAG)
    const effective = SESSION_KEY_SPEND_BUILD_ENABLED && (deviceOn || flagOn)

    const toggle = () => {
        setSessionKeySpendDeviceOptIn(!deviceOn)
        setTick((t) => t + 1)
    }

    return (
        <DevPageShell
            title="One-tap mixed spend (ephemeral session key)"
            description="Per-transaction session key signs the Rain admin EIP-712 and the UserOp after a single enable-signature passkey tap. Falls back to the two-tap passkey path on any failure."
            width="prose"
        >
            <div className="rounded-sm border border-border-default p-3 text-sm">
                <div>
                    <span className="font-bold">Build gate (NEXT_PUBLIC_SESSION_KEY_SPEND): </span>
                    {SESSION_KEY_SPEND_BUILD_ENABLED ? '✅ on' : '❌ off — this page can only toggle a dead switch'}
                </div>
                <div>
                    <span className="font-bold">PostHog flag ({SESSION_KEY_SPEND_FLAG}) for this user: </span>
                    {flagOn ? '✅ on' : '❌ off'}
                </div>
                <div>
                    <span className="font-bold">Device opt-in: </span>
                    {deviceOn ? '✅ on' : '❌ off'}
                </div>
                <div>
                    <span className="font-bold">Effective: </span>
                    {effective ? '✅ one-tap path active' : '❌ two-tap passkey path'}
                </div>
            </div>

            <Button onClick={toggle} disabled={!SESSION_KEY_SPEND_BUILD_ENABLED}>
                {deviceOn ? 'Disable on this device' : 'Enable on this device'}
            </Button>
        </DevPageShell>
    )
}
