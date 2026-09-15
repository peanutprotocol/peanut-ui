'use client'

import { useState } from 'react'
import { Card } from '@/components/0_Bruddle/Card'
import { PageStack } from '@/components/0_Bruddle/PageStack'
import { Section } from '@/components/0_Bruddle/Section'
import { UserAvatar } from '@/components/Avatar/UserAvatar'
import Loading from '@/components/Global/Loading'
import NavHeader from '@/components/Global/NavHeader'
import styles from './NearbyReceiverSearch.module.css'

const RECEIVERS = [
    { name: 'Maya', username: 'maya', avatarKey: 'basic.frog' },
    { name: 'Leo', username: 'leo', avatarKey: 'basic.star' },
    { name: 'Nia', username: 'nia', avatarKey: 'basic.planet' },
] as const

function NearbyPhoneIllustration() {
    return (
        <svg
            viewBox="0 0 320 248"
            role="img"
            aria-labelledby="nearby-phone-title"
            className="w-full max-w-80 overflow-visible"
        >
            <title id="nearby-phone-title">Phone sending waves to find people nearby</title>

            <g
                fill="none"
                stroke="var(--color-action-primary)"
                strokeWidth="8"
                strokeLinecap="round"
                className={`${styles.ripple} ${styles.rippleOuter}`}
            >
                <path d="M72 42C24 76 24 172 72 206" />
                <path d="M248 42C296 76 296 172 248 206" />
            </g>
            <g
                fill="none"
                stroke="var(--color-border-default)"
                strokeWidth="8"
                strokeLinecap="round"
                className={`${styles.ripple} ${styles.rippleMiddle}`}
            >
                <path d="M92 72C60 96 60 152 92 176" />
                <path d="M228 72C260 96 260 152 228 176" />
            </g>
            <g
                fill="none"
                stroke="var(--color-action-primary)"
                strokeWidth="8"
                strokeLinecap="round"
                className={styles.ripple}
            >
                <path d="M112 99C96 112 96 136 112 149" />
                <path d="M208 99C224 112 224 136 208 149" />
            </g>

            <g
                fill="none"
                stroke="var(--color-action-secondary)"
                strokeWidth="8"
                strokeLinecap="round"
                aria-hidden="true"
            >
                <path d="M98 34L88 20" />
                <path d="M78 51L62 44" />
                <path d="M222 197L232 212" />
                <path d="M242 181L258 188" />
            </g>

            <g className={styles.phone}>
                <rect
                    x="116"
                    y="38"
                    width="88"
                    height="172"
                    rx="18"
                    fill="var(--color-background-default)"
                    stroke="var(--color-border-default)"
                    strokeWidth="8"
                />
                <rect x="125" y="51" width="70" height="140" rx="11" fill="var(--color-action-primary)" />
                <path d="M148 45H172" stroke="var(--color-border-default)" strokeWidth="5" strokeLinecap="round" />
                <path
                    d="M160 91C143 91 134 104 140 118C129 130 137 153 154 155C166 168 188 156 185 140C198 129 191 107 175 105C173 97 168 91 160 91Z"
                    fill="var(--color-action-secondary)"
                    stroke="var(--color-border-default)"
                    strokeWidth="5"
                    strokeLinejoin="round"
                />
                <circle cx="154" cy="119" r="3" fill="var(--color-border-default)" />
                <circle cx="169" cy="119" r="3" fill="var(--color-border-default)" />
                <path
                    d="M154 133C159 138 165 138 170 133"
                    fill="none"
                    stroke="var(--color-border-default)"
                    strokeWidth="4"
                    strokeLinecap="round"
                />
            </g>
        </svg>
    )
}

export default function NearbyReceiverSearch() {
    const [selectedUsername, setSelectedUsername] = useState<string | null>(null)

    return (
        <PageStack gap="6" className="flex-1" style={{ minHeight: 0 }}>
            <NavHeader title="Shake to pay" href="/send" hideMaintenanceBanner />

            <PageStack.Center className="my-0 flex-none gap-3">
                <p className="text-center text-body-m text-foreground-secondary">Shake your phones at the same time</p>
                <div className="flex justify-center px-4">
                    <NearbyPhoneIllustration />
                </div>
                <div className="flex items-center justify-center gap-2 text-body-s" aria-live="polite">
                    <Loading className="h-5 w-5" />
                    <span>Looking nearby…</span>
                </div>
            </PageStack.Center>

            <Section title="People nearby" className="mt-auto">
                <div className="grid grid-cols-3 gap-2">
                    {RECEIVERS.map((receiver) => {
                        const isSelected = selectedUsername === receiver.username

                        return (
                            <button
                                key={receiver.username}
                                type="button"
                                aria-label={`Pay ${receiver.name}`}
                                aria-pressed={isSelected}
                                onClick={() => setSelectedUsername(receiver.username)}
                                className={`${styles.receiverCard} group rounded-sm text-foreground-primary focus-visible:outline-[3px] focus-visible:outline-action-focus`}
                            >
                                <Card
                                    shadowSize="4"
                                    className={`h-40 items-center justify-center gap-3 p-3 transition-all duration-instant group-active:translate-x-1 group-active:translate-y-1 group-active:shadow-none ${isSelected ? 'bg-action-primary' : ''}`}
                                >
                                    <UserAvatar name={receiver.name} avatarKey={receiver.avatarKey} size="medium" />
                                    <span className="text-heading-card">{receiver.name}</span>
                                </Card>
                            </button>
                        )
                    })}
                </div>
            </Section>
        </PageStack>
    )
}
