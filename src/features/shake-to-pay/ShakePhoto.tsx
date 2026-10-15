'use client'

import { useLayoutEffect, useRef, type RefObject } from 'react'
import { UserAvatar } from '@/components/Avatar/UserAvatar'
import { Icon } from '@/components/Global/Icons/Icon'
import type { ShakeCandidate } from './shakeApi'
import styles from './ShakeToPay.module.css'

const SHOT_BACKGROUNDS = [
    'bg-avatar-pink',
    'bg-avatar-yellow',
    'bg-avatar-blue',
    'bg-avatar-orange',
    'bg-avatar-purple',
    'bg-avatar-green',
]

/** A small, stable tilt per person so the prints look tossed down, not gridded. */
function tiltFor(username: string): number {
    let hash = 0
    for (const char of username) hash = (hash * 31 + char.charCodeAt(0)) | 0
    return (Math.abs(hash) % 13) - 6
}

interface ShakePhotoProps {
    candidate: ShakeCandidate
    index: number
    isContact: boolean
    slotRef: RefObject<SVGRectElement | null>
    labels: { pay: string; contact: string; verified: string }
    onSelect: () => void
}

export function ShakePhoto({ candidate, index, isContact, slotRef, labels, onSelect }: ShakePhotoProps) {
    const cellRef = useRef<HTMLLIElement>(null)

    // the print slides out of the camera slot: measure the untransformed cell, not the tilted button
    useLayoutEffect(() => {
        const cell = cellRef.current
        const slot = slotRef.current
        if (!cell || !slot) return
        const from = slot.getBoundingClientRect()
        const to = cell.getBoundingClientRect()
        cell.style.setProperty('--from-x', `${from.left + from.width / 2 - (to.left + to.width / 2)}px`)
        cell.style.setProperty('--from-y', `${from.top + from.height / 2 - (to.top + to.height / 2)}px`)
    }, [slotRef])

    useLayoutEffect(() => {
        cellRef.current?.style.setProperty('--tilt', `${tiltFor(candidate.username)}deg`)
    }, [candidate.username])

    // a 4rem print fits a first name; the full name is in the button's label
    const name = (candidate.displayName ?? candidate.username).split(' ')[0]
    const accessibleName = [labels.pay, isContact && labels.contact, candidate.isVerified && labels.verified]
        .filter(Boolean)
        .join(', ')

    return (
        <li ref={cellRef}>
            <button type="button" aria-label={accessibleName} onClick={onSelect} className={styles.photo}>
                {isContact && <span className={`${styles.contactTag} text-label-m`}>{labels.contact}</span>}
                <span className={`${styles.shot} ${SHOT_BACKGROUNDS[index % SHOT_BACKGROUNDS.length]}`}>
                    <UserAvatar size="l" name={candidate.username} avatarKey={candidate.avatarKey} decorative />
                </span>
                <span className={styles.caption}>
                    <span className="flex min-w-0 items-center gap-0.5">
                        <span className="truncate text-label-m text-foreground-primary">{name}</span>
                        {candidate.isVerified && (
                            <Icon
                                name="check"
                                size={16}
                                className="shrink-0 text-green-500"
                                aria-label={labels.verified}
                                role="img"
                            />
                        )}
                    </span>
                    <span className="truncate text-body-xs text-foreground-secondary">{`@${candidate.username}`}</span>
                </span>
            </button>
        </li>
    )
}
