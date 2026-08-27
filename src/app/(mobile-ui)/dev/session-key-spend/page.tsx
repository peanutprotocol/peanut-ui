'use client'

/**
 * Dev page: opt this device into the one-tap mixed spend
 * (SESSION_KEY_SPEND — see src/constants/session-key-spend.consts.ts).
 *
 * The build gate must be on (NEXT_PUBLIC_SESSION_KEY_SPEND=true) or the spend
 * path contains no ephemeral-key code at all; this page then flips the
 * per-device runtime gate. Verify by making a mixed spend (amount above the
 * smart-account balance, covered by card collateral): one passkey tap, and
 * PostHog shows session_key_spend_attempted without a _fallback.
 */

import { useState } from 'react'
import { Button } from '@/components/0_Bruddle/Button'
import { SESSION_KEY_SPEND_BUILD_ENABLED, sessionKeySpendEnabled } from '@/constants/session-key-spend.consts'
import DevPageShell from '../_components/DevPageShell'

const RUNTIME_KEY = '__session_key_spend'

export default function SessionKeySpendPage() {
    const [, setTick] = useState(0)
    const runtimeOn = sessionKeySpendEnabled()

    const toggle = () => {
        if (window.localStorage.getItem(RUNTIME_KEY) === 'true') {
            window.localStorage.removeItem(RUNTIME_KEY)
        } else {
            window.localStorage.setItem(RUNTIME_KEY, 'true')
        }
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
                    <span className="font-bold">Runtime gate (this device): </span>
                    {runtimeOn ? '✅ on' : '❌ off'}
                </div>
            </div>

            <Button onClick={toggle} disabled={!SESSION_KEY_SPEND_BUILD_ENABLED}>
                {runtimeOn ? 'Disable on this device' : 'Enable on this device'}
            </Button>
        </DevPageShell>
    )
}
