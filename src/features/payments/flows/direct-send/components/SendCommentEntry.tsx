'use client'

import { useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import BaseInput from '@/components/0_Bruddle/BaseInput'
import { Button } from '@/components/0_Bruddle/Button'
import { LinkButton } from '@/components/0_Bruddle/LinkButton'
import { pickCommentEmojis } from '../sendAmount.utils'

const MAX_COMMENT_LENGTH = 140

interface SendCommentEntryProps {
    value: string
    onChange: (value: string) => void
    onEditingChange: (editing: boolean) => void
}

export function SendCommentEntry({ value, onChange, onEditingChange }: SendCommentEntryProps) {
    const t = useTranslations('payment.amountEntry')
    const [isOpen, setIsOpen] = useState(false)
    const [emojis, setEmojis] = useState<string[]>([])
    const inputRef = useRef<HTMLInputElement>(null)
    const editorRef = useRef<HTMLDivElement>(null)

    const insertEmoji = (emoji: string) => {
        const input = inputRef.current
        const start = input?.selectionStart ?? value.length
        const end = input?.selectionEnd ?? value.length
        const next = `${value.slice(0, start)}${emoji}${value.slice(end)}`
        if (next.length > MAX_COMMENT_LENGTH) return
        onChange(next)
        requestAnimationFrame(() => {
            inputRef.current?.focus()
            inputRef.current?.setSelectionRange(start + emoji.length, start + emoji.length)
        })
    }

    if (!isOpen) {
        return (
            <div className="flex h-12 w-full items-center justify-center gap-3">
                <LinkButton
                    onClick={() => {
                        setEmojis(pickCommentEmojis())
                        setIsOpen(true)
                        onEditingChange(true)
                        requestAnimationFrame(() => inputRef.current?.focus())
                    }}
                >
                    {t(value ? 'editComment' : 'addComment')}
                </LinkButton>
                {value && <span className="max-w-48 truncate text-body-xs text-foreground-secondary">{value}</span>}
            </div>
        )
    }

    return (
        <div
            ref={editorRef}
            className="relative h-12 w-full"
            onBlur={(event) => {
                if (!editorRef.current?.contains(event.relatedTarget)) {
                    setIsOpen(false)
                    onEditingChange(false)
                }
            }}
        >
            <BaseInput
                ref={inputRef}
                id="send-comment"
                aria-label={t('comment')}
                value={value}
                onChange={(event) => onChange(event.target.value)}
                placeholder={t('comment')}
                className="pr-36"
                enterKeyHint="done"
                maxLength={MAX_COMMENT_LENGTH}
                onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                        event.preventDefault()
                        inputRef.current?.blur()
                    }
                }}
            />
            <div className="absolute inset-y-0 right-1 flex items-center gap-0.5">
                {emojis.map((emoji) => (
                    <Button
                        key={emoji}
                        type="button"
                        variant="ghost"
                        className="h-11 w-11 shrink-0 p-0 opacity-50 hover:opacity-80 focus-visible:opacity-100"
                        aria-label={t('insertEmoji', { emoji })}
                        onPointerDown={(event) => event.preventDefault()}
                        onClick={() => insertEmoji(emoji)}
                    >
                        <span className={emoji.length > 2 ? 'text-body-m' : 'text-heading-s'}>{emoji}</span>
                    </Button>
                ))}
            </div>
        </div>
    )
}
