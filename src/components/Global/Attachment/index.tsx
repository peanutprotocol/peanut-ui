'use client'

import { IAttachmentOptions } from '@/redux/types/send-flow.types'
import { useState } from 'react'
import Card from '../Card'
import { Icon } from '../Icons/Icon'

interface AttachmentProps {
    attachmentOptions: IAttachmentOptions | undefined
}

const Attachment = ({ attachmentOptions }: AttachmentProps) => {
    const [showMessage, setShowMessage] = useState<boolean>(false)

    if (!attachmentOptions || (!attachmentOptions.fileUrl && !attachmentOptions.message)) return null

    return (
        <Card className="space-y-4 p-4 px-2">
            {attachmentOptions.fileUrl && (
                <div className="flex w-full flex-row items-center justify-between gap-1 px-2 text-h8 text-grey-1">
                    <div className="flex w-max flex-row items-center justify-center gap-1">
                        <label className="font-bold">Attachment</label>
                    </div>
                    <a href={attachmentOptions.fileUrl} download target="_blank">
                        <Icon name={'download'} className="h-4 fill-grey-1" />
                    </a>
                </div>
            )}
            {attachmentOptions.message && (
                <div className="flex w-full flex-col items-center justify-center gap-2">
                    <div
                        className="flex w-full  flex-row items-center justify-between gap-1 px-2 text-h8 text-grey-1"
                        onClick={() => {
                            setShowMessage(!showMessage)
                        }}
                    >
                        <div className="flex w-max flex-row items-center justify-center gap-1">
                            <label className=" font-bold">Message</label>
                        </div>
                        <Icon
                            name={'chevron-up'}
                            className={`h-4 cursor-pointer fill-grey-1 transition-transform ${!showMessage && ' rotate-180'}`}
                        />
                    </div>
                    {showMessage && (
                        <div className="flex w-full flex-col items-center justify-center gap-1 pl-2 text-h8 text-grey-1">
                            <label className="w-full text-start text-sm font-normal leading-4">
                                {attachmentOptions.message}
                            </label>
                        </div>
                    )}
                </div>
            )}
        </Card>
    )
}

export default Attachment
