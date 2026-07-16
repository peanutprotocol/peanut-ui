'use client'

import { Button } from '@/components/0_Bruddle/Button'
import ActionModal from '@/components/Global/ActionModal'
import InfoCard from '@/components/Global/InfoCard'
import { PASSKEY_TROUBLESHOOTING_STEPS, PASSKEY_WARNINGS, WebAuthnErrorName } from '@/utils/webauthn.utils'
import { useTranslations } from 'next-intl'

interface PasskeySetupHelpModalProps {
    visible: boolean
    onClose: () => void
    onRetry: () => void
    errorName: string
    platform: 'android' | 'ios' | 'web'
}

const getTroubleshootingSteps = (errorName: string, platform: 'android' | 'ios' | 'web'): readonly string[] => {
    if (platform === 'android') {
        const steps = PASSKEY_TROUBLESHOOTING_STEPS.android
        return errorName in steps ? steps[errorName as keyof typeof steps] : steps.default
    }
    if (platform === 'ios') {
        const steps = PASSKEY_TROUBLESHOOTING_STEPS.ios
        return errorName in steps ? steps[errorName as keyof typeof steps] : steps.default
    }
    return PASSKEY_TROUBLESHOOTING_STEPS.web.default
}

const getWarningMessage = (errorName: string, platform: 'android' | 'ios' | 'web'): string | null => {
    if (platform === 'android' && errorName in PASSKEY_WARNINGS.android) {
        return PASSKEY_WARNINGS.android[errorName as keyof typeof PASSKEY_WARNINGS.android]
    }
    return null
}

export const PasskeySetupHelpModal = ({
    visible,
    onClose,
    onRetry,
    errorName,
    platform,
}: PasskeySetupHelpModalProps) => {
    const t = useTranslations('setup.passkey.help')
    const tCommon = useTranslations('common')

    const getTitle = (): string => {
        if (errorName === WebAuthnErrorName.NotReadable) return t('titles.notReadable')
        if (errorName === WebAuthnErrorName.NotAllowed) return t('titles.notAllowed')
        if (errorName === WebAuthnErrorName.InvalidState) return t('titles.invalidState')
        if (errorName === WebAuthnErrorName.NotSupported) return t('titles.notSupported')
        return t('titles.default')
    }

    const getDescription = (): string => {
        if (errorName === WebAuthnErrorName.NotReadable) return t('descriptions.notReadable')
        if (errorName === WebAuthnErrorName.NotAllowed) {
            return platform === 'android' ? t('descriptions.notAllowedAndroid') : t('descriptions.notAllowed')
        }
        if (errorName === WebAuthnErrorName.InvalidState) return t('descriptions.invalidState')
        return t('descriptions.default')
    }

    const title = getTitle()
    const description = getDescription()
    const troubleshootingSteps = getTroubleshootingSteps(errorName, platform)
    const warning = getWarningMessage(errorName, platform)

    return (
        <ActionModal
            visible={visible}
            onClose={onClose}
            icon="alert"
            iconContainerClassName="bg-yellow-400"
            iconProps={{ className: 'text-black' }}
            title={title}
            footer={
                <Button icon="retry" shadowSize="4" onClick={onRetry}>
                    {tCommon('retry')}
                </Button>
            }
            content={
                <div className="flex w-full flex-col gap-4">
                    <h2 className="mr-auto text-sm text-grey-1">{description}</h2>

                    <h3 className="mr-auto font-bold">{t('tryTheseFixes')}</h3>
                    <InfoCard
                        variant="info"
                        itemIcon="check"
                        itemIconClassName="text-secondary-7"
                        items={[...troubleshootingSteps]}
                    />

                    {warning && (
                        <InfoCard
                            variant="error"
                            icon="alert"
                            iconClassName="text-error-5"
                            title={t('importantNote')}
                            description={warning}
                        />
                    )}

                    <div className="rounded-lg border border-grey-2 bg-grey-2/5 p-3 text-xs text-grey-1">
                        <p className="mb-1 font-bold">{t('stillHavingIssues')}</p>
                        <p>
                            {t.rich('contactSupport', {
                                link: (chunks) => (
                                    <a href="https://peanut.me/support" className="text-secondary-7 underline">
                                        {chunks}
                                    </a>
                                ),
                            })}
                        </p>
                    </div>
                </div>
            }
            preventClose={false}
            modalPanelClassName="max-w-md mx-8"
        />
    )
}
