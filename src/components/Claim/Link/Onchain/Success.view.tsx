'use client'
import { Button } from '@/components/0_Bruddle/Button'
import NavHeader from '@/components/Global/NavHeader'
import PeanutActionDetailsCard from '@/components/Global/PeanutActionDetailsCard'
import { SoundPlayer } from '@/components/Global/SoundPlayer'
import { TRANSACTIONS } from '@/constants/query.consts'
import { useAuth } from '@/context/authContext'
import { useClaimBankFlow } from '@/context/ClaimBankFlowContext'
import { useUserStore } from '@/redux/hooks'
import { useClaimSuccessPolling } from './useClaimSuccessPolling'
import { captureMessage } from '@sentry/nextjs'
import { formatTokenAmount, getTokenDetails, shortenStringLong } from '@/utils/general.utils'
import { useRecipientDisplay } from '@/hooks/useRecipientDisplay'
import { useQueryClient } from '@tanstack/react-query'
import { useRouter, useSearchParams } from 'next/navigation'
import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Hash } from 'viem'
import { formatUnits } from 'viem'
import * as _consts from '../../Claim.consts'
import CreateAccountButton from '@/components/Global/CreateAccountButton'
import { PeanutCheering } from '@/assets/mascot'
import Image from 'next/image'
import { useAppHaptic } from '@/hooks/useAppHaptic'
import { useTranslations } from 'next-intl'
import { badgeCampaignForLegacyWire } from '@/components/Invites/badge-campaign-context'

export const SuccessClaimLinkView = ({
    transactionHash,
    setTransactionHash,
    claimLinkData,
    tokenPrice,
}: _consts.IClaimScreenProps) => {
    const t = useTranslations('claim')
    const { user: authUser } = useUserStore()
    const { fetchUser } = useAuth()
    const router = useRouter()
    const queryClient = useQueryClient()
    const { offrampDetails, claimType, bankDetails } = useClaimBankFlow()
    const { triggerHaptic } = useAppHaptic()
    const params = useSearchParams()
    const campaignTag = badgeCampaignForLegacyWire(params)
    const senderDisplay = useRecipientDisplay({
        user: claimLinkData.sender,
        address: claimLinkData.senderAddress,
    })
    // claim polling reached a non-success end (failed / gave up) — stop polling
    const [isClaimPollingSettled, setIsClaimPollingSettled] = useState(false)

    // @dev: Claimers don't earn points (only senders do), so we don't call calculatePoints
    // Points will show in activity history once the sender's transaction is processed

    useEffect(() => {
        queryClient.invalidateQueries({ queryKey: [TRANSACTIONS] })
    }, [queryClient])

    const handleClaimConfirmed = useCallback(
        (txHash: string) => {
            setTransactionHash(txHash)

            // Force immediate refetch of balance and transactions,
            // bypassing staleTime; only currently mounted queries.
            queryClient.refetchQueries({ queryKey: [TRANSACTIONS], type: 'active' })
            queryClient.refetchQueries({ queryKey: ['balance'], type: 'active' })

            // Update user profile (points, etc)
            fetchUser()
        },
        [queryClient, fetchUser, setTransactionHash]
    )

    /*
     * Both non-success outcomes only settle polling — the optimistic success
     * card stays, matching the pre-existing behavior (dev never had a failure
     * UI here; its TODO to add one still stands). A local flag stops the
     * polling instead of dev's 'FAILED' sentinel string, which lived in the
     * flow-level transactionHash where a future consumer could mistake a
     * truthy non-hash for a real one.
     */
    const handleClaimFailed = useCallback((reason?: string) => {
        // TODO: Show error UI to user instead of silent failure
        console.error('Claim failed:', reason || 'Unknown error')
        setIsClaimPollingSettled(true)
    }, [])

    const handleClaimUnconfirmed = useCallback(() => {
        captureMessage('Claim confirmation polling gave up without a terminal status', 'warning')
        setIsClaimPollingSettled(true)
    }, [])

    useClaimSuccessPolling(
        claimLinkData.link,
        !transactionHash && !isClaimPollingSettled,
        handleClaimConfirmed,
        handleClaimFailed,
        handleClaimUnconfirmed
    )

    const tokenDetails = useMemo(() => {
        if (!claimLinkData) return null

        const tokenDetails = getTokenDetails({
            tokenAddress: claimLinkData.tokenAddress as Hash,
            chainId: claimLinkData.chainId,
        })

        return tokenDetails
    }, [claimLinkData])

    const maskedAccountNumber = useMemo(() => {
        if (bankDetails?.iban) {
            return t('success.toAccount', { account: shortenStringLong(bankDetails.iban) })
        }
        if (bankDetails?.clabe) {
            return t('success.toAccount', { account: shortenStringLong(bankDetails.clabe) })
        }
        if (bankDetails?.accountNumber) {
            return t('success.toAccount', { account: shortenStringLong(bankDetails.accountNumber) })
        }
        return t('success.toYourBankAccount')
    }, [bankDetails, t])

    const isBankClaim = claimType === 'claim-bank'

    const navHeaderTitle = t('receive')

    const cardProps = {
        viewType: 'SUCCESS' as const,
        transactionType: (isBankClaim ? 'CLAIM_LINK_BANK_ACCOUNT' : 'CLAIM_LINK') as
            | 'CLAIM_LINK_BANK_ACCOUNT'
            | 'CLAIM_LINK',
        recipientType: isBankClaim ? ('BANK_ACCOUNT' as const) : ('USERNAME' as const),
        recipientName: isBankClaim ? maskedAccountNumber : senderDisplay.displayName,
        amount: isBankClaim
            ? (formatTokenAmount(
                  Number(formatUnits(claimLinkData.amount, claimLinkData.tokenDecimals)) * (tokenPrice ?? 0)
              ) ?? '')
            : formatUnits(claimLinkData.amount, tokenDetails?.decimals ?? 6),
        tokenSymbol: isBankClaim ? (offrampDetails?.quote.destination_currency ?? '') : claimLinkData.tokenSymbol,
        message: isBankClaim ? maskedAccountNumber : t('success.fromSender', { sender: senderDisplay.displayName }),
        title: isBankClaim ? t('success.youWillReceive') : t('success.youClaimed'),
    }

    const renderButtons = () => {
        if (authUser?.user.userId) {
            return (
                <Button
                    shadowSize="4"
                    onClick={() => {
                        if (!isBankClaim) fetchUser()
                        router.push('/home')
                    }}
                    className="w-full"
                >
                    {t('backToHome')}
                </Button>
            )
        }
        return <CreateAccountButton onClick={() => router.push('/setup')} />
    }

    useEffect(() => {
        // trigger haptic on mount
        triggerHaptic()
    }, [triggerHaptic])

    return (
        <div className="flex min-h-[inherit] flex-col justify-between gap-8">
            <SoundPlayer sound="success" />
            <div className="md:hidden">
                <NavHeader
                    icon="cancel"
                    title={navHeaderTitle}
                    onPrev={() => {
                        router.push('/home')
                    }}
                />
            </div>
            <div className="relative z-10 my-auto flex h-full flex-col justify-center space-y-4">
                <Image
                    src={PeanutCheering.src}
                    unoptimized
                    alt={t('success.peanutMascotAlt')}
                    width={240}
                    height={240}
                    className="absolute -top-32 left-1/2 -z-10 h-60 w-60 -translate-x-1/2"
                />
                <PeanutActionDetailsCard {...cardProps} />
                {renderButtons()}
                {campaignTag?.toLowerCase() === 'devconnect_ba_2025' && (
                    <p className="text-center text-xs text-grey-1">{t('success.devconnectReturnHint')}</p>
                )}
            </div>
        </div>
    )
}
