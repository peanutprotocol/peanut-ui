import { Button } from '@/components/0_Bruddle'
import NavHeader from '@/components/Global/NavHeader'
import PeanutActionDetailsCard from '@/components/Global/PeanutActionDetailsCard'
import { TRANSACTIONS } from '@/constants/query.consts'
import { useUserStore } from '@/redux/hooks'
import { ESendLinkStatus, sendLinksApi } from '@/services/sendLinks'
import { printableAddress, getTokenDetails } from '@/utils'
import { useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo } from 'react'
import * as _consts from '../../Claim.consts'
import { formatUnits } from 'viem'
import type { Hash } from 'viem'

export const SuccessClaimLinkView = ({
    transactionHash,
    setTransactionHash,
    claimLinkData,
    type,
}: _consts.IClaimScreenProps) => {
    const { user: authUser } = useUserStore()
    const router = useRouter()
    const queryClient = useQueryClient()

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

    return (
        <div className="flex min-h-[inherit] flex-col justify-between gap-8">
            <div className="md:hidden">
                <NavHeader
                    icon="cancel"
                    title="Claim"
                    onPrev={() => {
                        router.push('/home')
                    }}
                />
            </div>
            <div className="my-auto flex h-full flex-col justify-center space-y-4">
                <PeanutActionDetailsCard
                    viewType="SUCCESS"
                    transactionType="CLAIM_LINK"
                    recipientType="USERNAME"
                    recipientName={claimLinkData.sender.username}
                    amount={formatUnits(claimLinkData.amount, tokenDetails?.decimals ?? 6)}
                    tokenSymbol={claimLinkData.tokenSymbol}
                    message={`from ${claimLinkData.sender.username || claimLinkData.sender.accounts[0].identifier || printableAddress(claimLinkData.senderAddress)}`}
                />
                {!!authUser?.user.userId && (
                    <Button shadowSize="4" onClick={() => router.push('/home')} className="w-full">
                        Back to home
                    </Button>
                )}
            </div>
        </div>
    )
}
