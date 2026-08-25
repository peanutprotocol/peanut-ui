'use client'

import ActionModal from '@/components/Global/ActionModal'
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
        <ActionModal
            visible={visible}
            onClose={onClose}
            icon="alert"
            iconContainerClassName="bg-yellow-400"
            iconProps={{ className: 'text-foreground-primary' }}
            title={t('title')}
            footer={
                <div className="w-full">
                    <SlideToConfirm label={tCommon('slideToProceed')} onConfirm={onConfirm} />
                </div>
            }
            content={
                <div className="flex w-full flex-col gap-4">
                    <h2 className="mr-auto font-bold">{t('nextStep')}</h2>
                    <Notification priority="helper" className="w-full">
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
            }
            preventClose={false}
            modalPanelClassName="max-w-md mx-8"
        />
    )
}
