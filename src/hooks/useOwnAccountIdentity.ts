'use client'

import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/context/authContext'
import { OWN_ACCOUNT_IDENTITY } from '@/constants/query.consts'
import { apiFetch } from '@/utils/api-fetch'
import { type IBridgeAccount } from '@/interfaces/interfaces'

/** The address the bank form asks for, in the form's own field names. */
export interface OwnAccountAddress {
    street: string
    city: string
    state: string
    postalCode: string
}

export interface OwnAccountIdentity {
    /** The verified name on the account, or null when we do not hold one. */
    ownerName: string | null
    /** The address the user gave for an earlier payout, or null. */
    address: OwnAccountAddress | null
    /** True while the address is still being read. */
    isLoading: boolean
}

/** Bridge wants a first and a last name, so one word is not a name we can use. */
function usableName(fullName: string | null | undefined): string | null {
    const trimmed = (fullName ?? '').trim()
    return trimmed.split(/\s+/).filter(Boolean).length >= 2 ? trimmed : null
}

function addressOf(account: IBridgeAccount): OwnAccountAddress | null {
    const address = account.address
    // Street, city and postal code are all required by the form, so a partial
    // address prefills nothing: half a form is worse than an empty one, because
    // the user has to find which half is missing.
    if (!address?.street_line_1 || !address.city || !address.postal_code) return null
    return {
        street: address.street_line_1,
        city: address.city,
        state: address.state ?? '',
        postalCode: address.postal_code,
    }
}

/**
 * What the app already knows about the person's own payout details.
 *
 * The name is the verified one on the profile — a bank payout needs an approved
 * identity check, so every user who reaches this form has it. The address is the
 * one they gave with an earlier payout account of their own, read back from
 * their own accounts; a first-time payout has none and the fields stay empty.
 *
 * Both are the user's own data, read in the user's own session. Nothing here
 * reaches a third party, and nothing is written.
 */
export function useOwnAccountIdentity(enabled: boolean = true): OwnAccountIdentity {
    const { user } = useAuth()
    const bridgeCustomerId = user?.user.bridgeCustomerId ?? null

    const { data, isLoading } = useQuery({
        queryKey: [OWN_ACCOUNT_IDENTITY, bridgeCustomerId],
        enabled: enabled && !!bridgeCustomerId,
        // The answer is a past payout address; it does not change while a form
        // is open, and re-reading it on every focus would spend a provider call.
        staleTime: 5 * 60 * 1000,
        retry: false,
        queryFn: async (): Promise<OwnAccountAddress | null> => {
            const response = await apiFetch(`/bridge/customers/${bridgeCustomerId}/external-accounts`, {
                method: 'GET',
            })
            if (!response.ok) return null
            const accounts: IBridgeAccount[] = await response.json()
            if (!Array.isArray(accounts)) return null
            // Any of the user's own accounts answers; the first complete one wins.
            for (const account of accounts) {
                const address = addressOf(account)
                if (address) return address
            }
            return null
        },
    })

    return useMemo(
        () => ({
            ownerName: usableName(user?.user.fullName),
            address: data ?? null,
            isLoading: enabled && !!bridgeCustomerId && isLoading,
        }),
        [user?.user.fullName, data, isLoading, enabled, bridgeCustomerId]
    )
}
