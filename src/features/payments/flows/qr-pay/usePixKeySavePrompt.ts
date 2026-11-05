import { useCallback, useEffect, useRef, useState } from 'react'
import { useAuth } from '@/context/authContext'
import { AccountType } from '@/interfaces/interfaces'
import { mantecaApi } from '@/services/manteca'
import { accountDestination, destinationLabel } from '@/features/destinations/saved-destinations'
import { defaultPixKeyNickname } from '@/utils/pix.utils'

/**
 * "Save to favorites" on the PIX-key payment screen, as crypto withdrawals
 * offer it. The box starts ticked, so a payment saves the key unless the user
 * unticks it. A key the user already saved gets its saved name instead. The
 * name starts as the key owner's name. The key is saved once the payment
 * succeeds, and a failed save never touches the payment.
 */
export function usePixKeySavePrompt(pixKey: string | null, ownerName: string | undefined) {
    const { user, fetchUser } = useAuth()
    // null until the user ticks or unticks the box themselves
    const [choice, setChecked] = useState<boolean | null>(null)
    const [nickname, setNickname] = useState('')

    // Prefill once the owner is known; never overwrite what the user typed.
    useEffect(() => {
        if (ownerName) setNickname((current) => current || defaultPixKeyNickname(ownerName))
    }, [ownerName])

    // Not offered until the account list has loaded, so the card cannot
    // appear and then vanish under the user's thumb for a key already saved.
    const accounts = user?.accounts
    const savedAccount = pixKey
        ? accounts?.find(
              (account) =>
                  account.type === AccountType.MANTECA && account.identifier.toLowerCase() === pixKey.toLowerCase()
          )
        : undefined
    // Every saved PIX key carries Brazil, so the country fallback of the shared name is never reached.
    const savedName = savedAccount ? destinationLabel(accountDestination(savedAccount, { countryName: '' })) : null
    const isOffered = !!pixKey && !!accounts && !savedAccount
    // Ticked by default only with a name to save under: a blank name would hold
    // Pay for a field the user never asked for when the owner lookup gave none.
    const checked = choice ?? !!ownerName
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
        /** The name the key is saved under, when the user already saved it. */
        savedName,
        checked,
        setChecked,
        nickname,
        setNickname,
        /** Like the crypto review screen: a ticked box needs a name before Pay. */
        blocksPay: isOffered && checked && !trimmedNickname,
        saveAfterPayment,
    }
}
