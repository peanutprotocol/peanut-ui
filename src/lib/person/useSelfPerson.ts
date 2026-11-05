import { useAuth } from '@/context/authContext'
import { personFrom } from './person'
import type { Person } from './person.types'

/** The signed-in user through the same door as every other person. */
export function useSelfPerson(): Person | null {
    const { user } = useAuth()
    return personFrom(user?.user)
}
