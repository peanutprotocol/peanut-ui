import Image from 'next/image'
import Card from '../Card'
import { Icon } from '../Icons/Icon'
import { SOCIALS_ICON } from '@/assets'

interface PeanutActionCardProps {
    type: 'request' | 'send'
}

const PeanutActionCard = ({ type }: PeanutActionCardProps) => {
    return (
        <Card className="flex items-center gap-3 p-4">
            <div className={`flex size-8 items-center justify-center rounded-full bg-primary-1 font-bold`}>
                <Icon name="link" size={16} />
            </div>
            <div>
                <div className="font-bold">
                    {type === 'request' ? 'Request money from friends' : 'Create a payment link'}
                </div>
                <div className="text-sm text-black">
                    {type === 'request'
                        ? `They don't need an account to pay`
                        : 'Anyone with the link can receive the money'}
                </div>
                <div className="flex items-center gap-1">
                    <Image src={SOCIALS_ICON} alt="Socials" width={32} height={13} />
                    <p className="text-xs text-grey-1">Perfect for group chats!</p>
                </div>
            </div>
        </Card>
    )
}

export default PeanutActionCard
