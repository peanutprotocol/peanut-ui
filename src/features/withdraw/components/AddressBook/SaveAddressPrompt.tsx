'use client'
import { useTranslations } from 'next-intl'
import BaseInput from '@/components/0_Bruddle/BaseInput'
import Checkbox from '@/components/0_Bruddle/Checkbox'
import Card from '@/components/Global/Card'
import { SAVED_ADDRESS_NICKNAME_MAX } from '@/utils/saved-address.utils'

interface SaveAddressPromptProps {
    checked: boolean
    nickname: string
    onCheckedChange: (checked: boolean) => void
    onNicknameChange: (nickname: string) => void
}

/** Review-screen prompt: "Save to address book" + nickname (≤15 chars). */
export default function SaveAddressPrompt({
    checked,
    nickname,
    onCheckedChange,
    onNicknameChange,
}: SaveAddressPromptProps) {
    const t = useTranslations('global')
    return (
        <Card className="flex flex-col gap-3 p-4">
            <Checkbox
                label={t('savedAddresses.savePrompt')}
                value={checked}
                onChange={(e) => onCheckedChange(e.target.checked)}
            />
            {checked && (
                <BaseInput
                    autoFocus
                    value={nickname}
                    maxLength={SAVED_ADDRESS_NICKNAME_MAX}
                    onChange={(e) => onNicknameChange(e.target.value)}
                    placeholder={t('savedAddresses.nicknamePlaceholder')}
                    rightContent={
                        <span className="text-xs text-grey-1">
                            {nickname.length}/{SAVED_ADDRESS_NICKNAME_MAX}
                        </span>
                    }
                />
            )}
            {checked && !nickname.trim() && (
                <p className="text-xs text-grey-1">{t('savedAddresses.nicknameRequired')}</p>
            )}
        </Card>
    )
}
