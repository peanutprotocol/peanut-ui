import React, { FC } from 'react'
import ActionModal from '../ActionModal'
import Image from 'next/image'
import { PEANUT_LOGO_BLACK, PEANUTMAN_LOGO } from '@/assets'

interface ConfirmInviteModalProps {
    isOpen: boolean
    onClose: () => void
    method: string
    handleLoseInvite: () => void
    handleContinueWithPeanut: () => void
}

const ConfirmInviteModal: FC<ConfirmInviteModalProps> = ({
    isOpen,
    onClose,
    method,
    handleLoseInvite,
    handleContinueWithPeanut,
}) => {
    return (
        <ActionModal
            visible={isOpen}
            title="Don’t lose your invite!"
            titleClassName="font-extrabold text-lg"
            description={`This link unlocks Peanut. Using ${method} will skip your invite.`}
            onClose={onClose}
            ctaClassName="flex-col sm:flex-col gap-0 md:gap-2"
            contentContainerClassName="py-4 px-6"
            ctas={[
                {
                    text: '',
                    onClick: handleContinueWithPeanut,
                    shadowSize: '4',
                    className: 'sm:py-3',
                    children: (
                        <>
                            <div>Join</div>
                            <div className="flex items-center gap-1">
                                <Image src={PEANUTMAN_LOGO} alt="Peanut Logo" className="size-5" />
                                <Image src={PEANUT_LOGO_BLACK} alt="Peanut Logo" />
                            </div>
                        </>
                    ),
                },
                {
                    text: `Continue with ${method}`,
                    onClick: handleLoseInvite,
                    variant: 'transparent',
                    className: 'underline text-sm !font-normal w-full !transform-none !pt-2',
                },
            ]}
        />
    )
}

export default ConfirmInviteModal
