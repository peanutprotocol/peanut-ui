'use client'

import { useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { useQueryState } from 'nuqs'
import { updateUserById } from '@/app/actions/users'
import { CARD_SURFACE } from '@/components/0_Bruddle/Card'
import { useToast } from '@/components/0_Bruddle/Toast'
import StatusBadge from '@/components/Global/Badges/StatusBadge'
import { Drawer, DrawerContent } from '@/components/Global/Drawer'
import { Icon } from '@/components/Global/Icons/Icon'
import { useAuth } from '@/context/authContext'
import { twMerge } from '@/utils/tw'
import { AVATAR_PICKER_BADGE_PARAM, avatarPickerBadgeParser } from './avatar.consts'
import { badgeAvatarKeys, dealHand } from './avatar.utils'
import { isLetterAvatarKey, storeLetterAvatar } from './avatar-letter.storage'
import { useAvatarKey } from './useAvatarKey'
import { roveAvatarTiles } from './avatarPicker.utils'
import { UserAvatar } from './UserAvatar'

interface AvatarPickerProps {
    open: boolean
    onOpenChange: (open: boolean) => void
}

const capitalise = (word: string) => word.charAt(0).toUpperCase() + word.slice(1)

/**
 * The profile avatar picker (TASK-22142): one hand of eight tiles plus the die,
 * three across, with no header — the sheet is the hand. Slot 1 is always the
 * user's own initial, slots 2-8 are dealt by `dealHand` (at least one earned
 * badge avatar, the current pick kept, the rest from the basics) and slot 9
 * rolls a new hand. A tap saves at once; rolling never changes the pick. The
 * API validates the pick against the same pool, so a locked key never lands
 * even if the manifest and the catalog drift.
 *
 * Slot 1 saves `letter.<x>`, a real pick that stays put, rather than the
 * `avatarKey: null` a "use my initial instead" button used to write — that
 * followed the username on rename. `null` remains the day-0 state of someone
 * who never opened this, and is also what a name with no a-z initial saves.
 *
 * A letter the API still rejects falls back to a device-local mirror rather
 * than an error toast — see avatar-letter.storage. Sticker picks have no
 * fallback by design: their unlock is enforced server-side.
 */
export function AvatarPicker({ open, onOpenChange }: AvatarPickerProps) {
    const t = useTranslations('avatar')
    const { user, fetchUser } = useAuth()
    const { toast } = useToast()
    // the badge the earn toast deep-linked with: its art leads the first hand
    const [preferBadge, setPreferBadge] = useQueryState(AVATAR_PICKER_BADGE_PARAM, avatarPickerBadgeParser)

    const userId = user?.user.userId
    const username = user?.user.username ?? undefined
    // the effective pick: the server's, or the device-local letter fallback
    const saved = useAvatarKey(user?.user.avatarKey, userId)
    const badges = user?.user.badges ?? []
    const held = badges.map((badge) => badge.code)
    const badgeName = Object.fromEntries(badges.map((badge) => [badge.code, badge.name]))
    const unlocked = badgeAvatarKeys(held)

    // Slot 1 wears the first letter of the username. A name that does not start
    // with a-z has no letter sticker to save, so that tile clears the key back
    // to the day-0 state — which still draws that first character.
    const first = username?.trim().charAt(0) ?? ''
    const initialKey = /^[a-z]$/i.test(first) ? `letter.${first.toLowerCase()}` : null

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
                        if (error) rememberOrReport(key)
                        // the server now holds the pick, so a mirror could only
                        // shadow it — this is also what promotes a letter to the
                        // durable copy the day the API starts accepting one
                        else storeLetterAvatar(userId, null)
                    } catch {
                        rememberOrReport(key)
                    }
                }
                await fetchUser()
            } while (wanted.current !== undefined)
        } finally {
            draining.current = false
            setPending(undefined)
        }
    }

    /**
     * A rejected letter is not a user-facing failure: the pick is kept on this
     * device and upgrades itself on the next write the server does accept. A
     * rejected sticker has nowhere to go, so it still reports.
     */
    const rememberOrReport = (key: string | null) => {
        // stamped with the server key it stands in for, so a pick made on another
        // device supersedes it as soon as this one refetches
        if (isLetterAvatarKey(key)) storeLetterAvatar(userId, key, user?.user.avatarKey ?? null)
        else toast({ type: 'error', message: t('saveFailed') })
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
    const dealt = useRef(false)
    useEffect(() => {
        if (!open) {
            dealt.current = false
            return
        }
        // Dealt once per open, and once more when the user arrives: a cold load
        // of the toast's deep link renders this before authContext resolves,
        // and a hand dealt then holds no earned avatar and no pick. Anything
        // after that is the die's job, so the hand never moves under a tap.
        if (dealt.current) return
        dealt.current = !!userId
        // deal from `pick`, not `saved`: reopening while a save is still in
        // flight must keep the visibly selected avatar in the hand
        setHand(dealHand(pick, unlocked, { prefer: preferBadge ?? undefined }))
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, userId])
    const roll = () => {
        setTurns((n) => n + 1)
        setHand(dealHand(pick, unlocked))
    }

    // Slot 1 reads checked while nothing is picked and while the pick IS that
    // letter. A letter that is not the user's own is never dealt, so a legacy
    // pick like that leaves the hand with nothing checked — deliberately: it is
    // someone else's initial, and no tile claims to be it.
    const isChecked = (key: string | null) => (key === null ? pick === null || pick === initialKey : key === pick)
    const focusIndex = Math.max(0, hand.findIndex(isChecked))

    // Slot 1 is the user's own initial and the basics are the cast. An earned
    // avatar has no cast entry — it is named after its art and lined with the
    // badge that unlocked it.
    const describe = (key: string | null): { name: string; line: string } => {
        if (!key) return { name: t('initialName', { letter: first.toUpperCase() }), line: t('initialLine') }
        // for a basic, `code` is its slug and there is no `slug`
        const [kind, code, slug] = key.split('.')
        if (kind === 'badge') return { name: capitalise(slug), line: badgeName[code] ?? code }
        const nameKey = `cast.${code}.name` as Parameters<typeof t>[0]
        const lineKey = `cast.${code}.line` as Parameters<typeof t>[0]
        return { name: t.has(nameKey) ? t(nameKey) : capitalise(code), line: t.has(lineKey) ? t(lineKey) : '' }
    }

    // the deep link is spent by the hand it dealt: left in the URL it would
    // stack the same badge into every later open of the sheet
    const setOpen = (next: boolean) => {
        if (!next && preferBadge !== null) void setPreferBadge(null)
        onOpenChange(next)
    }

    return (
        <Drawer open={open} onOpenChange={setOpen}>
            {/* No header: the title is the drawer's accessible name only, and the
                horizontal padding belongs to the SCROLL AREA so the hand pans
                inside it rather than under the panel's own padding. */}
            <DrawerContent accessibleTitle={t('title')} className="pb-4" scrollAreaClassName="px-4">
                {/* py-1 clears the tiles' 3px focus ring, which the scroll box would
                    otherwise crop on the first and last rows. It belongs to the GRID:
                    a `py-*` on the scroll area merges the primitive's pb-safe-bottom away. */}
                <div className="grid grid-cols-3 gap-2 py-1">
                    {/* `contents` so the tiles stay grid items: a radiogroup may only
                        hold radios, and the die is a plain button beside them */}
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
                                        // Card's own surface — a role="radio" must be a
                                        // <button>, so the component (a div) cannot be
                                        // composed and the chrome is imported instead.
                                        // XL on top: the Earned tag sits in that band,
                                        // clear of the sticker.
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
                                    {/* slot 1 draws FROM the username, so it is the one tile that needs
                                        the name; on the rest the sticker is decorative and the tile's
                                        own name and line label it */}
                                    <UserAvatar
                                        name={initial ? username : undefined}
                                        avatarKey={initial ? initialKey : key}
                                        size="medium"
                                    />
                                    {/* Both boxes are a fixed two lines: at 320px the tile is ~81px
                                        wide, where a single line cut "Grumpy Raincloud" to eleven
                                        characters — and a ragged tile height across the three rows
                                        is the one thing that breaks the grid. */}
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
                        {/* one full turn per roll; class parity, so no inline style */}
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
