import React from 'react'
import Card from '../Card'
import { Icon, IconName } from '../Icons/Icon'

interface EmptyStateProps {
    icon: IconName
    title: string | React.ReactNode
    description?: string
    cta?: React.ReactNode
}

export default function EmptyState({ title, description, icon, cta }: EmptyStateProps) {
    return (
        <Card position="single" className="p-0">
            <div className="flex flex-col items-center justify-center gap-2 py-6">
                <div className="rounded-full bg-primary-1 p-2">
                    <Icon name={icon} size={16} />
                </div>
                <div className="text-center">
                    <div className="font-medium">{title}</div>
                    {description && <div className="text-sm text-grey-1">{description}</div>}
                    {cta && cta}
                </div>
            </div>
        </Card>
    )
}
