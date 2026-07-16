'use client'

import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { Icon } from '../Icons/Icon'

interface AttachmentProps {
    message: string
    fileUrl: string
}

const Attachment = ({ message, fileUrl }: AttachmentProps) => {
    const t = useTranslations('global')
    if (!fileUrl && !message) return null

    return (
        <div className="text-sm text-grey-1">
            {fileUrl ? (
                <Link href={fileUrl} target="_blank" rel="noreferrer" className="flex items-center gap-2">
                    {message ? `${message}` : t('attachment.viewAttachment')}
                    <Icon name="external-link" className="h-4 w-4" />
                </Link>
            ) : (
                message
            )}
        </div>
    )
}

export default Attachment
