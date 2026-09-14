import { TitleBlock } from '@/components/0_Bruddle/TitleBlock'
import { StatusTag } from './StatusTag'

interface DocHeaderProps {
    title: string
    description: string
    status?: 'production' | 'limited' | 'unused' | 'needs-refactor'
    usages?: string
}

// dogfood: the page header IS the DS TitleBlock (size m) — status/usage meta
// rides inside the title slot
export function DocHeader({ title, description, status, usages }: DocHeaderProps) {
    return (
        <div className="border-b border-border-disabled pb-8">
            <TitleBlock
                size="m"
                title={
                    // h1 keeps the page-heading semantics; preflight makes it
                    // inherit the TitleBlock size-m type token
                    <h1 className="flex items-center gap-3">
                        {title}
                        {status && <StatusTag status={status} />}
                        {usages && <span className="text-body-xs text-foreground-secondary">{usages}</span>}
                    </h1>
                }
                description={<span className="block max-w-prose">{description}</span>}
            />
        </div>
    )
}
