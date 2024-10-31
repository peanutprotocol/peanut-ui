import { useEffect, useState } from 'react'

interface Passkey {
    handle: string
    account: string
}

interface PasskeyStore {
    passkeys: Passkey[]
}

/**
 * TEMPORARY: This is a temporary storage solution for storing passkeys locally to move forward with UI development.
 */
export class PasskeyStorage {
    private static readonly STORAGE_KEY = 'passkeys'

    static list(): Passkey[] {
        const storedData = localStorage.getItem(this.STORAGE_KEY)
        console.log('storedData:', storedData)
        if (!storedData) return []

        try {
            const data: PasskeyStore = JSON.parse(storedData)
            return data.passkeys
        } catch {
            return []
        }
    }

    static add(passkey: Passkey): void {
        const passkeys = this.list()
        if (!passkeys.some((p) => p.handle === passkey.handle)) {
            passkeys.push(passkey)
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify({ passkeys }))
        }
    }

    static remove(handle: string): void {
        const passkeys = this.list()
        const updatedPasskeys = passkeys.filter((p) => p.handle !== handle)
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify({ passkeys: updatedPasskeys }))
    }

    static clearAll(): void {
        localStorage.removeItem(this.STORAGE_KEY)
    }
}

export function useLocalPasskeys(): Passkey[] {
    const [passkeys, setPasskeys] = useState<Passkey[]>([])

    useEffect(() => {
        setPasskeys(PasskeyStorage.list())
    }, [])

    return passkeys
}
