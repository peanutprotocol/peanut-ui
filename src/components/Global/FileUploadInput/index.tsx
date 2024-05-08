import { Uploader } from 'uploader'
import { UploadButton } from 'react-uploader'
import Icon from '../Icon'
import { useState } from 'react'

interface IFileUploadInputProps {
    fileUrl: string
    setFileUrl: (fileUrl: string) => void
}

export const FileUploadInput = ({ fileUrl, setFileUrl }: IFileUploadInputProps) => {
    const uploader = Uploader({
        apiKey: 'free', // TODO: API key?
    })
    const options = { multi: false }

    return (
        <div className="flex h-12 w-full max-w-96 flex-row items-center justify-center gap-2 border border-n-1 px-4 py-2">
            <UploadButton
                uploader={uploader}
                options={options}
                onComplete={(files) => {
                    if (files.length === 0) return
                    setFileUrl(files[0].fileUrl)
                }}
            >
                {({ onClick }) => (
                    <button onClick={onClick}>
                        {fileUrl ? (
                            <img src={fileUrl} className="h-4 w-4" />
                        ) : (
                            <Icon name="paperclip" className="h-4 w-4" />
                        )}
                    </button>
                )}
            </UploadButton>
            <input
                placeholder="Add reference or upload file (optional)"
                className="h-full w-full focus:border-none focus:outline-none"
            />{' '}
        </div>
    )
}

export default FileUploadInput
