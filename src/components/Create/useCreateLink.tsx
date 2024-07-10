'use client'
import { useCallback, useContext, useEffect, useState, useRef } from 'react'
import peanut, {
    generateKeysFromString,
    getRandomString,
    getRawParamsFromLink,
    interfaces as peanutInterfaces,
} from '@squirrel-labs/peanut-sdk'
import {
    useAccount,
    useSendTransaction,
    useSignTypedData,
    useSwitchChain,
    useConfig,
    usePrepareTransactionRequest,
} from 'wagmi'
import { waitForTransactionReceipt } from 'wagmi/actions'

import { useBalance } from '@/hooks/useBalance'
import * as context from '@/context'
import * as consts from '@/constants'
import * as utils from '@/utils'
import * as _utils from './Create.utils'
import { BigNumber, ethers } from 'ethers'

interface IAssertValuesProps {
    tokenValue: string | undefined
}

export const useCreateLink = () => {
    const { setLoadingState } = useContext(context.loadingStateContext)
    const {
        inputDenomination,
        selectedChainID,
        selectedTokenPrice,
        selectedTokenAddress,
        setSelectedTokenPrice,
        setInputDenomination,
    } = useContext(context.tokenSelectorContext)
    const { balances } = useBalance()

    const { chain: currentChain, address } = useAccount()
    const { switchChainAsync } = useSwitchChain()
    const { signTypedDataAsync } = useSignTypedData()
    const { sendTransactionAsync } = useSendTransaction()
    const config = useConfig()

    // step 1
    const assertValues = async ({ tokenValue }: IAssertValuesProps) => {
        // if inputDenomination is USD, the tokenPrice has to be defineds
        if (inputDenomination == 'USD') {
            if (!selectedTokenPrice) {
                try {
                    const _selectedTokenPrice = await utils.fetchTokenPrice(selectedTokenAddress, selectedChainID)
                    setSelectedTokenPrice(_selectedTokenPrice?.price)
                } catch (error) {
                    setInputDenomination('TOKEN')
                    throw new Error(
                        'Something went wrong while fetching the token price. Please change the input denomination and try again'
                    )
                }
            }
        }

        // the selectedChainID and selectedTokenAddress have to be defined
        if (!selectedChainID && !selectedTokenAddress) {
            throw new Error('Please ensure that the correct token and chain are defined')
        }

        // if the userbalances are know, the user must have a balance of the selected token
        if (balances.length > 0) {
            let balance = balances.find(
                (balance) =>
                    utils.compareTokenAddresses(balance.address, selectedTokenAddress) &&
                    balance.chainId === selectedChainID
            )?.amount
            if (!balance) {
                balance = Number(
                    await peanut.getTokenBalance({
                        tokenAddress: selectedTokenAddress,
                        chainId: selectedChainID,
                        walletAddress: address ?? '',
                    })
                )
            }
            if (!balance || (balance && balance <= Number(tokenValue))) {
                throw new Error('Please ensure that you have sufficient balance of the token you are trying to send')
            }
        }

        // the selected tokenvalue has to be a number higher then .0001
        if (!tokenValue || (tokenValue && Number(tokenValue) < 0.0001)) {
            throw new Error('The minimum amount to send is 0.0001')
        }
    }
    const generateLinkDetails = ({
        tokenValue,
        walletType,
        envInfo,
    }: {
        tokenValue: string | undefined
        walletType: 'blockscout' | undefined
        envInfo: any
    }) => {
        try {
            // get tokenDetails (type and decimals)
            const tokenDetails = _utils.getTokenDetails(selectedTokenAddress, selectedChainID, balances)

            // baseUrl
            let baseUrl = ''
            if (walletType === 'blockscout') {
                baseUrl = `${envInfo.origin}/apps/peanut-protocol`
            } else if (typeof window !== 'undefined') {
                baseUrl = `${window.location.origin}/claim`
            }

            // create linkDetails and save to state
            const linkDetails = {
                chainId: selectedChainID,
                tokenAmount: parseFloat(Number(tokenValue).toFixed(6)),
                tokenType: tokenDetails.tokenType,
                tokenAddress: selectedTokenAddress,
                tokenDecimals: tokenDetails.tokenDecimals,
                baseUrl: baseUrl,
                trackId: 'ui',
            }

            return linkDetails
        } catch (error) {
            console.log(error)
            throw new Error('Error getting the linkDetails.')
        }
    }
    const generatePassword = async () => {
        try {
            //generate password and save to state
            const password = await getRandomString(16)

            return password
        } catch (error) {
            console.log(error)
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
        [address, selectedChainID, selectedTokenAddress, balances]
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

                const prepareTxsResponse = await peanut.prepareTxs({
                    address: address ?? '',
                    linkDetails: _linkDetails,
                    passwords: [_password],
                })

                return prepareTxsResponse
            } catch (error) {
                throw error
            }
        },
        [address, selectedChainID, selectedTokenAddress, balances]
    )
    const switchNetwork = async (chainId: string) => {
        if (currentChain?.id.toString() !== chainId.toString()) {
            setLoadingState('Allow network switch')
            try {
                await switchChainAsync({ chainId: Number(chainId) })
                setLoadingState('Switching network')
                await new Promise((resolve) => setTimeout(resolve, 2000))
                setLoadingState('Loading')
            } catch (error) {
                throw new Error('Error switching network.')
            }
        }
    }
    const estimateGasFee = async ({ chainId, preparedTx }: { chainId: string; preparedTx: any }) => {
        try {
            const feeOptions = await peanut.setFeeOptions({
                chainId: chainId,
                unsignedTx: preparedTx,
            })

            let transactionCostWei = feeOptions.gasLimit.mul(feeOptions.maxFeePerGas || feeOptions.gasPrice)
            let transactionCostNative = ethers.utils.formatEther(transactionCostWei)
            const nativeTokenPrice = await utils.fetchTokenPrice('0x0000000000000000000000000000000000000000', chainId)
            const transactionCostUSD = Number(transactionCostNative) * nativeTokenPrice?.price

            return {
                feeOptions,
                transactionCostUSD,
            }
        } catch (error) {
            throw error
        }
    }
    const estimatePoints = async ({
        chainId,
        preparedTx,
        address,
        amountUSD,
        actionType,
    }: {
        chainId: string
        preparedTx: any // This could be detailed further depending on the transaction structure
        address: string
        amountUSD: number
        actionType: 'CREATE' | 'TRANSFER'
    }) => {
        try {
            const response = await fetch('https://api.staging.peanut.to/calculate-pts-for-action', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    actionType: actionType,
                    amountUsd: amountUSD,
                    transaction: preparedTx
                        ? {
                              from: preparedTx.from ? preparedTx.from.toString() : address,
                              to: preparedTx.to ? preparedTx.to.toString() : '',
                              data: preparedTx.data ? preparedTx.data.toString() : '',
                              value: preparedTx.value ? preparedTx.value.toString() : '',
                          }
                        : undefined,
                    chainId: chainId,
                    userAddress: address,
                }),
            })

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`)
            }
            const data = await response.json()
            return Math.round(data.points)
        } catch (error) {
            console.error('Failed to estimate points:', error)
            return 0 // Returning 0 or another error handling strategy could be implemented here
        }
    }
    const submitClaimLinkInit = async ({
        attachmentOptions,
        password,
        senderAddress,
    }: {
        password: string
        attachmentOptions: {
            message?: string
            attachmentFile?: File
        }
        senderAddress: string
    }) => {
        try {
            const formData = new FormData()
            formData.append('password', password)
            formData.append('attachmentOptions', JSON.stringify(attachmentOptions))
            formData.append('senderAddress', senderAddress)

            if (attachmentOptions.attachmentFile) {
                formData.append('attachmentFile', attachmentOptions.attachmentFile)
            }

            const response = await fetch('/api/peanut/submit-claim-link/init', {
                method: 'POST',
                body: formData,
            })

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`)
            }
            const data = await response.json()

            return data
        } catch (error) {
            console.error('Failed to publish file (init):', error)
            return ''
        }
    }
    const submitClaimLinkConfirm = async ({
        link,
        password,
        txHash,
        chainId,
        senderAddress,
        amountUsd,
        transaction,
    }: {
        link: string
        password: string
        txHash: string
        chainId: string
        senderAddress: string
        amountUsd: number
        transaction?: peanutInterfaces.IPeanutUnsignedTransaction
    }) => {
        try {
            const response = await fetch('/api/peanut/submit-claim-link/confirm', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    link,
                    password,
                    txHash,
                    chainId,
                    senderAddress: senderAddress,
                    amountUsd,
                    transaction: transaction
                        ? { ...transaction, value: transaction?.value && transaction.value.toString() }
                        : undefined,
                }),
            })

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`)
            }
        } catch (error) {
            console.error('Failed to publish file (complete):', error)
            return ''
        }
    }
    const submitDirectTransfer = async ({
        txHash,
        chainId,
        senderAddress,
        amountUsd,
        transaction,
    }: {
        txHash: string
        chainId: string
        senderAddress: string
        amountUsd: number
        transaction?: peanutInterfaces.IPeanutUnsignedTransaction
    }) => {
        try {
            const response = await fetch('/api/peanut/submit-direct-transfer', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    txHash,
                    chainId,
                    senderAddress: senderAddress,
                    amountUsd,
                    transaction: {
                        ...transaction,
                        value:
                            transaction?.value && transaction.value !== BigInt(0)
                                ? transaction.value.toString()
                                : undefined,
                    },
                }),
            })

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`)
            }
        } catch (error) {
            console.error('Failed to publish file (complete):', error)
            return ''
        }
    }
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

        if (!utils.isNativeCurrency(tokenAddress)) {
            // ERC20 Token transfer
            const erc20Contract = new ethers.Contract(tokenAddress, peanut.ERC20_ABI)
            const amount = ethers.utils.parseUnits(tokenValue, tokenDecimals)
            const data = erc20Contract.interface.encodeFunctionData('transfer', [recipient, amount])

            transactionRequest = {
                to: tokenAddress,
                data,
                value: BigInt(0), // Convert to BigInt
            }
        } else {
            // Native token transfer
            tokenValue = Number(tokenValue).toFixed(7)
            const amount = ethers.utils.parseEther(tokenValue).toBigInt() // Convert to BigInt
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
                    chainId: Number(gaslessMessage.domain.chainId), //TODO: non-evm chains wont work
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
                baseUrl: `${consts.next_proxy_url}/deposit-3009`,
                APIKey: 'doesnt-matter',
            }) //TODO: for safe app, check if this tx hash is correct
            return response.txHash
        } catch (error) {
            throw error
        }
    }
    const sendTransactions = useCallback(
        async ({
            preparedDepositTxs,
            feeOptions,
        }: {
            preparedDepositTxs: peanutInterfaces.IPrepareDepositTxsResponse
            feeOptions: any | undefined
        }) => {
            try {
                if (!preparedDepositTxs) return

                let idx = 0
                const signedTxsResponse: string[] = []
                for (const tx of preparedDepositTxs.unsignedTxs) {
                    setLoadingState('Sign in wallet')

                    // Set fee options using our SDK
                    if (!feeOptions) {
                        try {
                            feeOptions = await peanut.setFeeOptions({
                                chainId: selectedChainID,
                            })
                        } catch (error: any) {
                            console.log('error setting fee options, fallback to default')
                        }
                    }
                    console.log(tx.value)

                    // Send the transaction using wagmi
                    let hash = await sendTransactionAsync({
                        to: (tx.to ? tx.to : '') as `0x${string}`,
                        value: tx.value ? BigInt(tx.value.toString()) : undefined,
                        data: tx.data ? (tx.data as `0x${string}`) : undefined,
                        gas: feeOptions?.gas ? BigInt(feeOptions.gas.toString()) : undefined,
                        gasPrice: feeOptions?.gasPrice ? BigInt(feeOptions.gasPrice.toString()) : undefined,
                        maxFeePerGas: feeOptions?.maxFeePerGas
                            ? BigInt(feeOptions?.maxFeePerGas.toString())
                            : undefined,
                        maxPriorityFeePerGas: feeOptions?.maxPriorityFeePerGas
                            ? BigInt(feeOptions?.maxPriorityFeePerGas.toString())
                            : undefined,
                        chainId: Number(selectedChainID), //TODO: chainId as number here
                    })

                    setLoadingState('Executing transaction')

                    // if (walletType === 'safe') {
                    //     const sdk = new SafeAppsSDK({
                    //         allowedDomains: [/app.safe.global$/, /.*\.blockscout\.com$/],
                    //         debug: true,
                    //     })
                    //     while (true) {
                    //         const queued = await sdk.txs.getBySafeTxHash(hash)

                    //         if (
                    //             queued.txStatus === TransactionStatus.AWAITING_CONFIRMATIONS ||
                    //             queued.txStatus === TransactionStatus.AWAITING_EXECUTION
                    //         ) {
                    //             console.log('waiting for safe tx')

                    //             await new Promise((resolve) => setTimeout(resolve, 1000))
                    //         } else if (queued.txHash) {
                    //             hash = queued.txHash as `0x${string}`
                    //             break
                    //         }
                    //     }
                    // } // TODO: fix this when we decide to continue work on the safe app. Also do this within the gaslessDeposit stuff

                    // Wait for the transaction to be mined using wagmi/actions
                    // Only doing this for the approval transaction (the first tx)
                    // Includes retry logic. If the hash isnt available yet, it retries after .5 seconds for 3 times
                    if (preparedDepositTxs.unsignedTxs.length === 2 && idx === 0) {
                        for (let attempt = 0; attempt < 3; attempt++) {
                            try {
                                await waitForTransactionReceipt(config, {
                                    confirmations: 4,
                                    hash: hash,
                                    chainId: Number(selectedChainID),
                                })
                                break
                            } catch (error) {
                                if (attempt < 2) {
                                    await new Promise((resolve) => setTimeout(resolve, 500))
                                } else {
                                    console.error('Failed to wait for transaction receipt after 3 attempts', error)
                                }
                            }
                        }
                    }

                    signedTxsResponse.push(hash.toString())
                    idx++
                }

                return signedTxsResponse[signedTxsResponse.length - 1]
            } catch (error) {
                throw error
            }
        },
        [selectedChainID, sendTransactionAsync, config]
    )
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
            const getLinksFromTxResponse = await peanut.getLinksFromTx({
                linkDetails,
                txHash: hash,
                passwords: [password],
            })
            let links: string[] = getLinksFromTxResponse.links

            if (walletType === 'blockscout') {
                const _link = links[0]
                const urlObj = new URL(_link)
                urlObj.searchParams.append('path', 'claim')
                const newUrl = urlObj.toString()
                links = [newUrl]
            }
            return links
        } catch (error) {
            throw error
        }
    }

    return {
        assertValues,
        generateLinkDetails,
        generatePassword,
        makeGaslessDepositPayload,
        signTypedData,
        makeDepositGasless,
        prepareDepositTxs,
        sendTransactions,
        getLinkFromHash,
        switchNetwork,
        estimateGasFee,
        estimatePoints,
        submitClaimLinkInit,
        submitClaimLinkConfirm,
        prepareDirectSendTx,
        submitDirectTransfer,
    }
}
