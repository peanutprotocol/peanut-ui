'use client'
import { CARD_SURFACE } from '@/components/0_Bruddle/Card'
import countryCurrencyMappings, { getFlagUrl } from '@/constants/countryCurrencyMapping'
import { SUPPORTED_EXCHANGE_CURRENCIES } from '@/constants/exchange-currencies.consts'
import { twMerge } from '@/utils/tw'
import Image from 'next/image'
import React, { cloneElement, isValidElement, useEffect, useId, useMemo, useRef, useState } from 'react'
import StatusBadge from '../Global/Badges/StatusBadge'
import { Icon } from '../Global/Icons/Icon'

interface CurrencySelectProps {
    selectedCurrency: string
    setSelectedCurrency: (currency: string) => void
    trigger: React.ReactNode
    excludeCurrencies?: string[]
}

// Transform the currency mappings into the format expected by the component
const currencies = SUPPORTED_EXCHANGE_CURRENCIES.map((code) => {
    const mapping = countryCurrencyMappings.find((m) => m.currencyCode === code)!
    return {
        countryCode: mapping.flagCode,
        country: mapping.country,
        currency: mapping.currencyCode,
        currencyName: mapping.currencyName,
        comingSoon: mapping.comingSoon || false,
    }
})

type CurrencyOption = (typeof currencies)[number]

/**
 * Hand-rolled listbox popover (same idiom as Common/CountryCombobox — no
 * HeadlessUI): the consumer-supplied trigger toggles an absolutely positioned,
 * NON-modal panel. No portal, no overlay, no scroll lock — page scroll stays
 * free and document-level gestures outside the panel keep flowing (the
 * pull-to-refresh contract). ponytail: no typeahead — the trigger is a button,
 * not an input, and ~10 rows need no search; add filtering if the list grows.
 */
const CurrencySelect = ({
    selectedCurrency,
    setSelectedCurrency,
    trigger,
    excludeCurrencies = [],
}: CurrencySelectProps) => {
    const id = useId()
    const listId = `${id}-listbox`
    const listRef = useRef<HTMLUListElement>(null)
    const triggerRef = useRef<HTMLElement>(null)
    const [open, setOpen] = useState(false)
    const [activeIndex, setActiveIndex] = useState(0)

    const availableCurrencies = useMemo(
        () => currencies.filter((currency) => !excludeCurrencies.includes(currency.currency)),
        [excludeCurrencies]
    )

    // keyboard focus lands on the list itself; aria-activedescendant names the row
    useEffect(() => {
        if (open) listRef.current?.focus()
    }, [open])

    useEffect(() => {
        if (!open) return
        listRef.current?.querySelector<HTMLElement>(`[data-index="${activeIndex}"]`)?.scrollIntoView?.({
            block: 'nearest',
        })
    }, [open, activeIndex])

    const openList = () => {
        setActiveIndex(
            Math.max(
                0,
                availableCurrencies.findIndex((currency) => currency.currency === selectedCurrency)
            )
        )
        setOpen(true)
    }

    const closeList = (refocusTrigger = false) => {
        setOpen(false)
        if (refocusTrigger) triggerRef.current?.focus()
    }

    const select = (currency: CurrencyOption) => {
        if (currency.comingSoon) return
        setSelectedCurrency(currency.currency)
        closeList(true)
    }

    // arrow keys skip coming-soon rows — they are inert (click does nothing either)
    const moveActive = (from: number, delta: 1 | -1) => {
        const count = availableCurrencies.length
        for (let step = 1; step <= count; step++) {
            const index = (from + delta * step + count) % count
            if (!availableCurrencies[index].comingSoon) return index
        }
        return from
    }

    const onKeyDown = (event: React.KeyboardEvent<HTMLUListElement>) => {
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault()
            setActiveIndex((index) => moveActive(index, event.key === 'ArrowDown' ? 1 : -1))
            return
        }
        if (event.key === 'Home' || event.key === 'End') {
            event.preventDefault()
            setActiveIndex(moveActive(event.key === 'Home' ? -1 : 0, event.key === 'Home' ? 1 : -1))
            return
        }
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            const option = availableCurrencies[activeIndex]
            if (option) select(option)
            return
        }
        if (event.key === 'Escape') {
            event.preventDefault()
            closeList(true)
            return
        }
        if (event.key === 'Tab') {
            closeList()
        }
    }

    const activeOption = open ? availableCurrencies[activeIndex] : undefined

    const triggerElement = isValidElement(trigger)
        ? cloneElement(
              trigger as React.ReactElement<React.HTMLAttributes<HTMLElement>>,
              {
                  ref: triggerRef,
                  'aria-haspopup': 'listbox',
                  'aria-expanded': open,
                  'aria-controls': open ? listId : undefined,
                  onClick: (event: React.MouseEvent<HTMLElement>) => {
                      ;(trigger as React.ReactElement<React.HTMLAttributes<HTMLElement>>).props.onClick?.(event)
                      // refocus on toggle-close: the mousedown preventDefault below stops the
                      // browser from focusing the trigger, so without this focus drops to body
                      if (open) closeList(true)
                      else openList()
                  },
                  // while the list holds focus, a trigger mousedown would blur → close →
                  // the click would reopen; preventing the default keeps the toggle honest
                  onMouseDown: (event: React.MouseEvent<HTMLElement>) => {
                      ;(trigger as React.ReactElement<React.HTMLAttributes<HTMLElement>>).props.onMouseDown?.(event)
                      if (open) event.preventDefault()
                  },
              } as React.HTMLAttributes<HTMLElement>
          )
        : trigger

    return (
        <div
            className="relative"
            // focus leaving the trigger + panel closes the list (click-away and tab-away)
            onBlur={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget)) closeList()
            }}
        >
            {triggerElement}
            {open && (
                <ul
                    ref={listRef}
                    id={listId}
                    role="listbox"
                    tabIndex={-1}
                    aria-label="Select currency"
                    aria-activedescendant={activeOption ? `${listId}-${activeOption.currency}` : undefined}
                    onKeyDown={onKeyDown}
                    // usePullToRefresh listens on `document` and only bails on window.scrollY > 0,
                    // so scrolling this panel at page top reads as a pull. Same guard as Global/Drawer.
                    onTouchMove={(event) => event.stopPropagation()}
                    // keep the list focused (and open) while a row is being tapped
                    onMouseDown={(event) => event.preventDefault()}
                    className={twMerge(
                        CARD_SURFACE,
                        'absolute top-full right-0 z-50 mt-4 max-h-72 w-72 overflow-y-auto p-4 shadow-lg outline-action-focus focus-visible:outline-[3px] focus-visible:outline-action-focus sm:w-80 md:w-96'
                    )}
                >
                    {availableCurrencies.map((currency, index) => (
                        <CurrencyBox
                            key={currency.currency}
                            id={`${listId}-${currency.currency}`}
                            index={index}
                            countryCode={currency.countryCode}
                            currency={currency.currency}
                            currencyName={currency.currencyName}
                            comingSoon={currency.comingSoon}
                            selected={currency.currency === selectedCurrency}
                            active={index === activeIndex}
                            onSelect={() => select(currency)}
                            onActivate={() => setActiveIndex(index)}
                        />
                    ))}
                </ul>
            )}
        </div>
    )
}

export default CurrencySelect

interface CurrencyBoxProps {
    id: string
    index: number
    selected?: boolean
    active?: boolean
    countryCode: string
    currency: string
    currencyName: string
    comingSoon?: boolean
    onSelect: () => void
    onActivate: () => void
}
const CurrencyBox = ({
    id,
    index,
    selected,
    active,
    countryCode,
    currency,
    currencyName,
    comingSoon = false,
    onSelect,
    onActivate,
}: CurrencyBoxProps) => {
    return (
        <li
            id={id}
            data-index={index}
            role="option"
            aria-selected={selected}
            aria-disabled={comingSoon || undefined}
            onClick={onSelect}
            onMouseMove={onActivate}
            className={twMerge(
                'flex min-h-11 w-full items-center justify-between rounded-sm px-4 py-2 select-none',
                !comingSoon && 'cursor-pointer',
                comingSoon && 'cursor-not-allowed bg-background-disabled opacity-75',
                active && !comingSoon && 'bg-background-disabled',
                selected && !comingSoon && 'border border-border-default'
            )}
        >
            <div className="flex items-center gap-2">
                <Image
                    src={getFlagUrl(countryCode)}
                    alt={`${countryCode} flag`}
                    width={160}
                    height={160}
                    className="size-4 rounded-full object-cover"
                    onError={(e) => {
                        e.currentTarget.style.display = 'none'
                    }}
                />
                <div className="flex items-center gap-2">
                    <h3
                        className={twMerge(
                            'text-body-m-semibold',
                            comingSoon ? 'text-foreground-secondary' : 'text-foreground-primary'
                        )}
                    >
                        {currency}
                    </h3>
                    <span className="text-body-xs text-foreground-secondary">{currencyName}</span>
                </div>
            </div>

            <div className="flex items-center gap-2">
                {comingSoon && <StatusBadge status="soon" size="small" />}
                {selected && !comingSoon && <Icon size={16} name="success" className="text-foreground-secondary" />}
            </div>
        </li>
    )
}
