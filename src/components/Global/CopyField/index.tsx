'use client'
import * as utils from '@/utils'
import { useState } from 'react'

interface CopyFieldProps {
    text: string
}

const CopyField = ({ text }: CopyFieldProps) => {
    const [isCopied, setIsCopied] = useState(false)

    return (
        <div className="flex w-full flex-row items-center justify-between border border-n-1 dark:border-white ">
            <label className="h-6 flex-grow truncate px-2 py-1 text-h8 font-normal">{text}</label>

            <label
                onClick={() => {
                    utils.copyTextToClipboardWithFallback(text)
                    setIsCopied(true)
                }}
                className="w-24 cursor-pointer border-l-[1px] border-black py-1 text-center text-sm dark:border-white"
            >
                {isCopied ? 'Copied' : 'Copy'}
            </label>
        </div>
    )
}

export default CopyField
