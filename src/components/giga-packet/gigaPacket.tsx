'use client'
import * as global_components from '@/components/global'
import { Fragment, useEffect, useMemo, useState } from 'react'
import { useAccount, useNetwork } from 'wagmi'
import { providers, ethers } from 'ethers'
import { switchNetwork, getWalletClient } from '@wagmi/core'
import peanut, {
    getDefaultProvider,
    getRaffleLinkFromTx,
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
} from '@squirrel-labs/peanut-sdk'

import * as utils from '@/utils'
import * as consts from '@/consts'
import * as hooks from '@/hooks'
import * as _utils from './gigaPacket.utils'
import * as _consts from './gigaPacket.consts'
import { Dialog, Switch, Transition } from '@headlessui/react'
import { useWeb3Modal } from '@web3modal/wagmi/react'
import { waitForTransactionReceipt } from 'viem/_types/actions/public/waitForTransactionReceipt'

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

export function GigaPacket() {
    const { isConnected, address } = useAccount()
    const { chain: currentChain } = useNetwork()
    const { open } = useWeb3Modal()
    const [isCopied, setIsCopied] = useState(false)

    const [peanutPassword, setPeanutPassword] = useState<string>('')
    const [finalLink, setFinalLink] = useState<string | undefined>(undefined)
    const [isMainnet, setIsMainnet] = useState<boolean>(true)
    const [showModal, setShowModal] = useState<boolean>(false)
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

    async function setPassword() {
        const _password = utils.getFromLocalStorage('latest-gigalink-password')
        if (_password == null) {
            const _passw = await getRandomString(16)
            setPeanutPassword(_passw)
            utils.saveToLocalStorage('latest-gigalink-password', _passw)
        } else {
            setPeanutPassword(_password)
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

    async function createRaffle() {
        setErrorState({
            showError: false,
            errorMessage: '',
        })
        // check if token addresses are correct
        // check if amounts and number of slots per link are correct

        try {
            const _formState = formState.filter((state) => state.tokenAddress !== '')

            if (senderName == '') {
                setErrorState({
                    showError: true,
                    errorMessage: 'Please provide a name for the sender',
                })
                return
            }

            console.log(senderName)

            if (_formState.length === 0) {
                setErrorState({
                    showError: true,
                    errorMessage: 'Please provide the details for at least one token.',
                })
                return
            }

            setLoadingStates('executing transaction')

            if (!checkForm(_formState)) {
                setLoadingStates('idle')
                return
            }

            const _chainID = isMainnet ? _consts.MANTLE_CHAIN_ID : _consts.MANTLE_TESTNET_CHAIN_ID

            //Check network
            await checkNetwork(_chainID)

            //get signer
            const signer = await getWalletClientAndUpdateSigner({ chainId: _chainID })

            //filter out empty token fields

            let raffleLinks: string[] = []

            const baseUrl = `${window.location.origin}/packet`
            const trackId = 'mantle'

            const batcherContractVersion = getLatestContractVersion({
                chainId: _chainID,
                type: 'batch',
                experimental: true,
            })

            const currentDateTime = new Date()
            const localstorageKey = `saving giga-link for address: ${address} at ${currentDateTime}`
            const premadeLink = `${baseUrl}?c=${_chainID}&v=v4.3&i=&t=${trackId}#p=${peanutPassword}`
            utils.saveToLocalStorage(localstorageKey, premadeLink)

            console.log('saved to localstorage with key and value:', localstorageKey, premadeLink)
            const defaultProvider = await getDefaultProvider(_chainID) // get from wallet? But rpc.mantle.xyz should work

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
                        const tx = await signer.sendTransaction(combined)

                        await tx.wait()
                    }
                }
            }

            await new Promise((resolve) => setTimeout(resolve, 2500))

            // We'll handle each token separately
            for (const token of _formState) {
                let preparedTransactions: interfaces.IPrepareDepositTxsResponse[] = []
                const [quotient, remainder] = _utils.divideAndRemainder(token.numberOfSlots)
                console.log(token.tokenAmount)
                console.log(token.numberOfSlots)
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

                console.log('tokenType:', tokenType)
                console.log('tokenDecimals:', tokenDecimals)

                console.log(token)
                // prepare the transactions. It is calculated based on the number of slots and the max transactions per block
                for (let index = 0; index <= quotient; index++) {
                    const numberofLinks = index != quotient ? _consts.MAX_TRANSACTIONS_PER_BLOCK : remainder

                    console.log(numberofLinks)

                    console.log(tokenAmountPerSlot)

                    console.log(Number(tokenAmountPerSlot * numberofLinks))

                    console.log(index != quotient ? _consts.MAX_TRANSACTIONS_PER_BLOCK : remainder)

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

                console.log('preparedTx: ', preparedTransactions)

                if (token.tokenAddress === _consts.MANTLE_NATIVE_TOKEN_ADDRESS) {
                    console.log('hier')
                    preparedTransactions = preparedTransactions.map((item) => {
                        console.log(item.unsignedTxs.length)
                        if (item.unsignedTxs.length === 2) {
                            // Filter out the first transaction and return only the second one
                            return { unsignedTxs: [item.unsignedTxs[1]] }
                        }
                        // If the length is not 2, return the item as it is
                        return item
                    })
                }

                console.log('filtered preparedTx: ', preparedTransactions)

                let hashes: string[] = []

                for (const preparedTransactionsArray of preparedTransactions) {
                    let index = 0
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
                        console.log(txOptions)

                        const convertedTransaction: ethers.providers.TransactionRequest = {
                            from: prearedTransaction.from,
                            to: prearedTransaction.to,
                            data: prearedTransaction.data,
                            value: prearedTransaction.value
                                ? ethers.BigNumber.from(prearedTransaction.value)
                                : undefined,
                        }
                        const combined = {
                            ...txOptions,
                            ...convertedTransaction,
                        } as ethers.providers.TransactionRequest

                        console.log('combined:', combined)
                        const tx = await signer.sendTransaction(combined)
                        await tx.wait()
                        hashes.push(tx.hash)

                        index++
                    }
                }

                console.log('hashes:', hashes)

                const links: string[] = []
                let index = 0

                for (const hash of hashes) {
                    const numberofLinks = index != quotient ? _consts.MAX_TRANSACTIONS_PER_BLOCK : remainder

                    const linkDetails = {
                        chainId: _chainID,
                        tokenAmount: 0,
                        tokenAddress: token.tokenAddress,
                        baseUrl: 'https://red.peanut.to/packet',
                        trackId: 'mantle',
                        tokenDecimals: tokenDecimals,
                        tokenType: tokenType,
                    }

                    // TODO: push to backend
                    // const getLinkFromTxResponse = await getRaffleLinkFromTx({
                    //     password: peanutPassword,
                    //     txHash: hash,
                    //     name: '',
                    //     linkDetails: linkDetails,
                    //     withMFA: true,
                    //     withCaptcha: true,
                    //     APIKey: process.env.PEANUT_API_KEY ?? '',
                    //     numberOfLinks: numberofLinks,
                    //     provider: signer.provider,
                    // })

                    // TODO: len passwords
                    const getLinksFromTxResponse = await getLinksFromTx({
                        passwords: Array(numberofLinks).fill(peanutPassword),
                        txHash: hash,
                        linkDetails: linkDetails,
                        provider: signer.provider,
                    })

                    const createdMultilink = createMultiLinkFromLinks(getLinksFromTxResponse.links)

                    // returns array of links
                    links.push(createdMultilink)

                    index++
                }

                console.log('links:', links)

                const combinedLink = combineRaffleLink(links)

                console.log(combinedLink)

                // save to localstorage status with smt like not finalized

                const localstorageItem = utils.getFromLocalStorage(localstorageKey)

                console.log(localstorageItem)

                const localstorageItemUrl = new URL(localstorageItem)

                console.log(localstorageItemUrl.searchParams.get('i'))

                if (localstorageItemUrl.searchParams.get('i') == '') {
                    console.log('hier') // lmao
                    utils.saveToLocalStorage(localstorageKey, combinedLink)
                } else {
                    console.log('da')
                    console.log(localstorageItem)
                    console.log(combinedLink)
                    const _combinedLink = combineRaffleLink([localstorageItem, combinedLink])
                    utils.saveToLocalStorage(localstorageKey, _combinedLink)
                }

                raffleLinks.push(combinedLink)
            }
            const finalfinalv4rafflelink_final = combineRaffleLink(raffleLinks)
            console.log(finalfinalv4rafflelink_final)
            setFinalLink(finalfinalv4rafflelink_final)

            await addLinkCreation({
                name: senderName,
                link: finalfinalv4rafflelink_final,
                APIKey: 'youwish',
                withCaptcha: true,
                withMFA: true,
                baseUrl: consts.next_proxy_url + '/submit-raffle-link',
            })

            utils.delteFromLocalStorage('latest-gigalink-password')
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
                    errorMessage: error.toString(),
                })
            }

            console.error(error)
        } finally {
            setLoadingStates('idle')
        }
    }

    useEffect(() => {
        if (peanutPassword == '') {
            setPassword()
        }
        getAllGigalinks()
    }, [])

    function classNames(...classes: any) {
        return classes.filter(Boolean).join(' ')
    }

    function getAllGigalinks() {
        const links = utils.getAllGigalinksFromLocalstorage({ address: address ?? '' })
        console.log(links)
    }

    return (
        <>
            <global_components.CardWrapper redPacket>
                <div className=" mt-10 flex w-full flex-col items-center gap-2 text-center">
                    <h2 className="title-font bold my-0 text-2xl lg:text-4xl">Create a Mega Red Packet</h2>
                    <div className="my-0 w-4/5 font-normal">
                        This is a form for specifically creating red packets with more than 250 slots. Only possible on
                        mantle.
                        <br></br>
                        <br></br>
                        <a className="font-bold">Instructions: </a>
                        Fill out the rows with the token address, the amount of tokens and the number of slots you want
                        to create. You can add up to 4 different tokens, just leave the remaining ones empty.
                        {/*  click{' '}
                        <label
                            className="cursor-pointer underline"
                            onClick={() => {
                                setShowModal(true)
                            }}
                        >
                            here
                        </label>{' '}
                        to see all previously created giga-links */}
                    </div>

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

                    <div className="my-4 w-4/5 font-normal">
                        Please confirm all token addresses are correct and your connected wallet has sufficient funds!
                    </div>

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
                                } else {
                                    createRaffle()
                                }
                            }}
                            disabled={isLoading ? true : false}
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
                        ) : (
                            isLoading && (
                                <div className="mt-6 w-4/5 text-xl font-black">
                                    Please do not click away during the creation proccess. This might take a while
                                </div>
                            )
                        )}

                        {errorState.showError && (
                            <div className="text-center">
                                <label className="font-bold text-red ">{errorState.errorMessage}</label>
                            </div>
                        )}
                    </div>
                </div>
            </global_components.CardWrapper>

            <Transition.Root show={showModal} as={Fragment}>
                <Dialog
                    as="div"
                    className="relative z-10 "
                    onClose={() => {
                        setShowModal(false)
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
                                <Dialog.Panel className="brutalborder relative h-max w-full transform overflow-hidden rounded-lg rounded-none bg-white pt-5 text-left text-black shadow-xl transition-all sm:mt-8  sm:w-auto sm:min-w-[420px] sm:max-w-[420px] ">
                                    <div className="flex flex-col items-center justify-center gap-6 p-12 ">
                                        <div>
                                            Henlo! That's a lot of recipients! If you're running a larger campaign, we'd
                                            love to help.{' '}
                                            <a
                                                href={'https://cal.com/kkonrad+hugo0/15min?duration=30'}
                                                target="_blank"
                                                rel="noreferrer noopener"
                                                className=" cursor-pointer text-black underline"
                                            >
                                                book
                                            </a>{' '}
                                            a meeting or share your email and we'll get in touch!
                                        </div>
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
