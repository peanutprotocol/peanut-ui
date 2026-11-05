'use client'

import { useEffect } from 'react'
import { http } from 'viem'
import { createBundlerClient, entryPoint07Abi } from 'viem/account-abstraction'
import { PUBLIC_CLIENTS_BY_CHAIN } from '@/app/actions/clients'
import { ZERODEV_RPC_TIMEOUT_MS } from '@/constants/zerodev.consts'
import { useAuth } from '@/context/authContext'
import { AccountType } from '@/interfaces/interfaces'
import { isDemoMode } from '@/utils/demo'
import {
    retryDeferredSignupTestTransaction,
    type DeferredSignupTestTxBundler,
} from './deferred-signup-test-transaction'
import { readSignupTestTransaction } from './signup-test-transaction'
import { sendSignedUserOperation } from '@/utils/userop-submission'

const attempted = new Set<string>()

function bundlerFor(chainId: number): DeferredSignupTestTxBundler | null {
    const config = PUBLIC_CLIENTS_BY_CHAIN[chainId]
    if (!config?.bundlerUrl) return null
    const bundler = createBundlerClient({
        chain: config.chain,
        transport: http(config.bundlerUrl, { timeout: ZERODEV_RPC_TIMEOUT_MS }),
        pollingInterval: 1_000,
    })
    return {
        send: (record) => sendSignedUserOperation(bundler, record.userOperation, record.entryPoint),
        waitForReceipt: (hash, timeout) => bundler.waitForUserOperationReceipt({ hash, timeout }),
        getReceipt: (hash) =>
            bundler.getUserOperationReceipt({ hash }).catch((error: unknown) => {
                if ((error as Error)?.name === 'UserOperationReceiptNotFoundError') return null
                throw error
            }),
        nonceSpent: async (record) => {
            const nonce = BigInt(record.userOperation.nonce)
            const next = await config.client.readContract({
                address: record.entryPoint,
                abi: entryPoint07Abi,
                functionName: 'getNonce',
                args: [record.sender, nonce >> 64n],
            })
            return next > nonce
        },
    }
}

/**
 * Once per app start, resends a signup confirmation the person finished
 * without (the final signup step after repeated network failures). The signed
 * operation is reused, so this never shows a passkey prompt.
 */
export function useDeferredSignupTestTransactionRetry() {
    const { user } = useAuth()
    const userId = user?.user.userId
    const hasWallet = !!user?.accounts.some((account) => account.type === AccountType.PEANUT_WALLET)

    useEffect(() => {
        if (!userId || !hasWallet || isDemoMode() || attempted.has(userId)) return
        const record = readSignupTestTransaction(userId)
        if (!record?.deferred) return
        const bundler = bundlerFor(record.chainId)
        if (!bundler) return
        attempted.add(userId)
        void retryDeferredSignupTestTransaction(userId, bundler).catch(() => undefined)
    }, [userId, hasWallet])
}
