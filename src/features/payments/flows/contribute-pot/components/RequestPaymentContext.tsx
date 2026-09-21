import { UserAvatar } from '@/components/Avatar/UserAvatar'
import { Card } from '@/components/0_Bruddle/Card'

export interface RequestPaymentContextProps {
    recipientUsername?: string
    recipientAvatarKey?: string | null
    requestMessage?: string
    requestAmount?: string
}

export function RequestPaymentContext({
    recipientUsername,
    recipientAvatarKey,
    requestMessage,
    requestAmount,
}: RequestPaymentContextProps) {
    if (!recipientUsername && !requestMessage && !requestAmount) return null
    return (
        <Card className="mb-4 flex-row items-start gap-3 p-3">
            {recipientUsername && (
                <UserAvatar name={recipientUsername} avatarKey={recipientAvatarKey} size="s" decorative />
            )}
            <div className="min-w-0">
                {recipientUsername && <p className="truncate text-body-m-semibold">@{recipientUsername}</p>}
                {requestAmount && <p className="text-body-s">{requestAmount}</p>}
                {requestMessage && (
                    <p className="line-clamp-2 text-body-s text-foreground-secondary">{requestMessage}</p>
                )}
            </div>
        </Card>
    )
}
