'use client'

import { DepositAccountsFlowContainer } from '@/features/deposit-accounts/components/DepositAccountsFlowContainer'
import { useDepositAccountsEnabled } from '@/features/deposit-accounts/useDepositAccountsEnabled'
import { useFlagsSettled } from '@/hooks/useFlagsSettled'
import { useSafeBack } from '@/hooks/useSafeBack'
import { readReturnTo, RETURN_TO_PARAM } from '@/utils/return-to.utils'
import { useRouter } from 'next/navigation'
import { parseAsString, useQueryState } from 'nuqs'
import { useEffect } from 'react'

/** the one-off bank deposit, which works today on every corridor this flow serves */
const ONE_OFF_TRANSFER_HREF = '/add-money?method=bank'

/**
 * Get paid — the deposit-accounts flow entered from the accounts side.
 *
 * Add money enters the same flow from the country side: pick a country, and a
 * corridor you can hold opens these very screens in place. This route is the
 * shortcut for someone who already knows they want their standing details, and
 * for every link already minted at it — `?step=`, `?corridor=` and `?returnTo=`
 * mean the same thing on both entries, because both render the same flow.
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
        if (flagsSettled && !enabled) router.replace(ONE_OFF_TRANSFER_HREF)
    }, [flagsSettled, enabled, router])

    if (!enabled) return null

    return <DepositAccountsFlowContainer onExit={() => (returnTo ? router.push(returnTo) : safeBack())} />
}
