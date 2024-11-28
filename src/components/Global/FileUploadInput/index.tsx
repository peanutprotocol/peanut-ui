import Icon from '../Icon'
import { useEffect, useState } from 'react'
import * as utils from '@/utils'
import BaseInput from '@/components/0_Bruddle/BaseInput'
interface IFileUploadInputProps {
    attachmentOptions: {
        fileUrl: string | undefined
        message: string | undefined
        rawFile: File | undefined
    }
    setAttachmentOptions: (options: {
        fileUrl: string | undefined
        message: string | undefined
        rawFile: File | undefined
    }) => void
}

const FileUploadInput = ({ attachmentOptions, setAttachmentOptions }: IFileUploadInputProps) => {
    const [fileType, setFileType] = useState<string>('')

    const handleFileChange = (e: any) => {
        const file = e.target.files[0]
        if (file) {
            const url = URL.createObjectURL(file)

            setAttachmentOptions({ message: attachmentOptions.message, fileUrl: url, rawFile: file })
        }
    }

    useEffect(() => {
        if (attachmentOptions.fileUrl) {
            fetch(attachmentOptions.fileUrl)
                .then((response) => response.blob())
                .then((blob) => {
                    setFileType(blob.type)
                })
                .catch((error) => {
                    console.log('Error fetching the blob from URL:', error)
                    setFileType('') // Reset or handle the error state
                })
        }
    }, [attachmentOptions.fileUrl])

    return (
        <div className="relative w-full">
            <div className="absolute left-2 top-1/2 z-10 flex h-8 w-8 -translate-y-1/2 items-center justify-center bg-white">
                <BaseInput
                    type="file"
                    accept="image/*,application/pdf"
                    onChange={handleFileChange}
                    className="hidden"
                    id="file-input"
                />
                <label htmlFor="file-input" className="cursor-pointer">
                    {attachmentOptions.fileUrl ? (
                        utils.checkifImageType(fileType) ? (
                            <img src={attachmentOptions.fileUrl} alt="" className="h-8 w-8" />
                        ) : (
                            <Icon name="check" className="h-4 w-4" />
                        )
                    ) : (
                        <Icon name="paperclip" className="h-4 w-4" />
                    )}
                </label>
            </div>
            <BaseInput
                placeholder="Add reference or upload file (optional)"
                className="pl-12"
                value={attachmentOptions.message}
                maxLength={140}
                onChange={(e) =>
                    setAttachmentOptions({
                        message: e.target.value,
                        fileUrl: attachmentOptions.fileUrl,
                        rawFile: attachmentOptions.rawFile,
                    })
                }
            />{' '}
        </div>
    )
}

export default FileUploadInput
