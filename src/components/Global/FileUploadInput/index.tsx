import BaseInput from '@/components/0_Bruddle/BaseInput'
import { checkifImageType, fetchWithSentry } from '@/utils'
import * as Sentry from '@sentry/nextjs'
import { useEffect, useState } from 'react'
import { twMerge } from 'tailwind-merge'
import { Icon } from '../Icons/Icon'

export interface IFileUploadInputProps {
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
    placeholder?: string
    className?: HTMLInputElement['className']
}

const FileUploadInput = ({
    attachmentOptions,
    setAttachmentOptions,
    placeholder,
    className,
}: IFileUploadInputProps) => {
    const [fileType, setFileType] = useState<string>('')

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (file) {
            const url = URL.createObjectURL(file)
            setAttachmentOptions({ message: attachmentOptions.message, fileUrl: url, rawFile: file })
        }
    }

    // handle file deletion
    const handleFileDelete = (e: React.MouseEvent<HTMLButtonElement>) => {
        e.stopPropagation()
        e.preventDefault()
        setAttachmentOptions({ message: attachmentOptions.message, fileUrl: undefined, rawFile: undefined })

        // reset file input
        const fileInput = document.getElementById('file-input') as HTMLInputElement
        if (fileInput) {
            fileInput.value = ''
        }
    }

    useEffect(() => {
        if (attachmentOptions.fileUrl) {
            fetchWithSentry(attachmentOptions.fileUrl)
                .then((response) => response.blob())
                .then((blob) => {
                    setFileType(blob.type)
                })
                .catch((error) => {
                    console.log('Error fetching the blob from URL:', error)
                    Sentry.captureException(error)
                    setFileType('') // Reset or handle the error state
                })
        }
    }, [attachmentOptions.fileUrl])

    return (
        <div className="relative w-full">
            <div className="absolute right-2 top-1/2 z-10 flex h-8 w-8 -translate-y-1/2 items-center justify-center bg-white">
                <BaseInput
                    type="file"
                    accept="image/*,application/pdf"
                    onChange={handleFileChange}
                    className="hidden"
                    id="file-input"
                />
                <label htmlFor="file-input" className="group relative cursor-pointer">
                    {attachmentOptions.fileUrl ? (
                        checkifImageType(fileType) ? (
                            <img src={attachmentOptions.fileUrl} alt="" className="h-8 w-8 group-hover:opacity-30" />
                        ) : (
                            <Icon name="check" className="block h-4 w-4 group-hover:hidden" />
                        )
                    ) : (
                        <Icon name="clip" className="h-4 w-4" />
                    )}
                    {attachmentOptions.fileUrl && (
                        <button
                            onClick={handleFileDelete}
                            className="absolute right-1/2 top-1/2 ml-2 hidden -translate-y-1/2 translate-x-1/2 group-hover:block"
                        >
                            <Icon name="cancel" className="h-4 w-4" />
                        </button>
                    )}
                </label>
            </div>
            <BaseInput
                placeholder={placeholder ? placeholder : 'Add reference or upload file (optional)'}
                className={twMerge('pr-12', className)}
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
