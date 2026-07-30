'use client'
import { useEffect, useState } from 'react'
import posthog from 'posthog-js'
import { useTranslations } from 'next-intl'
import ActionModal from '@/components/Global/ActionModal'
import { ANALYTICS_EVENTS, MODAL_TYPES } from '@/constants/analytics.consts'
import { REVIEW_URL } from '@/constants/migration.consts'
import { DeviceType, useDeviceType } from '@/hooks/useGetDeviceType'
import { useMigrationFlag } from '@/hooks/useMigrationFlag'
import { useTransactionHistory } from '@/hooks/useTransactionHistory'
import { useModalsContext } from '@/context/ModalsContext'
import { useUserStore } from '@/redux/hooks'
import { isCapacitor, openExternalUrl } from '@/utils/capacitor'
import { getUserPreferences, updateUserPreferences } from '@/utils/general.utils'

/**
 * "Loving Peanut so far?" pre-prompt (TASK-20598), native app only, asked once
 * ever. Love it → store review page; Could be better → support drawer, so
 * unhappy users never reach the store.
 *
 * ponytail: "good moment" V1 = user has at least one transaction and visits
 * home (shares the useTransactionHistory cache with HomeHistory, so the read
 * is free). Wiring the exact success screens is the upgrade path. Store-page
 * deep link for the rating; @capacitor-community/in-app-review for the native
 * sheet if conversion matters.
 */
export default function ReviewPromptModal() {
    const t = useTranslations('migration')
    const migrationOn = useMigrationFlag()
    const { deviceType } = useDeviceType()
    const { user } = useUserStore()
    const { setIsSupportModalOpen } = useModalsContext()
    const { data: latestHistory } = useTransactionHistory({ mode: 'latest', limit: 50 })
    const [visible, setVisible] = useState(false)

    const userId = user?.user.userId
    const hasTransacted = (latestHistory?.entries.length ?? 0) > 0

    useEffect(() => {
        if (!migrationOn || !userId || !isCapacitor() || !hasTransacted) return
        if (getUserPreferences(userId)?.reviewPromptShownAt) return
        setVisible(true)
        posthog.capture(ANALYTICS_EVENTS.MODAL_SHOWN, { modal_type: MODAL_TYPES.APP_REVIEW })
    }, [migrationOn, userId, hasTransacted])

    const close = (cta?: 'love' | 'meh') => {
        setVisible(false)
        // stamp on interaction, not on show — home's priority wrapper can
        // unmount a just-shown modal, and a show-time stamp would burn the
        // once-ever ask before the user ever saw it
        updateUserPreferences(userId, { reviewPromptShownAt: new Date().toISOString() })
        if (cta) {
            posthog.capture(ANALYTICS_EVENTS.MODAL_CTA_CLICKED, { modal_type: MODAL_TYPES.APP_REVIEW, cta })
        } else {
            posthog.capture(ANALYTICS_EVENTS.MODAL_DISMISSED, { modal_type: MODAL_TYPES.APP_REVIEW })
        }
    }

    return (
        <ActionModal
            visible={visible}
            onClose={() => close()}
            icon="star"
            title={t('review.title')}
            description={t('review.description')}
            ctas={[
                {
                    text: t('review.loveIt'),
                    variant: 'purple',
                    shadowSize: '4',
                    onClick: () => {
                        close('love')
                        void openExternalUrl(REVIEW_URL[deviceType === DeviceType.ANDROID ? 'android' : 'ios'])
                    },
                },
                {
                    text: t('review.meh'),
                    variant: 'stroke',
                    shadowSize: '4',
                    onClick: () => {
                        close('meh')
                        setIsSupportModalOpen(true)
                    },
                },
            ]}
        />
    )
}
