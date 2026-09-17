'use client'

import { DepositAccountsFlowContainer } from '@/features/deposit-accounts/components/DepositAccountsFlowContainer'
import { useDepositAccountsEnabled } from '@/features/deposit-accounts/useDepositAccountsEnabled'
import { useFlagsSettled } from '@/hooks/useFlagsSettled'
import { useSafeBack } from '@/hooks/useSafeBack'
import { readReturnTo, RETURN_TO_PARAM } from '@/utils/return-to.utils'
import { useRouter } from 'next/navigation'
import { parseAsString, useQueryState } from 'nuqs'
import { useEffect } from 'react'

/** the same hub without the standing accounts — the bank routes that work today */
const BANK_HUB_HREF = '/add-money?method=bank'

/**
 * Get paid — the deposit-accounts flow entered from the accounts side.
 *
 * It is the same screen `/add-money?method=bank` renders, titled for the job
 * the user came with and opened on their accounts. `?step=`, `?corridor=` and
 * `?returnTo=` mean the same thing on both entries, because both render one
 * flow.
 *
 * Behind the `deposit-accounts` flag: while it is off, anyone who reaches this
 * route by link goes to the bank flow that does work today.
 */
export default function GetPaidPage() {
    const enabled = useDepositAccountsEnabled()
    // An unanswered flag reads as `false`, so redirecting on it would send an
    // enabled user to the legacy flow before PostHog answers.
    const flagsSettled = useFlagsSettled()
    const router = useRouter()

    // The flow is reached from the home Add drawer, from /request, and by
    // direct link. The caller can name where back should go; otherwise the
    // shared handler goes back through real history and falls back to /home.
    const [rawReturnTo] = useQueryState(RETURN_TO_PARAM, parseAsString)
    const returnTo = readReturnTo({ get: (key) => (key === RETURN_TO_PARAM ? rawReturnTo : null) }, '/get-paid')
    const safeBack = useSafeBack('/home')

    useEffect(() => {
        if (flagsSettled && !enabled) router.replace(BANK_HUB_HREF)
    }, [flagsSettled, enabled, router])

    if (!enabled) return null

    return (
        <DepositAccountsFlowContainer
            variant="get-paid"
            onExit={() => (returnTo ? router.push(returnTo) : safeBack())}
        />
    )
}
