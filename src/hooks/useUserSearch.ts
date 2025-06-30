import { useUserStore } from '@/redux/hooks'
import { ApiUser, usersApi } from '@/services/users'
import { useEffect, useRef, useState } from 'react'

export const useUserSearch = () => {
    const { user: authenticatedUser } = useUserStore()
    const [searchTerm, setSearchTerm] = useState('')
    const [debouncedValue, setDebouncedValue] = useState(searchTerm)
    const [searchResults, setSearchResults] = useState<ApiUser[]>([])
    const [isSearching, setIsSearching] = useState(false)
    const [error, setError] = useState('')
    const currentValueRef = useRef(searchTerm)

    // handle debounced search
    useEffect(() => {
        currentValueRef.current = searchTerm
        const handler = setTimeout(() => {
            setDebouncedValue(searchTerm)
        }, 300)

        return () => {
            clearTimeout(handler)
        }
    }, [searchTerm])

    // handle API call when debounced value changes
    useEffect(() => {
        if (!debouncedValue) {
            setSearchResults([])
            return
        }

        const performSearch = async () => {
            try {
                setIsSearching(true)
                setError('')
                const response = await usersApi.search(debouncedValue)
                if (currentValueRef.current === debouncedValue) {
                    const filteredUsers = response.users.filter(
                        (user) => user.userId !== authenticatedUser?.user.userId
                    )
                    setSearchResults(filteredUsers)
                }
            } catch (err) {
                if (err instanceof Error && err.message.includes('3 characters')) {
                    setSearchResults([])
                } else {
                    setError('Failed to search users')
                }
            } finally {
                setIsSearching(false)
            }
        }

        performSearch()
    }, [debouncedValue])

    return {
        searchTerm,
        setSearchTerm,
        searchResults,
        isSearching,
        error,
        showMinCharError: searchTerm.length > 0 && searchTerm.length < 3,
        showNoResults: searchTerm.length >= 3 && !isSearching && searchResults.length === 0,
    }
}
