import { Card } from '@/components/0_Bruddle/Card'
import { NOTION_JOB_BOARD_URL, type OpenRole } from '@/components/Jobs/openRoles'

const META_PILL = 'rounded-sm border border-n-1 px-3 py-1.5 text-xs font-medium text-n-1'

export function RoleCard({ role }: { role: OpenRole }) {
    return (
        <Card className="gap-4 p-6" shadowSize="4">
            <div className="flex flex-col gap-3">
                <h3 className="text-xl font-bold text-n-1">{role.title}</h3>
                <div className="flex flex-wrap gap-2">
                    <span className={META_PILL}>{role.location}</span>
                    <span className={META_PILL}>{role.compensation}</span>
                </div>
            </div>
            <p className="text-sm text-n-1">{role.summary}</p>
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
