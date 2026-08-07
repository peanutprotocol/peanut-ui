'use client'

/* eslint-disable react/jsx-no-literals -- internal team tool copy is intentionally not localized */

import { useState, type FormEvent } from 'react'
import { Icon } from '@/components/Global/Icons/Icon'

interface SearchBoxProps {
    busy: boolean
    error: string | null
    onSearch: (username: string) => Promise<boolean>
}

export default function SearchBox({ busy, error, onSearch }: SearchBoxProps) {
    const [username, setUsername] = useState('')

    const submit = async (event: FormEvent) => {
        event.preventDefault()
        const query = username.trim()
        if (!query || busy) return
        if (await onSearch(query)) setUsername('')
    }

    return (
        <form onSubmit={submit} className="relative w-full max-w-[340px]" role="search">
            <label htmlFor="payment-network-search" className="sr-only">
                Search by Peanut username
            </label>
            <Icon
                name="search"
                size={16}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-grey-1"
            />
            <input
                id="payment-network-search"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                autoComplete="off"
                spellCheck={false}
                required
                minLength={4}
                maxLength={12}
                pattern="[A-Za-z][A-Za-z0-9]{3,11}"
                title="4–12 letters or numbers, starting with a letter"
                placeholder="Search username"
                className="h-9 w-full rounded-sm border border-n-1 bg-white pl-9 pr-16 text-sm outline-none focus:ring-2 focus:ring-purple-1"
            />
            <button
                type="submit"
                disabled={busy || !username.trim()}
                className="absolute right-1 top-1 h-7 rounded-sm border border-n-1 bg-primary-3 px-2 text-xs font-bold disabled:cursor-not-allowed disabled:opacity-40"
            >
                {busy ? '…' : 'Find'}
            </button>
            {error && (
                <p role="alert" className="absolute left-0 top-[calc(100%_+_4px)] z-20 text-xs font-medium text-red">
                    {error}
                </p>
            )}
        </form>
    )
}
