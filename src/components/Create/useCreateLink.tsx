'use client'
import { PEANUT_API_URL, next_proxy_url } from '@/constants'
import { loadingStateContext, tokenSelectorContext } from '@/context'
import { useWalletType } from '@/hooks/useWalletType'
import { balanceByToken, fetchTokenPrice, isNativeCurrency, saveCreatedLinkToLocalStorage } from '@/utils'
import { switchNetwork as switchNetworkUtil } from '@/utils/general.utils'
import peanut, { getRandomString, interfaces as peanutInterfaces } from '@squirrel-labs/peanut-sdk'
import { BigNumber, ethers } from 'ethers'
import { useCallback, useContext } from 'react'
import { formatEther, parseEther, parseUnits } from 'viem'
import { useAccount, useConfig, useSendTransaction, useSignTypedData, useSwitchChain } from 'wagmi'
import { waitForTransactionReceipt } from 'wagmi/actions'
import { getTokenDetails, isGaslessDepositPossible } from './Create.utils'

interface ICheckUserHasEnoughBalanceProps {
    tokenValue: string | undefined
    gasAmount?: number
}

import { Hex } from 'viem'

import { useZeroDev } from '@/hooks/useZeroDev'
import { useWallet } from '@/hooks/wallet/useWallet'
import { WalletProviderType } from '@/interfaces'

export const useCreateLink = () => {
    const { setLoadingState } = useContext(loadingStateContext)
    const { selectedChainID, selectedTokenData, selectedTokenAddress } = useContext(tokenSelectorContext)

    const { chain: currentChain, address, selectedWallet, refetchBalances } = useWallet()
    const { connector } = useAccount()
    const { switchChainAsync } = useSwitchChain()
    const { signTypedDataAsync } = useSignTypedData()
    const { sendTransactionAsync } = useSendTransaction()
    const config = useConfig()
    const { walletType, environmentInfo } = useWalletType()

    const isActiveWalletPW = selectedWallet?.walletProviderType === WalletProviderType.PEANUT
    const isActiveWalletBYOW = selectedWallet?.walletProviderType === WalletProviderType.BYOW

    const { handleSendUserOpEncoded } = useZeroDev()

    // step 1
    const checkUserHasEnoughBalance = useCallback(
        async ({ tokenValue, gasAmount }: ICheckUserHasEnoughBalanceProps) => {
            // the selectedChainID and selectedTokenAddress have to be defined
            if (!selectedChainID || !selectedTokenAddress) {
                throw new Error('Please ensure that the correct token and chain are defined')
            }
            // if the userbalances are know, the user must have a balance of the selected token
            if ((selectedWallet?.balances?.length ?? 0) > 0) {
                let balanceAmount = balanceByToken(
                    selectedWallet!.balances!,
                    selectedChainID,
                    selectedTokenAddress
                )?.amount

                // consider gas fees in the balance check for native/non-stable tokens
                const totalNativeTokenAmount =
                    isNativeCurrency(selectedTokenAddress) && gasAmount
                        ? Number(tokenValue) + gasAmount
                        : Number(tokenValue)

                if (!balanceAmount || (balanceAmount && balanceAmount < totalNativeTokenAmount)) {
                    throw new Error(
                        'Please ensure that you have sufficient balance of the token you are trying to send'
                    )
                }
            }

            // the selected tokenvalue has to be a number higher then .0001
            if (!tokenValue || (tokenValue && Number(tokenValue) < 0.000001)) {
                throw new Error('The minimum amount to send is 0.000001')
            }
        },
        [selectedChainID, selectedTokenAddress, selectedWallet?.balances, address]
    )

    const generateLinkDetails = useCallback(
        ({
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
                const tokenDetails = getTokenDetails(
                    selectedTokenAddress,
                    selectedChainID,
                    selectedWallet?.balances ?? []
                )

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
                console.error('error generating linkdetails', error)
                throw new Error('Error getting the linkDetails.')
            }
        },
        [selectedTokenAddress, selectedChainID, selectedWallet?.balances]
    )

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
    const switchNetwork = async (chainId: string) => {
        try {
            await switchNetworkUtil({
                chainId,
                currentChainId: String(currentChain?.id),
                setLoadingState,
                switchChainAsync: async ({ chainId }) => {
                    await switchChainAsync({ chainId: chainId as number })
                },
            })
            console.log(`Switched to chain ${chainId}`)
        } catch (error) {
            console.error('Failed to switch network:', error)
        }
    }
    const isSafeConnector = (connector?: { name?: string }): boolean => {
        const name = connector?.name
        if (!name) return false
        return name.toLowerCase().includes('safe')
    }
    const estimateGasFee = useCallback(async ({ chainId, preparedTx }: { chainId: string; preparedTx: any }) => {
        // Return early with default values for Safe connector
        // TODO: request / cashout flows abstract this
        // requirement for internut (injects AA with zero gas fees)
        if (isSafeConnector({ name: connector?.name })) {
            return {
                feeOptions: {
                    gasLimit: BigInt(0),
                    maxFeePerGas: BigInt(0),
                    gasPrice: BigInt(0),
                },
                transactionCostUSD: 0,
            }
        }
        try {
            const feeOptions = await peanut.setFeeOptions({
                chainId: chainId,
                unsignedTx: preparedTx,
            })

            let transactionCostWei = feeOptions.gasLimit.mul(feeOptions.maxFeePerGas || feeOptions.gasPrice)
            let transactionCostNative = formatEther(transactionCostWei)
            const nativeTokenPrice = await fetchTokenPrice('0x0000000000000000000000000000000000000000', chainId)
            if (!nativeTokenPrice || typeof nativeTokenPrice.price !== 'number' || isNaN(nativeTokenPrice.price)) {
                throw new Error('Failed to fetch token price')
            }
            const transactionCostUSD = Number(transactionCostNative) * nativeTokenPrice.price

            return {
                feeOptions,
                transactionCostUSD,
            }
        } catch (error) {
            try {
                const feeOptions = await peanut.setFeeOptions({
                    chainId: chainId,
                    unsignedTx: preparedTx,
                    gasLimit: BigNumber.from(100000),
                })

                let transactionCostWei = feeOptions.gasLimit.mul(feeOptions.maxFeePerGas || feeOptions.gasPrice)
                let transactionCostNative = formatEther(transactionCostWei)
                const nativeTokenPrice = await fetchTokenPrice('0x0000000000000000000000000000000000000000', chainId)
                if (!nativeTokenPrice) {
                    throw new Error('Failed to fetch token price')
                }
                const transactionCostUSD = Number(transactionCostNative) * nativeTokenPrice.price

                return {
                    feeOptions,
                    transactionCostUSD,
                }
            } catch (error) {
                console.error('Failed to estimate gas fee:', error)
                throw error
            }
        }
    }, [])

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
            const response = await fetch(`${PEANUT_API_URL}/calculate-pts-for-action`, {
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

        if (!isNativeCurrency(tokenAddress)) {
            // ERC20 Token transfer
            const erc20Contract = new ethers.Contract(tokenAddress, peanut.ERC20_ABI)
            const amount = parseUnits(tokenValue, tokenDecimals)
            const data = erc20Contract.interface.encodeFunctionData('transfer', [recipient, amount])

            transactionRequest = {
                to: tokenAddress,
                data,
                value: BigInt(0), // Convert to BigInt
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

                if (isActiveWalletPW) {
                    const params = preparedDepositTxs.unsignedTxs.map((tx) => ({
                        to: tx.to! as Hex,
                        value: tx.value?.valueOf(),
                        data: tx.data as Hex | undefined,
                    }))
                    let hash = await handleSendUserOpEncoded(params)
                    signedTxsResponse.push(hash.toString())
                    idx++
                    return signedTxsResponse[signedTxsResponse.length - 1]
                }

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
                    if (isActiveWalletBYOW) {
                        // Send the transaction using wagmi
                        // current stage is encoded but NOT signed
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
                            chainId: Number(selectedChainID), //TODO: (mentioning) chainId as number here
                        })

                        setLoadingState('Executing transaction')

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
                }
                return signedTxsResponse[signedTxsResponse.length - 1]
            } catch (error) {
                throw error
            }
        },
        [selectedChainID, sendTransactionAsync, config, isActiveWalletPW, isActiveWalletBYOW, handleSendUserOpEncoded]
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

    const prepareCreateLinkWrapper = useCallback(
        async ({ tokenValue }: { tokenValue: string }) => {
            await checkUserHasEnoughBalance({ tokenValue })
            const linkDetails = generateLinkDetails({ tokenValue, walletType, envInfo: environmentInfo })
            const password = await generatePassword()
            await switchNetwork(selectedChainID)

            const _isGaslessDepositPossible = isGaslessDepositPossible({
                chainId: selectedChainID,
                tokenAddress: selectedTokenAddress,
            })
            if (_isGaslessDepositPossible && !isActiveWalletPW) {
                // routing only gasless BYOW txs through here
                const makeGaslessDepositResponse = await makeGaslessDepositPayload({
                    _linkDetails: linkDetails,
                    _password: password,
                })

                if (
                    !makeGaslessDepositResponse ||
                    !makeGaslessDepositResponse.payload ||
                    !makeGaslessDepositResponse.message
                )
                    return

                return { type: 'gasless', response: makeGaslessDepositResponse, linkDetails, password }
            } else {
                let prepareDepositTxsResponse: peanutInterfaces.IPrepareDepositTxsResponse | undefined =
                    await prepareDepositTxs({
                        _linkDetails: linkDetails,
                        _password: password,
                    })

                const feeOptions = await estimateGasFee({
                    chainId: selectedChainID,
                    preparedTx: prepareDepositTxsResponse?.unsignedTxs[0],
                })
                // If the selected token is native currency, we need to check
                // the user's balance to ensure they have enough to cover the
                // gas fees.
                if (isNativeCurrency(selectedTokenAddress)) {
                    const maxGasAmount = Number(
                        formatEther(
                            feeOptions.feeOptions.gasLimit.mul(
                                feeOptions.feeOptions.maxFeePerGas || feeOptions.feeOptions.gasPrice
                            )
                        )
                    )
                    await checkUserHasEnoughBalance({
                        tokenValue: String(Number(tokenValue) + maxGasAmount),
                    })
                }

                return { type: 'deposit', response: prepareDepositTxsResponse, linkDetails, password, feeOptions }
            }
        },
        [
            checkUserHasEnoughBalance,
            generateLinkDetails,
            walletType,
            environmentInfo,
            makeGaslessDepositPayload,
            prepareDepositTxs,
            estimateGasFee,
            selectedChainID,
            selectedTokenAddress,
            isActiveWalletPW,
        ]
    )

    const createLinkWrapper = async ({
        type,
        response,
        linkDetails,
        password,
        feeOptions,
        usdValue,
    }: {
        type: string
        response: any
        linkDetails: peanutInterfaces.IPeanutLinkDetails
        password: string
        feeOptions?: any
        usdValue?: string
    }) => {
        try {
            let hash: string = ''

            await submitClaimLinkInit({
                password: password ?? '',
                attachmentOptions: {
                    attachmentFile: undefined,
                    message: undefined,
                },
                senderAddress: address ?? '',
            })

            // TODO: this needs its own type
            if (type === 'deposit') {
                hash = (await sendTransactions({ preparedDepositTxs: response, feeOptions: feeOptions })) ?? ''
            } else if (type === 'gasless') {
                const signature = await signTypedData({ gaslessMessage: response.message })
                hash = await makeDepositGasless({ signature, payload: response.payload })
            }

            const link = await getLinkFromHash({ hash, linkDetails, password, walletType })

            saveCreatedLinkToLocalStorage({
                address: address ?? '',
                data: {
                    link: link[0],
                    depositDate: new Date().toISOString(),
                    USDTokenPrice: selectedTokenData?.price ?? 0,
                    points: 0,
                    txHash: hash,
                    message: '',
                    attachmentUrl: undefined,
                    ...linkDetails,
                },
            })

            await submitClaimLinkConfirm({
                chainId: selectedChainID,
                link: link[0],
                password: password ?? '',
                txHash: hash,
                senderAddress: address ?? '',
                amountUsd: parseFloat(usdValue ?? '0'),
                transaction: type === 'deposit' ? response && response.unsignedTxs[0] : undefined,
            })

            // refetch wallet balance after successful link creation
            refetchBalances(selectedWallet?.address || '')

            return link[0]
        } catch (error) {
            throw error
        }
    }

    return {
        checkUserHasEnoughBalance,
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
        prepareCreateLinkWrapper,
        createLinkWrapper,
    }
}
