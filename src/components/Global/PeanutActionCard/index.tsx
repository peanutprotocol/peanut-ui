import Card from '../Card'
import { Icon } from '../Icons/Icon'

interface PeanutActionCardProps {
    type: 'request' | 'send'
}

const PeanutActionCard = ({ type }: PeanutActionCardProps) => {
    return (
        <Card className="flex items-center gap-2 p-4">
            <div className={`flex size-8 items-center justify-center rounded-full bg-primary-1 font-bold`}>
                <Icon name="link" size={16} />
            </div>
            <div>
                <div className="text-sm font-medium">
                    {type === 'request' ? 'Request money with a link' : 'Create a payment link'}
                </div>
                <div className="text-xs">
                    {type === 'request' ? `No account needed to pay ` : 'Anyone with the link can receive the money'}
                </div>
            </div>
        </Card>
    )
}

export default PeanutActionCard
