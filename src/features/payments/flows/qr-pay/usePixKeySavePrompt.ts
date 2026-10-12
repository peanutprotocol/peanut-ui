import { useCallback, useEffect, useRef, useState } from 'react'
import { useAuth } from '@/context/authContext'
import { AccountType } from '@/interfaces/interfaces'
import { mantecaApi } from '@/services/manteca'
import { defaultPixKeyNickname } from '@/utils/pix.utils'

/**
 * "Save to address book" on the PIX-key payment screen, as crypto withdrawals
 * offer it. Hidden for a key the user already saved. The name starts as the
 * key owner's name. The key is saved once the payment succeeds, and a failed
 * save never touches the payment.
 */
export function usePixKeySavePrompt(pixKey: string | null, ownerName: string | undefined) {
    const { user, fetchUser } = useAuth()
    const [checked, setChecked] = useState(false)
    const [nickname, setNickname] = useState('')

    // Prefill once the owner is known; never overwrite what the user typed.
    useEffect(() => {
        if (ownerName) setNickname((current) => current || defaultPixKeyNickname(ownerName))
    }, [ownerName])

    // Not offered until the account list has loaded, so the card cannot
    // appear and then vanish under the user's thumb for a key already saved.
    const accounts = user?.accounts
    const alreadySaved =
        !!pixKey &&
        !!accounts?.some(
            (account) =>
                account.type === AccountType.MANTECA && account.identifier.toLowerCase() === pixKey.toLowerCase()
        )
    const isOffered = !!pixKey && !!accounts && !alreadySaved
    const trimmedNickname = nickname.trim()

    const saved = useRef(false)
    const saveAfterPayment = useCallback(() => {
        if (saved.current || !isOffered || !checked || !trimmedNickname || !pixKey) return
        saved.current = true
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
        saveAfterPayment,
    }
}
