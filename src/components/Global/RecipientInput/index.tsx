'use client'

import Icon from '@/components/Global/Icon'

type RecipientInputProps = {
    placeholder: string
    value: string
    setValue: (value: string) => void
    onEnter?: () => void
}

const RecipientInput = ({ placeholder, value, setValue, onEnter }: RecipientInputProps) => {
    return (
        <div className={`relative w-full border border-n-1 dark:border-white`}>
            <div className="absolute left-2 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center bg-white text-h8 font-medium">
                To:
            </div>
            <input
                className={`transition-color h-12 w-full rounded-none bg-transparent
                bg-white px-6 pl-9 text-h8 font-medium outline-none placeholder:text-sm focus:border-purple-1 dark:border-white dark:bg-n-1 dark:text-white dark:placeholder:text-white/75 dark:focus:border-purple-1`}
                type="text"
                placeholder={placeholder}
                spellCheck="false"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                onKeyDown={(e) => {
                    if (e.key === 'Enter' && onEnter) {
                        onEnter()
                    }
                }}
            />
            {value.length > 0 ? (
                <button
                    onClick={(e) => {
                        e.preventDefault()
                        setValue('')
                    }}
                    className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center bg-white"
                >
                    <Icon className="h-6 w-6 dark:fill-white" name="close" />
                </button>
            ) : null}
        </div>
    )
}

export default RecipientInput
