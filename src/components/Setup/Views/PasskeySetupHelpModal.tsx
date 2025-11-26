'use client'

import { Button } from '@/components/0_Bruddle'
import ActionModal from '@/components/Global/ActionModal'
import InfoCard from '@/components/Global/InfoCard'

interface PasskeySetupHelpModalProps {
    visible: boolean
    onClose: () => void
    onRetry: () => void
    errorName: string
    platform: 'android' | 'ios' | 'web'
}

// platform-specific troubleshooting steps
const ANDROID_STEPS = {
    NotReadableError: [
        'Restart your device',
        'Update Google Play Services',
        'Enable screen lock in Settings > Security',
    ],
    NotAllowedError: [
        'Enable screen lock (Settings > Security)',
        'Update Google Play Services and Chrome',
        'Check for system security updates',
        'Disable third-party password managers temporarily',
    ],
}

const IOS_STEPS = {
    NotAllowedError: [
        'Enable Face ID/Touch ID in Settings',
        'Enable iCloud Keychain in Settings',
        'Use Safari browser',
    ],
}

const getErrorTitle = (errorName: string): string => {
    if (errorName === 'NotReadableError') return 'Credential Manager Busy'
    if (errorName === 'NotAllowedError') return 'Passkey Setup Blocked'
    if (errorName === 'InvalidStateError') return 'Passkey Already Exists'
    if (errorName === 'NotSupportedError') return 'Passkeys Not Supported'
    return 'Setup Issue'
}

const getErrorDescription = (errorName: string, platform: 'android' | 'ios' | 'web'): string => {
    if (errorName === 'NotReadableError') {
        return "Your device's credential manager is temporarily unavailable. This usually happens when the system is busy or needs to be restarted."
    }
    if (errorName === 'NotAllowedError') {
        if (platform === 'android') {
            return 'Your device blocked passkey creation. This typically means security features need to be configured or updated.'
        }
        return 'Passkey creation was blocked. Make sure security features are enabled on your device.'
    }
    if (errorName === 'InvalidStateError') {
        return 'A passkey already exists for this account on your device.'
    }
    return 'An error occurred during passkey setup.'
}

const getTroubleshootingSteps = (errorName: string, platform: 'android' | 'ios' | 'web'): string[] => {
    if (platform === 'android' && errorName in ANDROID_STEPS) {
        return ANDROID_STEPS[errorName as keyof typeof ANDROID_STEPS]
    }
    if (platform === 'ios' && errorName in IOS_STEPS) {
        return IOS_STEPS[errorName as keyof typeof IOS_STEPS]
    }
    return ['Check your device security settings', 'Restart your device', 'Update your browser and OS']
}

const getWarningMessage = (errorName: string, platform: 'android' | 'ios' | 'web'): string | null => {
    if (errorName === 'NotAllowedError' && platform === 'android') {
        return 'Budget Android devices may require recent security updates for passkeys to work properly.'
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
                        items={troubleshootingSteps}
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
