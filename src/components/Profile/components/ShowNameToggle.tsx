'use client'

import { updateUserById } from '@/app/actions/users'
import { Toggle } from '@/components/0_Bruddle/Toggle'
import { useToast } from '@/components/0_Bruddle/Toast'
import ActionModal from '@/components/Global/ActionModal'
import { useAuth } from '@/context/authContext'
import { useTranslations } from 'next-intl'
import { useState } from 'react'

interface ShowNameToggleProps {
    checked: boolean
    /** Called with the optimistic value, so the screen reflects the setting at once. */
    onChange: (value: boolean) => void
}

const ShowNameToggle = ({ checked, onChange }: ShowNameToggleProps) => {
    const t = useTranslations('profile')
    const tCommon = useTranslations('common')
    const { fetchUser, user } = useAuth()
    const toast = useToast()
    const [isConfirming, setIsConfirming] = useState(false)

    const save = async (newValue: boolean) => {
        onChange(newValue)

        // updateUserById RESOLVES { error } for a non-2xx or a network failure —
        // it never rejects, so a catch block would let a failed save stand and
        // this screen would claim the legal name is hidden while it is public.
        const { error } = await updateUserById({
            userId: user?.user.userId,
            showFullName: newValue,
        })
        if (error) {
            onChange(!newValue)
            toast.error(tCommon('genericError'))
            return
        }
        // Refetch user data in background without blocking
        fetchUser()
    }

    // Turning it on publishes the legal name next to the username, so it asks
    // first. Turning it off takes nothing away and needs no confirmation.
    const handleToggleChange = () => (checked ? void save(false) : setIsConfirming(true))

    return (
        <>
            <Toggle checked={checked} onChange={handleToggleChange} aria-label={t('menu.showMyFullName')} />
            <ActionModal
                visible={isConfirming}
                onClose={() => setIsConfirming(false)}
                tone="warning"
                icon="eye"
                title={t('showFullNameConfirm.title')}
                description={t('showFullNameConfirm.description')}
                ctas={[
                    {
                        text: tCommon('confirm'),
                        variant: 'purple',
                        shadowSize: '4',
                        onClick: () => {
                            setIsConfirming(false)
                            void save(true)
                        },
                    },
                    {
                        text: tCommon('cancel'),
                        variant: 'stroke',
                        onClick: () => setIsConfirming(false),
                    },
                ]}
            />
        </>
    )
}

export default ShowNameToggle
