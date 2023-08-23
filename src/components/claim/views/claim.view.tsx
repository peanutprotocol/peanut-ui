import { useWeb3Modal } from '@web3modal/react'
import { useEffect, useMemo, useState } from 'react'
import { WalletClient, useAccount, useNetwork } from 'wagmi'
import { useAtom } from 'jotai'
import { getWalletClient, switchNetwork } from '@wagmi/core'
import peanut from '@squirrel-labs/peanut-sdk'
import { providers } from 'ethers'
import { useForm } from 'react-hook-form'

import * as global_components from '@/components/global'
import * as _consts from '../claim.consts'
import * as utils from '@/utils'
import * as store from '@/store'
import * as consts from '@/consts'
import dropdown_svg from '@/assets/dropdown.svg'

export function ClaimView({ onNextScreen, claimDetails, claimLink, setTxHash }: _consts.IClaimScreenProps) {
    const { isConnected, address } = useAccount()
    const { open } = useWeb3Modal()
    const [isDropdownOpen, setIsDropdownOpen] = useState(false)
    const [chainDetails] = useAtom(store.defaultChainDetailsAtom)
    const { chain: currentChain } = useNetwork()
    const [tokenDetails] = useAtom(store.defaultTokenDetailsAtom)

    const [loadingStates, setLoadingStates] = useState<consts.LoadingStates>('idle')
    const isLoading = useMemo(() => loadingStates !== 'idle', [loadingStates])
    const [errorState, setErrorState] = useState<{
        showError: boolean
        errorMessage: string
    }>({ showError: false, errorMessage: '' })
    const [signer, setSigner] = useState<providers.JsonRpcSigner | undefined>(undefined)

    const manualForm = useForm<{ address: string; addressExists: boolean }>({
        mode: 'onChange',
        reValidateMode: 'onChange',
        defaultValues: {
            address: '',
            addressExists: false,
        },
    })

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

    const getWalletClientAndUpdateSigner = async ({ chainId }: { chainId: number }) => {
        const walletClient = await getWalletClient({ chainId: Number(chainId) })
        if (walletClient) {
            const signer = walletClientToSigner(walletClient)
            setSigner(signer)
        }
    }

    const claim = async () => {
        try {
            if (claimLink && address) {
                setLoadingStates('executing transaction...')
                console.log('claiming link:' + claimLink)
                const claimTx = await peanut.claimLinkGasless(claimLink, address, process.env.PEANUT_API_KEY)
                console.log(claimTx)
                setTxHash(claimTx.tx_hash ?? claimTx.transactionHash ?? claimTx.hash ?? '')
                onNextScreen()
            }
            // setLoadingStates("checking signer...");
            // if (!signer) {
            //   await getWalletClientAndUpdateSigner({ chainId: claimDetails.chainId });
            // }
            // //check if the user is on the correct chain
            // if (currentChain?.id.toString() !== claimDetails.chainId.toString()) {
            //   setLoadingStates("allow network switch...");
            //   toast("Please allow the switch to the correct network in your wallet", {
            //     position: "bottom-right",
            //   });

            //   await utils
            //     .waitForPromise(
            //       switchNetwork({ chainId: Number(claimDetails.chainId) })
            //     )
            //     .catch((error) => {
            //       toast("Something went wrong while switching networks", {
            //         position: "bottom-right",
            //       });
            //       return;
            //     });
            //   setLoadingStates("switching network...");
            //   await new Promise((resolve) => setTimeout(resolve, 1500)); // wait a sec after switching chain before making other deeplink
            //   setLoadingStates("loading...");
            // }
            // if (claimLink) {
            //   setLoadingStates("executing transaction...");
            //   console.log("claiming link:" + claimLink);
            //   const claimTx = await peanut.claimLink({
            //     signer,
            //     link: " + claimLink,
            //   });
            //   setTxHash(claimTx.hash ?? claimTx.transactionHash);
            //   onNextScreen();
            // }
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

    const manualClaim = async (data: { address: string; addressExists: boolean }) => {
        try {
            if (!data.addressExists) {
                setErrorState({
                    showError: true,
                    errorMessage: 'Please check the box to confirm that the address exists on the chain',
                })
                return
            }
            setLoadingStates('executing transaction...')
            if (claimLink && data.address) {
                console.log('claiming link:' + claimLink)
                const claimTx = await peanut.claimLinkGasless(claimLink, data.address, process.env.PEANUT_API_KEY)

                setTxHash(claimTx.tx_hash ?? claimTx.transactionHash ?? claimTx.hash ?? '')
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

    useEffect(() => {
        if (isConnected) {
            //wait for the wallet to connect
            setTimeout(() => {
                getWalletClientAndUpdateSigner({ chainId: claimDetails.chainId })
            }, 1000)
        }
    }, [isConnected])

    return (
        <>
            <h2 className="my-2 mb-0 text-center text-3xl font-black lg:text-6xl ">
                Claim {utils.formatTokenAmount(Number(claimDetails.tokenAmount))} {claimDetails.tokenSymbol}
            </h2>
            <h3 className="text-md mb-8 text-center font-black sm:text-lg lg:text-xl ">
                {chainDetails && chainDetails.find((chain) => chain.chainId == claimDetails.chainId)?.name}
            </h3>
            <button
                type={isConnected ? 'submit' : 'button'}
                className="mx-auto mb-6 block w-full cursor-pointer bg-white p-5 px-2 text-2xl font-black sm:w-2/5 lg:w-1/2"
                id="cta-btn"
                onClick={!isConnected ? open : claim}
                disabled={isLoading}
            >
                {isLoading ? loadingStates : isConnected ? 'Claim' : 'Connect Wallet'}
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
                                {...manualForm.register('address', {
                                    required: true,
                                })}
                            />
                            <div className="tooltip w-1/8 brutalborder-left block h-4 cursor-pointer p-2">
                                {isLoading ? (
                                    <div className="flex h-full cursor-pointer items-center border-none bg-white text-base font-bold">
                                        <span className="tooltiptext inline " id="myTooltip">
                                            Claiming...
                                        </span>
                                    </div>
                                ) : (
                                    <button
                                        className="flex h-full cursor-pointer items-center border-none bg-white text-base font-bold"
                                        type="submit"
                                    >
                                        <span className="tooltiptext inline" id="myTooltip">
                                            Claim
                                        </span>
                                    </button>
                                )}
                            </div>
                        </div>
                        <div className="mx-auto mt-2 flex h-4 flex-row items-center justify-center">
                            <input type="checkbox" className="h-4 w-4" {...manualForm.register('addressExists')} />
                            <label className="ml-2 text-xs font-medium">This address exists on CHAIN</label>
                        </div>
                    </form>
                </global_components.CardWrapper>
            )}
            {errorState.showError && (
                <div className="text-center">
                    <label className="font-bold text-red ">{errorState.errorMessage}</label>
                </div>
            )}
            <p className="mt-4 text-center text-xs">
                Thoughts? Feedback? Use cases? Memes? Hit us up on{' '}
                <a href="https://discord.gg/BX9Ak7AW28" target="_blank" className="cursor-pointer text-black underline">
                    Discord
                </a>
                !
            </p>

            <global_components.PeanutMan type="presenting" />
        </>
    )
}
