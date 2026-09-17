'use client'

import { Button } from '@/components/0_Bruddle/Button'
import { useModalsContext } from '@/context/ModalsContext'
import { LinkButton } from '@/components/0_Bruddle/LinkButton'
import { useTranslations } from 'next-intl'
import PeanutMascot from '@/components/Global/PeanutMascot'
import { MASCOT_STATE_CLASS } from '@/components/Global/PeanutMascot/PeanutMascot.consts'

type ClaimErrorViewProps = {
    title: string
    message: string
    primaryButtonText: string
    onPrimaryClick: () => void
}

export const ClaimErrorView = ({ title, message, primaryButtonText, onPrimaryClick }: ClaimErrorViewProps) => {
    const { openSupportWithMessage } = useModalsContext()
    const t = useTranslations('claim')

    return (
        <div className="space-y-4 flex flex-col items-center justify-center text-center">
            <PeanutMascot pose="worried" alt={t('errors.sadPeanutAlt')} className={MASCOT_STATE_CLASS} />
            <div className="space-y-2">
                <h1 className="text-heading-card text-foreground-primary">{title}</h1>
                <p className="text-body-s font-normal md:max-w-xs">{message}</p>
            </div>
            <div className="flex w-full flex-col gap-2">
                <Button onClick={onPrimaryClick} size="medium" shadowSize="4" variant="purple" className="w-full">
                    {primaryButtonText}
                </Button>
                <Button
                    onClick={() => {
                        openSupportWithMessage(t('errors.supportPrefill', { url: window.location.href }))
                    }}
                    size="medium"
                    shadowSize="4"
                    variant="stroke"
                    className="w-full"
                >
                    {t('errors.talkToSupport')}
                </Button>
                <LinkButton href="/home" className="mt-2 self-center">
                    {t('errors.goBackToHome')}
                </LinkButton>
            </div>
        </div>
    )
}
