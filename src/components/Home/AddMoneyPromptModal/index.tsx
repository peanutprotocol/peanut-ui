'use client'

import { PEANUTMAN_WAVING } from '@/assets'
import ActionModal, { ActionModalButtonProps } from '@/components/Global/ActionModal'
import Image from 'next/image'
import { useRouter } from 'next/navigation'

interface AddMoneyPromptModalProps {
    visible: boolean
    onClose: () => void
}

const AddMoneyPromptModal: React.FC<AddMoneyPromptModalProps> = ({ visible, onClose }) => {
    const router = useRouter()

    const handleAddMoney = () => {
        router.push('/add-money')
        onClose()
    }

    const ctas: ActionModalButtonProps[] = [
        {
            text: 'Add money now',
            onClick: handleAddMoney,
            shadowSize: '4',
            className: 'h-10 md:py-2.5 text-sm !font-bold ',
        },
        {
            text: "I'll do it later",
            onClick: onClose,
            variant: 'transparent',
            className: 'underline text-sm !font-normal w-full !transform-none !pt-2',
        },
    ]

    const title = <h1 className="!text-lg !font-bold text-black">Let's add money to your wallet</h1>
    const description = (
        <>
            Your wallet is ready!
            <br />
            To start sending and spending money
            <br />
            you'll need to fund it first.
        </>
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

export default AddMoneyPromptModal
