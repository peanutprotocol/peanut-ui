'use client'

import { Button } from '@/components/0_Bruddle'
import StatusViewWrapper from '@/components/Global/StatusViewWrapper'
import * as context from '@/context'
import { useWallet } from '@/hooks/wallet/useWallet'
import * as interfaces from '@/interfaces'
import { ErrorHandler, shortenAddress } from '@/utils'
import * as Sentry from '@sentry/nextjs'
import { useContext, useState } from 'react'
import * as _consts from '../Claim.consts'
import useClaimLink from '../useClaimLink'

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
    const { address } = useWallet()

    const { setLoadingState, isLoading } = useContext(context.loadingStateContext)
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

            if (claimTxHash) {
                changeToRecipientView()
                setTransactionHash(claimTxHash)
                onCustom('SUCCESS')
            } else {
                throw new Error('Error claiming link')
            }
        } catch (error) {
            const errorString = ErrorHandler(error)
            setErrorState({
                showError: true,
                errorMessage: errorString,
            })
            Sentry.captureException(error)
        } finally {
            setLoadingState('Idle')
        }
    }

    return (
        <StatusViewWrapper
            title={`Hello ${shortenAddress(address ?? '')}`}
            description="This is a link that you have created. You can refund it or go to the recipient view."
        >
            <div className="flex flex-col gap-2">
                <Button onClick={handleOnCancel} disabled={isLoading} loading={isLoading}>
                    Refund
                </Button>
                <Button variant="dark" onClick={changeToRecipientView} disabled={isLoading}>
                    Go to recipient view
                </Button>
                {errorState.showError && (
                    <div className="text-start">
                        <label className=" text-h8 font-normal text-red ">{errorState.errorMessage}</label>
                    </div>
                )}
            </div>
        </StatusViewWrapper>
    )
}
