import { useWeb3Modal } from '@web3modal/wagmi/react'
import { useMemo, useState } from 'react'
import { useAccount } from 'wagmi'
import { ethers } from 'ethers'
import { useAtom } from 'jotai'
import peanut from '@squirrel-labs/peanut-sdk'
import { useForm } from 'react-hook-form'

import * as global_components from '@/components/global'
import * as _consts from '../claim.consts'
import * as utils from '@/utils'
import * as store from '@/store'
import * as consts from '@/consts'
import dropdown_svg from '@/assets/dropdown.svg'

export function ClaimView({
    onNextScreen,
    claimDetails,
    claimLink,
    setTxHash,
    claimType,
    tokenPrice,
}: _consts.IClaimScreenProps) {
    const { isConnected, address } = useAccount()
    const { open } = useWeb3Modal()
    const [isDropdownOpen, setIsDropdownOpen] = useState(false)
    const [chainDetails] = useAtom(store.defaultChainDetailsAtom)

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
            addressExists: false,
        },
    })

    const claim = async () => {
        try {
            if (claimLink && address) {
                setLoadingStates('executing transaction')

                const claimTx = await peanut.claimLinkGasless({
                    link: claimLink,
                    recipientAddress: address,
                    APIKey: process.env.PEANUT_API_KEY ?? '',
                })
                console.log(claimTx)
                setTxHash(claimTx.transactionHash ?? claimTx.txHash ?? claimTx.hash ?? '')

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

    const manualClaim = async (data: { address: string; addressExists: boolean }) => {
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
            if (!data.addressExists) {
                setManualErrorState({
                    showError: true,
                    errorMessage: 'Please check the box to confirm that the address exists on the chain',
                })
                return
            }
            setLoadingStates('executing transaction')
            if (claimLink && data.address) {
                console.log('claiming link:' + claimLink)
                const claimTx = await peanut.claimLinkGasless({
                    link: claimLink,
                    recipientAddress: data.address,
                    APIKey: process.env.PEANUT_API_KEY ?? '',
                })

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

    return (
        <>
            {claimType == 'PROMO' && (
                <h2 className="my-2 mb-4 text-center text-base font-black sm:text-xl  ">
                    Oh, you found a promo code! Enjoy your free money!
                </h2>
            )}
            <h2 className="my-2 mb-0 text-center text-3xl font-black lg:text-6xl ">
                Claim{' '}
                {tokenPrice
                    ? '$' + utils.formatAmount(Number(tokenPrice) * Number(claimDetails.tokenAmount))
                    : utils.formatTokenAmount(Number(claimDetails.tokenAmount))}{' '}
                {tokenPrice ? 'in ' + claimDetails.tokenSymbol : claimDetails.tokenSymbol}
            </h2>
            <h3 className="text-md mb-8 text-center font-black sm:text-lg lg:text-xl ">
                {chainDetails && chainDetails.find((chain) => chain.chainId == claimDetails.chainId)?.name}
            </h3>
            <button
                type={isConnected ? 'submit' : 'button'}
                className="mx-auto mb-6 block w-full cursor-pointer bg-white p-5 px-2 text-2xl font-black sm:w-2/5 lg:w-1/2"
                id="cta-btn"
                onClick={() => {
                    !isConnected ? open() : claim()
                }}
                disabled={isLoading}
            >
                {isLoading ? (
                    <div className="flex justify-center gap-1">
                        <label>{loadingStates} </label>
                        <div className="flex h-full w-[26px] justify-start pb-1">
                            <div className="loading" />
                        </div>
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
                        {manualErrorState.showError && (
                            <div className="text-center">
                                <label className="text-xs font-normal text-red ">{manualErrorState.errorMessage}</label>
                            </div>
                        )}

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

            <global_components.PeanutMan type="presenting" />
        </>
    )
}
