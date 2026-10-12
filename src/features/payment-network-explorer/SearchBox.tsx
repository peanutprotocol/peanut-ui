'use client'

import { useState, type FormEvent } from 'react'
import { Button } from '@/components/0_Bruddle/Button'
import { Field } from '@/components/0_Bruddle/Field'
import { SearchInput } from '@/components/SearchInput'

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
        <form onSubmit={submit} className="w-full" role="search">
            <Field error={error}>
                <div className="flex items-start gap-2">
                    <SearchInput
                        value={username}
                        onChange={setUsername}
                        onClear={() => setUsername('')}
                        placeholder="Search username"
                        aria-label="Search by Peanut username"
                        className="min-w-0 flex-1"
                    />
                    <Button
                        type="submit"
                        size="small"
                        disabled={busy || !username.trim()}
                        loading={busy}
                        className="w-auto"
                    >
                        Find
                    </Button>
                </div>
            </Field>
        </form>
    )
}
