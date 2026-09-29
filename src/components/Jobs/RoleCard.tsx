'use client'

import { Button } from '@/components/0_Bruddle/Button'
import { Card } from '@/components/0_Bruddle/Card'
import Badge from '@/components/Global/Badges/Badge'
import { NOTION_JOB_BOARD_URL, type OpenRole } from '@/components/Jobs/openRoles'

// 'use client' because Badge reads its label through next-intl's hook,
// which this app resolves on the client only. Nothing here holds state.
export function RoleCard({ role }: { role: OpenRole }) {
    return (
        <Card className="gap-4 p-6" shadowSize="4">
            <div className="flex flex-col gap-3">
                <h3 className="text-heading-xs text-foreground-primary">{role.title}</h3>
                <div className="flex flex-wrap gap-2">
                    <Badge status="neutral" customText={role.location} />
                    <Badge status="neutral" customText={role.compensation} />
                </div>
            </div>
            <p className="text-body-s text-foreground-primary">{role.summary}</p>
            <Button href={NOTION_JOB_BOARD_URL} external shadowSize="4" className="w-full">
                Apply on Notion
            </Button>
        </Card>
    )
}
