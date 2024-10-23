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
import { switchNetwork as switchNetworkUtil } from '@/utils/general.utils'
import { useBalance } from '@/hooks/useBalance'
import * as context from '@/context'
import * as consts from '@/constants'
import * as utils from '@/utils'
import * as _utils from './Create.utils'
import { BigNumber, ethers } from 'ethers'
import { assert } from 'console'
import { useWalletType } from '@/hooks/useWalletType'
interface ICheckUserHasEnoughBalanceProps {
    tokenValue: string | undefined
}


// FOR ZERODEV TESTS
import {
    createKernelAccount,
    createKernelAccountClient,
    createZeroDevPaymasterClient,
    KernelAccountClient
} from "@zerodev/sdk"
import {
    toPasskeyValidator,
    toWebAuthnKey,
    WebAuthnMode,
    PasskeyValidatorContractVersion
} from "@zerodev/passkey-validator"
import { KERNEL_V3_1 } from "@zerodev/sdk/constants"

// Viem imports
import { arbitrum } from 'viem/chains'
import { createPublicClient, http, parseAbi, encodeFunctionData, } from "viem"

// Permissionless imports
import { bundlerActions, ENTRYPOINT_ADDRESS_V07} from 'permissionless'
import { UserOperation } from "viem/_types/account-abstraction/types/userOperation"
import { useWallet } from '@/context/walletContext'
import { useZeroDev } from '@/context/walletContext/zeroDevContext.context'

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
    const { walletType, environmentInfo } = useWalletType()
    const { refetchBalances } = useBalance()

    const { activeWallet, isActiveWalletBYOW, isActiveWalletPW } = useWallet()
    const { handleSendUserOpNotEncoded } = useZeroDev()

    // step 1
    const checkUserHasEnoughBalance = async ({ tokenValue }: ICheckUserHasEnoughBalanceProps) => {
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
                    utils.areTokenAddressesEqual(balance.address, selectedTokenAddress) &&
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
            if (!balance || (balance && balance < Number(tokenValue))) {
                throw new Error('Please ensure that you have sufficient balance of the token you are trying to send')
            }
        }

        // the selected tokenvalue has to be a number higher then .0001
        if (!tokenValue || (tokenValue && Number(tokenValue) < 0.000001)) {
            throw new Error('The minimum amount to send is 0.000001')
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
            console.error('error generating linkdetails', error)
            throw new Error('Error getting the linkDetails.')
        }
    }
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
    const estimateGasFee = async ({ chainId, preparedTx }: { chainId: string; preparedTx: any }) => {
        try {
            const feeOptions = await peanut.setFeeOptions({
                chainId: chainId,
                unsignedTx: preparedTx,
            })

            let transactionCostWei = feeOptions.gasLimit.mul(feeOptions.maxFeePerGas || feeOptions.gasPrice)
            let transactionCostNative = ethers.utils.formatEther(transactionCostWei)
            const nativeTokenPrice = await utils.fetchTokenPrice('0x0000000000000000000000000000000000000000', chainId)
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
                let transactionCostNative = ethers.utils.formatEther(transactionCostWei)
                const nativeTokenPrice = await utils.fetchTokenPrice(
                    '0x0000000000000000000000000000000000000000',
                    chainId
                )
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
            const response = await fetch(`${consts.PEANUT_API_URL}/calculate-pts-for-action`, {
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
                baseUrl: `${consts.next_proxy_url}/deposit-3009`,
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

                    
                    
                    //   const userOperation = await clientKernelAccountClient.prepareUserOperationRequest({
                    //     userOperation: {
                    //       callData: await clientKernelAccount.encodeCallData({
                    //         to: (tx.to ? tx.to : '') as `0x${string}`,
                    //         value: tx.value ? BigInt(tx.value.toString()) : tx.value,
                    //         data: tx.data ? (tx.data as `0x${string}`) : '',
                    //         // data: encodeFunctionData({
                    //         //   abi: contractABI,
                    //         //   functionName: "mint",
                    //         //   args: [kernelAccount.address],
                    //         // }),
                    //       }),
                    //     },
                    //   });

                    // //   const userOperation = await clientKernelAccountClient.prepareUserOperationRequest({
                    // //     userOperation: {
                    // //       callData: await clientKernelAccount.encodeCallData({
                    // //         to: contractAddress,
                    // //         value: BigInt(0),
                    // //         data: encodeFunctionData({
                    // //           abi: contractABI,
                    // //           functionName: "mint",
                    // //           args: [clientKernelAccount.address],
                    // //         }),
                    // //       }),
                    // //     },
                    // //   });
                    
                    // console.log({userOperation})
                      
                    // // Sign the user operation
                    // const signature = await clientKernelAccount.signUserOperation(userOperation);
                    // console.log({signature})

                    // // Add the signature to the user operation
                    // const signedUserOperation = {
                    //     ...userOperation,
                    //     signature,
                    // };

                    // console.log({signedUserOperation})

                    //   // send the operation
                    //   const webAuthnKeyProxy = await toWebAuthnKey({ 
                    //     passkeyName: 'proxy', 
                    //     passkeyServerUrl: PASSKEY_SERVER_URL as string, 
                    //     mode: WebAuthnMode.Login ,
                    //     passkeyServerHeaders: {}
                    // })
             
                    // const passkeyValidatorProxy = await toPasskeyValidator(publicClient, { 
                    //     webAuthnKey: webAuthnKeyProxy,  
                    //     entryPoint, 
                    //     kernelVersion: KERNEL_V3_1,   
                    //     validatorContractVersion: PasskeyValidatorContractVersion.V0_0_2
                    // })

                    //   const proxyKernelAccount = await createKernelAccount(publicClient, {
                    //     plugins: {
                    //         sudo: passkeyValidatorProxy
                    //     },
                    //     entryPoint, 
                    //     kernelVersion: KERNEL_V3_1
                    // })
                
                    // const proxyKernelClient = createKernelAccountClient({ 
                    //     account: proxyKernelAccount, 
                    //     chain: CHAIN, 
                    //     bundlerTransport: http(BUNDLER_URL), 
                    //     entryPoint, 
                    //     middleware: { 
                    //       sponsorUserOperation: async ({ userOperation }) => { 
                    //         const zerodevPaymaster = createZeroDevPaymasterClient({ 
                    //           chain: CHAIN, 
                    //           transport: http(PAYMASTER_URL), 
                    //           entryPoint, 
                    //         }) 
                    //         return zerodevPaymaster.sponsorUserOperation({ 
                    //           userOperation, 
                    //           entryPoint, 
                    //         }) 
                    //       } 
                    //     } 
                    //   })
                      
                    //   // Send the user operation
                    //   const userOpHash = await proxyKernelClient.sendUserOperation({
                    //     userOperation: signedUserOperation,
                    //     entryPoint: entryPoint, // Make sure to define entryPoint
                    //   });
            
                    //   console.log({userOpHash})
                      

                    //   return

                    if (isActiveWalletPW) {

                    } else if (isActiveWalletBYOW) {
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

                    return signedTxsResponse[signedTxsResponse.length - 1]
                }


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

    const prepareCreateLinkWrapper = async ({ tokenValue }: { tokenValue: string }) => {
        try {
            await checkUserHasEnoughBalance({ tokenValue })
            const linkDetails = generateLinkDetails({ tokenValue, walletType, envInfo: environmentInfo })
            const password = await generatePassword()
            await switchNetwork(selectedChainID)

            const isGaslessDepositPossible = _utils.isGaslessDepositPossible({
                chainId: selectedChainID,
                tokenAddress: selectedTokenAddress,
            })
            if (isGaslessDepositPossible) {
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

                return { type: 'deposit', response: prepareDepositTxsResponse, linkDetails, password, feeOptions }
            }
        } catch (error) {
            throw error
        }
    }

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

            if (type === 'deposit') {
                hash = (await sendTransactions({ preparedDepositTxs: response, feeOptions: feeOptions })) ?? ''
            } else if (type === 'gasless') {
                const signature = await signTypedData({ gaslessMessage: response.message })
                hash = await makeDepositGasless({ signature, payload: response.payload })
            }

            const link = await getLinkFromHash({ hash, linkDetails, password, walletType })

            utils.saveCreatedLinkToLocalStorage({
                address: address ?? '',
                data: {
                    link: link[0],
                    depositDate: new Date().toISOString(),
                    USDTokenPrice: selectedTokenPrice ?? 0,
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

            await refetchBalances()

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
