'use client'
import { getNextDepositIndex } from '@/app/actions/claimLinks'
import { loadingStateContext } from '@/context/loadingStates.context'
import { saveToLocalStorage } from '@/utils/general.utils'
import { generateKeysFromString, getLinkFromParams } from '@/utils/peanut-link.utils'
import {
    getContractAbi,
    getContractAddress,
    getLatestContractVersion,
    getRandomString,
} from '@/utils/peanut-claim.utils'
import { useCallback, useContext } from 'react'
import type { Hash, Address } from 'viem'
import { bytesToNumber, encodeFunctionData, parseAbi, parseEventLogs, toBytes } from 'viem'

import { useZeroDev } from '@/hooks/useZeroDev'
import { PEANUT_WALLET_CHAIN, PEANUT_WALLET_TOKEN } from '@/constants/zerodev.consts'
import { tokenSelectorContext } from '@/context/tokenSelector.context'
import { useWallet } from '@/hooks/wallet/useWallet'
import { useSignTypedData } from 'wagmi'

export const useCreateLink = () => {
    const { setLoadingState } = useContext(loadingStateContext)
    const { selectedChainID } = useContext(tokenSelectorContext)

    const { address, sendTransactions } = useWallet()
    const { signTypedDataAsync } = useSignTypedData()
    const { handleSendUserOpEncoded } = useZeroDev()

    const generatePassword = async () => {
        try {
            const password = await getRandomString(16)
            return password
        } catch (error) {
            console.error('error generating password', error)
            throw new Error('Error generating the password.')
        }
    }

    // @dev TODO: Fix edge case - balance validation should also check loadingState.isLoading
    // Current: NOT tracked by usePendingTransactions + validation doesn't check isLoading
    // Edge case: If user rapidly creates links, insufficient balance error could briefly show
    // Fix: Add isLoading check to Initial.link.send.view.tsx useEffect (line 98)
    // Better: Wrap in useMutation with mutationKey: [BALANCE_DECREASE, SEND_LINK]
    // Priority: Low (rare edge case in less common flow)
    const createLink = useCallback(
        async (amount: bigint) => {
            setLoadingState('Generating details')
            const password = await generatePassword()
            const generatedKeys = generateKeysFromString(password)
            saveToLocalStorage(`sendLink::password::${generatedKeys.address}`, password)

            const chainId = PEANUT_WALLET_CHAIN.id.toString()
            const contractVersion = getLatestContractVersion({
                chainId,
                type: 'normal',
            })
            const tokenAddress = PEANUT_WALLET_TOKEN as Hash
            const contractAbi = getContractAbi(contractVersion)
            const contractAddress: Address = getContractAddress(
                PEANUT_WALLET_CHAIN.id.toString(),
                contractVersion
            ) as Hash

            const approveData = encodeFunctionData({
                abi: parseAbi(['function approve(address _spender, uint256 _amount) external returns (bool)']),
                functionName: 'approve',
                args: [contractAddress, amount],
            })
            const makeDepositData = encodeFunctionData({
                abi: contractAbi,
                functionName: 'makeDeposit',
                args: [tokenAddress, 1, amount, 0, generatedKeys.address as Hash],
            })
            // Route through sendTransactions with `requiredUsdcAmount` so a Rain
            // collateral withdraw is prepended to the UserOp when the smart
            // account is short. Covers the mixed (smart + collateral) case.
            const [nextIndex, { receipt }] = await Promise.all([
                getNextDepositIndex(contractVersion),
                sendTransactions(
                    [
                        { to: tokenAddress, value: 0n, data: approveData },
                        { to: contractAddress, value: 0n, data: makeDepositData },
                    ],
                    { chainId, requiredUsdcAmount: amount, kind: 'LINK_CREATE' }
                ),
            ])
            let depositIdx: number
            let txHash: Hash | undefined = undefined
            if (receipt !== null) {
                const depositEvent = parseEventLogs({
                    abi: contractAbi,
                    eventName: 'DepositEvent',
                    logs: receipt.logs,
                })[0]
                depositIdx = bytesToNumber(toBytes(depositEvent.topics[1]!))
                txHash = depositEvent.transactionHash
            } else {
                depositIdx = nextIndex
            }

            const link = getLinkFromParams(
                chainId,
                contractVersion,
                depositIdx,
                password,
                `${process.env.NEXT_PUBLIC_BASE_URL!}/claim`,
                undefined
            )
            return {
                link,
                pubKey: generatedKeys.address,
                chainId,
                contractVersion,
                depositIdx,
                txHash,
                amount,
                tokenAddress,
            }
        },
        [sendTransactions]
    )

    return {
        createLink,
    }
}
