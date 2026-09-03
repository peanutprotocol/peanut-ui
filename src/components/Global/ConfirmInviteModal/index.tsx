'use client'
import { type FC } from 'react'
import { useTranslations } from 'next-intl'
import Image from 'next/image'
import PEANUT_LOGO_BLACK from '@/assets/logos/peanut-logo-dark.svg'
import { PEANUTMAN } from '@/assets/mascot'
import ActionModal from '@/components/Global/ActionModal'
import { PeanutWavingHello } from '@/assets/mascot'

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
    const t = useTranslations('global')
    return (
        <ActionModal
            hideOverlay
            modalPanelClassName="rounded-none border-0"
            contentContainerClassName="isolate"
            visible={isOpen}
            onClose={onClose}
            title={t('confirmInviteModal.title')}
            description={t('confirmInviteModal.description', { method })}
            ctaClassName="sm:flex-col"
            ctas={[
                {
                    text: '',
                    shadowSize: '4',
                    variant: 'purple',
                    className: 'sm:flex-none',
                    onClick: handleContinueWithPeanut,
                    children: (
                        <>
                            <div>{t('confirmInviteModal.joinCta')}</div>
                            <div className="flex items-center gap-1">
                                <Image src={PEANUTMAN} alt="Peanut Logo" className="size-5" />
                                <Image src={PEANUT_LOGO_BLACK} alt="Peanut Logo" />
                            </div>
                        </>
                    ),
                },
                {
                    text: t('confirmInviteModal.continueWithMethod', { method }),
                    variant: 'stroke',
                    className: 'sm:flex-none',
                    onClick: handleLoseInvite,
                },
            ]}
            footer={
                <div className="absolute top-6 left-0 -z-10 flex w-full -translate-y-[80%] justify-center">
                    <div className="relative h-42 w-[90%] md:h-52">
                        <Image
                            src={PeanutWavingHello.src}
                            unoptimized
                            alt="Peanut Man"
                            className="object-contain"
                            fill
                        />
                    </div>
                </div>
            }
        />
    )
}

export default ConfirmInviteModal
