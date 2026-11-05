'use client'

import { type FC } from 'react'
import { useTranslations } from 'next-intl'
import { Divider } from '@/components/0_Bruddle/Divider'
import { Icon, type IconName } from '@/components/Global/Icons/Icon'
import { twMerge } from '@/utils/tw'

function Control({
    icon,
    label,
    active = false,
    onClick,
    testId,
}: {
    icon: IconName
    label: string
    active?: boolean
    onClick: () => void
    testId: string
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            aria-pressed={active || undefined}
            data-testid={testId}
            className="flex min-w-0 flex-1 flex-col items-center gap-2 rounded-sm py-2 text-center transition-opacity focus-visible:outline-[3px] focus-visible:outline-action-focus active:opacity-60"
        >
            <span
                className={twMerge(
                    'flex size-10 items-center justify-center rounded-full border border-solid bg-background-default',
                    active && 'bg-background-badge-info'
                )}
            >
                <Icon name={icon} size={20} />
            </span>
            <span className="text-body-m-semibold text-foreground-primary">{label}</span>
        </button>
    )
}

/** The card's everyday controls beside its face: PIN, then freeze or unfreeze. */
const CardQuickControls: FC<{ isFrozen: boolean; onPin: () => void; onFreeze: () => void }> = ({
    isFrozen,
    onPin,
    onFreeze,
}) => {
    const t = useTranslations('card.yourCard')
    return (
        <div className="flex gap-6" data-testid="card-quick-controls">
            <Control icon="pin-field" label={t('pin')} onClick={onPin} testId="card-control-pin" />
            <Divider orientation="vertical" />
            <Control
                icon="snowflake"
                label={isFrozen ? t('unlockCard') : t('lockCard')}
                active={isFrozen}
                onClick={onFreeze}
                testId="card-control-freeze"
            />
        </div>
    )
}

export default CardQuickControls
