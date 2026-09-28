'use client'
import { useId, useState } from 'react'
import { useTranslations } from 'next-intl'
import BaseInput from '@/components/0_Bruddle/BaseInput'
import Checkbox from '@/components/0_Bruddle/Checkbox'
import { Field } from '@/components/0_Bruddle/Field'
import Card from '@/components/Global/Card'
import { SAVED_ADDRESS_NICKNAME_MAX } from '@/utils/saved-address.utils'

interface SaveAddressPromptProps {
    checked: boolean
    nickname: string
    onCheckedChange: (checked: boolean) => void
    onNicknameChange: (nickname: string) => void
}

/**
 * Review-screen prompt: "Save to address book" + a name (≤15 chars). The field
 * is called "Name" here and in the edit drawer, so one thing has one name.
 */
export default function SaveAddressPrompt({
    checked,
    nickname,
    onCheckedChange,
    onNicknameChange,
}: SaveAddressPromptProps) {
    const t = useTranslations('global')
    const inputId = useId()
    // The missing name is a helper line until the user has been in the field;
    // after that it is a field error they can fix.
    const [touched, setTouched] = useState(false)
    const missing = !nickname.trim()
    return (
        <Card className="flex flex-col gap-3 p-4">
            <Checkbox
                label={t('savedAddresses.savePrompt')}
                value={checked}
                onChange={(e) => onCheckedChange(e.target.checked)}
            />
            {checked && (
                <Field
                    label={t('savedDestinations.nameLabel')}
                    htmlFor={inputId}
                    errorId={`${inputId}-error`}
                    errorTestId="save-address-name-error"
                    helper={missing ? t('savedAddresses.nicknameRequired') : undefined}
                    error={touched && missing ? t('savedAddresses.nicknameRequired') : undefined}
                >
                    <BaseInput
                        id={inputId}
                        autoFocus
                        value={nickname}
                        maxLength={SAVED_ADDRESS_NICKNAME_MAX}
                        onChange={(e) => onNicknameChange(e.target.value)}
                        onBlur={() => setTouched(true)}
                        aria-describedby={touched && missing ? `${inputId}-error` : undefined}
                        placeholder={t('savedAddresses.nicknamePlaceholder')}
                        rightContent={
                            <span className="text-body-xs text-foreground-secondary">
                                {nickname.length}/{SAVED_ADDRESS_NICKNAME_MAX}
                            </span>
                        }
                    />
                </Field>
            )}
        </Card>
    )
}
