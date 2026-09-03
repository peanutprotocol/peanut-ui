'use client'

import { useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { updateUserById } from '@/app/actions/users'
import { Button } from '@/components/0_Bruddle/Button'
import { useToast } from '@/components/0_Bruddle/Toast'
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from '@/components/Global/Drawer'
import { useAuth } from '@/context/authContext'
import { twMerge } from '@/utils/tw'
import { badgeAvatarKeys, offerBasics } from './avatar.utils'
import { roveAvatarTiles } from './avatarPicker.utils'
import { UserAvatar } from './UserAvatar'

interface AvatarPickerProps {
    open: boolean
    onOpenChange: (open: boolean) => void
}

/**
 * The profile avatar picker (TASK-22142): what the user's badges unlocked,
 * then one row of the basics everyone has. A tap saves at once; the dice
 * rerolls the offered row and never the pick; "use my initial" clears it.
 * The API validates the pick against the same pool, so a locked key never
 * lands even if the manifest and the catalog drift.
 */
export function AvatarPicker({ open, onOpenChange }: AvatarPickerProps) {
    const t = useTranslations('avatar')
    const tCommon = useTranslations('common')
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

    // the offered row of five basics: dealt on open, redealt by the dice
    const [offer, setOffer] = useState<string[]>([])
    useEffect(() => {
        if (open) setOffer(offerBasics(saved))
        // deal once per open; the pick joins the row by being picked from it
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open])
    const rollDice = () => setOffer(offerBasics(pick))

    // human labels: "Bug Whisperer · beetle" for a badge avatar, the slug for a basic
    const label = (key: string) => {
        const [kind, code, slug] = key.split('.')
        return kind === 'badge' ? `${badgeName[code] ?? code} · ${slug}` : code
    }

    const tiles = (keys: string[], groupLabel: string) => {
        const focusIndex = Math.max(0, keys.indexOf(pick ?? ''))
        return (
            <div
                role="radiogroup"
                aria-label={groupLabel}
                className="grid grid-cols-5 gap-2"
                onKeyDown={roveAvatarTiles}
            >
                {keys.map((key, index) => {
                    const checked = key === pick
                    return (
                        <button
                            key={key}
                            type="button"
                            role="radio"
                            aria-checked={checked}
                            aria-label={label(key)}
                            tabIndex={index === focusIndex ? 0 : -1}
                            onClick={() => save(key)}
                            className={twMerge(
                                'flex min-h-11 items-center justify-center rounded-sm border border-border-disabled bg-background-default p-1 focus-visible:outline-[3px] focus-visible:outline-action-focus',
                                checked && 'border-2 border-border-default shadow-4'
                            )}
                        >
                            <UserAvatar name={username} avatarKey={key} size="small" />
                        </button>
                    )
                })}
            </div>
        )
    }

    return (
        <Drawer open={open} onOpenChange={onOpenChange}>
            <DrawerContent className="p-4">
                <DrawerHeader className="p-0 pb-4 text-left">
                    <DrawerTitle className="text-heading-s text-foreground-primary">{t('title')}</DrawerTitle>
                    <DrawerDescription>{t('description')}</DrawerDescription>
                </DrawerHeader>
                <div className="flex flex-col gap-6">
                    <section className="flex flex-col gap-2">
                        <div className="flex items-baseline justify-between text-label-m text-foreground-secondary uppercase">
                            <span>{t('fromBadges')}</span>
                            {unlocked.length > 0 && (
                                <span className="normal-case">{t('unlocked', { count: unlocked.length })}</span>
                            )}
                        </div>
                        {unlocked.length > 0 ? (
                            tiles(unlocked, t('fromBadges'))
                        ) : (
                            <p className="text-body-s text-foreground-secondary">{t('noBadgeAvatars')}</p>
                        )}
                    </section>
                    <section className="flex flex-col gap-2">
                        <div className="text-label-m text-foreground-secondary uppercase">{t('basics')}</div>
                        {tiles(offer, t('basics'))}
                    </section>
                    <div className="flex flex-col gap-2">
                        <Button variant="stroke" className="w-full" onClick={rollDice}>
                            {t('rollDice')}
                        </Button>
                        <Button variant="purple" className="w-full" onClick={() => onOpenChange(false)}>
                            {tCommon('done')}
                        </Button>
                        <Button variant="transparent" className="w-full" onClick={() => save(null)}>
                            {t('useInitial')}
                        </Button>
                    </div>
                </div>
            </DrawerContent>
        </Drawer>
    )
}
