'use client'

import ActionModal from '@/components/Global/ActionModal'
import { useOtaUpdate } from '@/context/OtaUpdateContext'
import { useTranslations } from 'next-intl'

/**
 * "Update ready — restart to apply" for a staged OTA bundle. The restart is a
 * plugin `set()`, which reloads the page on the spot; if the page is somehow
 * still alive afterwards the provider exits the app on Android and, on iOS
 * (no programmatic exit), swaps the copy for the app-switcher instruction.
 * An apply that never reached the plugin (offline re-stage, rejected reload)
 * comes back as `failed` — an error tone with a retry, never a restart
 * instruction for an update that is not there.
 */
const OtaUpdateModal = ({ visible, onClose }: { visible: boolean; onClose: () => void }) => {
    const t = useTranslations('profile.update')
    const tCommon = useTranslations('common')
    const { pendingBundle, applyState, applyNow } = useOtaUpdate()
    const manualRestart = applyState === 'manual-restart'
    const failed = applyState === 'failed'
    const applying = applyState === 'applying'

    return (
        <ActionModal
            visible={visible}
            onClose={onClose}
            tone={failed ? 'error' : 'info'}
            icon="download"
            title={t('title')}
            description={
                manualRestart
                    ? t('manualRestart')
                    : failed
                      ? t('applyFailed')
                      : t('description', { version: pendingBundle?.version ?? '' })
            }
            preventClose={applying}
            ctas={
                manualRestart
                    ? [{ text: tCommon('gotIt'), variant: 'stroke', onClick: onClose }]
                    : [
                          {
                              text: failed ? tCommon('tryAgain') : t('restartNow'),
                              shadowSize: '4',
                              loading: applying,
                              disabled: applying,
                              onClick: () => void applyNow(),
                          },
                          {
                              text: t('notNow'),
                              variant: 'stroke',
                              disabled: applying,
                              onClick: onClose,
                          },
                      ]
            }
        />
    )
}

export default OtaUpdateModal
