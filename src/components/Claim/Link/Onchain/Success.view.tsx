'use client'
import { Button } from '@/components/0_Bruddle/Button'
import NavHeader from '@/components/Global/NavHeader'
import PeanutActionDetailsCard from '@/components/Global/PeanutActionDetailsCard'
import { SoundPlayer } from '@/components/Global/SoundPlayer'
import { TRANSACTIONS } from '@/constants/query.consts'
import { useAuth } from '@/context/authContext'
import { useClaimBankFlow } from '@/context/ClaimBankFlowContext'
import { useUserStore } from '@/redux/hooks'
import { useClaimSuccessPolling, type ClaimPollFailure } from './useClaimSuccessPolling'
import { formatTokenAmount, getTokenDetails, shortenStringLong } from '@/utils/general.utils'
import { useRecipientDisplay } from '@/hooks/useRecipientDisplay'
import { captureMessage } from '@sentry/nextjs'
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
import { useAppReviewNudge } from '@/hooks/useAppReviewNudge'
import { useTranslations } from 'next-intl'
import { Notification } from '@/components/0_Bruddle/Notification'
import Loading from '@/components/Global/Loading'
import { useFriendlyError } from '@/hooks/useFriendlyError'
import { useSafeBack } from '@/hooks/useSafeBack'
import { API_ERROR_CODES } from '@/services/api-error'
import { badgeCampaignForLegacyWire } from '@/components/Invites/badge-campaign-context'

export const SuccessClaimLinkView = ({
    transactionHash,
    setTransactionHash,
    claimLinkData,
    tokenPrice,
    onCustom,
}: _consts.IClaimScreenProps) => {
    const t = useTranslations('claim')
    const tCommon = useTranslations('common')
    const toFriendlyError = useFriendlyError()
    const goBack = useSafeBack('/home')
    // The optimistic claim path lands here before the broadcast is known to
    // have succeeded, so a failure can only arrive through the poll below.
    const [claimFailure, setClaimFailure] = useState<{ code: string | null } | null>(null)
    // CLAIMED can settle before the on-chain txHash has projected, so success is
    // its own flag rather than "we have a hash".
    const [claimConfirmed, setClaimConfirmed] = useState(false)
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

    // @dev: Claimers don't earn points (only senders do), so we don't call calculatePoints
    // Points will show in activity history once the sender's transaction is processed

    useEffect(() => {
        queryClient.invalidateQueries({ queryKey: [TRANSACTIONS] })
    }, [queryClient])

    const handleClaimConfirmed = useCallback(
        (txHash: string | null) => {
            setClaimConfirmed(true)
            // The hash may still be projecting when CLAIMED settles; set it once
            // it is there so any hash-dependent path downstream still gets it.
            if (txHash) setTransactionHash(txHash)

            // Force immediate refetch of balance and transactions,
            // bypassing staleTime; only currently mounted queries.
            queryClient.refetchQueries({ queryKey: [TRANSACTIONS], type: 'active' })
            queryClient.refetchQueries({ queryKey: ['balance'], type: 'active' })

            // Update user profile (points, etc)
            fetchUser()
        },
        [queryClient, fetchUser, setTransactionHash]
    )

    const handleClaimFailed = useCallback((failure: ClaimPollFailure) => {
        console.error('Claim failed:', failure.reason || 'Unknown error')
        setClaimFailure({ code: failure.code })
    }, [])

    /*
     * The poll ceiling was reached with no terminal answer (e.g. prolonged
     * connectivity loss). Stay in the processing state — claiming success
     * would be a lie and failure is not established either — and leave the
     * query enabled so a window refocus gets one recovery fetch.
     */
    const handleClaimUnconfirmed = useCallback(() => {
        captureMessage('Claim confirmation polling gave up without a terminal status', 'warning')
    }, [])

    // Success once the claim is confirmed (CLAIMED status or a projected hash),
    // matching the point the backend notifies — not "we have observed a hash".
    const isClaimed = claimConfirmed || !!transactionHash

    useClaimSuccessPolling(
        claimLinkData.link,
        !isClaimed && !claimFailure,
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
        // success feedback belongs to a confirmed claim, not to arriving here —
        // the optimistic path mounts this view before the broadcast is known
        if (!isClaimed) return
        triggerHaptic()
    }, [isClaimed, triggerHaptic])

    // same gate as the haptic: a confirmed claim, never the optimistic mount
    useAppReviewNudge(authUser?.user.userId, 'money_received', isClaimed && !claimFailure)

    // The optimistic 202 lands here with no outcome yet. Hold the processing
    // state until the claim is confirmed — rendering success before that would
    // claim money that has not moved.
    if (!isClaimed && !claimFailure) {
        return (
            <div className="flex min-h-inherit flex-col justify-between gap-8">
                <div className="md:hidden">
                    <NavHeader icon="cancel" title={navHeaderTitle} onPrev={goBack} />
                </div>
                <div className="relative z-10 my-auto flex h-full flex-col justify-center">
                    <Loading variant="mascot" message={tCommon('status.processing')} />
                </div>
            </div>
        )
    }

    if (claimFailure) {
        const isRetryable = claimFailure.code === API_ERROR_CODES.CHAIN_INFRA_UNAVAILABLE
        return (
            <div className="flex min-h-inherit flex-col justify-between gap-8">
                <div className="md:hidden">
                    <NavHeader icon="cancel" title={navHeaderTitle} onPrev={goBack} />
                </div>
                <div className="relative z-10 my-auto space-y-4 flex h-full flex-col justify-center">
                    <Notification priority="error" data-testid="error-alert">
                        {toFriendlyError({ code: claimFailure.code })}
                    </Notification>
                    {isRetryable && (
                        <Button
                            shadowSize="4"
                            className="w-full"
                            onClick={() => {
                                // the link was rolled back, so INITIAL offers
                                // the claim again rather than a spent link
                                setTransactionHash(undefined)
                                onCustom('INITIAL')
                            }}
                        >
                            {tCommon('tryAgain')}
                        </Button>
                    )}
                    <Button variant="stroke" className="w-full" onClick={() => router.push('/home')}>
                        {t('backToHome')}
                    </Button>
                </div>
            </div>
        )
    }

    return (
        <div className="flex min-h-inherit flex-col justify-between gap-8">
            <SoundPlayer sound="success" />
            <NavHeader
                icon="cancel"
                title={navHeaderTitle}
                onPrev={() => {
                    router.push('/home')
                }}
            />
            <div className="relative z-10 my-auto space-y-4 flex h-full flex-col justify-center">
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
                    <p className="text-center text-body-xs text-foreground-secondary">
                        {t('success.devconnectReturnHint')}
                    </p>
                )}
            </div>
        </div>
    )
}
