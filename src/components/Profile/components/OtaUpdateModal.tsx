'use client'

import ActionModal from '@/components/Global/ActionModal'
import { useOtaUpdate } from '@/context/OtaUpdateContext'
import { useTranslations } from 'next-intl'

/**
 * "Update ready — restart to apply" for a staged OTA bundle. The restart is a
 * plugin `set()`, which reloads the page on the spot; if the page is somehow
 * still alive afterwards the provider exits the app on Android and, on iOS
 * (no programmatic exit), swaps the copy for the app-switcher instruction.
 */
const OtaUpdateModal = ({ visible, onClose }: { visible: boolean; onClose: () => void }) => {
    const t = useTranslations('profile.update')
    const tCommon = useTranslations('common')
    const { pendingBundle, applyState, applyNow } = useOtaUpdate()
    const manualRestart = applyState === 'manual-restart'

    return (
        <ActionModal
            visible={visible}
            onClose={onClose}
            tone="info"
            icon="download"
            title={t('title')}
            description={
                manualRestart ? t('manualRestart') : t('description', { version: pendingBundle?.version ?? '' })
            }
            preventClose={applyState === 'applying'}
            ctas={
                manualRestart
                    ? [{ text: tCommon('gotIt'), variant: 'stroke', onClick: onClose }]
                    : [
                          {
                              text: t('restartNow'),
                              shadowSize: '4',
                              loading: applyState === 'applying',
                              disabled: applyState === 'applying',
                              onClick: () => void applyNow(),
                          },
                          {
                              text: t('notNow'),
                              variant: 'stroke',
                              disabled: applyState === 'applying',
                              onClick: onClose,
                          },
                      ]
            }
        />
    )
}

export default OtaUpdateModal
