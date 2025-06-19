'use client'

import React from 'react'
import ActionModal, { ActionModalButtonProps } from '@/components/Global/ActionModal'
import Image from 'next/image'

interface CancelLinkModalProps {
    visible: boolean
    amount: string
    onCancel: () => void
}

const CancelLinkModal: React.FC<CancelLinkModalProps> = ({ visible, amount, onCancel }) => {
    const ctas: ActionModalButtonProps[] = [
        {
            text: 'Cancel & Return Funds',
            onClick: onCancel,
            variant: 'purple',
            shadowSize: '4',
            className: 'h-10 md:py-2.5 text-sm !font-bold w-full',
        },
    ]

    const title = 'Cancel this link?'
    const description = (
        <>
            The {amount} locked in the link will go straight back to your balance.
            <br />
            <br />
            Once cancelled, nobody will be able to claim it.
        </>
    )

    return (
        <ActionModal
            visible={visible}
            onClose={onCancel}
            icon={<Image src="/icons/no-tx.svg" alt="No transactions" width={48} height={48} />}
            iconContainerClassName="!bg-transparent !p-0"
            title={title}
            description={description}
            ctas={ctas}
            ctaClassName="flex-col gap-1"
            hideModalCloseButton={true}
        />
    )
}

export default CancelLinkModal
