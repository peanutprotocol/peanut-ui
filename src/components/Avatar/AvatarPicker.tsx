'use client'

import { useEffect, useState, type KeyboardEvent } from 'react'
import { useTranslations } from 'next-intl'
import { updateUserById } from '@/app/actions/users'
import { Button } from '@/components/0_Bruddle/Button'
import { useToast } from '@/components/0_Bruddle/Toast'
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from '@/components/Global/Drawer'
import { useAuth } from '@/context/authContext'
import { twMerge } from '@/utils/tw'
import { avatarPool, badgeAvatarKeys, basicAvatarKeys } from './avatar.utils'
import { UserAvatar } from './UserAvatar'

interface AvatarPickerProps {
    open: boolean
    onOpenChange: (open: boolean) => void
}

const COLUMNS = 5

// one tab stop per group, arrows move, wrapping (radiogroup convention)
function rove(event: KeyboardEvent<HTMLDivElement>) {
    const step = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: COLUMNS, ArrowUp: -COLUMNS }[event.key]
    if (!step) return
    const radios = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="radio"]'))
    const index = radios.indexOf(document.activeElement as HTMLButtonElement)
    if (index < 0) return
    event.preventDefault()
    radios[(index + step + radios.length) % radios.length].focus()
}

/**
 * The profile avatar picker (TASK-22142): what the user's badges unlocked,
 * then the basics everyone has. A tap saves at once; the die randomizes
 * across the whole pool, free forever; "use my initial" clears the pick.
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
    const held = (user?.user.badges ?? []).map((badge) => badge.code)
    const unlocked = badgeAvatarKeys(held)
    const basics = basicAvatarKeys()

    // optimistic: the tile and the slot behind the drawer move on tap; a
    // failed save snaps back and says so
    const [pick, setPick] = useState<string | null>(saved)
    useEffect(() => setPick(saved), [saved])

    const save = async (key: string | null) => {
        if (!userId) return
        const previous = pick
        setPick(key)
        const { error } = await updateUserById({ userId, avatarKey: key })
        if (error) {
            setPick(previous)
            toast({ type: 'error', message: t('saveFailed') })
            return
        }
        await fetchUser()
    }

    const roll = () => {
        const pool = avatarPool(held).filter((key) => key !== pick)
        if (pool.length === 0) return
        void save(pool[Math.floor(Math.random() * pool.length)])
    }

    const tiles = (keys: string[], label: string) => (
        <div role="radiogroup" aria-label={label} className="grid grid-cols-5 gap-2" onKeyDown={rove}>
            {keys.map((key, index) => {
                const checked = key === pick
                return (
                    <button
                        key={key}
                        type="button"
                        role="radio"
                        aria-checked={checked}
                        aria-label={key}
                        tabIndex={checked || (!keys.includes(pick ?? '') && index === 0) ? 0 : -1}
                        onClick={() => void save(key)}
                        className={twMerge(
                            'flex min-h-11 items-center justify-center rounded-sm border border-border-disabled bg-background-default p-1 focus-visible:outline-[3px] focus-visible:outline-action-focus',
                            checked && 'border-2 border-border-default shadow-[3px_3px_0_var(--color-shadow-primary)]'
                        )}
                    >
                        <UserAvatar name={username} avatarKey={key} size="small" />
                    </button>
                )
            })}
        </div>
    )

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
                        {tiles(basics, t('basics'))}
                    </section>
                    <div className="flex flex-col gap-2">
                        <Button variant="stroke" className="w-full" onClick={roll}>
                            {t('roll')}
                        </Button>
                        <Button variant="purple" className="w-full" onClick={() => onOpenChange(false)}>
                            {tCommon('done')}
                        </Button>
                        <Button variant="transparent" className="w-full" onClick={() => void save(null)}>
                            {t('useInitial')}
                        </Button>
                    </div>
                </div>
            </DrawerContent>
        </Drawer>
    )
}
