'use client'

import Link from 'next/link'
import { Icon } from '../Icons/Icon'

interface AttachmentProps {
    message: string
    fileUrl: string
    shortenMessage?: boolean
}

const Attachment = ({ message, fileUrl, shortenMessage = false }: AttachmentProps) => {
    if (!fileUrl && !message) return null

    return (
        <div className="text-sm text-grey-1">
            {fileUrl ? (
                <Link href={fileUrl} target="_blank" rel="noreferrer" className="flex items-center gap-2">
                    {message ? (shortenMessage && message.length > 30 ? `${message.slice(0, 30)}...` : message) : 'View Attachment'}
                    <Icon name="external-link" className="h-4 w-4" />
                </Link>
            ) : message ? (
                shortenMessage && message.length > 30 ? (
                    `${message.slice(0, 30)}...`
                ) : (
                    message
                )
            ) : null}
        </div>
    )
}

export default Attachment
