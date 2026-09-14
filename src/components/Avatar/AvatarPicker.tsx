'use client'

import { useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { useQueryState } from 'nuqs'
import { updateUserById } from '@/app/actions/users'
import { CARD_SURFACE } from '@/components/0_Bruddle/Card'
import { useToast } from '@/components/0_Bruddle/Toast'
import { useBadgeCopy } from '@/components/Badges/useBadgeCopy'
import StatusBadge from '@/components/Global/Badges/StatusBadge'
import { Drawer, DrawerContent } from '@/components/Global/Drawer'
import { Icon } from '@/components/Global/Icons/Icon'
import { useAuth } from '@/context/authContext'
import { twMerge } from '@/utils/tw'
import { AVATAR_PICKER_BADGE_PARAM, avatarPickerBadgeParser } from './avatar.consts'
import { badgeAvatarKeys, basicAvatarKeys, dealHand } from './avatar.utils'
import { isLetterAvatarKey, storeLetterAvatar } from './avatar-letter.storage'
import { useAvatarKey } from './useAvatarKey'
import { roveAvatarTiles } from './avatarPicker.utils'
import { UserAvatar } from './UserAvatar'

interface AvatarPickerProps {
    open: boolean
    onOpenChange: (open: boolean) => void
}

const capitalise = (word: string) => word.charAt(0).toUpperCase() + word.slice(1)

/** Eight tiles: the user's initial, then basics and unlocked badge art. Taps save; rolls only deal. */
export function AvatarPicker({ open, onOpenChange }: AvatarPickerProps) {
    const t = useTranslations('avatar')
    const badgeCopy = useBadgeCopy()
    const { user, fetchUser } = useAuth()
    const { toast } = useToast()
    const [preferBadge, setPreferBadge] = useQueryState(AVATAR_PICKER_BADGE_PARAM, avatarPickerBadgeParser)

    const userId = user?.user.userId
    const username = user?.user.username ?? undefined
    const saved = useAvatarKey(user?.user.avatarKey, userId)
    const badges = user?.user.badges ?? []
    const held = badges.map((badge) => badge.code)
    const badgeName = Object.fromEntries(badges.map((badge) => [badge.code, badgeCopy(badge.code, badge.name).name]))
    const unlocked = badgeAvatarKeys(held)

    // Non-Latin initials have no sticker key; null renders the username's first character.
    const first = username?.trim().charAt(0) ?? ''
    const initialKey = /^[a-z]$/i.test(first) ? `letter.${first.toLowerCase()}` : null

    // Show the latest tap immediately. Serialize writes so an older save cannot finish last.
    const [pending, setPending] = useState<string | null | undefined>(undefined)
    const wanted = useRef<string | null | undefined>(undefined)
    const draining = useRef(false)
    const pick = pending === undefined ? saved : pending

    const drain = async () => {
        draining.current = true
        let serverKey = user?.user.avatarKey ?? null
        try {
            // A tap during refetch queues another write.
            do {
                while (wanted.current !== undefined) {
                    const key = wanted.current
                    wanted.current = undefined
                    try {
                        const { error } = await updateUserById({ userId, avatarKey: key })
                        if (error) rememberOrReport(key, serverKey)
                        else {
                            serverKey = key
                            storeLetterAvatar(userId, null)
                        }
                    } catch {
                        rememberOrReport(key, serverKey)
                    }
                }
                await fetchUser()
            } while (wanted.current !== undefined)
        } finally {
            draining.current = false
            setPending(undefined)
        }
    }

    // Older APIs reject letter keys. Keep those locally; sticker failures still report an error.
    const rememberOrReport = (key: string | null, serverKey: string | null) => {
        // A changed server key invalidates this fallback after a pick on another device.
        if (isLetterAvatarKey(key)) storeLetterAvatar(userId, key, serverKey)
        else toast({ type: 'error', message: t('saveFailed') })
    }

    const save = (key: string | null) => {
        if (!userId) return
        setPending(key)
        wanted.current = key
        if (!draining.current) void drain()
    }

    const [hand, setHand] = useState<(string | null)[]>([])
    const [turns, setTurns] = useState(0)
    useEffect(() => {
        // Deal on open and when auth resolves. Keep an in-flight pick when reopening.
        if (open) setHand(dealHand(pick, unlocked, { prefer: preferBadge ?? undefined }))
        // Taps and ordinary user refetches must not reshuffle the hand.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, userId])

    useEffect(() => {
        if (!open || pending !== undefined || !saved) return
        const earned = badgeAvatarKeys((user?.user.badges ?? []).map((badge) => badge.code))
        if (!basicAvatarKeys().includes(saved) && !earned.includes(saved)) return
        // A failed save after a roll can restore a saved sticker that is no longer in the hand.
        setHand((current) => (current.length && !current.includes(saved) ? dealHand(saved, earned) : current))
    }, [open, pending, saved, user?.user.badges])

    const roll = () => {
        setTurns((n) => n + 1)
        setHand(dealHand(pick, unlocked))
    }

    // A legacy pick of another letter has no matching tile; do not mark the user's initial instead.
    const isChecked = (key: string | null) => (key === null ? pick === null || pick === initialKey : key === pick)
    const focusIndex = Math.max(0, hand.findIndex(isChecked))

    const describe = (key: string | null): { name: string; line: string } => {
        if (!key) return { name: t('initialName', { letter: first.toUpperCase() }), line: t('initialLine') }
        const [kind, code, slug] = key.split('.')
        if (kind === 'badge') {
            const nameKey = `badge.${code}.${slug}` as Parameters<typeof t>[0]
            return { name: t.has(nameKey) ? t(nameKey) : capitalise(slug), line: badgeName[code] ?? code }
        }
        const nameKey = `cast.${code}.name` as Parameters<typeof t>[0]
        const lineKey = `cast.${code}.line` as Parameters<typeof t>[0]
        return { name: t.has(nameKey) ? t(nameKey) : capitalise(code), line: t.has(lineKey) ? t(lineKey) : '' }
    }

    // Consume the badge hint so later opens can deal any unlocked art.
    const setOpen = (next: boolean) => {
        if (!next && preferBadge !== null) void setPreferBadge(null)
        onOpenChange(next)
    }

    return (
        <Drawer open={open} onOpenChange={setOpen}>
            <DrawerContent accessibleTitle={t('title')} className="pb-4" scrollAreaClassName="px-4">
                {/* Pad the grid for focus rings; scroll-area padding must retain its safe-area inset. */}
                <div className="grid grid-cols-3 gap-2 py-1">
                    {/* Keep tiles in the grid and the roll button outside the radio group. */}
                    <div role="radiogroup" aria-label={t('title')} className="contents" onKeyDown={roveAvatarTiles}>
                        {hand.map((key, index) => {
                            const initial = key === null
                            const checked = isChecked(key)
                            const earned = !!key?.startsWith('badge.')
                            const { name, line } = describe(key)
                            return (
                                <button
                                    key={key ?? 'initial'}
                                    type="button"
                                    role="radio"
                                    aria-checked={checked}
                                    tabIndex={index === focusIndex ? 0 : -1}
                                    onClick={() => save(initial ? initialKey : key)}
                                    className={twMerge(
                                        // Native buttons share Card's surface; top padding reserves space for the Earned tag.
                                        `relative flex flex-col items-center ${CARD_SURFACE} px-1 pt-6 pb-3 text-center focus-visible:outline-[3px] focus-visible:outline-action-focus`,
                                        checked && 'border-2 border-border-default'
                                    )}
                                >
                                    {earned && (
                                        <StatusBadge
                                            status="custom"
                                            customText={t('earned')}
                                            className="absolute top-1 right-1"
                                        />
                                    )}
                                    <UserAvatar
                                        name={initial ? username : undefined}
                                        avatarKey={initial ? initialKey : key}
                                        size="medium"
                                    />
                                    {/* Two fixed lines keep tile heights equal at 320px. */}
                                    <span className="mt-1 line-clamp-2 h-8 text-label-m">{name}</span>
                                    <span className="line-clamp-2 h-8 text-body-xs text-foreground-secondary">
                                        {line}
                                    </span>
                                </button>
                            )
                        })}
                    </div>
                    <button
                        type="button"
                        onClick={roll}
                        className="flex flex-col items-center justify-center gap-2 rounded-sm border-[1.5px] border-dashed border-border-default bg-background-default px-2 py-4 text-button-s focus-visible:outline-[3px] focus-visible:outline-action-focus"
                    >
                        <span
                            className={twMerge(
                                'inline-flex motion-safe:transition-transform motion-safe:duration-slow motion-safe:ease-spring',
                                turns % 2 ? 'rotate-360' : 'rotate-0'
                            )}
                        >
                            <Icon name="dice" size={24} />
                        </span>
                        {t('rollDie')}
                    </button>
                </div>
            </DrawerContent>
        </Drawer>
    )
}
