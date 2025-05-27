'use client'

import Link from 'next/link'
import { Icon } from '../Icons/Icon'

interface AttachmentProps {
    message: string
    fileUrl: string
}

const Attachment = ({ message, fileUrl }: AttachmentProps) => {
    if (!fileUrl && !message) return null

    return (
        <div className="text-sm text-grey-1">
            {fileUrl ? (
                <Link href={fileUrl} target="_blank" rel="noreferrer" className="flex items-center gap-2">
                    {message ? `${message}` : 'View Attachment'}
                    <Icon name="external-link" className="h-4 w-4" />
                </Link>
            ) : (
                message
            )}
        </div>
    )
}

export default Attachment
