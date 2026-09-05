'use client'

import { Button } from '@/components/0_Bruddle/Button'
import ActionModal from '@/components/Global/ActionModal'
import { Notification } from '@/components/0_Bruddle/Notification'
import { NumberedList } from '@/components/0_Bruddle/NumberedList'
import { LinkButton } from '@/components/0_Bruddle/LinkButton'
import { PASSKEY_TROUBLESHOOTING_STEPS, PASSKEY_WARNINGS, WebAuthnErrorName } from '@/utils/webauthn.utils'
import { useTranslations } from 'next-intl'

interface PasskeySetupHelpModalProps {
    visible: boolean
    onClose: () => void
    onRetry: () => void
    errorName: string
    platform: 'android' | 'ios' | 'web'
}

const getTroubleshootingStepIds = (errorName: string, platform: 'android' | 'ios' | 'web'): readonly string[] => {
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

const getWarningId = (errorName: string, platform: 'android' | 'ios' | 'web'): string | null => {
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
    const troubleshootingSteps = getTroubleshootingStepIds(errorName, platform).map((id) =>
        t(`steps.${id}` as Parameters<typeof t>[0])
    )
    const warningId = getWarningId(errorName, platform)
    const warning = warningId ? t(`warnings.${warningId}` as Parameters<typeof t>[0]) : null

    return (
        <ActionModal
            visible={visible}
            onClose={onClose}
            icon="alert"
            iconContainerClassName="bg-action-secondary"
            iconProps={{ className: 'text-foreground-primary' }}
            title={title}
            footer={
                <div className="flex w-full flex-col items-center gap-3">
                    <Button icon="retry" shadowSize="4" onClick={onRetry} className="w-full justify-center">
                        {tCommon('retry')}
                    </Button>
                    {/* support leaves the tinted box: it is a secondary action, not a caveat */}
                    <LinkButton href="https://peanut.me/support">{t('stillHavingIssues')}</LinkButton>
                </div>
            }
            content={
                /* One Notification on the screen, and it is the device-security
                   caveat — the only line here that is a real warning. The fixes
                   are a sequence, so they read as a numbered list (the same
                   shape CameraPermissionModal uses for the same job), and their
                   heading is the grey mini-header, not a raw bold h3. */
                <div className="flex w-full flex-col gap-4 text-left">
                    <p className="text-body-s text-foreground-secondary">{description}</p>

                    <div className="flex flex-col gap-2">
                        <h2 className="text-label-m tracking-wide text-foreground-secondary uppercase">
                            {t('tryTheseFixes')}
                        </h2>
                        <NumberedList items={troubleshootingSteps} />
                    </div>

                    {warning && <Notification priority="attention">{warning}</Notification>}
                </div>
            }
            preventClose={false}
            modalPanelClassName="max-w-md mx-8"
        />
    )
}
