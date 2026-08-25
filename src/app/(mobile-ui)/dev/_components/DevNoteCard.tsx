'use client'

import { Card } from '@/components/0_Bruddle/Card'
import { Icon } from '@/components/Global/Icons/Icon'

/** Lavender caveat/footnote card that closes several dev pages. */
export default function DevNoteCard({ title = 'Note', children }: { title?: string; children: React.ReactNode }) {
    return (
        <Card className="bg-purple-200/20 p-3">
            <div className="mb-1 flex items-center gap-2">
                <Icon name="info" size={14} />
                <span className="text-label-m">{title}</span>
            </div>
            <div className="text-body-xs text-foreground-secondary">{children}</div>
        </Card>
    )
}
