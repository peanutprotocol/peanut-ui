import { useEffect, useState } from 'react'

export const useUser = () => {
    const [user, setUser] = useState<string>('')
    const [hasFetchedUser, setHasFetchedUser] = useState<boolean>(false)

    const fetchUser = async () => {
        const response = await fetch(`/api/peanut/user/fetch-user?accountIdentifier=BE97063517962049`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            },
        })

        if (response.status === 404) {
            return undefined
        }

        const data = await response.json()
        setUser('x')
        setHasFetchedUser(true)
    }

    const updateUser = async () => {}

    const addAccount = async () => {}

    useEffect(() => {
        fetchUser()
    })
    return {
        user,
        fetchUser,
        updateUser,
        addAccount,
        hasFetchedUser,
    }
}
