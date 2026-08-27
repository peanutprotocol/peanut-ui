import { StatusTag } from './StatusTag'

interface DocHeaderProps {
    title: string
    description: string
    status?: 'production' | 'limited' | 'unused' | 'needs-refactor'
    usages?: string
}

export function DocHeader({ title, description, status, usages }: DocHeaderProps) {
    return (
        <div className="border-b border-border-disabled pb-8">
            <div className="flex items-center gap-3">
                <h1 className="text-heading-m">{title}</h1>
                {status && <StatusTag status={status} />}
                {usages && <span className="text-body-xs text-foreground-secondary">{usages}</span>}
            </div>
            <p className="mt-3 max-w-prose text-body-s text-foreground-secondary">{description}</p>
        </div>
    )
}
