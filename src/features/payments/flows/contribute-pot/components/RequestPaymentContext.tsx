import { UserAvatar } from '@/components/Avatar/UserAvatar'
import { Card } from '@/components/0_Bruddle/Card'
import type { Person } from '@/lib/person/person.types'

export interface RequestPaymentContextProps {
    /** The requester (TASK-23756). Absent while the request has nobody to show. */
    person?: Person | null
    requestMessage?: string
    requestAmount?: string
}

export function RequestPaymentContext({ person, requestMessage, requestAmount }: RequestPaymentContextProps) {
    if (!person && !requestMessage && !requestAmount) return null
    return (
        <Card className="mb-4 flex-row items-start gap-3 p-3">
            {person && <UserAvatar person={person} size="s" decorative />}
            <div className="min-w-0">
                {person && (
                    <p className="truncate text-body-m-semibold">
                        {'@'}
                        {person.username}
                    </p>
                )}
                {requestAmount && <p className="text-body-s">{requestAmount}</p>}
                {requestMessage && (
                    <p className="line-clamp-2 text-body-s text-foreground-secondary">{requestMessage}</p>
                )}
            </div>
        </Card>
    )
}
