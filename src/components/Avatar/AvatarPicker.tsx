'use client'

import { useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { updateUserById } from '@/app/actions/users'
import { Button } from '@/components/0_Bruddle/Button'
import { useToast } from '@/components/0_Bruddle/Toast'
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/Global/Drawer'
import { useAuth } from '@/context/authContext'
import { twMerge } from '@/utils/tw'
import { avatarGridColumns, badgeAvatarKeys, dealAvatars, letterAvatarKeys } from './avatar.utils'
import { isLetterAvatarKey, storeLetterAvatar } from './avatar-letter.storage'
import { roveAvatarTiles } from './avatarPicker.utils'
import { UserAvatar } from './UserAvatar'
import { DiceRoll } from './DiceRoll'
import styles from './AvatarPicker.module.css'

interface AvatarPickerProps {
    open: boolean
    onOpenChange: (open: boolean) => void
}

export function AvatarPicker({ open, onOpenChange }: AvatarPickerProps) {
    const t = useTranslations('avatar')
    const tCommon = useTranslations('common')
    const { user, fetchUser } = useAuth()
    const { toast } = useToast()
    const username = user?.user.username ?? undefined
    const userId = user?.user.userId
    const unlocked = badgeAvatarKeys((user?.user.badges ?? []).map((badge) => badge.code))
    const available = dealAvatars(unlocked, 16, () => 0).length
    const initial = /^[a-z]/i.test(username?.trim() ?? '') ? `letter.${username!.trim()[0].toLowerCase()}` : null
    const letters = letterAvatarKeys()
    const start = Math.max(0, letters.indexOf(initial ?? ''))
    const orderedLetters: (string | null)[] = initial
        ? [...letters.slice(start), ...letters.slice(0, start)]
        : [null, ...letters]
    const [phase, setPhase] = useState<'initials' | 'rolling' | 'avatars'>('initials')
    const [selected, setSelected] = useState<string | null>(initial)
    const [offer, setOffer] = useState<string[]>([])
    const [columns, setColumns] = useState(3)
    const [saving, setSaving] = useState(false)
    const savingRef = useRef(false)
    const rowRef = useRef<HTMLDivElement>(null)
    const titleRef = useRef<HTMLHeadingElement>(null)
    const wasOpen = useRef(false)
    const openedFor = useRef<string | undefined>(undefined)

    useEffect(() => {
        if (open && (!wasOpen.current || openedFor.current !== username)) {
            setPhase('initials')
            setSelected(initial)
            if (rowRef.current) rowRef.current.scrollLeft = 0
        }
        wasOpen.current = open
        openedFor.current = username
    }, [open, initial, username])

    useEffect(() => {
        if (!open) return
        const resize = () =>
            setColumns(
                avatarGridColumns(window.innerWidth, window.visualViewport?.height ?? window.innerHeight, available)
            )
        resize()
        window.addEventListener('resize', resize)
        window.visualViewport?.addEventListener('resize', resize)
        return () => {
            window.removeEventListener('resize', resize)
            window.visualViewport?.removeEventListener('resize', resize)
        }
    }, [open, available])

    useEffect(() => {
        if (phase === 'avatars') titleRef.current?.focus()
    }, [phase])

    const save = async () => {
        if (!userId || savingRef.current) return
        savingRef.current = true
        setSaving(true)
        let accepted = false
        try {
            const result = await updateUserById({ userId, avatarKey: selected })
            if (result.error) throw new Error(result.error)
            storeLetterAvatar(userId, null)
            accepted = true
        } catch {
            if (isLetterAvatarKey(selected)) {
                storeLetterAvatar(userId, selected, user?.user.avatarKey ?? null)
                accepted = true
            } else toast({ type: 'error', message: t('saveFailed') })
        }
        try {
            if (accepted) {
                await fetchUser()
                onOpenChange(false)
            }
        } catch {
            toast({ type: 'error', message: t('saveFailed') })
        } finally {
            savingRef.current = false
            setSaving(false)
        }
    }

    const roll = () => {
        setSelected(null)
        setOffer(dealAvatars(unlocked, 16))
        setPhase('rolling')
    }
    const label = (key: string | null) => {
        if (!key) return username?.trim()[0]?.toUpperCase() ?? t('initials')
        const [kind, code, slug] = key.split('.')
        return kind === 'letter' ? code.toUpperCase() : (slug ?? code).replaceAll('-', ' ')
    }
    const keys = phase === 'initials' ? orderedLetters : offer.slice(0, columns * columns)
    const focusIndex = Math.max(0, keys.indexOf(selected))

    return (
        <Drawer
            open={open}
            onOpenChange={(next) => {
                if (!savingRef.current) onOpenChange(next)
            }}
            hideBottomNav
            shouldScaleBackground={false}
        >
            <DrawerContent
                className={
                    phase === 'rolling' ? styles.fullscreen : twMerge('py-4', phase === 'avatars' && styles.dealtDrawer)
                }
                scrollAreaClassName={phase === 'rolling' ? twMerge('px-0', styles.rollArea) : undefined}
            >
                {phase === 'rolling' ? (
                    <>
                        <DrawerTitle className="sr-only">{t('rolling')}</DrawerTitle>
                        {open && (
                            <DiceRoll onComplete={() => setPhase('avatars')} onCancel={() => onOpenChange(false)} />
                        )}
                    </>
                ) : (
                    <div className={twMerge('pb-2', styles.picker, columns === 4 && styles.fourColumns)}>
                        <DrawerHeader className="p-0 pb-4 text-left">
                            <DrawerTitle
                                ref={titleRef}
                                tabIndex={-1}
                                className="text-heading-s text-foreground-primary outline-none"
                            >
                                {phase === 'initials' ? t('initials') : t('chooseAvatar')}
                            </DrawerTitle>
                        </DrawerHeader>
                        <div
                            ref={rowRef}
                            role="radiogroup"
                            aria-label={phase === 'initials' ? t('initials') : t('chooseAvatar')}
                            className={phase === 'initials' ? styles.initials : styles.grid}
                            data-vaul-no-drag
                            onKeyDown={(event) => roveAvatarTiles(event, phase === 'initials' ? 1 : columns)}
                        >
                            {keys.map((key, index) => (
                                <button
                                    key={key ?? 'initial'}
                                    type="button"
                                    role="radio"
                                    aria-label={label(key)}
                                    aria-checked={key === selected}
                                    tabIndex={index === focusIndex ? 0 : -1}
                                    disabled={saving}
                                    onClick={() => setSelected(key)}
                                    className={twMerge(
                                        styles.tile,
                                        'rounded-sm border border-border-disabled bg-background-default focus-visible:outline-[3px] focus-visible:outline-action-focus',
                                        key === selected && 'border-2 border-border-default'
                                    )}
                                >
                                    <UserAvatar name={username} avatarKey={key} size="small" className={styles.art} />
                                </button>
                            ))}
                        </div>
                        <div className="flex flex-col gap-2 pt-4 pb-2">
                            <Button
                                variant="purple"
                                className="w-full"
                                disabled={saving || !userId || (phase === 'avatars' && !keys.includes(selected))}
                                loading={saving}
                                onClick={() => void save()}
                            >
                                {phase === 'initials' ? t('useInitial') : t('useAvatar')}
                            </Button>
                            <span className="text-center text-body-s text-foreground-secondary">{tCommon('or')}</span>
                            <Button variant="stroke" className="w-full" disabled={saving} onClick={roll}>
                                {t('rollDice')}
                            </Button>
                        </div>
                    </div>
                )}
            </DrawerContent>
        </Drawer>
    )
}
