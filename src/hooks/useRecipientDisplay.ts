'use client'

import { usePrimaryName } from '@justaname.id/react'
import { useMemo } from 'react'
import { isAddress } from 'viem'

import { resolveRecipientDisplay, type RecipientDisplay, type ResolveRecipientInput } from '@/utils/recipient-display'
import { normalizeEnsName } from '@/utils/ens.utils'

/**
 * Returns a recipient display result without blocking on the ENS lookup:
 * the synchronous resolution (username or printable address) is returned
 * immediately, and the result upgrades to ENS only if a primary name
 * resolves AND no Peanut username was already available. Username always
 * dominates — if we know who the recipient is on Peanut, ENS never wins.
 *
 * ENS resolution is skipped when a username is already known, or when the
 * address isn't a valid EVM address (Solana/Tron/bank-id inputs).
 */
export function useRecipientDisplay(input: Omit<ResolveRecipientInput, 'ensName'>): RecipientDisplay {
    const skipEnsLookup = !!input.user?.username || !isAddress(input.address)

    const { primaryName } = usePrimaryName({
        address: skipEnsLookup ? undefined : (input.address as `0x${string}`),
        chainId: 1,
        priority: 'onChain',
    })

    return useMemo(
        () =>
            resolveRecipientDisplay({
                user: input.user,
                address: input.address,
                ensName: normalizeEnsName(primaryName),
            }),
        [input.user, input.address, primaryName]
    )
}
