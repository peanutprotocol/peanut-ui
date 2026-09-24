'use client'

import { useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/0_Bruddle/Button'
import { LinkButton } from '@/components/0_Bruddle/LinkButton'
import { Icon } from '@/components/Global/Icons/Icon'
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
    const hasComment = value.trim().length > 0

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

    const finishEditing = () => {
        setIsOpen(false)
        onEditingChange(false)
    }

    return (
        <div
            ref={editorRef}
            className={`flex h-12 w-full overflow-hidden rounded-sm border bg-background-disabled focus-within:border-transparent focus-within:outline-[3px] focus-within:outline-solid ${hasComment ? 'border-action-primary focus-within:outline-action-primary' : 'border-action-primary/50 focus-within:outline-action-primary/50'}`}
            onBlur={(event) => {
                if (!editorRef.current?.contains(event.relatedTarget)) {
                    finishEditing()
                }
            }}
        >
            <div className="relative min-w-0 flex-1">
                <input
                    ref={inputRef}
                    id="send-comment"
                    type="text"
                    aria-label={t('comment')}
                    value={value}
                    onChange={(event) => onChange(event.target.value)}
                    placeholder={t('comment')}
                    className="h-full w-full border-0 bg-transparent pr-36 pl-3 text-body-s-semibold text-foreground-primary outline-none placeholder:text-foreground-secondary"
                    enterKeyHint="done"
                    maxLength={MAX_COMMENT_LENGTH}
                    onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                            event.preventDefault()
                            finishEditing()
                        }
                    }}
                />
                <div className="absolute inset-y-0 right-1 flex items-center gap-0.5">
                    {emojis.map((emoji) => (
                        <Button
                            key={emoji}
                            type="button"
                            variant="ghost"
                            className="h-11 w-11 shrink-0 p-0 opacity-50 hover:opacity-80 focus-visible:opacity-100 active:opacity-100"
                            aria-label={t('insertEmoji', { emoji })}
                            onPointerDown={(event) => event.preventDefault()}
                            onClick={() => insertEmoji(emoji)}
                        >
                            <span className={emoji.length > 2 ? 'text-body-m' : 'text-heading-s'}>{emoji}</span>
                        </Button>
                    ))}
                </div>
            </div>
            <button
                type="button"
                aria-label={t('saveComment')}
                disabled={!hasComment}
                onPointerDown={(event) => event.preventDefault()}
                onClick={finishEditing}
                className="flex h-full w-15 shrink-0 items-center justify-center bg-action-primary text-foreground-primary disabled:opacity-50"
            >
                <Icon name="check-circle" size={24} />
            </button>
        </div>
    )
}
