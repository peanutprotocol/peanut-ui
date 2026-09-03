'use client'

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
                <div className="flex flex-col items-center gap-4 px-4 pt-1 pb-6 text-center">
                    <IconBubble icon="alert" color="yellow" />
                    <DrawerTitle>{t('title')}</DrawerTitle>
                    <div className="flex w-full flex-col gap-4 text-left">
                        <h2 className="mr-auto font-bold">{t('nextStep')}</h2>
                        <Notification priority="helper" hideIcon className="w-full">
                            <ul className="list-inside list-disc text-start">
                                <li>{t('bankDetailsItem')}</li>
                                <li>{t('referenceCodeItem')}</li>
                            </ul>
                        </Notification>
                        <h2 className="mr-auto font-bold">{t('youMust')}</h2>
                        <Notification
                            priority="info"
                            className="w-full"
                            items={[
                                t.rich('sendExactly', {
                                    currency,
                                    amount,
                                    b: (chunks) => <b>{chunks}</b>,
                                }),
                                t('copyReferenceCode'),
                                t('pasteReference'),
                            ]}
                        />

                        <Notification priority="error" title={t('mismatchTitle')}>
                            {t('mismatchDescription')}
                        </Notification>
                    </div>
                    {/* data-vaul-no-drag: the horizontal slide gesture must not start a drawer drag */}
                    <div className="w-full" data-vaul-no-drag>
                        <SlideToConfirm label={tCommon('slideToProceed')} onConfirm={onConfirm} />
                    </div>
                </div>
            </DrawerContent>
        </Drawer>
    )
}
