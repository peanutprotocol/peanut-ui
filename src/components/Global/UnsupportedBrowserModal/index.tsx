'use client'

import ActionModal from '@/components/Global/ActionModal'
import { type IconName } from '@/components/Global/Icons/Icon'
import { useState, Suspense, useSyncExternalStore } from 'react'
import { useTranslations } from 'next-intl'
import { useSearchParams } from 'next/navigation'
import { isLikelyWebview } from '@/components/Setup/Setup.utils'
import { usePasskeySupportContext } from '@/context/passkeySupportContext'
import { getCompatibilityModalCopy } from './UnsupportedBrowserModal.utils'
import { useCopyLinkActions } from './useCopyLinkActions'

const subscribeToStaticBrowserDetection = (): (() => void) => () => {}
const getServerBrowserDetectionSnapshot = (): boolean => false

const UnsupportedBrowserModalContent = ({
    allowClose = true,
    visible = false,
}: {
    allowClose?: boolean
    visible?: boolean
}) => {
    const t = useTranslations('global')
    const searchParams = useSearchParams()
    // The UA/display-mode inputs are static for the lifetime of a page. A
    // server snapshot keeps hydration deterministic, then React reads the real
    // browser snapshot after hydration.
    const isDetectedInAppBrowser = useSyncExternalStore(
        subscribeToStaticBrowserDetection,
        isLikelyWebview,
        getServerBrowserDetectionSnapshot
    )
    const [hasDismissedDetection, setHasDismissedDetection] = useState(false)
    const { isSupported: isPasskeySupported, isLoading: isLoadingPasskeySupport } = usePasskeySupportContext()
    const copyLinkActions = useCopyLinkActions(searchParams)
    const modalCopy = getCompatibilityModalCopy({
        showBrowserWarning: visible || isDetectedInAppBrowser,
        passkeySupported: isPasskeySupported,
        passkeyLoading: isLoadingPasskeySupport,
    })

    if (!modalCopy || (hasDismissedDetection && !visible)) return null

    const handleModalClose = () => {
        // A missing platform authenticator must not trap existing users who can
        // still log in with a roaming authenticator such as a security key.
        // Registration remains gated by the setup flow's capability check.
        if (allowClose || modalCopy.kind === 'passkey') {
            setHasDismissedDetection(true)
        }
    }

    return (
        <ActionModal
            visible={true}
            onClose={handleModalClose}
            title={t(modalCopy.titleKey)}
            description={t(modalCopy.descriptionKey)}
            icon={'alert' as IconName}
            iconContainerClassName="bg-action-primary"
            iconProps={{ className: 'text-black' }}
            ctas={modalCopy.kind === 'browser' ? copyLinkActions : undefined}
            hideModalCloseButton={modalCopy.kind === 'browser' && !allowClose}
            modalPanelClassName="max-w-md"
            contentContainerClassName="text-center"
            descriptionClassName="mb-0"
            ctaClassName="flex-col sm:flex-col"
        />
    )
}

// suspense is being used to prevent hydration errors that may be caused by useSearchParams
const UnsupportedBrowserModal = (props: { allowClose?: boolean; visible?: boolean }) => {
    return (
        <Suspense fallback={null}>
            <UnsupportedBrowserModalContent {...props} />
        </Suspense>
    )
}

export default UnsupportedBrowserModal
