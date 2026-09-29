'use client'

import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/context/authContext'
import { OWN_ACCOUNT_IDENTITY, VERIFIED_ADDRESS } from '@/constants/query.consts'
import { apiFetch } from '@/utils/api-fetch'
import { verifiedAddressApi } from '@/services/verified-address'
import { type IBridgeAccount } from '@/interfaces/interfaces'

/** The address the bank form asks for, in the form's own field names. */
export interface OwnAccountAddress {
    street: string
    city: string
    state: string
    postalCode: string
    /** ISO 3166-1 alpha-2 where it is known, else null. */
    countryCode: string | null
}

export interface OwnAccountIdentity {
    /** The verified name on the account, or null when we do not hold one. */
    ownerName: string | null
    /** An address we already hold for this person, or null. */
    address: OwnAccountAddress | null
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
        countryCode: address.country ?? null,
    }
}

/**
 * What the app already knows about the person's own payout details.
 *
 * The name is the verified one on the profile — a bank payout needs an approved
 * identity check, so every user who reaches this form has it.
 *
 * The address has two sources, and they are asked in that order:
 *
 *  1. an address the person gave with an EARLIER payout account of their own.
 *     It wins, because the bank already accepted it;
 *  2. failing that, the address on their verified identity, read through
 *     `GET /users/me/verified-address`. That call is made only when the person
 *     says the account is theirs and we have nothing better — never to decorate
 *     a form they are filling in for someone else.
 *
 * Every way of having no answer — no earlier account, no approved identity, a
 * slow provider, a rate limit, an expired session, a deployment without the
 * route, no network — lands on the same result: null, and the form asks, the
 * way it always did. None of them is shown to the user as a failure.
 *
 * Both reads are the user's own data in the user's own session. Nothing is
 * written, nothing reaches a third party, and neither answer is logged,
 * measured or put in the URL.
 */
export function useOwnAccountIdentity(enabled: boolean = true, isOwnAccount: boolean = true): OwnAccountIdentity {
    const { user } = useAuth()
    const bridgeCustomerId = user?.user.bridgeCustomerId ?? null

    const savedAccountsQuery = useQuery({
        queryKey: [OWN_ACCOUNT_IDENTITY, bridgeCustomerId],
        enabled: enabled && !!bridgeCustomerId,
        // The answer is a past payout address; it does not change while a form
        // is open, and re-reading it on every focus would spend a provider call.
        staleTime: 5 * 60 * 1000,
        retry: false,
        queryFn: async ({ signal }): Promise<OwnAccountAddress | null> => {
            const response = await apiFetch(`/bridge/customers/${bridgeCustomerId}/external-accounts`, {
                method: 'GET',
                signal,
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

    const savedAddress = savedAccountsQuery.data ?? null
    // Asked only when the earlier accounts gave nothing AND the person says the
    // account is theirs. The key carries no value of its own, so a second mount
    // (React strict mode, a remount of the form) joins the same request instead
    // of making another.
    const askVerified = enabled && isOwnAccount && !savedAccountsQuery.isLoading && !savedAddress

    const verifiedQuery = useQuery({
        queryKey: [VERIFIED_ADDRESS],
        enabled: askVerified,
        queryFn: ({ signal }) => verifiedAddressApi.get(signal),
        // One read per form open. Nothing about a verified address changes while
        // the form is on screen, so nothing may refetch it behind the user.
        staleTime: Infinity,
        refetchOnMount: false,
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
        // A refused or rate-limited read is an answer, not something to hammer.
        retry: false,
    })

    const verifiedAddress = useMemo((): OwnAccountAddress | null => {
        const verified = verifiedQuery.data
        if (!verified) return null
        return {
            street: verified.streetLine1,
            city: verified.city,
            state: verified.subdivisionCode ?? '',
            postalCode: verified.postalCode,
            countryCode: verified.countryCode,
        }
    }, [verifiedQuery.data])

    return useMemo(
        () => ({
            ownerName: usableName(user?.user.fullName),
            address: savedAddress ?? verifiedAddress,
        }),
        [user?.user.fullName, savedAddress, verifiedAddress]
    )
}
