'use client'

import { useEffect, useRef, useState } from 'react'
import { validateAndResolveRecipient } from '@/lib/validation/recipient'
import type { WithdrawAddressFamily } from '@/lib/validation/addressFamily'
import { useWithdrawFlow } from './WithdrawFlowContext'

/**
 * ENS names resolve per destination chain (ENSIP-11): a validated name has to
 * re-resolve when the user switches chains, or the withdrawal would go to the
 * previous chain's address. Shared by the destination form and the pay screen
 * for a scanned name. The recipient is gated while it resolves; a name that
 * resolves to nothing on the new chain keeps its name, loses its address and
 * says so, so the user can pick another network or type again.
 *
 * Returns true while a resolution is in flight.
 */
export function useEnsRecipientForChain(selectedChainID: string, addressFamily: WithdrawAddressFamily): boolean {
    const { recipient, setRecipient, setIsValidRecipient, setError } = useWithdrawFlow()
    const [isResolving, setIsResolving] = useState(false)
    const prevResolvedChainRef = useRef(selectedChainID)

    useEffect(() => {
        if (prevResolvedChainRef.current === selectedChainID) return
        prevResolvedChainRef.current = selectedChainID
        if (addressFamily !== 'evm' || !recipient.name) return

        const name = recipient.name
        // Gate the send while the previous chain's address is still in state —
        // a tap mid-resolution would send to that address.
        setIsValidRecipient(false)
        setIsResolving(true)
        let stale = false
        validateAndResolveRecipient(name, true, 'evm', selectedChainID)
            .then((validation) => {
                if (stale) return
                setRecipient({ name, address: validation.resolvedAddress })
                setIsValidRecipient(true)
            })
            .catch(() => {
                if (stale) return
                setRecipient({ name, address: '' })
                setIsValidRecipient(false)
                setError({
                    showError: true,
                    errorMessage: 'Could not resolve the ENS name for the selected network',
                })
            })
            .finally(() => {
                if (!stale) setIsResolving(false)
            })
        return () => {
            stale = true
            setIsResolving(false)
        }
    }, [selectedChainID, addressFamily, recipient.name, setRecipient, setIsValidRecipient, setError])

    return isResolving
}
