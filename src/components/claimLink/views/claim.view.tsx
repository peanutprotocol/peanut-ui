import { useWeb3Modal } from '@web3modal/wagmi/react'
import { useEffect, useMemo, useState } from 'react'
import { useAccount, useSwitchChain, useWalletClient } from 'wagmi'
import { ethers } from 'ethers'
import { useAtom } from 'jotai'
import peanut, { claimLinkGasless } from '@squirrel-labs/peanut-sdk'
import { useForm } from 'react-hook-form'
import { providers } from 'ethers'
import { isMobile } from 'react-device-detect'
import peanutman_logo from '@/assets/peanutman-logo.svg'

import * as global_components from '@/components/global'
import * as _consts from '../claim.consts'
import * as utils from '@/utils'
import * as store from '@/store'
import * as consts from '@/consts'
import dropdown_svg from '@/assets/dropdown.svg'
import axios from 'axios'

export function ClaimView({
    onNextScreen,
    claimDetails,
    claimLink,
    setTxHash,
    claimType,
    tokenPrice,
}: _consts.IClaimScreenProps) {
    const { isConnected, address, chain: currentChain } = useAccount()
    const { switchChainAsync } = useSwitchChain()
    const { open } = useWeb3Modal()
    const signer = utils.useEthersSigner({ chainId: Number(claimDetails[0].chainId) })

    const [isDropdownOpen, setIsDropdownOpen] = useState(false)
    const [chainDetails] = useAtom(store.defaultChainDetailsAtom)
    const [IpfsMetadata, setIpfsMetadata] = useState('')
    const verbose = true
    const [isIpfsLoading, setIsIpfsLoading] = useState(true)

    const [loadingStates, setLoadingStates] = useState<consts.LoadingStates>('idle')
    const isLoading = useMemo(() => loadingStates !== 'idle', [loadingStates])
    const [errorState, setErrorState] = useState<{
        showError: boolean
        errorMessage: string
    }>({ showError: false, errorMessage: '' })
    const [manualErrorState, setManualErrorState] = useState<{
        showError: boolean
        errorMessage: string
    }>({ showError: false, errorMessage: '' })

    const manualForm = useForm<{ address: string; addressExists: boolean }>({
        mode: 'onChange',
        reValidateMode: 'onChange',
        defaultValues: {
            address: '',
        },
    })

    const checkNetwork = async (chainId: string) => {
        //check if the user is on the correct chain
        if (currentChain?.id.toString() !== chainId.toString()) {
            setLoadingStates('allow network switch')

            try {
                await switchChainAsync({ chainId: Number(chainId) })
                setLoadingStates('switching network')
                await new Promise((resolve) => setTimeout(resolve, 4000))
                setLoadingStates('loading')
            } catch (error) {
                setLoadingStates('idle')
                console.error('Error switching network:', error)
                setErrorState({
                    showError: true,
                    errorMessage: 'Error switching network',
                })
            }
        }
    }

    const claim = async () => {
        if (isLoading) return
        try {
            if (claimLink && address) {
                setLoadingStates('executing transaction')

                let claimTx
                if (claimDetails[0].chainId == '1') {
                    await checkNetwork(claimDetails[0].chainId)

                    const _signer = await signer

                    if (!_signer) {
                        return //TODO: handle error
                    }

                    claimTx = await peanut.claimLink({
                        recipient: address,
                        link: claimLink[0],
                        structSigner: {
                            signer: _signer,
                        },
                    })
                } else {
                    claimTx = await claimLinkGasless({
                        link: claimLink[0],
                        recipientAddress: address,
                        baseUrl: `${consts.next_proxy_url}/claim-v2`,
                        APIKey: 'doesnt-matter',
                    })
                }
                verbose && console.log(claimTx)
                setTxHash([claimTx.transactionHash ?? claimTx.txHash ?? claimTx.hash ?? claimTx.tx_hash ?? ''])

                onNextScreen()
            }
        } catch (error) {
            setErrorState({
                showError: true,
                errorMessage: 'Something went wrong while claiming',
            })
            console.error(error)
        } finally {
            setLoadingStates('idle')
        }
    }

    const fetchIpfsFile = async (url: string) => {
        const ipfsHash = url.split('://')[1]
        let response = null
        let triedProviders = new Set<string>() // To keep track of providers already tried
        let randomProvider: string | null = null // Declare randomProvider outside the loop

        while (!response && triedProviders.size < consts.ipfsProviderArray.length) {
            const randomIndex = Math.floor(Math.random() * consts.ipfsProviderArray.length)
            randomProvider = consts.ipfsProviderArray[randomIndex]

            if (triedProviders.has(randomProvider)) {
                continue
            }

            triedProviders.add(randomProvider)

            try {
                response = await axios.get(randomProvider + ipfsHash)
                break
            } catch (error) {
                console.error('Error with provider:', randomProvider, '; Error:', error)
            }
        }

        if (response && randomProvider) {
            const formattedResponse = randomProvider + response.data.image.split('://')[1]
            setIpfsMetadata(formattedResponse)

            setTimeout(() => {
                setIsIpfsLoading(false)
            }, 1500)
        } else {
            console.error('All providers tried, none were successful.')
        }
    }

    useEffect(() => {
        if (claimDetails[0].tokenType == '2') {
            fetchIpfsFile(claimDetails[0].tokenURI)
        }
    }, [])

    const manualClaim = async (data: { address: string }) => {
        try {
            setManualErrorState({
                showError: false,
                errorMessage: '',
            })
            if (!ethers.utils.isAddress(data.address)) {
                setManualErrorState({
                    showError: true,
                    errorMessage: 'Please enter a valid address',
                })
                return
            }

            setLoadingStates('executing transaction')
            if (claimLink && data.address) {
                verbose && console.log('claiming link:' + claimLink)
                const claimTx = await claimLinkGasless({
                    link: claimLink[0],
                    recipientAddress: data.address,
                    baseUrl: `${consts.next_proxy_url}/claim-v2`,
                    APIKey: 'doesnt-matter',
                })

                setTxHash([claimTx.transactionHash ?? claimTx.txHash ?? claimTx.hash ?? claimTx.tx_hash ?? ''])

                onNextScreen()
            }
        } catch (error) {
            setErrorState({
                showError: true,
                errorMessage: 'Something went wrong while claiming',
            })
            console.error(error)
        } finally {
            setLoadingStates('idle')
        }
    }

    return (
        <>
            {' '}
            {claimType == 'PROMO' && (
                <h2 className="my-2 mb-4 text-center text-base font-black sm:text-xl  ">
                    Oh, you found a promo code! Enjoy your free money!
                </h2>
            )}
            {claimDetails[0].tokenType == '2' ? (
                <div className="flex flex-col items-center justify-center gap-4">
                    <h2 className="my-2 mb-0 text-center text-3xl font-black lg:text-6xl ">
                        Claim NFT on{' '}
                        {chainDetails && chainDetails.find((chain) => chain.chainId == claimDetails[0].chainId)?.name}
                    </h2>
                    <div className="h-64 w-64 p-6  ">
                        {isIpfsLoading ? (
                            <div className="flex h-full w-full animate-spin items-center justify-center">
                                <img src={peanutman_logo.src} alt="logo" className="h-1/2 w-1/2" />
                            </div>
                        ) : (
                            <img src={IpfsMetadata} className="brutalborder brutalshadow h-full w-full" />
                        )}{' '}
                    </div>
                </div>
            ) : (
                <h2 className="my-2 mb-0 text-center text-3xl font-black lg:text-6xl ">
                    Claim{' '}
                    <>
                        {tokenPrice
                            ? '$' + utils.formatAmount(Number(tokenPrice) * Number(claimDetails[0].tokenAmount))
                            : utils.formatTokenAmount(Number(claimDetails[0].tokenAmount))}{' '}
                        {tokenPrice ? 'in ' + claimDetails[0].tokenSymbol : claimDetails[0].tokenSymbol}
                    </>
                </h2>
            )}
            {claimDetails[0].tokenType != '2' ? (
                <h3 className="text-md mb-8 text-center font-black sm:text-lg lg:text-xl ">
                    {chainDetails && chainDetails.find((chain) => chain.chainId == claimDetails[0].chainId)?.name}
                </h3>
            ) : (
                <div className="mb-8 flex flex-col items-center justify-center gap-2">
                    <h3 className="text-md mb-0 text-center font-black sm:text-lg lg:text-xl ">
                        {claimDetails[0].tokenName}
                    </h3>
                    <a
                        className="text-black underline"
                        target="_blank"
                        href={
                            'https://opensea.io/assets/optimism/' +
                            claimDetails[0].tokenAddress +
                            '/' +
                            claimDetails[0].tokenId
                        }
                    >
                        opensea
                    </a>
                </div>
            )}
            <button
                type={isConnected ? 'submit' : 'button'}
                className="mt-2 block w-[90%] cursor-pointer bg-white p-5 px-2  text-2xl font-black sm:w-2/5 lg:w-1/2"
                id="cta-btn"
                onClick={() => {
                    !isConnected ? open() : claim()
                }}
                disabled={isLoading}
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
                ) : isConnected ? (
                    'Claim'
                ) : (
                    'Connect Wallet'
                )}
            </button>
            <div
                className="mt-2 flex cursor-pointer items-center justify-center"
                onClick={() => {
                    setIsDropdownOpen(!isDropdownOpen)
                }}
            >
                <div className="cursor-pointer border-none bg-white text-sm  ">manually enter address</div>
                <img
                    style={{
                        transform: isDropdownOpen ? 'scaleY(-1)' : 'none',
                        transition: 'transform 0.3s ease-in-out',
                    }}
                    src={dropdown_svg.src}
                    alt=""
                    className={'h-6 '}
                />
            </div>
            {isDropdownOpen && (
                <global_components.CardWrapper mb="mb-4">
                    <label className="block text-center text-xs font-medium">
                        If you can't connect, you can also write your address below <br />{' '}
                        <span className="italic">⚠️ WARNING: if you enter a wrong address, funds will get lost!!</span>
                    </label>

                    <form className=" w-full " onSubmit={manualForm.handleSubmit(manualClaim)}>
                        <div className="brutalborder mx-auto mt-4 flex w-11/12 flex-row sm:w-3/4">
                            <input
                                type="text"
                                className="h-4 w-full flex-grow border-none p-4 px-4 placeholder:text-xs placeholder:font-light"
                                placeholder="0x6B37..."
                                {...manualForm.register('address')}
                            />
                            <div className="w-1/8 brutalborder-left tooltip block h-4 cursor-pointer p-2 ">
                                {isLoading ? (
                                    <div className="flex h-full cursor-pointer items-center border-none bg-white text-base font-bold">
                                        <span className="tooltiptext inline text-black" id="myTooltip">
                                            Claiming...
                                        </span>
                                    </div>
                                ) : (
                                    <button
                                        className="flex h-full cursor-pointer items-center border-none bg-white text-base font-bold"
                                        type="submit"
                                    >
                                        <span className="tooltiptext inline text-black" id="myTooltip">
                                            Claim
                                        </span>
                                    </button>
                                )}
                            </div>
                        </div>
                        {manualErrorState.showError && (
                            <div className="text-center">
                                <label className="text-xs font-normal text-red ">{manualErrorState.errorMessage}</label>
                            </div>
                        )}
                    </form>
                </global_components.CardWrapper>
            )}
            {errorState.showError && (
                <div className="text-center">
                    <label className="font-bold text-red ">{errorState.errorMessage}</label>
                </div>
            )}
            <global_components.PeanutMan type="presenting" />
        </>
    )
}
