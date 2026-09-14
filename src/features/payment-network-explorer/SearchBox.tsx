'use client'

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
                className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-grey-1"
            />
            <input
                id="payment-network-search"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                autoComplete="off"
                spellCheck={false}
                required
                maxLength={40}
                pattern="[A-Za-z0-9_.\-]{1,40}"
                title="1–40 letters, numbers, dots, dashes or underscores"
                placeholder="Search username"
                className="h-9 w-full rounded-sm border border-n-1 bg-white pr-16 pl-9 text-sm outline-none focus:ring-2 focus:ring-purple-1"
            />
            <button
                type="submit"
                disabled={busy || !username.trim()}
                className="absolute top-1 right-1 h-7 rounded-sm border border-n-1 bg-primary-3 px-2 text-xs font-bold disabled:cursor-not-allowed disabled:opacity-40"
            >
                {busy ? '…' : 'Find'}
            </button>
            {error && (
                <p role="alert" className="absolute top-[calc(100%_+_4px)] left-0 z-20 text-xs font-medium text-red">
                    {error}
                </p>
            )}
        </form>
    )
}
