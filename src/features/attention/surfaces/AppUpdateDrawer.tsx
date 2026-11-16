'use client'

import { useRef } from 'react'
import { useTranslations } from 'next-intl'
import { MIGRATION_SURFACES, STORE_NAME } from '@/constants/migration.consts'
import { openStore } from '@/utils/migration.utils'
import { AskShell } from '../AskShell'
import { useAttention } from '../AttentionProvider'
import type { AskSurfaceProps } from '../types'

export default function AppUpdateDrawer({ presentation, onAction, onSnoozed }: AskSurfaceProps) {
    const t = useTranslations('appUpdateAttention')
    const tStore = useTranslations('profile.storeUpdate')
    const tUpdate = useTranslations('profile.update')
    const { state } = useAttention()
    const opened = useRef(false)
    const store = state.storeUpdatePrompt?.platform
    if (!store) return null
    const snooze = () => onSnoozed()
    return (
        <AskShell
            presentation={presentation}
            tone="info"
            icon="download"
            title={t('title')}
            description={t('description')}
            onClose={snooze}
            ctas={[
                {
                    text: tStore('openStore', { store: STORE_NAME[store] }),
                    onClick: () => {
                        if (opened.current) return
                        opened.current = true
                        onAction?.({ cta: 'store' })
                        snooze()
                        openStore(store, MIGRATION_SURFACES.ATTENTION_UPDATE)
                    },
                },
            ]}
            tertiaryCta={{ text: tUpdate('notNow'), onClick: snooze }}
        />
    )
}
