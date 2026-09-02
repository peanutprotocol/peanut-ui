'use client'

import BaseInput from '@/components/0_Bruddle/BaseInput'
import { Button } from '@/components/0_Bruddle/Button'
import { Icon } from '@/components/Global/Icons/Icon'
import { type ResidenceCountryOption } from '@/utils/residence-options'
import { twMerge } from '@/utils/tw'
import { useTranslations } from 'next-intl'
import { useEffect, useId, useMemo, useRef, useState } from 'react'

interface CountryComboboxProps {
    options: ResidenceCountryOption[]
    value?: string
    onValueChange: (value: string) => void
    placeholder?: string
    className?: string
    'aria-label'?: string
}

const normalize = (text: string) =>
    text
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim()

/**
 * Typeahead country field: shows the picked country's name, and opens an
 * inline list under the field on focus that filters as the user types
 * (case- and accent-insensitive). Inline rather than portalled so it scrolls
 * with the form and keyboards never cover it.
 */
export const CountryCombobox = ({
    options,
    value,
    onValueChange,
    placeholder,
    className,
    'aria-label': ariaLabel,
}: CountryComboboxProps) => {
    const t = useTranslations('global.countryCombobox')
    const id = useId()
    const listId = `${id}-listbox`
    const inputRef = useRef<HTMLInputElement>(null)
    const listRef = useRef<HTMLUListElement>(null)
    const [open, setOpen] = useState(false)
    const [query, setQuery] = useState('')
    // the list filters only once the user types: opening shows every country
    const [typed, setTyped] = useState(false)
    const [activeIndex, setActiveIndex] = useState(0)

    const selected = useMemo(() => options.find((option) => option.value === value), [options, value])

    const filtered = useMemo(() => {
        if (!typed) return options
        const needle = normalize(query)
        if (!needle) return options
        return options.filter((option) => normalize(option.label).includes(needle))
    }, [options, query, typed])

    useEffect(() => {
        if (!open) return
        const index = typed
            ? 0
            : Math.max(
                  0,
                  filtered.findIndex((option) => option.value === value)
              )
        setActiveIndex(index)
    }, [open, typed, filtered, value])

    useEffect(() => {
        if (!open) return
        listRef.current?.querySelector<HTMLElement>(`[data-index="${activeIndex}"]`)?.scrollIntoView?.({
            block: 'nearest',
        })
    }, [open, activeIndex])

    const openList = () => {
        if (open) return
        setQuery(selected?.label ?? '')
        setTyped(false)
        setOpen(true)
        // typing replaces the current name instead of appending to it
        requestAnimationFrame(() => inputRef.current?.select())
    }

    const closeList = () => {
        setOpen(false)
        setQuery('')
        setTyped(false)
    }

    const select = (option: ResidenceCountryOption) => {
        onValueChange(option.value)
        closeList()
        inputRef.current?.blur()
    }

    const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault()
            if (!open) return openList()
            if (!filtered.length) return
            const delta = event.key === 'ArrowDown' ? 1 : -1
            setActiveIndex((index) => (index + delta + filtered.length) % filtered.length)
            return
        }
        if (event.key === 'Enter') {
            if (!open) return
            event.preventDefault()
            const option = filtered[activeIndex]
            if (option) select(option)
            return
        }
        if (event.key === 'Escape' && open) {
            event.preventDefault()
            closeList()
        }
    }

    const activeOption = open ? filtered[activeIndex] : undefined

    return (
        <div className={twMerge('w-full', className)}>
            <div className="relative">
                <BaseInput
                    ref={inputRef}
                    type="text"
                    role="combobox"
                    aria-label={ariaLabel}
                    aria-expanded={open}
                    aria-controls={listId}
                    aria-autocomplete="list"
                    aria-activedescendant={activeOption ? `${listId}-${activeOption.value}` : undefined}
                    autoComplete="off"
                    autoCorrect="off"
                    spellCheck={false}
                    placeholder={placeholder}
                    value={open ? query : (selected?.label ?? '')}
                    onChange={(event) => {
                        setQuery(event.target.value)
                        setTyped(true)
                        if (!open) setOpen(true)
                    }}
                    onFocus={openList}
                    onClick={openList}
                    onBlur={closeList}
                    onKeyDown={onKeyDown}
                    className="notranslate pr-10"
                />
                {open && query ? (
                    <Button
                        variant="transparent"
                        // mousedown would blur the input and close the list before the click lands
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => {
                            setQuery('')
                            setTyped(true)
                            inputRef.current?.focus()
                        }}
                        className="absolute top-1/2 right-2 w-fit -translate-y-1/2 p-0"
                        aria-label={t('clear')}
                    >
                        <div className="flex size-6 items-center justify-center">
                            <Icon name="cancel" size={16} className="text-foreground-secondary" />
                        </div>
                    </Button>
                ) : (
                    <Icon
                        name="chevron-down"
                        size={16}
                        className={twMerge(
                            'pointer-events-none absolute top-1/2 right-4 -translate-y-1/2 text-foreground-primary transition-transform',
                            open && 'rotate-180'
                        )}
                    />
                )}
            </div>
            {open && (
                <ul
                    ref={listRef}
                    id={listId}
                    role="listbox"
                    aria-label={ariaLabel ?? placeholder}
                    className="notranslate mt-1 max-h-60 w-full overflow-y-auto rounded-sm border border-border-default bg-white p-1 shadow-lg"
                    // usePullToRefresh listens on `document` and only bails on window.scrollY > 0,
                    // so scrolling this list at page top reads as a pull. Same guard as Global/Drawer.
                    onTouchMove={(event) => event.stopPropagation()}
                    // keep the input focused (and the list open) while a row is being tapped
                    onMouseDown={(event) => event.preventDefault()}
                >
                    {filtered.length === 0 && (
                        <li className="px-3 py-2 text-label-l text-foreground-secondary">{t('noResults')}</li>
                    )}
                    {filtered.map((option, index) => {
                        const isSelected = option.value === value
                        return (
                            <li
                                key={option.value}
                                id={`${listId}-${option.value}`}
                                data-index={index}
                                role="option"
                                aria-selected={isSelected}
                                onClick={() => select(option)}
                                onMouseMove={() => setActiveIndex(index)}
                                className={twMerge(
                                    'flex w-full cursor-pointer items-center rounded-sm px-3 py-2 text-label-l transition-colors select-none',
                                    index === activeIndex && 'bg-gray-200',
                                    isSelected && 'bg-action-primary text-white'
                                )}
                            >
                                <span>{option.label}</span>
                                {isSelected && <Icon name="check" size={16} className="ml-auto" />}
                            </li>
                        )
                    })}
                </ul>
            )}
        </div>
    )
}

export default CountryCombobox
