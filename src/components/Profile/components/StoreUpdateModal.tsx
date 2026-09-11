'use client'

import ActionModal from '@/components/Global/ActionModal'
import { STORE_NAME, MIGRATION_SURFACES } from '@/constants/migration.consts'
import { isIOSNative } from '@/utils/capacitor'
import { openStore } from '@/utils/migration.utils'
import { useTranslations } from 'next-intl'

/**
 * The store-only half of the update prompt. A bundle built for a newer binary
 * cannot be installed over the air at all (see utils/ota-native-gate), so this
 * must never offer a restart — the restart would reload the same JS and read as
 * an update that silently did nothing.
 */
const StoreUpdateModal = ({ visible, onClose }: { visible: boolean; onClose: () => void }) => {
    const t = useTranslations('profile.storeUpdate')
    const tUpdate = useTranslations('profile.update')
    const store = isIOSNative() ? 'ios' : 'android'

    return (
        <ActionModal
            visible={visible}
            onClose={onClose}
            tone="info"
            icon="download"
            title={t('title', { store: STORE_NAME[store] })}
            description={t('description', { store: STORE_NAME[store] })}
            ctas={[
                {
                    text: t('openStore', { store: STORE_NAME[store] }),
                    shadowSize: '4',
                    onClick: () => {
                        openStore(store, MIGRATION_SURFACES.PROFILE_UPDATE)
                        onClose()
                    },
                },
                { text: tUpdate('notNow'), variant: 'stroke', onClick: onClose },
            ]}
        />
    )
}

export default StoreUpdateModal
