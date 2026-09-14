'use client'

import { useState, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import Modal from '@/components/Global/Modal'
import { Icon } from '@/components/Global/Icons/Icon'
import Loading from '@/components/Global/Loading'
import { SumsubSdkErrorView } from './SumsubSdkErrorView'
import { SumsubHelpModal } from './SumsubHelpModal'
import { useSumsubWebSdk } from './useSumsubWebSdk'
import type { SumsubSdkProps, SumsubHelpModalVariant } from './sumsubSdk.types'

/**
 * The web (non-Capacitor) Sumsub driver: full-screen modal hosting the WebSDK
 * iframe. SDK lifecycle lives in useSumsubWebSdk; this owns only the shell and
 * the help/stop-verification confirmations.
 */
export const SumsubWebSdkModal = ({
    visible,
    sessionKey,
    accessToken,
    onClose,
    onComplete,
    onSubmitted,
    onError,
    onRefreshToken,
    isMultiLevel,
}: SumsubSdkProps) => {
    const [isHelpModalOpen, setIsHelpModalOpen] = useState(false)
    const [modalVariant, setModalVariant] = useState<SumsubHelpModalVariant>('trouble')
    const t = useTranslations('kyc')
    const tCommon = useTranslations('common')

    const { sdkLoadError, setSdkContainer, hasSubmittedRef } = useSumsubWebSdk({
        visible,
        sessionKey,
        accessToken,
        onComplete,
        onSubmitted,
        onError,
        onRefreshToken,
        isMultiLevel,
    })

    // Close-button handler. After the user has submitted, the "are you sure
    // you want to stop?" modal is misleading — they're done, not abandoning.
    // Skip straight to onClose in that case.
    const handleCloseButton = useCallback(() => {
        if (hasSubmittedRef.current) {
            onClose()
            return
        }
        setModalVariant('stop-verification')
        setIsHelpModalOpen(true)
    }, [onClose, hasSubmittedRef])

    const dismissHelpModal = useCallback(() => setIsHelpModalOpen(false), [])

    return (
        <>
            <Modal
                visible={visible}
                onClose={onClose}
                classWrap="h-full w-full !max-w-none sm:!max-w-[600px] border-none sm:m-auto m-0"
                classOverlay={`bg-black/50 ${isHelpModalOpen ? 'pointer-events-none' : ''}`}
                video={false}
                className={`z-[100] !p-0 md:!p-6 ${isHelpModalOpen ? 'pointer-events-none' : ''}`}
                classButtonClose="hidden"
                preventClose={true}
                hideOverlay={false}
            >
                {sdkLoadError ? (
                    <SumsubSdkErrorView onClose={onClose} message={t('wrapper.loadError')} />
                ) : (
                    <div className="flex h-full flex-col">
                        <div className="flex items-center justify-between px-4 py-2">
                            <button
                                type="button"
                                aria-label={tCommon('contactSupport')}
                                onClick={() => {
                                    setModalVariant('trouble')
                                    setIsHelpModalOpen(true)
                                }}
                                className="relative flex items-center gap-1 p-1 transition-opacity duration-instant after:absolute after:-inset-2 focus-visible:outline-[3px] focus-visible:outline-action-focus active:opacity-60"
                            >
                                <Icon name="peanut-support" size={20} className="text-foreground-secondary" />
                            </button>
                            <button
                                type="button"
                                aria-label={tCommon('close')}
                                onClick={handleCloseButton}
                                className="relative p-1 transition-opacity duration-instant after:absolute after:-inset-2 focus-visible:outline-[3px] focus-visible:outline-action-focus active:opacity-60"
                            >
                                <Icon name="cancel" size={24} />
                            </button>
                        </div>
                        <div className="relative w-full flex-1">
                            {/* sits behind the SDK iframe — covered once it paints */}
                            <div className="absolute inset-0 flex items-center justify-center">
                                <Loading className="h-8 w-8" />
                            </div>
                            <div
                                ref={setSdkContainer}
                                className="relative h-full w-full overflow-auto [&>iframe]:!min-h-full"
                            />
                        </div>
                    </div>
                )}
            </Modal>
            {/* rendered outside the outer Modal to avoid pointer-events-none blocking clicks */}
            <SumsubHelpModal
                visible={isHelpModalOpen}
                variant={modalVariant}
                onDismiss={dismissHelpModal}
                onExit={onClose}
            />
        </>
    )
}
