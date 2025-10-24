'use client'

import { PEANUTMAN_WAVING } from '@/assets'
import ActionModal, { type ActionModalButtonProps } from '@/components/Global/ActionModal'
import Image from 'next/image'
import { useRouter } from 'next/navigation'

interface ReferralCampaignModalProps {
    visible: boolean
    onClose: () => void
}

const ReferralCampaignModal: React.FC<ReferralCampaignModalProps> = ({ visible, onClose }) => {
    const router = useRouter()

    const handleInviteFriends = () => {
        router.push('/send?createLink=true')
        onClose()
    }

    const ctas: ActionModalButtonProps[] = [
        {
            text: 'Send & Score $5',
            onClick: handleInviteFriends,
            shadowSize: '4',
            className: 'h-10 md:py-2.5 text-sm !font-bold ',
        },
        {
            text: 'Maybe Later',
            onClick: onClose,
            variant: 'transparent',
            className: 'underline text-sm !font-normal w-full !transform-none !pt-2',
        },
    ]

    const title = <h1 className="!text-lg !font-bold italic text-black">Give money, get money.</h1>
    const description = (
        <div className="space-y-4">
            <p className="text-sm text-grey-1">
                You transfer, we thank you. Friend's first $200+ / fiat load = $5 credit in both accounts.
            </p>

            <ol className="list-inside list-decimal space-y-1 text-sm text-grey-1">
                <li>Send via link.</li>
                <li>Friend signs up.</li>
                <li>Friends deposit &gt;$200 or connects bank account.</li>
                <li>You both get the bonus.</li>
            </ol>

            <p className="text-xs italic text-grey-1">Rewards calculated and credited every Monday.</p>
        </div>
    )

    return (
        <ActionModal
            visible={visible}
            onClose={onClose}
            icon={<Image src={PEANUTMAN_WAVING} alt="Peanut character waving" width={80} height={100} priority />}
            iconContainerClassName="!size-auto !rounded-none !bg-transparent !p-0 -mb-2"
            title={title}
            titleClassName="!text-xl !font-bold text-black"
            description={description}
            descriptionClassName="text-grey-1 text-sm"
            ctas={ctas}
            ctaClassName="md:flex-col gap-1"
            hideModalCloseButton={true}
            contentContainerClassName="!pb-4"
        />
    )
}

export default ReferralCampaignModal
