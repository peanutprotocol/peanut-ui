import { useUserStore } from '@/redux/hooks'
import { ApiUser, usersApi } from '@/services/users'
import { useEffect, useRef, useState } from 'react'
import { useDebounce } from './useDebounce'

export const useUserSearch = () => {
    const { user: authenticatedUser } = useUserStore()
    const [searchTerm, setSearchTerm] = useState('')
    const debouncedValue = useDebounce(searchTerm, 300)
    const [searchResults, setSearchResults] = useState<ApiUser[]>([])
    const [isSearching, setIsSearching] = useState(false)
    const [error, setError] = useState('')
    const currentValueRef = useRef(searchTerm)

    // Update currentValueRef when searchTerm changes
    useEffect(() => {
        currentValueRef.current = searchTerm
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
