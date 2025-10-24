import { type Payment } from '@/services/services.types'
import Card, { type CardPosition } from '../Card'
import AvatarWithBadge from '@/components/Profile/AvatarWithBadge'
import { getColorForUsername } from '@/utils/color.utils'
import { VerifiedUserLabel } from '@/components/UserHeader'
import { formatTokenAmount } from '@/utils'
import { isAddress } from 'viem'

export type Contributor = {
    uuid: string
    payments: Payment[]
    amount: string
    username: string | undefined
    fulfillmentPayment: Payment | null
    isUserVerified: boolean
}

const ContributorCard = ({ contributor, position }: { contributor: Contributor; position: CardPosition }) => {
    const colors = getColorForUsername(contributor.username ?? '')
    const isEvmAddress = isAddress(contributor.username ?? '')
    return (
        <Card position={position} className="cursor-pointer">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
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
