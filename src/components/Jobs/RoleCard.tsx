import { Card } from '@/components/0_Bruddle/Card'
import { NOTION_JOB_BOARD_URL, type OpenRole } from '@/components/Jobs/openRoles'

const META_PILL = 'rounded-sm border border-border-default px-3 py-1 text-xs font-medium text-foreground-primary'

export function RoleCard({ role }: { role: OpenRole }) {
    return (
        <Card className="gap-4 p-6" shadowSize="4">
            <div className="flex flex-col gap-3">
                <h3 className="text-heading-xs text-foreground-primary">{role.title}</h3>
                <div className="flex flex-wrap gap-2">
                    <span className={META_PILL}>{role.location}</span>
                    <span className={META_PILL}>{role.compensation}</span>
                </div>
            </div>
            <p className="text-body-s text-foreground-primary">{role.summary}</p>
            <a
                href={NOTION_JOB_BOARD_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-purple btn-shadow-primary-4 w-full"
            >
                Apply on Notion
            </a>
        </Card>
    )
}
