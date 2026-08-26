'use client'
import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/0_Bruddle/Button'
import ErrorAlert from '@/components/Global/ErrorAlert'
import BaseInput from '@/components/0_Bruddle/BaseInput'
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from '@/components/Global/Drawer'
import type { SavedAddress } from '@/interfaces/interfaces'
import { SAVED_ADDRESS_NICKNAME_MAX, shortSavedAddress } from '@/utils/saved-address.utils'

interface SavedAddressEditDrawerProps {
    saved: SavedAddress | null
    onClose: () => void
    onRename: (id: string, nickname: string) => Promise<unknown>
    onDelete: (id: string) => Promise<unknown>
}

/** Rename or delete one address-book entry. */
export default function SavedAddressEditDrawer({ saved, onClose, onRename, onDelete }: SavedAddressEditDrawerProps) {
    const t = useTranslations('global')
    const tCommon = useTranslations('common')
    const [nickname, setNickname] = useState('')
    const [busy, setBusy] = useState<'rename' | 'delete' | null>(null)
    const [failed, setFailed] = useState(false)

    useEffect(() => {
        if (saved) {
            setNickname(saved.nickname)
            setFailed(false)
        }
    }, [saved])

    const trimmed = nickname.trim()
    const canSave = !!saved && trimmed.length > 0 && trimmed !== saved.nickname

    const run = async (kind: 'rename' | 'delete', fn: () => Promise<unknown>) => {
        setBusy(kind)
        setFailed(false)
        try {
            await fn()
            onClose()
        } catch (error) {
            // keep the drawer open so the user sees the write did not land
            console.error('[address-book] edit failed:', error)
            setFailed(true)
        } finally {
            setBusy(null)
        }
    }

    return (
        <Drawer open={!!saved} dismissible={!busy} onOpenChange={(open) => !open && !busy && onClose()}>
            <DrawerContent>
                <div className="flex flex-col gap-4 px-5 pb-6 pt-1">
                    <DrawerHeader className="w-full gap-1 p-0 text-left sm:text-left">
                        <DrawerTitle className="text-base font-bold text-black">
                            {t('savedAddresses.editTitle')}
                        </DrawerTitle>
                        <DrawerDescription className="text-sm text-grey-1">
                            {saved ? shortSavedAddress(saved.address) : ''}
                        </DrawerDescription>
                    </DrawerHeader>
                    <label className="flex flex-col gap-1">
                        <span className="text-xs font-bold">{t('savedAddresses.nicknameLabel')}</span>
                        <BaseInput
                            value={nickname}
                            maxLength={SAVED_ADDRESS_NICKNAME_MAX}
                            onChange={(e) => setNickname(e.target.value)}
                            placeholder={t('savedAddresses.nicknamePlaceholder')}
                            rightContent={
                                <span className="text-xs text-grey-1">
                                    {nickname.length}/{SAVED_ADDRESS_NICKNAME_MAX}
                                </span>
                            }
                        />
                    </label>
                    <Button
                        variant="purple"
                        shadowSize="4"
                        className="w-full"
                        disabled={!canSave || !!busy}
                        loading={busy === 'rename'}
                        onClick={() => saved && run('rename', () => onRename(saved.id, trimmed))}
                    >
                        {tCommon('save')}
                    </Button>
                    {failed && <ErrorAlert description={t('savedAddresses.editFailed')} />}
                    <Button
                        variant="stroke"
                        className="w-full"
                        icon="trash"
                        disabled={!!busy}
                        loading={busy === 'delete'}
                        onClick={() => saved && run('delete', () => onDelete(saved.id))}
                    >
                        {t('savedAddresses.deleteCta')}
                    </Button>
                </div>
            </DrawerContent>
        </Drawer>
    )
}
