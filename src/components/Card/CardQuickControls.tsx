'use client'

import { type FC } from 'react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/0_Bruddle/Button'
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
        <Button
            variant="ghost"
            onClick={onClick}
            aria-pressed={active || undefined}
            data-testid={testId}
            className="h-auto min-w-0 flex-1 flex-col gap-2 rounded-sm px-0 py-2 text-center"
        >
            <span
                className={twMerge(
                    'flex size-10 items-center justify-center rounded-full border border-solid bg-background-default',
                    active && 'bg-background-badge-info'
                )}
            >
                <Icon name={icon} size={20} />
            </span>
            <span className="text-body-m-semibold">{label}</span>
        </Button>
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
