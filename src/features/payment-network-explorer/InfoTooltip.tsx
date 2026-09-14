'use client'

import { useId } from 'react'
import { Button } from '@/components/0_Bruddle/Button'
import { Tooltip } from '@/components/Tooltip'

interface InfoTooltipProps {
    label: string
    children: React.ReactNode
}

export default function InfoTooltip({ label, children }: InfoTooltipProps) {
    const id = useId()

    return (
        <Tooltip
            id={id}
            position="bottom"
            content={
                <span className="ph-no-capture" data-private="true" data-sentry-mask>
                    {children}
                </span>
            }
        >
            <Button
                type="button"
                variant="transparent"
                shape="square"
                size="small"
                icon="info"
                iconSize={16}
                aria-label={`About ${label}`}
                aria-describedby={id}
                className="w-10 text-foreground-secondary"
            />
        </Tooltip>
    )
}
