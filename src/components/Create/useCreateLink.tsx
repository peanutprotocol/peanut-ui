'use client'
import { getLinkFromTx, getNextDepositIndex } from '@/app/actions/claimLinks'
import { PEANUT_WALLET_CHAIN, PEANUT_WALLET_TOKEN, next_proxy_url } from '@/constants'
import { loadingStateContext, tokenSelectorContext } from '@/context'
import { isNativeCurrency, saveToLocalStorage } from '@/utils'
import peanut, {
    generateKeysFromString,
    getLatestContractVersion,
    getLinkFromParams,
    getRandomString,
    interfaces as peanutInterfaces,
} from '@squirrel-labs/peanut-sdk'
import { useCallback, useContext } from 'react'
import type { Hash, Address } from 'viem'
import { bytesToNumber, encodeFunctionData, parseAbi, parseEther, parseEventLogs, parseUnits, toBytes } from 'viem'
import { useSignTypedData } from 'wagmi'

import { useZeroDev } from '@/hooks/useZeroDev'
import { useWallet } from '@/hooks/wallet/useWallet'

export const useCreateLink = () => {
    const { setLoadingState } = useContext(loadingStateContext)
    const { selectedChainID } = useContext(tokenSelectorContext)

    const { address } = useWallet()
    const { signTypedDataAsync } = useSignTypedData()
    const { handleSendUserOpEncoded } = useZeroDev()

    const generatePassword = async () => {
        try {
            //generate password and save to state
            const password = await getRandomString(16)

            return password
        } catch (error) {
            console.error('error generating password', error)
            throw new Error('Error generating the password.')
        }
    }
    const makeGaslessDepositPayload = useCallback(
        async ({
            _linkDetails,
            _password,
        }: {
            _linkDetails: peanutInterfaces.IPeanutLinkDetails | undefined
            _password: string | undefined
        }) => {
            try {
                if (!_linkDetails || !_password) return

                const latestContractVersion = peanut.getLatestContractVersion({
                    chainId: selectedChainID,
                    type: 'normal',
                })

                const { payload, message } = await peanut.makeGaslessDepositPayload({
                    linkDetails: _linkDetails,
                    password: _password,
                    address: address ?? '',
                    contractVersion: latestContractVersion,
                })

                return { payload, message }
            } catch (error) {
                throw error
            }
        },
        [address, selectedChainID]
    )
    const prepareDepositTxs = useCallback(
        async ({
            _linkDetails,
            _password,
        }: {
            _linkDetails: peanutInterfaces.IPeanutLinkDetails | undefined
            _password: string | undefined
        }) => {
            try {
                if (!_linkDetails || !_password) return

                const prepareTxsResponse = await peanut.prepareDepositTxs({
                    address: address ?? '',
                    linkDetails: _linkDetails,
                    passwords: [_password],
                })

                return prepareTxsResponse
            } catch (error) {
                throw error
            }
        },
        [address]
    )

    const prepareDirectSendTx = ({
        recipient,
        tokenValue,
        tokenAddress,
        tokenDecimals,
    }: {
        recipient: string
        tokenValue: string
        tokenAddress: string
        tokenDecimals: number
    }) => {
        let transactionRequest

        if (!isNativeCurrency(tokenAddress)) {
            // ERC20 Token transfer
            const amount = parseUnits(tokenValue, tokenDecimals)
            const data = encodeFunctionData({
                abi: peanut.ERC20_ABI,
                functionName: 'transfer',
                args: [recipient, amount],
            })

            transactionRequest = {
                to: tokenAddress,
                data,
                value: 0n,
            }
        } else {
            // Native token transfer
            tokenValue = Number(tokenValue).toFixed(7)
            const amount = parseEther(tokenValue)
            transactionRequest = {
                to: recipient,
                value: amount,
            }
        }

        return transactionRequest
    }

    // step 2
    const signTypedData = async ({ gaslessMessage }: { gaslessMessage: peanutInterfaces.IPreparedEIP712Message }) => {
        try {
            const signature = await signTypedDataAsync({
                domain: {
                    ...gaslessMessage.domain,
                    chainId: Number(gaslessMessage.domain.chainId), //TODO: (mentioning) non-evm chains wont work
                    verifyingContract: gaslessMessage.domain.verifyingContract as `0x${string}`,
                },
                types: gaslessMessage.types,
                primaryType: gaslessMessage.primaryType,
                message: {
                    ...gaslessMessage.values,
                    value: BigInt(gaslessMessage.values.value),
                    validAfter: BigInt(gaslessMessage.values.validAfter),
                    validBefore: BigInt(gaslessMessage.values.validBefore),
                },
            })
            return signature
        } catch (error) {
            throw error
        }
    }
    const makeDepositGasless = async ({
        signature,
        payload,
    }: {
        signature: string
        payload: peanutInterfaces.IGaslessDepositPayload
    }) => {
        try {
            const response = await peanut.makeDepositGasless({
                payload: payload,
                signature: signature,
                baseUrl: `${next_proxy_url}/deposit-3009`,
                APIKey: 'doesnt-matter',
            })
            return response.txHash
        } catch (error) {
            throw error
        }
    }

    const getLinkFromHash = async ({
        hash,
        linkDetails,
        password,
        walletType,
    }: {
        hash: string
        linkDetails: peanutInterfaces.IPeanutLinkDetails
        password: string
        walletType: 'blockscout' | undefined
    }) => {
        try {
            let link = await getLinkFromTx({ linkDetails, txHash: hash, password })

            if (walletType === 'blockscout') {
                const _link = link
                const urlObj = new URL(_link)
                urlObj.searchParams.append('path', 'claim')
                const newUrl = urlObj.toString()
                link = newUrl
            }
            return link
        } catch (error) {
            throw error
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
            const contractAbi = peanut.getContractAbi(contractVersion)
            const contractAddress: Address = peanut.getContractAddress(
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
            const [nextIndex, { receipt }] = await Promise.all([
                getNextDepositIndex(contractVersion),
                handleSendUserOpEncoded(
                    [
                        { to: tokenAddress, value: 0n, data: approveData },
                        { to: contractAddress, value: 0n, data: makeDepositData },
                    ],
                    chainId
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
        [handleSendUserOpEncoded]
    )

    return {
        generatePassword,
        makeGaslessDepositPayload,
        signTypedData,
        makeDepositGasless,
        prepareDepositTxs,
        getLinkFromHash,
        prepareDirectSendTx,
        createLink,
    }
}
