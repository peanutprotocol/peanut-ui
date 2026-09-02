'use client'

import { Button } from '@/components/0_Bruddle/Button'
import { IconBubble } from '@/components/0_Bruddle/IconBubble'
import { Drawer, DrawerContent, DrawerTitle } from '@/components/Global/Drawer'
import { Notification } from '@/components/0_Bruddle/Notification'
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

    // troubleshooting content is too long for a modal on small screens —
    // DrawerContent's built-in scroll area handles the overflow.
    return (
        <Drawer
            open={visible}
            onOpenChange={(isOpen) => {
                if (!isOpen) onClose()
            }}
        >
            <DrawerContent>
                <div className="flex flex-col items-center gap-4 px-4 pt-1 pb-6 text-center">
                    <IconBubble icon="alert" className="bg-action-secondary" />
                    <DrawerTitle>{title}</DrawerTitle>

                    <div className="flex w-full flex-col gap-4 text-left">
                        <h2 className="mr-auto text-body-s text-foreground-secondary">{description}</h2>

                        <h3 className="mr-auto font-bold">{t('tryTheseFixes')}</h3>
                        <Notification priority="info" className="w-full" items={troubleshootingSteps} />

                        {warning && (
                            <Notification priority="error" title={t('importantNote')}>
                                {warning}
                            </Notification>
                        )}

                        <div className="rounded-sm border border-border-disabled bg-background-disabled/5 p-3 text-body-xs text-foreground-secondary">
                            <p className="mb-1 font-bold">{t('stillHavingIssues')}</p>
                            <p>
                                {t.rich('contactSupport', {
                                    link: (chunks) => (
                                        <a href="https://peanut.me/support" className="text-blue-500 underline">
                                            {chunks}
                                        </a>
                                    ),
                                })}
                            </p>
                        </div>
                    </div>

                    <Button icon="retry" shadowSize="4" className="w-full justify-center" onClick={onRetry}>
                        {tCommon('retry')}
                    </Button>
                </div>
            </DrawerContent>
        </Drawer>
    )
}
