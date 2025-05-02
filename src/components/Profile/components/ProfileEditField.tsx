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
                <label className={twMerge('text-sm font-bold', disabled && 'text-grey-1')}>{label}</label>
                {badge && <StatusBadge status="soon" size="small" />}
            </div>
            <BaseInput
                type={type}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder={placeholder}
                className={twMerge(
                    'h-10 w-full rounded-sm border border-black p-3 focus:border-primary-1 focus:outline-none focus:ring-1 focus:ring-primary-1',
                    disabled && 'bg-grey-4'
                )}
                disabled={disabled}
            />
        </div>
    )
}

export default ProfileEditField
