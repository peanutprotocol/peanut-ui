'use client'
import { Button } from '@/components/0_Bruddle/Button'
import NavHeader from '@/components/Global/NavHeader'
import PeanutActionDetailsCard from '@/components/Global/PeanutActionDetailsCard'
import { SoundPlayer } from '@/components/Global/SoundPlayer'
import { TRANSACTIONS } from '@/constants/query.consts'
import { useAuth } from '@/context/authContext'
import { useClaimBankFlow } from '@/context/ClaimBankFlowContext'
import { useUserStore } from '@/redux/hooks'
import { ESendLinkStatus, sendLinksApi } from '@/services/sendLinks'
import { formatTokenAmount, getTokenDetails, shortenStringLong } from '@/utils/general.utils'
import { useRecipientDisplay } from '@/hooks/useRecipientDisplay'
import { useQueryClient } from '@tanstack/react-query'
import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import type { Hash } from 'viem'
import { formatUnits } from 'viem'
import * as _consts from '../../Claim.consts'
import CreateAccountButton from '@/components/Global/CreateAccountButton'
import { PeanutCheering } from '@/assets/mascot'
import Image from 'next/image'
import { useAppHaptic } from '@/hooks/useAppHaptic'
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

    useEffect(() => {
        if (!!transactionHash || claimFailure) return

        const fetchClaimData = async () => {
            try {
                const link = await sendLinksApi.get(claimLinkData.link)
                if (link.claim) {
                    const txHash = link.claim.txHash
                    setTransactionHash(txHash)

                    // Force immediate refetch of balance and transactions
                    // This runs inside the polling callback, so it works even if component unmounts
                    // Using refetchQueries to bypass staleTime and force immediate refetch
                    queryClient.refetchQueries({
                        queryKey: [TRANSACTIONS],
                        type: 'active', // Only refetch currently mounted queries
                    })
                    queryClient.refetchQueries({
                        queryKey: ['balance'],
                        type: 'active', // Only refetch currently mounted queries
                    })

                    // Update user profile (points, etc)
                    fetchUser()

                    console.log('✅ Claim confirmed. WebSocket will handle backend updates:', txHash) // Poll every 1 second

                    return true
                } else if (link.status === ESendLinkStatus.FAILED) {
                    // The API rolled the claim back, so the success card below
                    // would be a lie. `claimFailureCode` is the only channel
                    // this path has: CHAIN_INFRA_UNAVAILABLE means the failure
                    // was provably pre-submission, so the link is claimable
                    // again and offering a retry is honest advice.
                    console.error('Claim failed:', link.events?.[link.events.length - 1]?.reason || 'Unknown error')
                    setClaimFailure({ code: link.claimFailureCode ?? null })
                    return true
                }
                return false
            } catch (error) {
                console.error('Error fetching claim data:', error)
                return false
            }
        }

        const intervalId = setInterval(async () => {
            const claimFound = await fetchClaimData()
            if (claimFound) {
                clearInterval(intervalId)
            }
        }, 250)

        // Initial fetch attempt
        fetchClaimData()

        // Clean up the interval when component unmounts or transactionHash changes
        return () => clearInterval(intervalId)
    }, [transactionHash, claimFailure, claimLinkData.link, queryClient, fetchUser])

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
        if (!transactionHash) return
        triggerHaptic()
    }, [transactionHash, triggerHaptic])

    // The optimistic 202 lands here with no hash and no outcome yet. Rendering
    // the success card now would claim money that has not moved — and would
    // keep claiming it for as long as the poll is slow or failing.
    if (!transactionHash && !claimFailure) {
        return (
            <div className="flex min-h-[inherit] flex-col justify-between gap-8">
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
            <div className="flex min-h-[inherit] flex-col justify-between gap-8">
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
        <div className="flex min-h-[inherit] flex-col justify-between gap-8">
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
