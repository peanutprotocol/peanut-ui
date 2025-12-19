import { useEffect, useState } from 'react'
import { type ApiUser, usersApi } from '@/services/users'

/**
 * Hook to fetch a user by username
 * @param username - The username of the user to fetch
 * @returns The user details
 */
export const useUserByUsername = (username: string | null | undefined) => {
    const [user, setUser] = useState<ApiUser | null>(null)
    const [isLoading, setIsLoading] = useState(!!username)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        const fetchUser = async () => {
            if (!username) {
                setUser(null)
                return
            }

            setIsLoading(true)
            setError(null)
            try {
                const userDetails = await usersApi.getByUsername(username)
                setUser(userDetails)
            } catch (e) {
                console.error(`Failed to fetch user details for ${username}`, e)
                setError('Failed to fetch user details.')
                setUser(null)
            } finally {
                setIsLoading(false)
            }
        }

        fetchUser()
    }, [username])

    return { user, isLoading, error }
}
