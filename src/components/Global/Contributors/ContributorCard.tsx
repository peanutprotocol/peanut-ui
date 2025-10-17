import { ChargeEntry, Payment } from '@/services/services.types'
import Card, { CardPosition } from '../Card'
import AvatarWithBadge from '@/components/Profile/AvatarWithBadge'
import { getColorForUsername } from '@/utils/color.utils'
import { VerifiedUserLabel } from '@/components/UserHeader'
import { formatTokenAmount } from '@/utils'

export type Contributor = {
    uuid: string
    payments: Payment[]
    amount: string
    username: string | undefined
    fulfilmentPayment: Payment | null
    isUserVerified: boolean
}

const ContributorCard = ({ contributor, position }: { contributor: Contributor; position: CardPosition }) => {
    const colors = getColorForUsername(contributor.username ?? '')
    return (
        <Card position={position} className="cursor-pointer">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <AvatarWithBadge
                        name={contributor.username ?? ''}
                        size={'extra-small'}
                        inlineStyle={{ backgroundColor: colors.lightShade }}
                        textColor={colors.darkShade}
                    />

                    <VerifiedUserLabel
                        username={contributor.username ?? ''}
                        name={contributor.username ?? ''}
                        isVerified={contributor.isUserVerified}
                        haveSentMoneyToUser={true}
                    />
                </div>

                <p className="font-medium">{formatTokenAmount(Number(contributor.amount))}</p>
            </div>
        </Card>
    )
}

export default ContributorCard
