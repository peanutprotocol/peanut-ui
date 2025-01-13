import { FILE_UPLOAD_ALLOWED_MIME_TYPES, FILE_UPLOAD_MAX_FILE_SIZE } from '@/constants'
import * as utils from '@/utils'
import { useCallback, useEffect, useState } from 'react'
import Icon from '../Icon'

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
    onError?: (error: string) => void
}

const FileUploadInput = ({ attachmentOptions, setAttachmentOptions, onError }: IFileUploadInputProps) => {
    const [fileType, setFileType] = useState<string>('')

    // validate file type using actual file content
    const validateFileType = async (file: File): Promise<boolean> => {
        return new Promise((resolve) => {
            const reader = new FileReader()
            reader.onloadend = (e) => {
                if (!e.target?.result) {
                    resolve(false)
                    return
                }

                // get the actual MIME type from file signature
                const arr = new Uint8Array(e.target.result as ArrayBuffer).subarray(0, 4)
                let header = ''
                for (let i = 0; i < arr.length; i++) {
                    header += arr[i].toString(16)
                }

                // validate file signatures
                const isValid = utils.isValidFileSignature(header)

                resolve(isValid)
            }
            reader.onerror = () => resolve(false)
            reader.readAsArrayBuffer(file)
        })
    }

    const sanitizeFileName = (fileName: string): string => {
        // remove any path traversal attempts and dangerous characters
        return fileName
            .replace(/^.*[\\\/]/, '') // remove path
            .replace(/[^a-zA-Z0-9._-]/g, '_') // replace unsafe chars
            .replace(/\.{2,}/g, '.') // prevent multiple dots
    }

    const handleFileChange = useCallback(
        async (e: React.ChangeEvent<HTMLInputElement>) => {
            const file = e.target.files?.[0]
            if (!file) return

            try {
                // 1. validate file size
                if (file.size > FILE_UPLOAD_MAX_FILE_SIZE) {
                    throw new Error('File size exceeds 5MB limit')
                }

                // 2. validate MIME type
                if (!FILE_UPLOAD_ALLOWED_MIME_TYPES.has(file.type)) {
                    throw new Error('Invalid file type')
                }

                // 3. deep validation of file content
                const isValidType = await validateFileType(file)
                if (!isValidType) {
                    throw new Error('File content validation failed')
                }

                // 4. sanitize filename
                const sanitizedFile = new File([file], sanitizeFileName(file.name), {
                    type: file.type,
                })

                // 5. create safe object URL
                const url = URL.createObjectURL(sanitizedFile)

                setAttachmentOptions({
                    message: attachmentOptions.message,
                    fileUrl: url,
                    rawFile: sanitizedFile,
                })
            } catch (error) {
                // clean up and report error
                if (onError) {
                    onError(error instanceof Error ? error.message : 'Upload failed')
                }
                setAttachmentOptions({
                    message: attachmentOptions.message,
                    fileUrl: undefined,
                    rawFile: undefined,
                })
            }
        },
        [attachmentOptions.message, setAttachmentOptions, onError]
    )

    // cleanup object URL on component unmount or when URL changes
    useEffect(() => {
        const currentUrl = attachmentOptions.fileUrl
        return () => {
            if (currentUrl) {
                URL.revokeObjectURL(currentUrl)
            }
        }
    }, [attachmentOptions.fileUrl])

    useEffect(() => {
        if (attachmentOptions.fileUrl && attachmentOptions.rawFile) {
            setFileType(attachmentOptions.rawFile.type)
        }
    }, [attachmentOptions.fileUrl, attachmentOptions.rawFile])

    return (
        <div className="flex h-12 w-full max-w-96 flex-row items-center justify-center gap-2 border border-n-1 px-4 py-2">
            <div>
                <input
                    type="file"
                    accept={Array.from(FILE_UPLOAD_ALLOWED_MIME_TYPES).join(',')}
                    onChange={handleFileChange}
                    className="hidden"
                    id="file-input"
                />
                <label htmlFor="file-input" className="cursor-pointer">
                    {attachmentOptions.fileUrl ? (
                        utils.checkifImageType(fileType) ? (
                            <img
                                src={attachmentOptions.fileUrl}
                                alt=""
                                className="h-8 w-8"
                                // prevent XSS via SVG
                                crossOrigin="anonymous"
                            />
                        ) : (
                            <Icon name="check" className="h-4 w-4" />
                        )
                    ) : (
                        <Icon name="paperclip" className="h-4 w-4" />
                    )}
                </label>
            </div>
            <input
                placeholder="Add reference or upload file (optional)"
                className="h-full w-full placeholder:text-h9 placeholder:font-normal focus:border-none focus:outline-none sm:placeholder:text-h7 sm:placeholder:font-normal"
                value={attachmentOptions.message}
                maxLength={140}
                onChange={(e) =>
                    setAttachmentOptions({
                        message: e.target.value,
                        fileUrl: attachmentOptions.fileUrl,
                        rawFile: attachmentOptions.rawFile,
                    })
                }
            />
        </div>
    )
}

export default FileUploadInput
