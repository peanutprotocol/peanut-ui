'use client'

import { MiniHeader } from '@/components/0_Bruddle/MiniHeader'
import { IconBubble } from '@/components/0_Bruddle/IconBubble'
import { Drawer, DrawerContent, DrawerTitle } from '@/components/Global/Drawer'
import SlideToConfirm from '@/components/0_Bruddle/SlideToConfirm'
import { Notification } from '@/components/0_Bruddle/Notification'
import { useTranslations } from 'next-intl'

interface OnrampConfirmationModalProps {
    visible: boolean
    onClose: () => void
    onConfirm: () => void
    amount: string
    currency: string
}

export const OnrampConfirmationModal = ({
    visible,
    onClose,
    onConfirm,
    amount,
    currency,
}: OnrampConfirmationModalProps) => {
    const t = useTranslations('addMoney.confirmationModal')
    const tCommon = useTranslations('common')
    return (
        <Drawer
            open={visible}
            onOpenChange={(isOpen) => {
                if (!isOpen) onClose()
            }}
        >
            <DrawerContent>
                <div className="flex flex-col items-center px-4 pt-1 pb-6 text-center">
                    {/* the head carries M/12 beneath it; the slide keeps the L/16 of the outer stack */}
                    <div className="mb-3 flex w-full flex-col items-center gap-4">
                        <IconBubble icon="alert" color="yellow" />
                        <DrawerTitle>{t('title')}</DrawerTitle>
                    </div>
                    {/* Two topics, two grey mini-headers, plain text under each —
                        neither was ever a warning. That leaves the mismatch block
                        as the one Notification, and the only coloured thing on a
                        screen that confirms an irreversible transfer. */}
                    <div className="flex w-full flex-col gap-4 text-left">
                        <div className="flex flex-col gap-1">
                            <MiniHeader>{t('nextStep')}</MiniHeader>
                            <p className="text-body-s text-foreground-primary">{t('bankDetailsItem')}</p>
                            <p className="text-body-s text-foreground-primary">{t('referenceCodeItem')}</p>
                        </div>

                        <div className="flex flex-col gap-1">
                            <MiniHeader>{t('youMust')}</MiniHeader>
                            <p className="text-body-s text-foreground-primary">
                                {t.rich('sendExactly', {
                                    currency,
                                    amount,
                                    b: (chunks) => <b>{chunks}</b>,
                                })}
                            </p>
                            <p className="text-body-s text-foreground-primary">{t('copyReferenceCode')}</p>
                            <p className="text-body-s text-foreground-primary">{t('pasteReference')}</p>
                        </div>

                        <Notification priority="error" title={t('mismatchTitle')}>
                            {t('mismatchDescription')}
                        </Notification>
                    </div>
                    {/* data-vaul-no-drag: the horizontal slide gesture must not start a drawer drag */}
                    <div className="mt-4 w-full" data-vaul-no-drag>
                        <SlideToConfirm label={tCommon('slideToProceed')} onConfirm={onConfirm} />
                    </div>
                </div>
            </DrawerContent>
        </Drawer>
    )
}
