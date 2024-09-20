'use client'
import Icon from '@/components/Global/Icon'

import * as _consts from '../Claim.consts'
import * as context from '@/context'
import * as utils from '@/utils'
import { useRouter } from 'next/navigation'
import { useContext, useState } from 'react'
import useClaimLink from '../useClaimLink'
import { useAccount } from 'wagmi'
import * as interfaces from '@/interfaces'
import Loading from '@/components/Global/Loading'
import Link from 'next/link'

interface ISenderClaimLinkViewProps {
    changeToRecipientView: () => void
    claimLinkData: interfaces.ILinkDetails | undefined
    setTransactionHash: (hash: string) => void
    onCustom: (screen: _consts.ClaimScreens) => void
}

export const SenderClaimLinkView = ({
    changeToRecipientView,
    claimLinkData,
    setTransactionHash,
    onCustom,
}: ISenderClaimLinkViewProps) => {
    const { claimLink } = useClaimLink()
    const { isConnected, address } = useAccount()

    const router = useRouter()
    const { setLoadingState, loadingState, isLoading } = useContext(context.loadingStateContext)
    const [errorState, setErrorState] = useState<{
        showError: boolean
        errorMessage: string
    }>({ showError: false, errorMessage: '' })

    const handleOnCancel = async () => {
        setLoadingState('Loading')
        setErrorState({
            showError: false,
            errorMessage: '',
        })

        if (!claimLinkData) return

        try {
            setLoadingState('Executing transaction')
            const claimTxHash = await claimLink({
                address: address ?? '',
                link: claimLinkData.link,
            })

            console.log('claimTxHash', claimTxHash)

            if (claimTxHash) {
                changeToRecipientView()
                setTransactionHash(claimTxHash)
                onCustom('SUCCESS')
            } else {
                throw new Error('Error claiming link')
            }
        } catch (error) {
            const errorString = utils.ErrorHandler(error)
            setErrorState({
                showError: true,
                errorMessage: errorString,
            })
        } finally {
            setLoadingState('Idle')
        }
    }

    return (
        <div className="flex w-full flex-col items-center justify-center gap-6 py-2 pb-20 text-center">
            <div className="space-y-2">
                <label className="text-h2">Hello, {utils.shortenAddress(address ?? '')}</label>
                <label className="">
                    This is a link that you have created. You can refund it or go to the recipient view.
                </label>
            </div>

            <div className="flex w-full flex-col items-center justify-center gap-2">
                <button className="btn-purple btn-xl" onClick={handleOnCancel} disabled={isLoading}>
                    {isLoading ? (
                        <div className="flex w-full flex-row items-center justify-center gap-2">
                            <Loading /> {loadingState}
                        </div>
                    ) : (
                        'Refund'
                    )}
                </button>
                <button
                    className="btn btn-xl dark:border-white dark:text-white"
                    onClick={changeToRecipientView}
                    disabled={isLoading}
                >
                    Go to recipient view
                </button>
                {errorState.showError && (
                    <div className="text-center">
                        <label className=" text-h8 font-normal text-red ">{errorState.errorMessage}</label>
                    </div>
                )}
            </div>

            <label className="text-h8 font-normal">
                We would like to hear from your experience. Hit us up on{' '}
                <a className="text-link-decoration" target="_blank" href="https://discord.gg/BX9Ak7AW28">
                    Discord!
                </a>
            </label>

            {/* <Link
                className="absolute bottom-0 flex h-20 w-[27rem] w-full flex-row items-center justify-start gap-2 border-t-[1px] border-black bg-purple-3  px-4.5 dark:text-black"
                href={'/profile'}
            >
                <div className=" border border-n-1 p-0 px-1">
                    <Icon name="profile" className="-mt-0.5" />
                </div>
                See your payments.
            </Link> */}

            <Link
                className="btn-purple btn-xl flex w-full flex-row items-center justify-center gap-1"
                href={'/profile'}
            >
                <div className="">
                    <Icon name="profile" className="" />
                </div>
                See your payments.
            </Link>
        </div>
    )
}

export default SenderClaimLinkView
