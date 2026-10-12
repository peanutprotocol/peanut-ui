'use client'

import { useCallback, useEffect, useRef } from 'react'
import type { Hex } from 'viem'
import { useKernelClient } from '@/context/kernelClient.context'
import { useZeroDev } from '@/hooks/useZeroDev'
import { PEANUT_WALLET_CHAIN } from '@/constants/zerodev.consts'
import { ensureRootValidatorMigrated } from '@/utils/kernelMigration.utils'

const pendingChains = new Set<number>()

export function useMoneriumSigner() {
    const kernel = useKernelClient()
    const { ensureClientForChain, rebuildClientForChain, assertClientOwnedByUser } = kernel
    const latest = useRef(kernel)
    latest.current = kernel
    const mounted = useRef(true)
    useEffect(() => {
        mounted.current = true
        return () => {
            mounted.current = false
        }
    }, [])
    const { handleSendUserOpEncoded } = useZeroDev()
    const pending = useRef(false)
    const signMoneriumMessage = useCallback(
        async (message: string): Promise<Hex> => {
            if (pending.current || pendingChains.has(PEANUT_WALLET_CHAIN.id))
                throw new Error('A signature is already pending')
            pending.current = true
            pendingChains.add(PEANUT_WALLET_CHAIN.id)
            const guard = () => {
                if (
                    !mounted.current ||
                    latest.current.assertClientOwnedByUser !== assertClientOwnedByUser ||
                    latest.current.ensureClientForChain !== ensureClientForChain
                )
                    throw new Error('Wallet session changed')
            }
            try {
                if (!message.trim()) throw new Error('Missing signing message')
                const chainId = PEANUT_WALLET_CHAIN.id.toString()
                const initial = await ensureClientForChain(chainId)
                guard()
                const client = await ensureRootValidatorMigrated({
                    client: initial,
                    sendNoopUserOp: (call) => {
                        guard()
                        return handleSendUserOpEncoded([call], chainId, { returnRevertedReceipt: true })
                    },
                    rebuildClient: () => {
                        guard()
                        return rebuildClientForChain(chainId)
                    },
                })
                guard()
                // Re-read the active client after a potentially long migration.
                // The context performs its current owner check at this boundary.
                const active = await ensureClientForChain(chainId)
                guard()
                assertClientOwnedByUser(active)
                assertClientOwnedByUser(client)
                if (!client.account) throw new Error('Wallet unavailable')
                const signature = await client.account.signMessage({ message })
                guard()
                return signature
            } finally {
                pending.current = false
                pendingChains.delete(PEANUT_WALLET_CHAIN.id)
            }
        },
        [ensureClientForChain, rebuildClientForChain, assertClientOwnedByUser, handleSendUserOpEncoded]
    )
    return { signMoneriumMessage }
}
