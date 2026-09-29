import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '@/context/authContext'
import { AccountType } from '@/interfaces/interfaces'
import { mantecaApi } from '@/services/manteca'
import { defaultPixKeyNickname } from '@/utils/pix.utils'

/**
 * "Save to address book" on the PIX-key payment screen, as crypto withdrawals
 * offer it. Hidden for a key the user already saved. The name starts as the
 * key owner's name. The save fires with the payment and never blocks it.
 */
export function usePixKeySavePrompt(pixKey: string | null, ownerName: string | undefined) {
    const { user, fetchUser } = useAuth()
    const [checked, setChecked] = useState(false)
    const [nickname, setNickname] = useState('')

    // Prefill once the owner is known; never overwrite what the user typed.
    useEffect(() => {
        if (ownerName) setNickname((current) => current || defaultPixKeyNickname(ownerName))
    }, [ownerName])

    const alreadySaved =
        !!pixKey &&
        !!user?.accounts?.some(
            (account) =>
                account.type === AccountType.MANTECA && account.identifier.toLowerCase() === pixKey.toLowerCase()
        )
    const isOffered = !!pixKey && !alreadySaved
    const trimmedNickname = nickname.trim()

    const saveAtSubmit = useCallback(() => {
        if (!isOffered || !checked || !trimmedNickname || !pixKey) return
        mantecaApi
            .savePixKey(pixKey, trimmedNickname)
            .then(() => fetchUser())
            .catch((error) => console.error('Saving the PIX key to the address book failed', error))
    }, [isOffered, checked, trimmedNickname, pixKey, fetchUser])

    return {
        isOffered,
        checked,
        setChecked,
        nickname,
        setNickname,
        /** Like the crypto review screen: a ticked box needs a name before Pay. */
        blocksPay: isOffered && checked && !trimmedNickname,
        saveAtSubmit,
    }
}
