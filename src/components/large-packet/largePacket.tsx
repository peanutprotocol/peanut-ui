'use client'
import * as global_components from '@/components/global'
import { useEffect, useMemo, useState } from 'react'
import { useAccount, useNetwork, useSendTransaction } from 'wagmi'
import * as consts from '@/consts'
import * as hooks from '@/hooks'
import { ethers } from 'ethers'
import peanut, {
    getLinksFromTx,
    getRaffleLinkFromTx,
    getRandomString,
    interfaces,
    prepareRaffleDepositTxs,
    setFeeOptions,
    trim_decimal_overflow,
} from '@squirrel-labs/peanut-sdk'
import { providers } from 'ethers'
import { switchNetwork, getWalletClient, sendTransaction } from '@wagmi/core'
import * as utils from '@/utils'
import { WalletClient } from 'wagmi'
import { tokenToString } from 'typescript'

const MAX_TRANSACTIONS_PER_BLOCK = 5

const MANTLE_CHAIN_ID = '11155111'

const mockData = [
    {
        tokenAddress: '0xdeaddeaddeaddeaddeaddeaddeaddeaddead0000',
        tokenAmount: 25000,
        numberOfSlots: 5534,
        tokenDecimals: 18,
        tokenType: 0,
    },
    {
        tokenAddress: '0x09bc4e0d864854c6afb6eb9a9cdf58ac190d0df9',
        tokenAmount: 25000,
        numberOfSlots: 3337,
        tokenDecimals: 6,
        tokenType: 1,
    },
    {
        tokenAddress: '0x217b4382a1de262c0fba97c1b8378904b4a25e4d',
        tokenAmount: 250000,
        numberOfSlots: 2292,
        tokenDecimals: 18,
        tokenType: 1,
    },
    {
        tokenAddress: '',
        tokenAmount: 0,
        numberOfSlots: 0,
        tokenDecimals: 0,
        tokenType: 0,
    },
]

//0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238

export function LargePacket() {
    const { isConnected, address } = useAccount()
    const [peanutPassword, setPeanutPassword] = useState<string>('')
    const { chain: currentChain } = useNetwork()

    hooks.useConfirmRefresh(true)

    const [loadingStates, setLoadingStates] = useState<consts.LoadingStates>('idle')
    const isLoading = useMemo(() => loadingStates !== 'idle', [loadingStates])

    const [formState, setFormState] = useState<
        {
            tokenAddress: string
            tokenAmount: number
            numberOfSlots: number
            tokenDecimals: number
            tokenType: number
        }[]
    >([
        {
            tokenAddress: '0x0000000000000000000000000000000000000000',
            tokenAmount: 0.1,
            numberOfSlots: 11,
            tokenDecimals: 18,
            tokenType: 0,
        },
        {
            tokenAddress: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238',
            tokenAmount: 0.1,
            numberOfSlots: 9,
            tokenDecimals: 6,
            tokenType: 1,
        },
    ])

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
        const signer = walletClientToSigner(walletClient)
        return signer
    }

    function walletClientToSigner(walletClient: WalletClient) {
        const { account, chain, transport } = walletClient
        const network = {
            chainId: chain.id,
            name: chain.name,
            ensAddress: chain.contracts?.ensRegistry?.address,
        }
        const provider = new providers.Web3Provider(transport, network)
        const signer = provider.getSigner(account.address)
        return signer
    }

    function divideAndRemainder(value: number): [number, number] {
        const quotient = Math.floor(value / MAX_TRANSACTIONS_PER_BLOCK)
        const remainder = value % MAX_TRANSACTIONS_PER_BLOCK
        return [quotient, remainder]
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

        const expandedLinks = links.map((link) => peanut.expandMultilink(link))
        const combinedLink = peanut.createMultiLinkFromLinks(expandedLinks)

        return combinedLink
    }

    async function createRaffle() {
        setLoadingStates('executing transaction')
        // check if token addresses are correct
        // check if amounts and number of slots per link are correct

        try {
            await checkNetwork(MANTLE_CHAIN_ID)

            //get signer
            const signer = await getWalletClientAndUpdateSigner({ chainId: MANTLE_CHAIN_ID })

            //filter out empty token fields
            const _formState = formState.filter((state) => state.tokenAddress !== '')

            let raffleLinks: string[] = []

            for (const token of _formState) {
                let preparedTransactions: interfaces.IPrepareDepositTxsResponse[] = []

                const [quotient, remainder] = divideAndRemainder(token.numberOfSlots)

                const tokenAmountPerSlot = token.tokenAmount / token.numberOfSlots

                if (token.tokenType == 1) {
                    const tokenAmountString = trim_decimal_overflow(token.tokenAmount, token.tokenDecimals)
                    const tokenAmountBigNum = ethers.utils.parseUnits(tokenAmountString, token.tokenDecimals)
                    const batcherContractVersion = 'Bv4.2'

                    const approveTx = await peanut.prepareApproveERC20Tx(
                        address ?? '',
                        MANTLE_CHAIN_ID,
                        token.tokenAddress,
                        tokenAmountBigNum,
                        -1, // decimals doesn't matter
                        true, // already a prepared bignumber
                        batcherContractVersion,
                        signer.provider
                    )

                    if (approveTx) {
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

                        console.log(combined)
                        const tx = await signer.sendTransaction(combined)

                        await tx.wait()
                    }
                }

                for (let index = 0; index <= quotient; index++) {
                    const numberofLinks = index != quotient ? MAX_TRANSACTIONS_PER_BLOCK : remainder

                    //TODO !!IMPORTANT!!: update baseurl, tokenDecimals and tokenType !!!!!

                    if (numberofLinks > 0) {
                        const linkDetails = {
                            chainId: MANTLE_CHAIN_ID,
                            tokenAmount: Number(tokenAmountPerSlot * numberofLinks),
                            tokenAddress: token.tokenAddress,
                            baseUrl: 'https://red.peanut.to/packet',
                            trackId: 'mantle',
                            tokenDecimals: token.tokenDecimals,
                            tokenType: token.tokenType,
                        }

                        const prepTx = await prepareRaffleDepositTxs({
                            userAddress: address ?? '',
                            linkDetails: linkDetails,
                            password: peanutPassword,
                            numberOfLinks: index != quotient ? MAX_TRANSACTIONS_PER_BLOCK : remainder,
                        })

                        preparedTransactions.push(prepTx)
                    }
                }

                console.log(preparedTransactions)

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
                        const tx = await signer.sendTransaction(combined)
                        await tx.wait()
                        hashes.push(tx.hash)

                        index++
                    }
                }

                const links: string[] = []
                let index = 0

                console.log(hashes)

                await setTimeout(() => {}, 1500)

                for (const hash of hashes) {
                    const numberofLinks = index != quotient ? MAX_TRANSACTIONS_PER_BLOCK : remainder

                    const linkDetails = {
                        chainId: MANTLE_CHAIN_ID,
                        tokenAmount: 0,
                        tokenAddress: token.tokenAddress,
                        baseUrl: 'https://red.peanut.to/packet',
                        trackId: 'mantle',
                        tokenDecimals: token.tokenDecimals,
                        tokenType: token.tokenType,
                    }

                    const getLinkFromTxResponse = await getRaffleLinkFromTx({
                        password: peanutPassword,
                        txHash: hash,
                        linkDetails: linkDetails,
                        creatorAddress: address ?? '',
                        APIKey: process.env.PEANUT_API_KEY ?? '',
                        numberOfLinks: numberofLinks,
                        provider: signer.provider,
                    })

                    links.push(getLinkFromTxResponse.link)

                    index++
                }

                console.log(links)

                const combinedLink = combineRaffleLink(links)

                console.log(combinedLink)

                raffleLinks.push(combinedLink)
            }

            const finalfinalv4rafflelink_final = combineRaffleLink(raffleLinks)

            console.log(finalfinalv4rafflelink_final)
        } catch (error) {
            setLoadingStates('idle')

            console.error(error)
        } finally {
            setLoadingStates('idle')
        }
    }

    async function setPassword() {
        if (peanutPassword == '') {
            const passw = await getRandomString(16)
            setPeanutPassword(passw)
        }
    }

    useEffect(() => {
        if (peanutPassword == '') {
            setPassword()
        }
    }, [])

    useEffect(() => {
        console.log(peanutPassword)
    }, [peanutPassword])

    return (
        <global_components.CardWrapper redPacket>
            <div className=" mb-6 mt-10 flex w-full flex-col items-center gap-2 text-center">
                <h2 className="title-font bold my-0 text-2xl lg:text-4xl">Red Packet</h2>
                <div className="my-0 w-4/5 font-normal">
                    Form for specifically creating red packets with more than 250 slots. Only possible on mantle
                </div>

                <div className=" mt-4 flex w-full flex-col items-center justify-center gap-4 ">
                    {formState.map((item, idx) => {
                        return (
                            <div className=" flex flex-col gap-4" key={idx}>
                                <div className={'flex w-full flex-row items-center justify-between gap-4 '}>
                                    <div>#{idx}</div>
                                    <div className=" flex h-[58px] w-1/4 flex-col items-start gap-2 border-4 border-solid !px-4 !py-1">
                                        <div className="font-normal">Token address</div>
                                        <div className="flex flex-row items-center justify-between">
                                            <input
                                                className="items-center overflow-hidden overflow-ellipsis whitespace-nowrap break-all border-none bg-transparent p-0 text-xl font-bold outline-none"
                                                placeholder="0x123"
                                                type="text"
                                                autoComplete="off"
                                                autoFocus
                                                onChange={(e) => {
                                                    const newFormState = formState
                                                    newFormState[idx].tokenAddress = e.target.value
                                                    setFormState(newFormState)
                                                }}
                                            />
                                        </div>
                                    </div>
                                    <div className=" flex h-[58px] w-1/4 flex-col items-start gap-2 border-4 border-solid !px-4 !py-1">
                                        <div className="font-normal">Token amount </div>
                                        <div className="flex flex-row items-center justify-between">
                                            <input
                                                className="items-center overflow-hidden overflow-ellipsis whitespace-nowrap break-all border-none bg-transparent p-0 text-xl font-bold outline-none"
                                                placeholder="500"
                                                type="number"
                                                inputMode="decimal"
                                                autoComplete="off"
                                                onChange={(e) => {
                                                    const newFormState = formState
                                                    newFormState[idx].tokenAmount = parseInt(e.target.value)
                                                    setFormState(newFormState)
                                                }}
                                            />
                                        </div>
                                    </div>
                                    <div className=" flex h-[58px] w-1/4 flex-col items-start gap-2 border-4 border-solid !px-4 !py-1">
                                        <div className="font-normal">Number of slots</div>
                                        <div className="flex flex-row items-center justify-between">
                                            <input
                                                className="items-center overflow-hidden overflow-ellipsis whitespace-nowrap break-all border-none bg-transparent p-0 text-xl font-bold outline-none"
                                                placeholder="1000"
                                                type="number"
                                                inputMode="decimal"
                                                autoComplete="off"
                                                onChange={(e) => {
                                                    const newFormState = formState
                                                    newFormState[idx].numberOfSlots = parseInt(e.target.value)
                                                    setFormState(newFormState)
                                                }}
                                            />
                                        </div>
                                    </div>
                                </div>
                                <div className={!(idx + 1 == formState.length) ? 'brutalborder-bottom' : ''}></div>
                            </div>
                        )
                    })}
                </div>

                <div className="my-4 w-4/5 font-normal">
                    Please confirm all token addresses are correct and have sufficient funds.
                </div>

                <div
                    className={
                        errorState.showError
                            ? 'mx-auto mb-0 mt-4 flex w-full flex-col items-center gap-10 sm:mt-0'
                            : 'mx-auto mb-8 mt-4 flex w-full flex-col items-center sm:mt-0'
                    }
                >
                    <button
                        type={isConnected ? 'submit' : 'button'}
                        className="mt-2 block w-[90%] cursor-pointer bg-white p-5 px-2  text-2xl font-black sm:w-2/5 lg:w-1/2"
                        id="cta-btn"
                        onClick={() => {
                            createRaffle()
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

                    <div className="my-0 w-4/5 font-normal">
                        Please do not click away during the creation proccess. This might take a while
                    </div>
                    {errorState.showError && (
                        <div className="text-center">
                            <label className="font-bold text-red ">{errorState.errorMessage}</label>
                        </div>
                    )}
                </div>
            </div>
        </global_components.CardWrapper>
    )
}
