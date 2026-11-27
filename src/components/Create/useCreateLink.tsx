'use client'
import { BASE_URL } from '@/constants/general.consts'
import { loadingStateContext } from '@/context/loadingStates.context'
import { saveToLocalStorage } from '@/utils/general.utils'
import { generateKeysFromString, getLinkFromParams, sendLinkPasswordKey } from '@/utils/peanut-link.utils'
import {
    getContractAddress,
    getLatestContractVersion,
    getRandomString,
    peanutVaultAbi,
} from '@/utils/peanut-claim.utils'
import { useCallback, useContext } from 'react'
import type { Address, Hash } from 'viem'
import { encodeFunctionData, parseAbi } from 'viem'

import { useKernelClient } from '@/context/kernelClient.context'
import { useZeroDev } from '@/hooks/useZeroDev'
import { PEANUT_WALLET_CHAIN, PEANUT_WALLET_TOKEN } from '@/constants/zerodev.consts'
import { useWallet } from '@/hooks/wallet/useWallet'
import { sendLinksApi } from '@/services/sendLinks'
import { captureNetworkTriagedFailure } from '@/utils/network-triage'
import { criticalFlowTags } from '@/utils/sentry-critical-flow'
import {
    LinkDepositUnconfirmedError,
    LinkStorageUnavailableError,
    parseLinkDeposit,
    readUserOpFate,
    resolveLinkDeposit,
    UNCONFIRMED_LINK_BLOCK_MS,
    unconfirmedLinkStore,
} from '@/utils/send-link-deposit.utils'
import { withCeremonyFlow } from '@/utils/webauthn-ceremony-telemetry'

/** What the sender attaches to a link. */
interface SendLinkDetails {
    message?: string
    attachment?: File
}

/** A link whose deposit the chain proved. */
interface FundedLink {
    link: string
    pubKey: Address
    chainId: string
    contractVersion: string
    depositIdx: number
    txHash: Hash
    tokenAddress: Address
    amount: bigint
    preparationId?: string
    /** Set when this is an earlier link that landed late, not a new deposit. */
    recovered?: { message?: string }
}

export const useCreateLink = () => {
    const { setLoadingState } = useContext(loadingStateContext)
    const { sendTransactions } = useWallet()
    // The kernel account: the vault records it as the deposit's sender.
    const sender = useZeroDev().address as Address | undefined
    const { getClientForChain } = useKernelClient()

    const generatePassword = async () => {
        try {
            const password = await getRandomString(16)
            return password
        } catch (error) {
            console.error('error generating password', error)
            throw new Error('Error generating the password.')
        }
    }

    /**
     * Settles the last link the app could not confirm, before it funds another
     * (Chip on ui#4296). A landed op comes back as that link, and its record is
     * cleared once the link is recorded. A reverted op clears the record. With
     * no receipt the op may still land, so it blocks a second deposit until
     * UNCONFIRMED_LINK_BLOCK_MS has passed.
     */
    const settleUnconfirmedLink = useCallback(
        async (owner: Address): Promise<FundedLink | null> => {
            const pending = unconfirmedLinkStore.read(owner)
            if (!pending) return null
            const fate = await readUserOpFate(getClientForChain(pending.chainId), pending.userOpHash)
            if (fate.state === 'unknown') {
                if (Date.now() - pending.savedAt < UNCONFIRMED_LINK_BLOCK_MS)
                    throw new LinkDepositUnconfirmedError(pending.pubKey, pending.userOpHash)
                unconfirmedLinkStore.clear(owner)
                return null
            }
            if (fate.state === 'reverted') {
                unconfirmedLinkStore.clear(owner)
                return null
            }

            const vault = getContractAddress(pending.chainId, pending.contractVersion)
            const { depositIdx, txHash } = parseLinkDeposit(fate.receipt, { vault, sender: owner })
            // Saved before the first send, so it is here whenever the record is.
            const password = unconfirmedLinkStore.password(pending) as string
            return {
                link: getLinkFromParams(
                    pending.chainId,
                    pending.contractVersion,
                    depositIdx,
                    password,
                    `${BASE_URL}/claim`
                ),
                pubKey: pending.pubKey,
                chainId: pending.chainId,
                contractVersion: pending.contractVersion,
                depositIdx,
                txHash,
                tokenAddress: pending.tokenAddress,
                amount: BigInt(pending.amount),
                preparationId: pending.preparationId,
                recovered: { message: pending.message },
            }
        },
        [getClientForChain]
    )

    /**
     * Records a proven link with the backend, then clears its unconfirmed
     * record. A recovered link keeps its own note; its attachment was never saved.
     */
    const recordLink = useCallback(
        async (funded: FundedLink, { message, attachment }: SendLinkDetails) => {
            setLoadingState('Creating link')
            const { link, recovered, ...deposit } = funded
            const details: SendLinkDetails = recovered ? { message: recovered.message } : { message, attachment }
            try {
                await sendLinksApi.persist({
                    ...deposit,
                    reference: details.message,
                    attachment: details.attachment,
                    filename: details.attachment?.name,
                    mimetype: details.attachment?.type,
                })
            } catch (error) {
                // The money is in the vault and the link still claims: the API
                // rebuilds a missing row from chain when the link is opened.
                // Hiding the link would hide the only claim URL, so show it and
                // report: the sender's history misses it until support restores it.
                console.error(error)
                void captureNetworkTriagedFailure(error, {
                    tags: { ...criticalFlowTags('send-link'), send_link_step: 'persist' },
                    // Everything support needs to restore the row, preparationId
                    // included: without it a mixed link's Rain intent is not adopted.
                    extra: deposit,
                })
            }
            // Cleared only now: a closed app before this point settles the same
            // link again on the next attempt, and the replayed record is a 409.
            if (sender) unconfirmedLinkStore.clear(sender)
            return {
                link,
                chainId: deposit.chainId,
                tokenAddress: deposit.tokenAddress,
                amount: deposit.amount,
                /** Set when an earlier link came back instead of a new one: its own note. */
                recovered: recovered ? { message: recovered.message } : undefined,
            }
        },
        [sender, setLoadingState]
    )

    /**
     * Brings back an earlier link that landed late, without a new amount or a
     * balance check: run it before them (Chip on ui#4296), because a late
     * deposit can leave too little balance for the amount on screen. Null when
     * there is nothing to settle; throws LinkDepositUnconfirmedError while the
     * earlier op may still land.
     */
    const recoverPendingLink = useCallback(async () => {
        if (!sender || !unconfirmedLinkStore.read(sender)) return null
        setLoadingState('Loading')
        try {
            const funded = await settleUnconfirmedLink(sender)
            return funded ? await recordLink(funded, {}) : null
        } finally {
            setLoadingState('Idle')
        }
    }, [recordLink, sender, setLoadingState, settleUnconfirmedLink])

    /**
     * Funds a link in the vault and records it with the backend before it
     * returns (TASK-24270). The success screen used to show first, so a failed
     * record went unseen. The loading state stays busy the whole time, which
     * is what keeps the view's balance gate and its button quiet.
     *
     * When an earlier link landed late, it returns that link (`recovered`)
     * instead of funding a new one.
     */
    const createLink = useCallback(
        async (amount: bigint, { message, attachment }: SendLinkDetails = {}) => {
            let strategy: string | undefined
            const funded = await withCeremonyFlow(
                'link_create',
                async (): Promise<FundedLink> => {
                    // Checked before any signing: the deposit is matched to its sender.
                    if (!sender) throw new Error('Wallet is not ready')
                    setLoadingState('Loading')
                    const recovered = await settleUnconfirmedLink(sender)
                    if (recovered) return recovered

                    setLoadingState('Generating details')
                    const password = await generatePassword()
                    const { address: pubKey } = generateKeysFromString(password)
                    // Fail closed before signing: see LinkStorageUnavailableError.
                    if (!saveToLocalStorage(sendLinkPasswordKey(pubKey), password))
                        throw new LinkStorageUnavailableError()

                    const chainId = PEANUT_WALLET_CHAIN.id.toString()
                    const contractVersion = getLatestContractVersion({ chainId, type: 'normal' })
                    const tokenAddress = PEANUT_WALLET_TOKEN as Address
                    const vault = getContractAddress(chainId, contractVersion)

                    const approveData = encodeFunctionData({
                        abi: parseAbi(['function approve(address _spender, uint256 _amount) external returns (bool)']),
                        functionName: 'approve',
                        args: [vault, amount],
                    })
                    const makeDepositData = encodeFunctionData({
                        abi: peanutVaultAbi,
                        functionName: 'makeDeposit',
                        args: [tokenAddress, 1, amount, 0n, pubKey],
                    })
                    // Route through sendTransactions with `requiredUsdcAmount` so a Rain
                    // collateral withdraw is prepended to the UserOp when the smart
                    // account is short. Covers the mixed (smart + collateral) case.
                    const { receipt, userOpHash, intentId } = await sendTransactions(
                        [
                            { to: tokenAddress, value: 0n, data: approveData },
                            { to: vault, value: 0n, data: makeDepositData },
                        ],
                        {
                            chainId,
                            requiredUsdcAmount: amount,
                            kind: 'LINK_CREATE',
                            // as soon as routing decides, not when it succeeds — a
                            // cancelled flow still has to be readable by strategy
                            onStrategyDecided: (decided) => {
                                strategy = decided
                            },
                        }
                    )
                    // No receipt yet: put the op on record before the extra wait,
                    // so a retry, or the app after a restart, settles it first.
                    // A send that throws after its broadcast leaves no record
                    // (TASK-25443).
                    if (!receipt && userOpHash) {
                        unconfirmedLinkStore.save(
                            {
                                userOpHash,
                                pubKey,
                                sender,
                                chainId,
                                contractVersion,
                                tokenAddress,
                                amount: amount.toString(),
                                preparationId: intentId,
                                message,
                                savedAt: Date.now(),
                            },
                            password
                        )
                    }
                    // The send is over but a timed-out receipt means one more
                    // wait: keep the screen busy so the link cannot be created twice.
                    setLoadingState('Executing transaction')
                    let deposit: Awaited<ReturnType<typeof resolveLinkDeposit>>
                    try {
                        deposit = await resolveLinkDeposit({
                            receipt,
                            userOpHash,
                            // The bundler finds any op by hash, the session-key one included.
                            receiptWaiter: () => getClientForChain(chainId),
                            vault,
                            sender,
                            pubKey,
                        })
                    } catch (error) {
                        // Only an op that can still land stays on record.
                        if (!(error instanceof LinkDepositUnconfirmedError)) unconfirmedLinkStore.clear(sender)
                        throw error
                    }

                    return {
                        link: getLinkFromParams(
                            chainId,
                            contractVersion,
                            deposit.depositIdx,
                            password,
                            `${BASE_URL}/claim`
                        ),
                        pubKey,
                        chainId,
                        contractVersion,
                        ...deposit,
                        tokenAddress,
                        amount,
                        // Present only for collateral-funded ("mixed") links — the Rain
                        // prepare intent id, threaded to /send-links so the backend
                        // adopts it instead of minting a duplicate SEND_LINK.
                        preparationId: intentId,
                    }
                },
                () => ({ strategy })
            )

            return recordLink(funded, { message, attachment })
        },
        [getClientForChain, recordLink, sendTransactions, sender, setLoadingState, settleUnconfirmedLink]
    )

    return {
        createLink,
        recoverPendingLink,
    }
}
