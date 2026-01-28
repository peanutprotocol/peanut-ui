'use client'
import { type Payment } from '@/services/services.types'
import Card from '../Card'
import { type CardPosition } from '../Card/card.utils'
import AvatarWithBadge from '@/components/Profile/AvatarWithBadge'
import { getColorForUsername } from '@/utils/color.utils'
import { VerifiedUserLabel } from '@/components/UserHeader'
import { formatTokenAmount } from '@/utils/general.utils'
import { isAddress } from 'viem'
import { useRouter } from 'next/navigation'
import { twMerge } from 'tailwind-merge'

export type Contributor = {
    uuid: string
    payments: Payment[]
    amount: string
    username: string | undefined
    fulfillmentPayment: Payment | null
    isUserVerified: boolean
    isPeanutUser: boolean
}

const ContributorCard = ({ contributor, position }: { contributor: Contributor; position: CardPosition }) => {
    const colors = getColorForUsername(contributor.username ?? '')
    const isEvmAddress = isAddress(contributor.username ?? '')

    const router = useRouter()

    return (
        <Card position={position}>
            <div className="flex items-center justify-between">
                <div
                    onClick={() => {
                        if (contributor.isPeanutUser) {
                            router.push(`/${contributor.username}`)
                        }
                    }}
                    className={twMerge('flex items-center gap-2', contributor.isPeanutUser && 'cursor-pointer')}
                >
                    <AvatarWithBadge
                        name={contributor.username ?? ''}
                        size={'extra-small'}
                        inlineStyle={{ backgroundColor: isEvmAddress ? '#FFC900' : colors.lightShade }}
                        textColor={isEvmAddress ? '#000000' : colors.darkShade}
                        icon={isEvmAddress ? 'wallet-outline' : undefined}
                    />

                    <VerifiedUserLabel
                        username={contributor.username ?? ''}
                        name={contributor.username ?? ''}
                        isVerified={contributor.isUserVerified}
                    />
                </div>

                <p className="font-medium">${formatTokenAmount(Number(contributor.amount))}</p>
            </div>
        </Card>
    )
}

export default ContributorCard
