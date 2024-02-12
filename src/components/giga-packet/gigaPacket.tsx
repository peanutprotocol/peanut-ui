'use client'
import * as global_components from '@/components/global'
import { Fragment, useEffect, useMemo, useState } from 'react'
import { useAccount, useNetwork } from 'wagmi'
import { providers, ethers } from 'ethers'
import { switchNetwork, getWalletClient } from '@wagmi/core'
import peanut, {
    getDefaultProvider,
    addLinkCreation,
    getLinksFromTx,
    getRandomString,
    getTokenContractDetails,
    interfaces,
    prepareRaffleDepositTxs,
    setFeeOptions,
    trim_decimal_overflow,
    getLatestContractVersion,
    createMultiLinkFromLinks,
    validateUserName,
} from '@squirrel-labs/peanut-sdk'
import clipboard_svg from '@/assets/clipboard.svg'
import checkbox_svg from '@/assets/checkbox.svg'

import * as utils from '@/utils'
import * as consts from '@/consts'
import * as hooks from '@/hooks'
import * as _utils from './gigaPacket.utils'
import * as _consts from './gigaPacket.consts'
import { Dialog, Switch, Transition } from '@headlessui/react'
import { useWeb3Modal } from '@web3modal/wagmi/react'

// {
//     tokenAddress: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238',
//     tokenAmount: 0.1,
//     numberOfSlots: 9,
// },
// {
//     tokenAddress: '0x0000000000000000000000000000000000000000',
//     tokenAmount: 0.1,
//     numberOfSlots: 11,
// },

type tokenType = {
    tokenAddress: string
    tokenAmount: number
    numberOfSlots: number
}

type localStorageItem = {
    completed: boolean
    tokenDetails: {
        tokenAddress: string
        tokenAmount: number
        numberOfSlots: number
        slotsExecuted: number //this will be the amount of slots that have been created
        link: string
        completed: boolean
        hashesExecuted: string[]
    }[]
    senderName: string
    password: string
    finalLink: string
}

export function GigaPacket() {
    const { isConnected, address } = useAccount()
    const { chain: currentChain } = useNetwork()
    const { open } = useWeb3Modal()
    const [isCopied, setIsCopied] = useState(false)

    const [finalLink, setFinalLink] = useState<string | undefined>(undefined)
    const [isMainnet, setIsMainnet] = useState<boolean>(true)
    const [showManualModal, setShowManualModal] = useState<boolean>(false)
    const [showDashboardModal, setShowDashboardModal] = useState<boolean>(false)
    const [incompleteForm, setIncompleteForm] = useState<localStorageItem | undefined>(undefined)
    const [localStorageCompleteData, setLocalStorageCompleteData] = useState<localStorageItem[]>([])
    const [copiedIdx, setCopiedIdx] = useState<number | undefined>(undefined)
    const [txStep, setTxStep] = useState<{ step: number; length: number } | undefined>(undefined)
    hooks.useConfirmRefresh(true)

    const [loadingStates, setLoadingStates] = useState<consts.LoadingStates>('idle')
    const isLoading = useMemo(() => loadingStates !== 'idle', [loadingStates])

    const [formState, setFormState] = useState<tokenType[]>([
        {
            tokenAddress: '0xDeadDeAddeAddEAddeadDEaDDEAdDeaDDeAD0000',
            tokenAmount: 0,
            numberOfSlots: 0,
        },
        {
            tokenAddress: '0x09Bc4E0D864854c6aFB6eB9A9cdF58aC190D0dF9',
            tokenAmount: 0,
            numberOfSlots: 0,
        },
        {
            tokenAddress: '',
            tokenAmount: 0,
            numberOfSlots: 0,
        },
        {
            tokenAddress: '',
            tokenAmount: 0,
            numberOfSlots: 0,
        },
    ]) //Should be a form, but for now we'll just use a state
    const [senderName, setSenderName] = useState<string>('')

    const [errorState, setErrorState] = useState<{
        showError: boolean
        errorMessage: string
    }>({ showError: false, errorMessage: '' })

    const getWalletClientAndUpdateSigner = async ({
        chainId,
    }: {
        chainId: string
    }): Promise<providers.JsonRpcSigner> => {
        const walletClient = await getWalletClient({ chainId: Number(chainId) })
        if (!walletClient) {
            throw new Error('Failed to get wallet client')
        }
        const signer = utils.walletClientToSigner(walletClient)
        return signer
    }

    const checkNetwork = async (chainId: string) => {
        //check if the user is on the correct chain
        if (currentChain?.id.toString() !== chainId.toString()) {
            setLoadingStates('allow network switch')

            await utils.waitForPromise(switchNetwork({ chainId: Number(chainId) })).catch((error) => {
                setErrorState({
                    showError: true,
                    errorMessage: 'Something went wrong while switching networks',
                })
                setLoadingStates('idle')
                throw error
            })
            setLoadingStates('switching network')
            setLoadingStates('loading')
        }
    }

    function combineRaffleLink(links: string[]): string {
        let firstCValue = null
        let firstPValue = null
        let firstVValue = null

        for (let url of links) {
            const urlObj = new URL(url)
            const cValue = urlObj.searchParams.get('c')
            const vValue = urlObj.searchParams.get('v')
            const fragment = urlObj.hash.substring(1)
            const pValue = new URLSearchParams(fragment).get('p')

            if (firstCValue === null) {
                firstCValue = cValue
            } else if (firstCValue !== cValue) {
                throw new Error("Inconsistent 'c' parameter values found.")
            }

            if (firstPValue === null) {
                firstPValue = pValue
            } else if (firstPValue !== pValue) {
                throw new Error("Inconsistent 'p' parameter values found.")
            }

            if (firstVValue === null) {
                firstVValue = vValue
            } else if (firstVValue !== vValue) {
                throw new Error("Inconsistent 'v' parameter values found.")
            }
        }

        console.log(links)
        const expandedLinks = links.map((link) => expandMultilink(link))
        console.log(expandedLinks)
        const combinedLink = peanut.createMultiLinkFromLinks(expandedLinks)
        console.log(combinedLink)

        return combinedLink
    } //TODO: move to sdk

    function expandMultilink(link: string): string {
        const url = new URL(link)
        const params = new URLSearchParams(url.search)

        console.log(url)

        const i = params.get('i')
        if (!i) {
            throw new Error('Error expanding the multilink')
        }

        const expandedIValues = []
        const groupRegex = /\((\d+),(\d+)\)/g
        let match

        if (groupRegex.test(i) === false) {
            return link
        }

        console.log(i)

        console.log(groupRegex.test(i) === false)

        while ((match = groupRegex.exec(i)) !== null) {
            console.log(match)
            const start = parseInt(match[1], 10)
            console.log(start)
            const count = parseInt(match[2], 10)
            console.log(count)
            for (let j = 0; j < count; j++) {
                expandedIValues.push(start + j)
            }
        }

        console.log(expandedIValues)

        params.set('i', expandedIValues.join(','))
        console.log(params.set('i', expandedIValues.join(',')))
        console.log(decodeURIComponent(params.toString()))
        url.search = decodeURIComponent(params.toString())

        console.log(url)
        return url.href
    } //TODO: move to sdk

    function checkForm(formState: tokenType[]) {
        for (const token of formState) {
            console.log(token)
            if (token.tokenAddress !== '') {
                if (token.tokenAmount <= 0) {
                    setErrorState({
                        showError: true,
                        errorMessage:
                            'Token amount must be greater than 0 for token with address: ' + token.tokenAddress,
                    })
                    return false
                }
                if (token.numberOfSlots < 2) {
                    setErrorState({
                        showError: true,
                        errorMessage:
                            'Number of slots must be greater than 2 for token with address: ' + token.tokenAddress,
                    })
                    return false
                }
            }
        }
        return true
    }

    function updateLocalstorageItem(key: string, item: localStorageItem) {
        localStorage.setItem(key, JSON.stringify(item))
    }

    const checkBalance = async (
        totalSlots: number,
        mntAmount: number,
        address: string,
        provider?: ethers.providers.JsonRpcProvider
    ) => {
        provider = provider ?? (await getDefaultProvider(_consts.MANTLE_CHAIN_ID))
        const balance = await provider.getBalance(address)
        const formattedBalance = utils.formatAmountWithDecimals({ amount: Number(balance.toString()), decimals: 18 })
        const requiredBalance = (totalSlots / _consts.MAX_TRANSACTIONS_PER_BLOCK) * _consts.MAX_GAS_PRICE + mntAmount
        console.log({
            requiredBalance,
            formattedBalance,
        })
        if (requiredBalance > Number(formattedBalance)) {
            return false
        } else {
            return true
        }
    }

    async function createRaffle() {
        if (isLoading) return
        setErrorState({
            showError: false,
            errorMessage: '',
        })
        // check if token addresses are correct
        // check if amounts and number of slots per link are correct
        try {
            const _formState = formState.filter((state) => state.tokenAddress !== '')

            //create localstorage item and save to localstorage

            const peanutPassword = await getRandomString(16)

            //check if sendername is defined
            if (senderName == '') {
                setErrorState({
                    showError: true,
                    errorMessage: 'Please provide a name for the sender',
                })
                return
            } else {
                try {
                    validateUserName(senderName)
                } catch (error) {
                    setErrorState({
                        showError: true,
                        errorMessage: 'Invalid name',
                    })
                }
            }

            //check if the form is empty
            if (_formState.length === 0) {
                setErrorState({
                    showError: true,
                    errorMessage: 'Please provide the details for at least one token.',
                })
                return
            }
            //check formvalues
            if (!checkForm(_formState)) {
                setErrorState({
                    showError: true,
                    errorMessage: 'Please provide valid details for each tokens.',
                })
                return
            }

            setLoadingStates('loading')

            let totalTxs = 0
            _formState.forEach((item) => {
                const x = _utils.divideAndRemainder(item.numberOfSlots)
                totalTxs += x[0] + (x[1] > 0 ? 1 : 0)
            })

            console.log(totalTxs)

            const totalSlots = _formState.reduce((acc, token) => acc + token.numberOfSlots, 0)
            const totalMNT =
                _formState.find((item) => item.tokenAddress == _consts.MANTLE_NATIVE_TOKEN_ADDRESS)?.tokenAmount ?? 0
            const balanceCheck = await checkBalance(totalSlots, totalMNT, address ?? '')
            if (!balanceCheck) {
                setErrorState({
                    showError: true,
                    errorMessage: 'Insufficient MNT to create the raffle links',
                })
                return
            }

            const _localstorageKey = `${address}-gigalink-${peanutPassword}` //get all items from locastorage, and filter out with the correct address TODO: update password in key
            let _localstorageItem: localStorageItem = {
                completed: false,
                tokenDetails: _formState.map((_token) => {
                    return {
                        tokenAddress: _token.tokenAddress,
                        tokenAmount: _token.tokenAmount,
                        numberOfSlots: _token.numberOfSlots,
                        slotsExecuted: 0, //this will be the amount of slots that have been created
                        startIdx: 0,
                        link: '',
                        hashesExecuted: [],
                        completed: false,
                    }
                }),
                senderName: senderName,
                password: peanutPassword,
                finalLink: '',
            }
            updateLocalstorageItem(_localstorageKey, _localstorageItem)

            console.log({ _localstorageItem })

            const _chainID = isMainnet ? _consts.MANTLE_CHAIN_ID : _consts.MANTLE_TESTNET_CHAIN_ID

            setLoadingStates('allow network switch')

            //Check network
            await checkNetwork(_chainID)

            setLoadingStates('loading')

            //get signer
            const signer = await getWalletClientAndUpdateSigner({ chainId: _chainID })

            let raffleLinks: string[] = []

            const baseUrl = `${window.location.origin}/packet`
            const trackId = 'mantle'
            const batcherContractVersion = getLatestContractVersion({
                chainId: _chainID,
                type: 'batch',
                experimental: true,
            })
            // const currentDateTime = new Date()
            // const localstorageKey = `saving giga-link for address: ${address} at ${currentDateTime}`
            // const premadeLink = `${baseUrl}?c=${_chainID}&v=v4.3&i=&t=${trackId}#p=${peanutPassword}`
            // utils.saveToLocalStorage(localstorageKey, premadeLink)

            const defaultProvider = await getDefaultProvider(_chainID) // get from wallet? But rpc.mantle.xyz should work

            // for each token, prepare the approve tx if needed. Need to fetch tokenDecimals and tokenType for this
            for (const token of _formState) {
                let tokenType, tokenDecimals

                if (token.tokenAddress == _consts.MANTLE_NATIVE_TOKEN_ADDRESS) {
                    tokenType = 0
                    tokenDecimals = 18
                } else {
                    try {
                        const contractDetails = await getTokenContractDetails({
                            address: token.tokenAddress,
                            provider: defaultProvider,
                        })

                        tokenType = contractDetails.type
                        contractDetails.decimals ? (tokenDecimals = contractDetails.decimals) : (tokenDecimals = 16)
                    } catch (error) {
                        throw new Error('Contract type not supported')
                    }

                    if (tokenType === undefined || tokenDecimals === undefined) {
                        throw new Error('Token type or decimals not found, please contact support')
                    }
                }

                setLoadingStates('getting allowance')
                if (tokenType == 1) {
                    const tokenAmountString = trim_decimal_overflow(token.tokenAmount, tokenDecimals)
                    const tokenAmountBigNum = ethers.utils.parseUnits(tokenAmountString, tokenDecimals)

                    const approveTx = await peanut.prepareApproveERC20Tx(
                        address ?? '',
                        _chainID,
                        token.tokenAddress,
                        tokenAmountBigNum,
                        -1, // decimals doesn't matter
                        true, // already a prepared bignumber
                        batcherContractVersion,
                        signer.provider
                    )

                    console.log('approveTx:', approveTx)

                    if (approveTx !== null) {
                        let txOptions
                        try {
                            txOptions = await setFeeOptions({ provider: signer.provider })
                        } catch (error) {
                            throw new interfaces.SDKStatus(
                                interfaces.ESignAndSubmitTx.ERROR_SETTING_FEE_OPTIONS,
                                'Error setting the fee options',
                                error
                            )
                        }

                        const convertedTransaction: ethers.providers.TransactionRequest = {
                            from: approveTx.from,
                            to: approveTx.to,
                            data: approveTx.data,
                            value: approveTx.value ? ethers.BigNumber.from(approveTx.value) : undefined,
                        }
                        const combined = {
                            ...txOptions,
                            ...convertedTransaction,
                        } as ethers.providers.TransactionRequest

                        setLoadingStates('sign in wallet')

                        const tx = await signer.sendTransaction(combined)

                        setLoadingStates('executing transaction')

                        await tx.wait()
                    }
                }
            }

            //wait for the rpc to update
            await new Promise((resolve) => setTimeout(resolve, 2500))

            // We'll handle each token separately: preparing, sending and getting the link
            for (const token of _formState) {
                console.log({ token })

                let preparedTransactions: interfaces.IPrepareDepositTxsResponse[] = []

                // Calculate the number of transactions needed (quotient is for the full slots, remainder for the last one)
                const [quotient, remainder] = _utils.divideAndRemainder(token.numberOfSlots)
                const tokenAmountPerSlot = token.tokenAmount / token.numberOfSlots
                let tokenType, tokenDecimals

                // We do this cause mantle native token isnt an actual native token, but we need to treat it that way
                if (token.tokenAddress == _consts.MANTLE_NATIVE_TOKEN_ADDRESS) {
                    tokenType = 0
                    tokenDecimals = 18
                } else {
                    try {
                        const contractDetails = await getTokenContractDetails({
                            address: token.tokenAddress,
                            provider: defaultProvider,
                        })

                        tokenType = contractDetails.type
                        contractDetails.decimals ? (tokenDecimals = contractDetails.decimals) : (tokenDecimals = 16)
                    } catch (error) {
                        throw new Error('Contract type not supported')
                    }

                    if (tokenType === undefined || tokenDecimals === undefined) {
                        throw new Error('Token type or decimals not found, please contact support')
                    }
                }

                console.log({ tokenType })
                console.log({ tokenDecimals })

                setLoadingStates('preparing transaction')
                // prepare the transactions. It is calculated based on the number of slots and the max transactions per block
                for (let index = 0; index <= quotient; index++) {
                    const numberofLinks = index != quotient ? _consts.MAX_TRANSACTIONS_PER_BLOCK : remainder
                    if (numberofLinks > 0) {
                        const linkDetails = {
                            chainId: _chainID,
                            tokenAmount: Number(tokenAmountPerSlot * numberofLinks),
                            tokenAddress: token.tokenAddress,
                            baseUrl,
                            trackId,
                            tokenDecimals: tokenDecimals,
                            tokenType: tokenType,
                        }

                        const prepTx = await prepareRaffleDepositTxs({
                            userAddress: address ?? '',
                            linkDetails: linkDetails,
                            password: peanutPassword,
                            withMFA: true,
                            numberOfLinks: index != quotient ? _consts.MAX_TRANSACTIONS_PER_BLOCK : remainder,
                        })

                        preparedTransactions.push(prepTx)
                    }
                }

                console.log({ preparedTransactions })

                let hashes: string[] = []

                setLoadingStates('executing transaction')
                setTxStep({ step: 1, length: totalTxs })

                let preparedTransactionsArrayIndex = 0
                // set the fee options, combine into the tx and send the transactions
                for (const preparedTransactionsArray of preparedTransactions) {
                    let index = 0
                    const numberofLinks =
                        preparedTransactionsArrayIndex != quotient ? _consts.MAX_TRANSACTIONS_PER_BLOCK : remainder
                    for (const prearedTransaction of preparedTransactionsArray.unsignedTxs) {
                        let txOptions
                        try {
                            txOptions = await setFeeOptions({ provider: signer.provider })
                        } catch (error) {
                            throw new interfaces.SDKStatus(
                                interfaces.ESignAndSubmitTx.ERROR_SETTING_FEE_OPTIONS,
                                'Error setting the fee options',
                                error
                            )
                        }

                        const convertedTransaction: ethers.providers.TransactionRequest = {
                            from: prearedTransaction.from,
                            to: prearedTransaction.to,
                            data: prearedTransaction.data,
                            value: prearedTransaction.value
                                ? ethers.BigNumber.from(prearedTransaction.value)
                                : undefined,
                        }
                        const preparedTx = {
                            ...txOptions,
                            ...convertedTransaction,
                        } as ethers.providers.TransactionRequest

                        console.log({ preparedTx })
                        setLoadingStates('sign in wallet')
                        const tx = await signer.sendTransaction(preparedTx)
                        setLoadingStates('executing transaction')
                        const txResponse = await tx.wait()
                        console.log(txResponse)
                        hashes.push(tx.hash)
                        index++
                        setTxStep({
                            length: txStep?.length ?? totalTxs,
                            step: (txStep?.step ?? 0) + 1,
                        })

                        _localstorageItem.tokenDetails = _localstorageItem.tokenDetails.map((_token) => {
                            if (_token.tokenAddress === token.tokenAddress) {
                                return {
                                    ..._token,
                                    slotsExecuted: _token.slotsExecuted + numberofLinks, // Updated value
                                    hashesExecuted: [..._token.hashesExecuted, tx.hash], // Updated value
                                }
                            }
                            return _token // Return the original _token, not `token`
                        })

                        updateLocalstorageItem(_localstorageKey, _localstorageItem)
                        console.log({
                            _localstorageItem,
                        })
                    }
                    preparedTransactionsArrayIndex++
                }

                setTxStep(undefined)

                console.log({ hashes })

                const links: string[] = []
                let index = 0

                setLoadingStates('creating link')

                // get the links from the hashes
                for (const hash of hashes) {
                    const numberofLinks = index != quotient ? _consts.MAX_TRANSACTIONS_PER_BLOCK : remainder

                    const linkDetails = {
                        chainId: _chainID,
                        tokenAmount: 0,
                        tokenAddress: token.tokenAddress,
                        baseUrl: baseUrl,
                        trackId: trackId,
                        tokenDecimals: tokenDecimals,
                        tokenType: tokenType,
                    }

                    //gets the links from the tx
                    const getLinksFromTxResponse = await getLinksFromTx({
                        passwords: Array(numberofLinks).fill(peanutPassword),
                        txHash: hash,
                        linkDetails: linkDetails,
                        provider: signer.provider,
                    })

                    //creates a multilink from the links
                    const createdMultilink = createMultiLinkFromLinks(getLinksFromTxResponse.links)

                    // returns array of links
                    links.push(createdMultilink)

                    index++

                    _localstorageItem.tokenDetails = _localstorageItem.tokenDetails.map((_token) => {
                        if (_token.tokenAddress === token.tokenAddress) {
                            return {
                                ..._token,
                                link:
                                    _token.link !== ''
                                        ? combineRaffleLink([_token.link, createdMultilink])
                                        : createdMultilink, // Updated value
                            }
                        }
                        return _token // Return the original _token, not `token`
                    })

                    updateLocalstorageItem(_localstorageKey, _localstorageItem)

                    console.log({
                        _localstorageItem,
                    })
                }

                console.log({ links })

                const combinedLink = combineRaffleLink(links)

                console.log({ combinedLink })

                raffleLinks.push(combinedLink)

                _localstorageItem.tokenDetails = _localstorageItem.tokenDetails.map((_token) => {
                    if (_token.tokenAddress === token.tokenAddress) {
                        return {
                            ..._token,
                            link: combinedLink, // Updated value
                            completed: true,
                        }
                    }
                    return _token // Return the original _token, not `token`
                })

                updateLocalstorageItem(_localstorageKey, _localstorageItem)
                console.log({
                    _localstorageItem,
                })
            }

            const finalfinalv4rafflelink_final = combineRaffleLink(raffleLinks)

            await addLinkCreation({
                name: senderName,
                link: finalfinalv4rafflelink_final,
                APIKey: 'youwish',
                withCaptcha: true,
                withMFA: true,
                baseUrl: consts.next_proxy_url + '/submit-raffle-link',
            })

            console.log({ finalfinalv4rafflelink_final })
            setFinalLink(finalfinalv4rafflelink_final)

            //udpatelocalstorage with final link and completed flag

            _localstorageItem = {
                ..._localstorageItem,
                completed: true,
                finalLink: finalfinalv4rafflelink_final,
            }
            updateLocalstorageItem(_localstorageKey, _localstorageItem)

            console.log({
                _localstorageItem,
            })

            setLoadingStates('idle')
        } catch (error: any) {
            setLoadingStates('idle')

            if (error.toString().includes('Failed to get wallet client')) {
                setErrorState({
                    showError: true,
                    errorMessage: 'Please make sure your wallet is connected.',
                })
            } else {
                setErrorState({
                    showError: true,
                    errorMessage:
                        'Something went wrong while creating the raffle link. Please refresh the page to continue the process.',
                })
            }

            console.error(error)
        } finally {
            setLoadingStates('idle')
        }
    }

    async function completeRaffle() {
        setErrorState({
            showError: false,
            errorMessage: '',
        })
        try {
            if (incompleteForm) {
                console.log(incompleteForm)

                const _password = incompleteForm.password
                const _chainID = isMainnet ? _consts.MANTLE_CHAIN_ID : _consts.MANTLE_TESTNET_CHAIN_ID
                const _localstorageKey = `${address}-gigalink-${_password}`

                const _senderName = incompleteForm.senderName

                let _localstorageItem: localStorageItem = {
                    password: _password,
                    completed: false,
                    tokenDetails: incompleteForm.tokenDetails,
                    senderName: _senderName,
                    finalLink: '',
                }

                setLoadingStates('allow network switch')

                //Check network
                await checkNetwork(_chainID)

                setLoadingStates('loading')

                //get signer
                const signer = await getWalletClientAndUpdateSigner({ chainId: _chainID })

                const baseUrl = `${window.location.origin}/packet`
                const trackId = 'mantle'
                const batcherContractVersion = getLatestContractVersion({
                    chainId: _chainID,
                    type: 'batch',
                    experimental: true,
                })

                let raffleLinks: string[] = []

                const defaultProvider = await getDefaultProvider(_chainID) // get from wallet? But rpc.mantle.xyz should work

                for (const token of incompleteForm.tokenDetails) {
                    if (token.completed) {
                        raffleLinks.push(token.link)
                    } else {
                        let tokenType, tokenDecimals

                        const numberOfSlotsTodo = token.numberOfSlots - token.slotsExecuted
                        const totalTokenAmountTodo = (token.tokenAmount / token.numberOfSlots) * numberOfSlotsTodo

                        if (token.tokenAddress == _consts.MANTLE_NATIVE_TOKEN_ADDRESS) {
                            tokenType = 0
                            tokenDecimals = 18
                        } else {
                            try {
                                const contractDetails = await getTokenContractDetails({
                                    address: token.tokenAddress,
                                    provider: defaultProvider,
                                })

                                tokenType = contractDetails.type
                                contractDetails.decimals
                                    ? (tokenDecimals = contractDetails.decimals)
                                    : (tokenDecimals = 16)
                            } catch (error) {
                                throw new Error('Contract type not supported')
                            }

                            if (tokenType === undefined || tokenDecimals === undefined) {
                                throw new Error('Token type or decimals not found, please contact support')
                            }
                        }

                        if (tokenType == 1) {
                            const tokenAmountString = trim_decimal_overflow(totalTokenAmountTodo, tokenDecimals)
                            const tokenAmountBigNum = ethers.utils.parseUnits(tokenAmountString, tokenDecimals)

                            const approveTx = await peanut.prepareApproveERC20Tx(
                                address ?? '',
                                _chainID,
                                token.tokenAddress,
                                tokenAmountBigNum,
                                -1, // decimals doesn't matter
                                true, // already a prepared bignumber
                                batcherContractVersion,
                                signer.provider
                            )

                            console.log('approveTx:', approveTx)

                            if (approveTx !== null) {
                                let txOptions
                                try {
                                    txOptions = await setFeeOptions({ provider: signer.provider })
                                } catch (error) {
                                    throw new interfaces.SDKStatus(
                                        interfaces.ESignAndSubmitTx.ERROR_SETTING_FEE_OPTIONS,
                                        'Error setting the fee options',
                                        error
                                    )
                                }

                                const convertedTransaction: ethers.providers.TransactionRequest = {
                                    from: approveTx.from,
                                    to: approveTx.to,
                                    data: approveTx.data,
                                    value: approveTx.value ? ethers.BigNumber.from(approveTx.value) : undefined,
                                }
                                const combined = {
                                    ...txOptions,
                                    ...convertedTransaction,
                                } as ethers.providers.TransactionRequest

                                setLoadingStates('sign in wallet')

                                const tx = await signer.sendTransaction(combined)

                                setLoadingStates('executing transaction')

                                await tx.wait()

                                //wait for the rpc to update
                                await new Promise((resolve) => setTimeout(resolve, 2500))
                            }
                        }

                        const [totalQuotient, totalRemainder] = _utils.divideAndRemainder(token.numberOfSlots)

                        const [quotient, remainder] = _utils.divideAndRemainder(numberOfSlotsTodo)
                        const tokenAmountPerSlot = totalTokenAmountTodo / numberOfSlotsTodo // or should this be the total number of slots?

                        let preparedTransactions: interfaces.IPrepareDepositTxsResponse[] = []

                        setLoadingStates('preparing transaction')
                        // prepare the transactions. It is calculated based on the number of slots and the max transactions per block
                        for (let index = 0; index <= quotient; index++) {
                            const numberofLinks = index != quotient ? _consts.MAX_TRANSACTIONS_PER_BLOCK : remainder
                            if (numberofLinks > 0) {
                                const linkDetails = {
                                    chainId: _chainID,
                                    tokenAmount: Number(tokenAmountPerSlot * numberofLinks),
                                    tokenAddress: token.tokenAddress,
                                    baseUrl,
                                    trackId,
                                    tokenDecimals: tokenDecimals,
                                    tokenType: tokenType,
                                }

                                const prepTx = await prepareRaffleDepositTxs({
                                    userAddress: address ?? '',
                                    linkDetails: linkDetails,
                                    password: _password,
                                    withMFA: true,
                                    numberOfLinks: numberofLinks,
                                })

                                preparedTransactions.push(prepTx)
                            }
                        }

                        console.log({ preparedTransactions })

                        let hashes: string[] = token.hashesExecuted

                        let preparedTransactionsArrayIndex = 0
                        // set the fee options, combine into the tx and send the transactions
                        for (const preparedTransactionsArray of preparedTransactions) {
                            let index = 0
                            const numberofLinks =
                                preparedTransactionsArrayIndex != quotient
                                    ? _consts.MAX_TRANSACTIONS_PER_BLOCK
                                    : remainder
                            for (const prearedTransaction of preparedTransactionsArray.unsignedTxs) {
                                let txOptions
                                try {
                                    txOptions = await setFeeOptions({ provider: signer.provider })
                                } catch (error) {
                                    throw new interfaces.SDKStatus(
                                        interfaces.ESignAndSubmitTx.ERROR_SETTING_FEE_OPTIONS,
                                        'Error setting the fee options',
                                        error
                                    )
                                }

                                const convertedTransaction: ethers.providers.TransactionRequest = {
                                    from: prearedTransaction.from,
                                    to: prearedTransaction.to,
                                    data: prearedTransaction.data,
                                    value: prearedTransaction.value
                                        ? ethers.BigNumber.from(prearedTransaction.value)
                                        : undefined,
                                }
                                const preparedTx = {
                                    ...txOptions,
                                    ...convertedTransaction,
                                } as ethers.providers.TransactionRequest

                                console.log({ preparedTx })
                                setLoadingStates('sign in wallet')
                                const tx = await signer.sendTransaction(preparedTx)
                                setLoadingStates('executing transaction')
                                await tx.wait()
                                hashes.push(tx.hash)
                                index++

                                _localstorageItem.tokenDetails = _localstorageItem.tokenDetails.map((_token) => {
                                    if (_token.tokenAddress === token.tokenAddress) {
                                        return {
                                            ..._token,
                                            slotsExecuted: _token.slotsExecuted + numberofLinks,
                                            hashesExecuted: [..._token.hashesExecuted, tx.hash],
                                        }
                                    }
                                    return _token
                                })

                                updateLocalstorageItem(_localstorageKey, _localstorageItem)
                                console.log({
                                    _localstorageItem,
                                })
                            }
                            preparedTransactionsArrayIndex++
                        }

                        hashes = hashes.filter((value, index, self) => {
                            return self.indexOf(value) === index
                        })
                        console.log({
                            hashes,
                        })

                        const links: string[] = []
                        let index = 0

                        setLoadingStates('creating link')

                        for (const hash of hashes) {
                            const numberOfLinks =
                                index != totalQuotient ? _consts.MAX_TRANSACTIONS_PER_BLOCK : totalRemainder

                            const linkDetails = {
                                chainId: _chainID,
                                tokenAmount: 0, //doesnt matter here
                                tokenAddress: token.tokenAddress,
                                baseUrl: baseUrl,
                                trackId: trackId,
                                tokenDecimals: tokenDecimals,
                                tokenType: tokenType,
                            }

                            //gets the links from the tx
                            const getLinksFromTxResponse = await getLinksFromTx({
                                passwords: Array(numberOfLinks).fill(_password), // always creating array of 250, max is 250 and not trivial to find out how much links a password
                                txHash: hash,
                                linkDetails: linkDetails,
                                provider: signer.provider,
                            })

                            console.log({ getLinksFromTxResponse })

                            //creates a multilink from the links
                            const createdMultilink = createMultiLinkFromLinks(getLinksFromTxResponse.links)

                            // returns array of links
                            links.push(createdMultilink)

                            index++

                            _localstorageItem.tokenDetails = _localstorageItem.tokenDetails.map((_token) => {
                                if (_token.tokenAddress === token.tokenAddress) {
                                    return {
                                        ..._token,
                                        link:
                                            _token.link !== ''
                                                ? combineRaffleLink([_token.link, createdMultilink])
                                                : createdMultilink,
                                    }
                                }
                                return _token
                            })

                            updateLocalstorageItem(_localstorageKey, _localstorageItem)

                            console.log({
                                _localstorageItem,
                            })
                        }

                        console.log({ links })

                        const combinedLink = combineRaffleLink(links)

                        console.log({ combinedLink })

                        raffleLinks.push(combinedLink)

                        _localstorageItem.tokenDetails = _localstorageItem.tokenDetails.map((_token) => {
                            if (_token.tokenAddress === token.tokenAddress) {
                                return {
                                    ..._token,
                                    link: combinedLink,
                                    completed: true,
                                }
                            }
                            return _token
                        })

                        updateLocalstorageItem(_localstorageKey, _localstorageItem)
                        console.log({
                            _localstorageItem,
                        })
                    }
                }

                console.log(raffleLinks)

                let FINAL_finalfinalv4rafflelink_final = raffleLinks[0]
                if (raffleLinks.length > 1) {
                    FINAL_finalfinalv4rafflelink_final = combineRaffleLink(raffleLinks)
                }

                await addLinkCreation({
                    name: _senderName,
                    link: FINAL_finalfinalv4rafflelink_final,
                    APIKey: 'youwish',
                    withCaptcha: true,
                    withMFA: true,
                    baseUrl: consts.next_proxy_url + '/submit-raffle-link',
                })

                console.log({ FINAL_finalfinalv4rafflelink_final })
                setFinalLink(FINAL_finalfinalv4rafflelink_final)

                _localstorageItem = {
                    ..._localstorageItem,
                    completed: true,
                    finalLink: FINAL_finalfinalv4rafflelink_final,
                }
                updateLocalstorageItem(_localstorageKey, _localstorageItem)

                console.log({
                    _localstorageItem,
                })

                setLoadingStates('idle')
            }
        } catch (error: any) {
            setLoadingStates('idle')

            if (error.toString().includes('Failed to get wallet client')) {
                setErrorState({
                    showError: true,
                    errorMessage: 'Please make sure your wallet is connected.',
                })
            } else {
                setErrorState({
                    showError: true,
                    errorMessage: 'Something went wrong while creating the raffle link',
                })
            }

            console.error(error)
        } finally {
            setLoadingStates('idle')
        }
    }

    function classNames(...classes: any) {
        return classes.filter(Boolean).join(' ')
    }

    useEffect(() => {
        if (address) {
            let localStorageItems: localStorageItem[] = []
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i)
                if (key !== null && key?.includes(`${address}-gigalink-`)) {
                    const value = localStorage.getItem(key)
                    if (value !== null) {
                        localStorageItems.push(JSON.parse(value))
                    }
                }
            }

            console.log(localStorageItems)
            setLocalStorageCompleteData(localStorageItems.filter((item) => item.completed === true))

            const incompleteForm = localStorageItems.find((item) => item.completed === false)
            if (incompleteForm) {
                console.log('found incomplete form, ', incompleteForm)
                setIncompleteForm(incompleteForm)
                setFormState(
                    incompleteForm.tokenDetails.map((token) => {
                        return {
                            tokenAddress: token.tokenAddress,
                            tokenAmount: token.tokenAmount,
                            numberOfSlots: token.numberOfSlots,
                        }
                    })
                )
            } else {
                setIncompleteForm(undefined)
            }
        }
    }, [])

    useEffect(() => {
        console.log(copiedIdx)
    }, [copiedIdx])

    return (
        <>
            <global_components.CardWrapper redPacket>
                <div className=" mt-10 flex w-full flex-col items-center gap-2 text-center">
                    <h2 className="title-font bold my-0 text-2xl lg:text-4xl">Create a Mega Red Packet</h2>
                    <h3 className="my-2">
                        click{' '}
                        <label
                            className="cursor-pointer underline"
                            onClick={() => {
                                setShowManualModal(true)
                            }}
                        >
                            here
                        </label>{' '}
                        to read the instructions
                    </h3>

                    <h3 className="my-2">
                        click{' '}
                        <label
                            className="cursor-pointer underline"
                            onClick={() => {
                                setShowDashboardModal(true)
                            }}
                        >
                            here
                        </label>{' '}
                        to see previously created links
                    </h3>

                    <Switch.Group as="div" className="flex items-center gap-4">
                        <Switch.Label as="span">
                            <span className="text-sm">Testnet</span>
                        </Switch.Label>
                        <Switch
                            checked={isMainnet}
                            onChange={setIsMainnet}
                            className={classNames(
                                isMainnet ? 'bg-teal' : 'bg-gray-200',
                                'relative m-0 inline-flex h-4 w-9 flex-shrink-0 cursor-pointer rounded-none border-2 border-black p-0 transition-colors duration-200 ease-in-out '
                            )}
                        >
                            <span
                                aria-hidden="true"
                                className={classNames(
                                    isMainnet ? 'translate-x-5' : 'translate-x-0',
                                    'pointer-events-none m-0 inline-block h-3 w-3 transform rounded-none border-2 border-black bg-white shadow ring-0 transition duration-200 ease-in-out'
                                )}
                            />
                        </Switch>
                        <Switch.Label as="span">
                            <span className="text-sm">Mainnet</span>
                        </Switch.Label>
                    </Switch.Group>

                    <div className="mt-4 flex w-full flex-col items-center justify-center">
                        <div className="grid w-full gap-4">
                            {formState.map((item, idx) => {
                                return (
                                    <Fragment key={idx}>
                                        <div className="flex w-full items-center justify-center gap-2">
                                            <div>
                                                <label className="flex h-full items-center justify-center text-xl font-bold">
                                                    #{idx + 1}
                                                </label>
                                            </div>
                                            <div className="grid grid-cols-3 items-center gap-4">
                                                <div className="col-span-1 flex h-[58px] flex-col items-start gap-2 border-4 border-solid !px-4 !py-1">
                                                    <div className="font-normal">Token address</div>
                                                    <input
                                                        className="w-full items-center overflow-hidden overflow-ellipsis whitespace-nowrap break-all border-none bg-transparent p-0 text-xl font-bold outline-none"
                                                        placeholder="0x123"
                                                        type="text"
                                                        autoComplete="off"
                                                        autoFocus
                                                        onChange={(e) => {
                                                            const newFormState = formState
                                                            newFormState[idx].tokenAddress = e.target.value
                                                            setFormState(newFormState)
                                                        }}
                                                        defaultValue={formState[idx].tokenAddress}
                                                    />
                                                </div>
                                                <div className="col-span-1 flex h-[58px] flex-col items-start gap-2 border-4 border-solid !px-4 !py-1">
                                                    <div className="font-normal">TOTAL Token amount</div>
                                                    <input
                                                        className="w-full items-center overflow-hidden overflow-ellipsis whitespace-nowrap break-all border-none bg-transparent p-0 text-xl font-bold outline-none"
                                                        placeholder="500"
                                                        type="number"
                                                        inputMode="decimal"
                                                        autoComplete="off"
                                                        onChange={(e) => {
                                                            const newFormState = formState
                                                            console.log(Number(e.target.value))
                                                            newFormState[idx].tokenAmount = Number(e.target.value)
                                                            setFormState(newFormState)
                                                        }}
                                                        defaultValue={formState[idx].tokenAmount}
                                                    />
                                                </div>
                                                <div className="col-span-1 flex h-[58px] flex-col items-start gap-2 border-4 border-solid !px-4 !py-1">
                                                    <div className="font-normal">Number of slots</div>
                                                    <input
                                                        className="w-full items-center overflow-hidden overflow-ellipsis whitespace-nowrap break-all border-none bg-transparent p-0 text-xl font-bold outline-none"
                                                        placeholder="1000"
                                                        type="number"
                                                        inputMode="decimal"
                                                        autoComplete="off"
                                                        onChange={(e) => {
                                                            const newFormState = formState
                                                            newFormState[idx].numberOfSlots = Number(e.target.value)
                                                            setFormState(newFormState)
                                                        }}
                                                        defaultValue={formState[idx].numberOfSlots}
                                                    />
                                                </div>
                                            </div>
                                        </div>

                                        {idx < formState.length - 1 && <div className="brutalborder w-full"></div>}
                                    </Fragment>
                                )
                            })}
                        </div>
                    </div>

                    <div className="col-span-1 ml-6 flex h-[58px] w-[270px] flex-col items-start gap-2 border-4 border-solid !px-4 !py-1">
                        <div className="font-normal">Name</div>
                        <input
                            className="w-full items-center overflow-hidden overflow-ellipsis whitespace-nowrap break-all border-none bg-transparent p-0 text-xl font-bold outline-none"
                            placeholder="Ben"
                            type="text"
                            autoComplete="off"
                            autoFocus
                            onChange={(e) => {
                                setSenderName(e.target.value)
                            }}
                        />
                    </div>

                    {incompleteForm && (
                        <h3 className="my-6 w-4/5 font-bold">
                            The proccess of creating a gigalink was interupted. Click continue to finish the link.
                        </h3>
                    )}
                    {txStep && (
                        <div>
                            Step: {txStep.step}/{txStep.length}
                        </div>
                    )}

                    <div
                        className={
                            errorState.showError
                                ? 'mx-auto mb-0 mt-4 flex w-full flex-col items-center gap-10 sm:mt-0'
                                : 'mx-auto mb-8 mt-4 flex w-full flex-col items-center sm:mt-0'
                        }
                    >
                        <button
                            type={'button'}
                            className="mt-2 block w-[90%] cursor-pointer bg-white p-5 px-2  text-2xl font-black sm:w-2/5 lg:w-1/2"
                            id="cta-btn"
                            onClick={() => {
                                if (!isConnected) {
                                    open()
                                } else if (incompleteForm) {
                                    completeRaffle()
                                } else {
                                    createRaffle()
                                }
                            }}
                            disabled={isLoading || finalLink ? true : false}
                        >
                            {isLoading ? (
                                <div className="flex justify-center gap-1">
                                    <label>{loadingStates} </label>
                                    <span className="bouncing-dots flex">
                                        <span className="dot">.</span>
                                        <span className="dot">.</span>
                                        <span className="dot">.</span>
                                    </span>
                                </div>
                            ) : !isConnected ? (
                                'Connect Wallet'
                            ) : finalLink ? (
                                'Completed!'
                            ) : incompleteForm ? (
                                'Continue'
                            ) : (
                                'Create'
                            )}
                        </button>

                        {finalLink ? (
                            <div className="brutalborder relative mt-4 flex w-4/5 items-center bg-black py-1 text-white ">
                                <div className="flex w-[90%] items-center overflow-hidden overflow-ellipsis whitespace-nowrap break-all bg-black p-2 text-lg font-normal text-white">
                                    {finalLink}
                                </div>
                                <div
                                    className="absolute right-0 top-0 flex h-full min-w-32 cursor-pointer items-center justify-center border-none bg-white px-1 text-black md:px-4"
                                    onClick={() => {
                                        navigator.clipboard.writeText(finalLink ?? '')
                                        setIsCopied(true)
                                    }}
                                >
                                    {isCopied ? (
                                        <div className="flex h-full cursor-pointer items-center border-none bg-white text-base font-bold ">
                                            <span className="tooltiptext inline w-full justify-center" id="myTooltip">
                                                {' '}
                                                copied!{' '}
                                            </span>
                                        </div>
                                    ) : (
                                        <button className="h-full cursor-pointer gap-2 border-none bg-white p-0 text-base font-bold ">
                                            <label className="cursor-pointer text-black">COPY</label>
                                        </button>
                                    )}
                                </div>
                            </div>
                        ) : errorState.showError ? (
                            <div className="text-center">
                                <label className="font-bold text-red ">{errorState.errorMessage}</label>
                            </div>
                        ) : (
                            isLoading && (
                                <div className="mt-6 w-4/5 text-xl font-black">
                                    Please do not click away during the creation proccess. This might take a while
                                </div>
                            )
                        )}
                    </div>
                    <p className="my-0 mt-4">
                        Hop over into our{' '}
                        <a href="https://discord.com/invite/BX9Ak7AW28" className=" text-black" target="_blank">
                            discord
                        </a>{' '}
                        in case of any issues!
                    </p>
                </div>
            </global_components.CardWrapper>

            <Transition.Root show={showManualModal} as={Fragment}>
                <Dialog
                    as="div"
                    className="relative z-10 "
                    onClose={() => {
                        setShowManualModal(false)
                    }}
                >
                    <Transition.Child
                        as={Fragment}
                        enter="ease-out duration-300"
                        enterFrom="opacity-0"
                        enterTo="opacity-100"
                        leave="ease-in duration-200"
                        leaveFrom="opacity-100"
                        leaveTo="opacity-0"
                    >
                        <div className="fixed inset-0 bg-black bg-opacity-75 transition-opacity" />
                    </Transition.Child>

                    <div className="fixed inset-0 z-10 overflow-y-auto">
                        <div className="flex min-h-full min-w-full items-end justify-center text-center sm:items-center ">
                            <Transition.Child
                                as={Fragment}
                                enter="ease-out duration-300"
                                enterFrom="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
                                enterTo="opacity-100 translate-y-0 sm:scale-100"
                                leave="ease-in duration-200"
                                leaveFrom="opacity-100 translate-y-0 sm:scale-100"
                                leaveTo="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
                            >
                                <Dialog.Panel className="brutalborder relative my-24 w-full min-w-[980px] max-w-[980px]  transform overflow-hidden rounded-lg rounded-none bg-white py-5 text-left text-black shadow-xl  transition-all ">
                                    <div className="border-2 border-black bg-white p-6 font-mono text-black">
                                        <p className="mb-2 border-b border-black pb-2">
                                            This is a widget for marketers joining the Mantle Red Packets campaign to
                                            create Red Packets with:
                                        </p>
                                        <ul className="mb-2 list-inside list-disc border-b border-black pb-2">
                                            <li>More than 250 slots</li>
                                            <li>Multiple tokens</li>
                                            <li>Only works on mantle</li>
                                        </ul>
                                        <p className="mb-2 border-b border-black pb-2">
                                            Each project's red packets should contain:
                                        </p>
                                        <ul className="mb-2 list-inside list-disc border-b border-black pb-2">
                                            <li>Either 1000 USDC or project token - 2000 slots</li>
                                            <li>2000 MNT - 2000 slots</li>
                                            <li>10000 $MDRAGON - 6000 slots</li>
                                        </ul>
                                        <p className="mb-2 border-b border-black pb-2">Some common token addresses:</p>
                                        <ul className="mb-2 list-inside list-disc border-b border-black pb-2">
                                            <li>MNT: 0xDeadDeAddeAddEAddeadDEaDDEAdDeaDDeAD0000</li>
                                            <li>MDRAGON: 0x057250c1DeFbfE4BD75240e3607A055FC072B6d0</li>
                                            <li>USDC: 0x09bc4e0d864854c6afb6eb9a9cdf58ac190d0df9</li>
                                        </ul>
                                        <p className="mb-2 border-b border-black pb-2">Instructions:</p>
                                        <ol className="mb-2 list-inside list-decimal border-b border-black pb-2">
                                            <li>Populate the token addresses,</li>
                                            <li>Amounts of tokens,</li>
                                            <li>The number of slots,</li>
                                            <li>Confirm.</li>
                                        </ol>
                                        <p className="mb-2 border-b border-black pb-2">
                                            Make yourself a cup of green tea as you will be prompted for approx. 40
                                            signatures and 3-4 allowances, each one depositing for 250 slots (which is a
                                            hard onchain limit). This might take more than 15 minutes in total, so
                                            please prepare the links well in advance of the campaign. Do not navigate
                                            away from the page or change tabs during the process.
                                        </p>
                                        <p className="mb-2 border-b border-black pb-2">
                                            If the processes gets interrupted through an error, you can safely continue
                                            by reloading the page. You will be prompted to complete the raffle link
                                            instead of making a new one.
                                        </p>
                                        <p className="mb-2 border-b border-black pb-2 font-bold">
                                            Before you start, ensure you have the relevant amounts of ERC-20 tokens and
                                            at least 100 MNT for gas (it will not cost as much).
                                        </p>
                                        <p className="mb-2 border-b border-black pb-2 ">
                                            Fill out the rows with the token address, the amount of tokens, and the
                                            number of slots you want to create. You can add up to 4 different tokens,
                                            just leave the remaining ones empty.
                                        </p>
                                        <p className="mb-2 border-b border-black pb-2">
                                            DONT USE BRAVE OR INCOGNITO BROWSER
                                        </p>
                                    </div>
                                </Dialog.Panel>
                            </Transition.Child>
                        </div>
                    </div>
                </Dialog>
            </Transition.Root>

            <Transition.Root show={showDashboardModal} as={Fragment}>
                <Dialog
                    as="div"
                    className="relative z-10 "
                    onClose={() => {
                        setShowDashboardModal(false)
                    }}
                >
                    <Transition.Child
                        as={Fragment}
                        enter="ease-out duration-300"
                        enterFrom="opacity-0"
                        enterTo="opacity-100"
                        leave="ease-in duration-200"
                        leaveFrom="opacity-100"
                        leaveTo="opacity-0"
                    >
                        <div className="fixed inset-0 bg-black bg-opacity-75 transition-opacity" />
                    </Transition.Child>

                    <div className="fixed inset-0 z-10 overflow-y-auto">
                        <div className="flex min-h-full min-w-full items-end justify-center text-center sm:items-center ">
                            <Transition.Child
                                as={Fragment}
                                enter="ease-out duration-300"
                                enterFrom="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
                                enterTo="opacity-100 translate-y-0 sm:scale-100"
                                leave="ease-in duration-200"
                                leaveFrom="opacity-100 translate-y-0 sm:scale-100"
                                leaveTo="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
                            >
                                <Dialog.Panel className="brutalborder relative my-24 w-full min-w-[980px] max-w-[980px]  transform overflow-hidden rounded-lg rounded-none bg-white py-5 text-left text-black shadow-xl  transition-all ">
                                    <div className="flex flex-col items-center justify-center gap-2 ">
                                        {localStorageCompleteData.length > 0
                                            ? localStorageCompleteData.map((item, idx) => {
                                                  return (
                                                      <div
                                                          className="brutalborder relative flex w-4/5 cursor-pointer items-center bg-black py-1 text-white "
                                                          onClick={() => {
                                                              navigator.clipboard.writeText(item.finalLink ?? '')
                                                              setCopiedIdx(idx)
                                                          }}
                                                      >
                                                          <div className="flex w-[100%] items-center overflow-hidden overflow-ellipsis whitespace-nowrap break-all bg-black p-2 text-lg font-normal text-white">
                                                              {item.finalLink}
                                                          </div>

                                                          <div
                                                              className="absolute right-0 top-0 flex h-full min-w-12 cursor-pointer items-center justify-center border-none bg-white px-1 text-black md:px-4"
                                                              onClick={() => {
                                                                  navigator.clipboard.writeText(item.finalLink)
                                                                  setCopiedIdx(idx)
                                                              }}
                                                              data-tooltip-id="my-tooltip"
                                                          >
                                                              <button className="h-full cursor-pointer gap-2 border-none bg-white pt-2 text-base font-bold ">
                                                                  <img
                                                                      src={
                                                                          copiedIdx == idx
                                                                              ? checkbox_svg.src
                                                                              : clipboard_svg.src
                                                                      }
                                                                      className="h-8 w-8 "
                                                                  />
                                                              </button>
                                                          </div>
                                                      </div>
                                                  )
                                              })
                                            : 'No links created yet. Make sure the correct wallet is connected'}
                                    </div>
                                </Dialog.Panel>
                            </Transition.Child>
                        </div>
                    </div>
                </Dialog>
            </Transition.Root>
        </>
    )
}
