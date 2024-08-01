'use client'
import React, { useState } from 'react'

interface ImageEditProps {
    initialProfilePicture: string
    onImageChange: (file: File | null) => void
}

const ImageEdit: React.FC<ImageEditProps> = ({ initialProfilePicture, onImageChange }) => {
    const [profilePicture, setProfilePicture] = useState(initialProfilePicture)

    const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files ? event.target.files[0] : null
        if (file && file.type.startsWith('image/')) {
            const reader = new FileReader()
            reader.onloadend = () => {
                setProfilePicture(reader.result?.toString() || '')
                onImageChange(file) // Notify parent component of the new file
            }
            reader.readAsDataURL(file)
        } else {
            onImageChange(null) // Notify parent component if no valid file is selected
        }
    }

    return (
        <div className="relative h-16 w-auto overflow-hidden">
            <div className="relative h-full w-full">
                <img
                    src={profilePicture}
                    alt="Profile"
                    className="h-full w-full transform object-cover transition duration-300 hover:scale-105"
                />
                <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50 opacity-0 transition duration-300 hover:opacity-100">
                    <label className="cursor-pointer">
                        <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className="h-8 w-8 text-white"
                            viewBox="0 0 20 20"
                            fill="currentColor"
                        >
                            <path d="M17.414 2.586a2 2 0 00-2.828 0L2 15.172V18h2.828l12.586-12.586a2 2 0 000-2.828zM12 5l3 3M3 17h4m-1-1H4v-1l10-10 1 1-10 10v1z" />
                        </svg>
                    </label>
                </div>
            </div>
        </div>
    )
}

export default ImageEdit
