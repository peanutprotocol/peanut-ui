'use client'
import { type FC } from 'react'
import { useTranslations } from 'next-intl'
import Image from 'next/image'
import PEANUT_LOGO_BLACK from '@/assets/logos/peanut-logo-dark.svg'
import { PEANUTMAN } from '@/assets/mascot'
import ActionModal from '@/components/Global/ActionModal'
import PeanutMascot from '@/components/Global/PeanutMascot'

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
            // the white surface moves from the panel to the content box on purpose.
            // the panel is a stacking context (transform-gpu + will-change), so a
            // -z-10 child can never paint behind the panel's OWN background — the
            // mascot came out in front of the modal, over the title. behind an
            // in-flow child's background it can: negative z paints before block
            // backgrounds. `isolate` here made it worse by trapping the mascot in
            // the content box's own context.
            modalPanelClassName="rounded-none border-0 bg-transparent dark:bg-transparent"
            contentContainerClassName="bg-background-default"
            visible={isOpen}
            onClose={onClose}
            title={t('confirmInviteModal.title')}
            description={t('confirmInviteModal.description', { method })}
            ctaClassName="sm:flex-col"
            ctas={[
                {
                    text: '',
                    shadowSize: '4',
                    variant: 'primary',
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
            footerIsDecorative
            footer={
                <div className="absolute top-6 left-0 -z-10 flex w-full -translate-y-[80%] justify-center">
                    <div className="relative h-42 w-[90%] md:h-52">
                        <PeanutMascot pose="waving-hello" alt="Peanut Man" className="size-full" />
                    </div>
                </div>
            }
        />
    )
}

export default ConfirmInviteModal
