import BaseInput from '@/components/0_Bruddle/BaseInput'
import StatusBadge from '@/components/Global/Badges/StatusBadge'
import React from 'react'
import { twMerge } from 'tailwind-merge'

interface ProfileEditFieldProps {
    label: string
    value: string
    onChange: (value: string) => void
    placeholder?: string
    type?: 'text' | 'email' | 'tel' | 'url'
    badge?: string
    disabled?: boolean
}

const ProfileEditField: React.FC<ProfileEditFieldProps> = ({
    label,
    value,
    onChange,
    placeholder,
    type = 'text',
    badge,
    disabled = false,
}) => {
    return (
        <div className="space-y-2">
            <div className="flex items-center justify-between">
                <label
                    className={disabled ? 'text-body-s font-bold text-foreground-secondary' : 'text-body-s font-bold'}
                >
                    {label}
                </label>
                {badge && <StatusBadge status="soon" size="small" customText={badge} />}
            </div>
            <BaseInput
                type={type}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder={placeholder}
                className={twMerge(
                    'h-10 w-full rounded-sm border border-border-default p-3 focus:border-action-primary focus:ring-1 focus:ring-action-primary focus:outline-none',
                    disabled && 'bg-grey-4'
                )}
                disabled={disabled}
            />
        </div>
    )
}

export default ProfileEditField
