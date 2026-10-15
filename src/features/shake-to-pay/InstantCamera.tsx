import type { Ref } from 'react'
import styles from './ShakeToPay.module.css'

export function InstantCamera({
    title,
    searching,
    muted,
    slotRef,
}: {
    title: string
    searching: boolean
    muted: boolean
    slotRef: Ref<SVGRectElement>
}) {
    return (
        <svg viewBox="0 0 120 120" role="img" aria-label={title} className="size-full">
            <rect
                x="2.5"
                y="2.5"
                width="115"
                height="115"
                rx="18"
                fill={muted ? 'var(--color-background-disabled)' : 'var(--color-action-primary)'}
                stroke="var(--color-border-default)"
                strokeWidth="3"
            />
            <path d="M4 20C4 10 10 4 20 4H100C110 4 116 10 116 20V30H4Z" fill="var(--color-border-default)" />
            <rect x="16" y="11" width="24" height="12" rx="3" fill="var(--color-foreground-secondary)" />
            <rect x="74" y="10" width="30" height="14" rx="3" fill="var(--color-action-secondary)" />
            <path d="M78 14H100M78 17H100M78 20H100" stroke="var(--color-border-default)" strokeWidth="1" />
            <rect x="52.5" y="89" width="5" height="16" fill="var(--color-action-primary)" />
            <rect x="57.5" y="89" width="5" height="16" fill="var(--color-action-secondary)" />
            <rect x="62.5" y="89" width="5" height="16" fill="var(--color-avatar-blue)" />
            <path d="M52.5 89V105M67.5 89V105" stroke="var(--color-border-default)" strokeWidth="1.5" />
            <circle
                cx="60"
                cy="64"
                r="24"
                fill="var(--color-background-default)"
                stroke="var(--color-border-default)"
                strokeWidth="3"
            />
            <circle cx="60" cy="64" r="14.5" fill="var(--color-border-default)" />
            <circle cx="55" cy="59" r="4" fill="var(--color-background-default)" />
            <circle
                cx="20"
                cy="48"
                r="6.5"
                fill="var(--color-action-primary)"
                stroke="var(--color-border-default)"
                strokeWidth="2"
            />
            <circle
                cx="100"
                cy="48"
                r="4.5"
                stroke="var(--color-border-default)"
                strokeWidth="1.8"
                className={searching ? `${styles.led} ${styles.ledOn}` : styles.led}
            />
            <rect ref={slotRef} x="26" y="108" width="68" height="5" rx="2.5" fill="var(--color-border-default)" />
        </svg>
    )
}
