'use client'

import ActionModal, { type ActionModalButtonProps } from '@/components/Global/ActionModal'
import { type IconName } from '@/components/Global/Icons/Icon'
import type { MediaCheckResult } from '@/utils/mediaPermissions.utils'

interface CameraPermissionWarningModalProps {
    visible: boolean
    onClose: () => void
    onContinueAnyway: () => void
    onOpenInBrowser: () => void
    mediaCheckResult: MediaCheckResult
}

/**
 * Modal that warns users when camera/microphone access is likely to fail
 * Offers two options: try anyway in iframe, or open in browser
 */
export default function CameraPermissionWarningModal({
    visible,
    onClose,
    onContinueAnyway,
    onOpenInBrowser,
    mediaCheckResult,
}: CameraPermissionWarningModalProps) {
    const isError = mediaCheckResult.severity === 'error'

    const getTitle = () => {
        if (isError) {
            return 'Camera or Microphone Required'
        }
        return 'Camera Access May Be Limited'
    }

    const getDescription = () => {
        if (mediaCheckResult.message) {
            return mediaCheckResult.message
        }
        return 'Identity verification requires camera and microphone access. Opening in your browser may provide better results.'
    }

    const ctas: ActionModalButtonProps[] = [
        {
            text: 'Open in Browser',
            icon: 'arrow-up-right' as IconName,
            iconPosition: 'right',
            onClick: onOpenInBrowser,
            variant: 'purple',
            shadowSize: '4',
            className: 'justify-center',
        },
    ]

    // Only show "Try Anyway" if it's a warning (not a hard error)
    if (!isError) {
        ctas.push({
            text: 'Try Anyway',
            onClick: onContinueAnyway,
            variant: 'transparent',
            className: 'underline text-xs md:text-sm !font-normal !transform-none !pt-2 text-grey-1',
        })
    }

    return (
        <ActionModal
            visible={visible}
            onClose={onClose}
            title={getTitle()}
            description={getDescription()}
            icon={'alert' as IconName}
            iconContainerClassName={isError ? 'bg-error-1' : 'bg-secondary-1'}
            iconProps={{ className: 'text-white' }}
            ctas={ctas}
            modalPanelClassName="max-w-md"
            contentContainerClassName="text-center"
            ctaClassName="flex-col sm:flex-col"
        />
    )
}

