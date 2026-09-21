'use client'

import { useCapabilities } from '@/hooks/useCapabilities'
import { useMemo } from 'react'
import { corridorsFromRails } from './rails'
import type { DepositCorridor } from './types'

/**
 * The corridors this user has a bank rail for, without asking for the accounts
 * they hold.
 *
 * The add-money country pick needs this one answer to decide where a country
 * leads, and it needs it before any account is fetched. `useDepositAccounts`
 * answers the same question on its way to a much bigger one, so the country
 * list would pay for an accounts request it never reads. Capabilities are
 * already on the user object, so this costs nothing.
 */
export function useOfferedCorridors(): DepositCorridor[] {
    const { rails } = useCapabilities()
    return useMemo(() => corridorsFromRails(rails), [rails])
}
