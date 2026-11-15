'use client'

import { useRef } from 'react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/0_Bruddle/Button'
import { Card } from '@/components/0_Bruddle/Card'
import { Icon } from '@/components/Global/Icons/Icon'
import { MIGRATION_SURFACES } from '@/constants/migration.consts'
import { openStore } from '@/utils/migration.utils'
import { useAttention } from '../../AttentionProvider'
import type { ZoneSurfaceProps } from '../../types'

export default function AppUpdateCard({ onAction, onSnoozed }: ZoneSurfaceProps) {
    const t = useTranslations('appUpdateAttention')
    const tCarousel = useTranslations('home.carousel')
    const { state } = useAttention()
    const opened = useRef(false)
    const store = state.storeUpdatePrompt?.platform
    if (!store) return null
    return (
        <Card className="embla__slide relative flex flex-row items-center px-2 py-2 md:py-3">
            <button
                type="button"
                className="flex w-full items-center gap-3 rounded-sm p-2 text-left focus-visible:outline-[3px] focus-visible:outline-action-focus"
                onClick={() => {
                    if (opened.current) return
                    opened.current = true
                    onAction?.({ cta: 'store' })
                    onSnoozed()
                    openStore(store, MIGRATION_SURFACES.ATTENTION_UPDATE)
                }}
            >
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-action-primary">
                    <Icon name="download" size={16} />
                </span>
                <span className="flex flex-col pr-8">
                    <span className="text-heading-card">{t('title')}</span>
                    <span className="text-body-m text-foreground-secondary">{t('description')}</span>
                </span>
            </button>
            <Button
                type="button"
                variant="ghost"
                shape="square"
                icon="cancel"
                aria-label={tCarousel('closeTitled', { title: t('title') })}
                className="absolute top-0 right-0 size-11"
                onClick={() => onSnoozed()}
            />
        </Card>
    )
}
