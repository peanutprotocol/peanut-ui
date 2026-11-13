'use client'

import { useTranslations } from 'next-intl'
import SaveAddressPrompt from '@/features/withdraw/components/AddressBook/SaveAddressPrompt'

/** What the form shows of `usePixKeySavePrompt`: the saved name, or the "Save to favorites" card. */
export interface SaveRecipientState {
    /** The name the key is saved under, when the user already saved it. */
    savedName: string | null
    isOffered: boolean
    checked: boolean
    nickname: string
    setChecked: (checked: boolean) => void
    setNickname: (nickname: string) => void
}

/**
 * Under the recipient card, so it reads as saving the key, not the amount or
 * fee: "Saved as {name}" for a key the user already saved, else the
 * "Save to favorites" card with its name field (≤15 characters). The same
 * card for the Pix-key payment and the Pix withdrawal.
 */
export function SaveRecipientCard({ save }: { save: SaveRecipientState }) {
    const t = useTranslations('qrPay')
    return (
        <>
            {save.savedName && (
                <p
                    className="ph-mask ph-no-capture text-body-s break-words text-foreground-secondary"
                    data-testid="pix-key-saved-as"
                >
                    {t('pixKeySavedAs', { name: save.savedName })}
                </p>
            )}
            {save.isOffered && (
                <SaveAddressPrompt
                    checked={save.checked}
                    nickname={save.nickname}
                    onCheckedChange={save.setChecked}
                    onNicknameChange={save.setNickname}
                />
            )}
        </>
    )
}
