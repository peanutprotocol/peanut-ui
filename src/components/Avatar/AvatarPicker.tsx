'use client'

import { useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { updateUserById } from '@/app/actions/users'
import { useToast } from '@/components/0_Bruddle/Toast'
import StatusBadge from '@/components/Global/Badges/StatusBadge'
import { Drawer, DrawerContent } from '@/components/Global/Drawer'
import { Icon } from '@/components/Global/Icons/Icon'
import { useAuth } from '@/context/authContext'
import { twMerge } from '@/utils/tw'
import { AVATAR_CAST } from './avatar.consts'
import { badgeAvatarKeys, dealHand } from './avatar.utils'
import { roveAvatarTiles } from './avatarPicker.utils'
import { UserAvatar } from './UserAvatar'

interface AvatarPickerProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    /** Badge code the first hand deals from — the badge-earned toast's deep link. */
    prefer?: string
}

/**
 * The profile avatar picker (TASK-22142): one hand of eight. Slot 1 is always
 * the user's initial, slots 2-8 are dealt by `dealHand` (at least one earned
 * badge avatar, the current pick kept, the rest from the basics) and slot 9
 * rolls a new hand. A tap saves at once; rolling never changes the pick. The
 * API validates the pick against the same pool, so a locked key never lands
 * even if the manifest and the catalog drift.
 */
export function AvatarPicker({ open, onOpenChange, prefer }: AvatarPickerProps) {
    const t = useTranslations('avatar')
    const { user, fetchUser } = useAuth()
    const { toast } = useToast()

    const userId = user?.user.userId
    const username = user?.user.username ?? undefined
    const saved = user?.user.avatarKey ?? null
    const badges = user?.user.badges ?? []
    const held = badges.map((badge) => badge.code)
    const badgeName = Object.fromEntries(badges.map((badge) => [badge.code, badge.name]))
    const unlocked = badgeAvatarKeys(held)

    // The tile moves on tap; the slot behind the drawer moves after fetchUser
    // lands. `pending` overrides `saved` while a burst drains. Saves are
    // SERIALIZED: one POST at a time, always the latest tap next, so the
    // server can never commit an older key last. One refetch per burst, in
    // a finally, so a thrown save cannot wedge the picker.
    const [pending, setPending] = useState<string | null | undefined>(undefined)
    const wanted = useRef<string | null | undefined>(undefined)
    const draining = useRef(false)
    const pick = pending === undefined ? saved : pending

    const drain = async () => {
        draining.current = true
        try {
            // a tap that lands while the refetch is in flight queues on
            // `wanted`; drain again rather than drop it with the finally
            do {
                while (wanted.current !== undefined) {
                    const key = wanted.current
                    wanted.current = undefined
                    try {
                        const { error } = await updateUserById({ userId, avatarKey: key })
                        if (error) toast({ type: 'error', message: t('saveFailed') })
                    } catch {
                        toast({ type: 'error', message: t('saveFailed') })
                    }
                }
                await fetchUser()
            } while (wanted.current !== undefined)
        } finally {
            draining.current = false
            setPending(undefined)
        }
    }

    const save = (key: string | null) => {
        if (!userId) return
        setPending(key)
        wanted.current = key
        if (!draining.current) void drain()
    }

    // the hand: dealt on open, dealt again by the die; the pick never moves with it
    const [hand, setHand] = useState<(string | null)[]>([])
    const [turns, setTurns] = useState(0)
    useEffect(() => {
        if (open) setHand(dealHand(saved, unlocked, { prefer }))
        // deal once per open; the pick joins the hand by being picked from it
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open])
    const roll = () => {
        setTurns((n) => n + 1)
        setHand(dealHand(pick, unlocked))
    }

    // The sticker is the label. The accessible name is the cast name for a
    // basic ("Jackpot Cherry" — the slugs predate the art), "Bug Whisperer ·
    // beetle" for a badge avatar, and "Your initial" for slot 1.
    const label = (key: string | null) => {
        if (!key) return t('initial')
        const [kind, code, slug] = key.split('.')
        return kind === 'badge' ? `${badgeName[code] ?? code} · ${slug}` : (AVATAR_CAST[code] ?? code)
    }

    const focusIndex = Math.max(0, hand.indexOf(pick))

    return (
        <Drawer open={open} onOpenChange={onOpenChange}>
            <DrawerContent accessibleTitle={t('title')} className="p-4">
                <div
                    role="radiogroup"
                    aria-label={t('title')}
                    className="grid grid-cols-3 gap-2"
                    onKeyDown={roveAvatarTiles}
                >
                    {hand.map((key, index) => {
                        const checked = key === pick
                        const earned = !!key?.startsWith('badge.')
                        return (
                            <button
                                key={key ?? 'initial'}
                                type="button"
                                role="radio"
                                aria-checked={checked}
                                aria-label={label(key)}
                                tabIndex={index === focusIndex ? 0 : -1}
                                onClick={() => save(key)}
                                className={twMerge(
                                    // XL on top: the "Earned" chip sits in that band, clear of the sticker
                                    'relative flex items-center justify-center rounded-sm border border-border-disabled bg-background-default px-4 pt-6 pb-4 focus-visible:outline-[3px] focus-visible:outline-action-focus',
                                    // yellow marks an earned avatar, as on the badge-earned toast
                                    earned && 'border-action-secondary',
                                    checked && 'border-2 border-border-default shadow-4'
                                )}
                            >
                                {earned && (
                                    <StatusBadge
                                        status="custom"
                                        customText={t('earned')}
                                        className="absolute top-1 right-1"
                                    />
                                )}
                                <UserAvatar name={username} avatarKey={key} size="medium" />
                            </button>
                        )
                    })}
                    <button
                        type="button"
                        onClick={roll}
                        aria-label={t('rollDie')}
                        className="flex flex-col items-center justify-center gap-1 rounded-sm border border-dashed border-border-default bg-background-page p-4 text-button-s text-foreground-primary focus-visible:outline-[3px] focus-visible:outline-action-focus"
                    >
                        {/* one full turn per roll; class parity, so no inline style */}
                        <Icon
                            name="dice"
                            size={24}
                            className={twMerge(
                                'motion-safe:transition-transform motion-safe:duration-slow motion-safe:ease-spring',
                                turns % 2 ? 'rotate-360' : 'rotate-0'
                            )}
                        />
                        {t('rollDie')}
                    </button>
                </div>
            </DrawerContent>
        </Drawer>
    )
}
