import { useState, useEffect } from 'react'

const STORAGE_KEY = 'recent-recipients'
const MAX_RECENT_ITEMS = 5

interface RecentRecipient {
    value: string
    type: 'address' | 'ens' | 'iban' | 'us' | 'username'
    timestamp: number
}

export function useRecentRecipients() {
    const [recentRecipients, setRecentRecipients] = useState<RecentRecipient[]>([])

    useEffect(() => {
        // Load saved recipients on mount
        const saved = localStorage.getItem(STORAGE_KEY)
        if (saved) {
            setRecentRecipients(JSON.parse(saved))
        }
    }, [])

    const addRecipient = (value: string, type: RecentRecipient['type']) => {
        setRecentRecipients((prev) => {
            // Remove duplicate if exists
            const filtered = prev.filter((r) => r.value !== value)

            // Add new recipient at start
            const updated = [{ value, type, timestamp: Date.now() }, ...filtered].slice(0, MAX_RECENT_ITEMS)

            // Save to localStorage
            localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))

            return updated
        })
    }

    const getSuggestions = (type?: RecentRecipient['type']) => {
        if (type) {
            return recentRecipients.filter((r) => r.type === type).map((r) => r.value)
        }
        return recentRecipients.map((r) => r.value)
    }

    return {
        recentRecipients,
        addRecipient,
        getSuggestions,
    }
}
