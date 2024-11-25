'use client'

import * as _consts from '../Claim.consts'
import * as context from '@/context'
import * as utils from '@/utils'
import { useContext, useState } from 'react'
import useClaimLink from '../useClaimLink'
import * as interfaces from '@/interfaces'
import Link from 'next/link'
import { Button, Card } from '@/components/0_Bruddle'
import { useWallet } from '@/context/walletContext'
import { PaymentsFooter } from '@/components/Global/PaymentsFooter'

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
        <Card className="shadow-none sm:shadow-primary-4">
            <Card.Header>
                <Card.Title>Hello, {utils.shortenAddress(address ?? '')}</Card.Title>
                <Card.Description>
                    This is a link that you have created. You can refund it or go to the recipient view.
                </Card.Description>
            </Card.Header>
            <Card.Content className="flex flex-col gap-2">
                <Button onClick={handleOnCancel} disabled={isLoading} loading={isLoading}>
                    Refund
                </Button>
                <Button variant="dark" onClick={changeToRecipientView} disabled={isLoading}>
                    Go to recipient view
                </Button>
                {errorState.showError && (
                    <div className="text-center">
                        <label className=" text-h8 font-normal text-red ">{errorState.errorMessage}</label>
                    </div>
                )}
                <label className="mt-2 text-h9 font-normal">
                    We would like to hear from your experience. Hit us up on{' '}
                    <a
                        className="cursor-pointer text-black underline dark:text-white"
                        target="_blank"
                        href="https://discord.gg/BX9Ak7AW28"
                    >
                        Discord!
                    </a>
                </label>
                <PaymentsFooter />
            </Card.Content>
        </Card>
    )
}
