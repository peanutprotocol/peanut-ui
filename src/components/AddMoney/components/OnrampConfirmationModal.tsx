'use client'

import ActionModal from '@/components/Global/ActionModal'
import InfoCard from '@/components/Global/InfoCard'
import { Slider } from '@/components/Slider'
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
    return (
        <ActionModal
            visible={visible}
            onClose={onClose}
            icon="alert"
            iconContainerClassName="bg-yellow-400"
            iconProps={{ className: 'text-black' }}
            title={t('title')}
            footer={
                <div className="w-full">
                    <Slider onValueChange={(v) => v && onConfirm()} />
                </div>
            }
            content={
                <div className="flex w-full flex-col gap-4">
                    <h2 className="mr-auto font-bold">{t('nextStep')}</h2>
                    <InfoCard variant="default" items={[t('bankDetailsItem'), t('referenceCodeItem')]} />
                    <h2 className="mr-auto font-bold">{t('youMust')}</h2>
                    <InfoCard
                        variant="info"
                        itemIcon="check"
                        itemIconClassName="text-secondary-7"
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

                    <InfoCard
                        variant="error"
                        icon="alert"
                        iconClassName="text-error-5"
                        title={t('mismatchTitle')}
                        description={t('mismatchDescription')}
                    />
                </div>
            }
            preventClose={false}
            modalPanelClassName="max-w-md mx-8"
        />
    )
}
