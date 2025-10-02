import { Button } from '@/components/0_Bruddle'
import NavHeader from '@/components/Global/NavHeader'
import PeanutActionDetailsCard from '@/components/Global/PeanutActionDetailsCard'
import { SoundPlayer } from '@/components/Global/SoundPlayer'
import { TRANSACTIONS } from '@/constants/query.consts'
import { useAuth } from '@/context/authContext'
import { useClaimBankFlow } from '@/context/ClaimBankFlowContext'
import { useUserStore } from '@/redux/hooks'
import { ESendLinkStatus, sendLinksApi } from '@/services/sendLinks'
import { formatTokenAmount, getTokenDetails, printableAddress, shortenAddressLong } from '@/utils'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo } from 'react'
import type { Hash } from 'viem'
import { formatUnits } from 'viem'
import * as _consts from '../../Claim.consts'
import Image from 'next/image'
import { PEANUT_LOGO_BLACK, PEANUTMAN_LOGO, STAR_STRAIGHT_ICON } from '@/assets'
import CreateAccountButton from '@/components/Global/CreateAccountButton'
import { pointsApi } from '@/services/points'
import { PointsAction } from '@/services/services.types'
import PeanutLoading from '@/components/Global/PeanutLoading'

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

    const queryKey = useMemo(() => ['calculate-points'], [crypto.randomUUID()])

    const { data: pointsData, isLoading: isPointsDataLoading } = useQuery({
        queryKey,
        queryFn: () =>
            pointsApi.calculatePoints({
                actionType: PointsAction.P2P_SEND_LINK,
                usdAmount: Number(
                    formatTokenAmount(
                        Number(formatUnits(claimLinkData.amount, claimLinkData.tokenDecimals)) * (tokenPrice ?? 0)
                    )
                ),
                otherUserId: claimLinkData?.senderAddress,
            }),
        // Fetch only for logged in users.
        enabled: !!authUser?.user.userId,
        refetchOnWindowFocus: false,
    })

    useEffect(() => {
        queryClient.invalidateQueries({ queryKey: [TRANSACTIONS] })
    }, [queryClient])

    useEffect(() => {
        if (!!transactionHash) return

        const fetchClaimData = async () => {
            try {
                const link = await sendLinksApi.get(claimLinkData.link)
                if (link.claim) {
                    setTransactionHash(link.claim?.txHash)
                    return true
                } else if (link.status === ESendLinkStatus.FAILED) {
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
    }, [transactionHash, claimLinkData.link])

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
            return `to ${shortenAddressLong(bankDetails.iban)}`
        }
        if (bankDetails?.clabe) {
            return `to ${shortenAddressLong(bankDetails.clabe)}`
        }
        if (bankDetails?.accountNumber) {
            return `to ${shortenAddressLong(bankDetails.accountNumber)}`
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

    if (isPointsDataLoading) {
        return <PeanutLoading />
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
            <div className="my-auto flex h-full flex-col justify-center space-y-4">
                <PeanutActionDetailsCard {...cardProps} />
                {pointsData && (
                    <div className="flex justify-center gap-2">
                        <Image src={STAR_STRAIGHT_ICON} alt="star" width={20} height={20} />
                        <p className="text-sm font-medium text-black">
                            You&apos;ve earned {pointsData.estimatedPoints} points!
                        </p>
                    </div>
                )}
                {renderButtons()}
            </div>
        </div>
    )
}
