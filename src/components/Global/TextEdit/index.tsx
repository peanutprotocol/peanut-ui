import React, { useState, useRef, useEffect } from 'react'

const TextEdit = ({ initialText, onTextChange }: { initialText: string; onTextChange: (text: string) => void }) => {
    const [text, setText] = useState(initialText)
    const [isEditing, setIsEditing] = useState(false)
    const inputRef = useRef<HTMLInputElement>(null)

    useEffect(() => {
        if (isEditing && inputRef.current) {
            inputRef.current.focus()
        }
    }, [isEditing])

    const handleTextChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        setText(event.target.value)
    }

    const handleBlur = () => {
        setIsEditing(false)
        onTextChange(text)
    }

    const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
        const key = event.key

        // Allow alphanumeric characters and control keys
        if (!/^[a-zA-Z0-9]$/.test(key) && !['Backspace', 'ArrowLeft', 'ArrowRight', 'Delete'].includes(key)) {
            event.preventDefault()
        }
        if (event.key === 'Enter') {
            setIsEditing(false)
            onTextChange(text)
        }
    }

    useEffect(() => {
        setText(initialText)
    }, [initialText])

    return (
        <div className="group relative flex cursor-pointer items-center gap-1">
            {isEditing ? (
                <input
                    ref={inputRef}
                    type="text"
                    value={text}
                    onChange={handleTextChange}
                    onBlur={handleBlur}
                    onKeyDown={handleKeyDown}
                    className="w-full bg-transparent text-center text-h4 focus:outline-none sm:text-start"
                    maxLength={16}
                    pattern="[a-zA-Z0-9\s]+"
                />
            ) : (
                <span
                    className={`cursor-pointer text-h4`}
                    onClick={() => {
                        setIsEditing(true)
                    }}
                >
                    {text}
                </span>
            )}

            {!isEditing && (
                <button
                    className="ml-2 cursor-pointer text-gray-700 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:hover:text-gray-700"
                    onClick={() => setIsEditing(true)}
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path d="M17.414 2.586a2 2 0 00-2.828 0L2 15.172V18h2.828l12.586-12.586a2 2 0 000-2.828zM12 5l3 3M3 17h4m-1-1H4v-1l10-10 1 1-10 10v1z" />
                    </svg>
                </button>
            )}
        </div>
    )
}

export default TextEdit
