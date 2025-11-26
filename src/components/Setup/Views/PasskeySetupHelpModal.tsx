'use client'

import { Button } from '@/components/0_Bruddle'
import ActionModal from '@/components/Global/ActionModal'
import InfoCard from '@/components/Global/InfoCard'
import { PASSKEY_TROUBLESHOOTING_STEPS, PASSKEY_WARNINGS, WebAuthnErrorName } from '@/utils'

interface PasskeySetupHelpModalProps {
    visible: boolean
    onClose: () => void
    onRetry: () => void
    errorName: string
    platform: 'android' | 'ios' | 'web'
}

const getErrorTitle = (errorName: string): string => {
    if (errorName === WebAuthnErrorName.NotReadable) return 'Credential Manager Busy'
    if (errorName === WebAuthnErrorName.NotAllowed) return 'Passkey Setup Blocked'
    if (errorName === WebAuthnErrorName.InvalidState) return 'Passkey Already Exists'
    if (errorName === WebAuthnErrorName.NotSupported) return 'Passkeys Not Supported'
    return 'Setup Issue'
}

const getErrorDescription = (errorName: string, platform: 'android' | 'ios' | 'web'): string => {
    if (errorName === WebAuthnErrorName.NotReadable) {
        return "Your device's credential manager is temporarily unavailable. This usually happens when the system is busy or needs to be restarted."
    }
    if (errorName === WebAuthnErrorName.NotAllowed) {
        if (platform === 'android') {
            return 'Your device blocked passkey creation. This typically means security features need to be configured or updated.'
        }
        return 'Passkey creation was blocked. Make sure security features are enabled on your device.'
    }
    if (errorName === WebAuthnErrorName.InvalidState) {
        return 'A passkey already exists for this account on your device.'
    }
    return 'An error occurred during passkey setup.'
}

const getTroubleshootingSteps = (errorName: string, platform: 'android' | 'ios' | 'web'): readonly string[] => {
    if (platform === 'android' && errorName in PASSKEY_TROUBLESHOOTING_STEPS.android) {
        return PASSKEY_TROUBLESHOOTING_STEPS.android[errorName as keyof typeof PASSKEY_TROUBLESHOOTING_STEPS.android]
    }
    if (platform === 'ios' && errorName in PASSKEY_TROUBLESHOOTING_STEPS.ios) {
        return PASSKEY_TROUBLESHOOTING_STEPS.ios[errorName as keyof typeof PASSKEY_TROUBLESHOOTING_STEPS.ios]
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
    const title = getErrorTitle(errorName)
    const description = getErrorDescription(errorName, platform)
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
                    Retry
                </Button>
            }
            content={
                <div className="flex w-full flex-col gap-4">
                    <h2 className="mr-auto text-sm text-grey-1">{description}</h2>

                    <h3 className="mr-auto font-bold">Try these fixes:</h3>
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
                            title="Important Note"
                            description={warning}
                        />
                    )}

                    <div className="rounded-lg border border-grey-2 bg-grey-2/5 p-3 text-xs text-grey-1">
                        <p className="mb-1 font-bold">Still having issues?</p>
                        <p>
                            Contact our support team at{' '}
                            <a href="https://peanut.me/support" className="text-secondary-7 underline">
                                peanut.me/support
                            </a>
                        </p>
                    </div>
                </div>
            }
            preventClose={false}
            modalPanelClassName="max-w-md mx-8"
        />
    )
}
