'use client'
import { Button } from '@/components/0_Bruddle'
import NavHeader from '@/components/Global/NavHeader'
import PeanutActionDetailsCard from '@/components/Global/PeanutActionDetailsCard'
import { SoundPlayer } from '@/components/Global/SoundPlayer'
import { TRANSACTIONS } from '@/constants/query.consts'
import { useAuth } from '@/context/authContext'
import { useClaimBankFlow } from '@/context/ClaimBankFlowContext'
import { useUserStore } from '@/redux/hooks'
import { ESendLinkStatus, sendLinksApi } from '@/services/sendLinks'
import { formatTokenAmount, getTokenDetails, printableAddress, shortenStringLong } from '@/utils'
import { useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo } from 'react'
import type { Hash } from 'viem'
import { formatUnits } from 'viem'
import * as _consts from '../../Claim.consts'
import CreateAccountButton from '@/components/Global/CreateAccountButton'
import chillPeanutAnim from '@/animations/GIF_ALPHA_BACKGORUND/512X512_ALPHA_GIF_konradurban_01.gif'
import Image from 'next/image'

export const SuccessClaimLinkView = ({
    transactionHash,
    setTransactionHash,
    claimLinkData,
    type,
    tokenPrice,
}: _consts.IClaimScreenProps) => {
    const { user: authUser } = useUserStore()
    const { fetchUser } = useAuth()
    const router = useRouter()
    const queryClient = useQueryClient()
    const { offrampDetails, claimType, bankDetails } = useClaimBankFlow()

    // @dev: Claimers don't earn points (only senders do), so we don't call calculatePoints
    // Points will show in activity history once the sender's transaction is processed

    useEffect(() => {
        queryClient.invalidateQueries({ queryKey: [TRANSACTIONS] })
    }, [queryClient])

    useEffect(() => {
        if (!!transactionHash) return

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
                    // Claim failed after optimistic return - show error to user
                    console.error('Claim failed:', link.events?.[link.events.length - 1]?.reason || 'Unknown error')
                    // TODO: Show error UI to user instead of silent failure
                    // For now, setting txHash to 'FAILED' to stop showing loading state
                    setTransactionHash('FAILED')
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
    }, [transactionHash, claimLinkData.link, queryClient, fetchUser])

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
            return `to ${shortenStringLong(bankDetails.iban)}`
        }
        if (bankDetails?.clabe) {
            return `to ${shortenStringLong(bankDetails.clabe)}`
        }
        if (bankDetails?.accountNumber) {
            return `to ${shortenStringLong(bankDetails.accountNumber)}`
        }
        return 'to your bank account'
    }, [bankDetails])

    const isBankClaim = claimType === 'claim-bank'

    const navHeaderTitle = 'Receive'

    const cardProps = {
        viewType: 'SUCCESS' as const,
        transactionType: (isBankClaim ? 'CLAIM_LINK_BANK_ACCOUNT' : 'CLAIM_LINK') as
            | 'CLAIM_LINK_BANK_ACCOUNT'
            | 'CLAIM_LINK',
        recipientType: isBankClaim ? ('BANK_ACCOUNT' as const) : ('USERNAME' as const),
        recipientName: isBankClaim
            ? maskedAccountNumber
            : (claimLinkData.sender?.username ?? printableAddress(claimLinkData.senderAddress)),
        amount: isBankClaim
            ? (formatTokenAmount(
                  Number(formatUnits(claimLinkData.amount, claimLinkData.tokenDecimals)) * (tokenPrice ?? 0)
              ) ?? '')
            : formatUnits(claimLinkData.amount, tokenDetails?.decimals ?? 6),
        tokenSymbol: isBankClaim ? (offrampDetails?.quote.destination_currency ?? '') : claimLinkData.tokenSymbol,
        message: isBankClaim
            ? maskedAccountNumber
            : `from ${claimLinkData.sender?.username || printableAddress(claimLinkData.senderAddress)}`,
        title: isBankClaim ? 'You will receive' : 'You claimed',
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
                    Back to home
                </Button>
            )
        }
        return <CreateAccountButton onClick={() => router.push('/setup')} />
    }

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
                    src={chillPeanutAnim.src}
                    alt="Peanut Mascot"
                    width={20}
                    height={20}
                    className="absolute -top-32 left-1/2 -z-10 h-60 w-60 -translate-x-1/2"
                />
                <PeanutActionDetailsCard {...cardProps} />
                {renderButtons()}
            </div>
        </div>
    )
}
