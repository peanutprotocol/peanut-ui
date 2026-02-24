import { StatusTag } from './StatusTag'

interface DocHeaderProps {
    title: string
    description: string
    status?: 'production' | 'limited' | 'unused' | 'needs-refactor'
    usages?: string
}

export function DocHeader({ title, description, status, usages }: DocHeaderProps) {
    return (
        <div className="border-b border-gray-3 pb-8">
            <div className="flex items-center gap-3">
                <h1 className="text-h3">{title}</h1>
                {status && <StatusTag status={status} />}
                {usages && <span className="text-xs text-grey-1">{usages}</span>}
            </div>
            <p className="mt-3 max-w-prose text-sm leading-relaxed text-grey-1">{description}</p>
        </div>
    )
}
