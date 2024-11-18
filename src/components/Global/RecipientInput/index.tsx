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
        <div className={`relative w-full`}>
            <input
                className="input-text input-text-inset"
                type="text"
                placeholder={placeholder}
                spellCheck="false"
                autoCorrect="off"
                autoCapitalize="off"
                autoComplete="off"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                onKeyDown={(e) => {
                    if (e.key === 'Enter' && onEnter) {
                        onEnter()
                    }
                }}
            />
            {value && (
                <div className="absolute right-0 top-0 h-full opacity-0 transition-opacity hover:opacity-100">
                    <button
                        onClick={(e) => {
                            e.preventDefault()
                            setValue('')
                        }}
                        className="flex h-full w-12 items-center justify-center bg-white"
                    >
                        <Icon className="h-6 w-6 dark:fill-white" name="close" />
                    </button>
                </div>
            )}
        </div>
    )
}

export default RecipientInput
