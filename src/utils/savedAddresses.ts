/**
 * Saved crypto withdrawal addresses — localStorage CRUD.
 *
 * Key: peanut_saved_withdraw_addresses
 * Shape: SavedWithdrawAddress[]
 */

const STORAGE_KEY = 'peanut_saved_withdraw_addresses'

export interface SavedWithdrawAddress {
    id: string
    label?: string
    address: string
    chainId: string
    chainName: string
    lastUsed: string // ISO timestamp (Date serialises to string in JSON)
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function isClient(): boolean {
    return typeof window !== 'undefined' && typeof localStorage !== 'undefined'
}

function generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

// ─── CRUD ────────────────────────────────────────────────────────────────────

/** Return all saved addresses, sorted by most-recently used first. */
export function getSavedAddresses(): SavedWithdrawAddress[] {
    if (!isClient()) return []
    try {
        const raw = localStorage.getItem(STORAGE_KEY)
        if (!raw) return []
        const parsed = JSON.parse(raw) as SavedWithdrawAddress[]
        return parsed.sort((a, b) => new Date(b.lastUsed).getTime() - new Date(a.lastUsed).getTime())
    } catch {
        return []
    }
}

/** Add a new saved address. Returns the created entry. */
export function addSavedAddress(
    address: string,
    chainId: string,
    chainName: string,
    label?: string
): SavedWithdrawAddress {
    const addresses = getSavedAddresses()
    const entry: SavedWithdrawAddress = {
        id: generateId(),
        address,
        chainId,
        chainName,
        label,
        lastUsed: new Date().toISOString(),
    }
    addresses.push(entry)
    persistAddresses(addresses)
    return entry
}

/**
 * Update the label of an existing saved address.
 * Returns true if found and updated.
 */
export function updateSavedAddressLabel(id: string, label: string): boolean {
    const addresses = getSavedAddresses()
    const idx = addresses.findIndex((a) => a.id === id)
    if (idx === -1) return false
    addresses[idx] = { ...addresses[idx], label }
    persistAddresses(addresses)
    return true
}

/** Remove a saved address by id. Returns true if found and removed. */
export function removeSavedAddress(id: string): boolean {
    const addresses = getSavedAddresses()
    const filtered = addresses.filter((a) => a.id !== id)
    if (filtered.length === addresses.length) return false
    persistAddresses(filtered)
    return true
}

/**
 * Record a successful use of an address (updates lastUsed and upserts if new).
 * If the address+chain combo already exists, only lastUsed is bumped.
 * Otherwise a new entry is created (auto-saved).
 * Returns the updated/created entry.
 */
export function touchSavedAddress(
    address: string,
    chainId: string,
    chainName: string,
    label?: string
): SavedWithdrawAddress {
    const addresses = getSavedAddresses()
    const existing = addresses.find((a) => a.address.toLowerCase() === address.toLowerCase() && a.chainId === chainId)

    if (existing) {
        existing.lastUsed = new Date().toISOString()
        if (label && !existing.label) existing.label = label
        persistAddresses(addresses)
        return existing
    }

    return addSavedAddress(address, chainId, chainName, label)
}

// ─── Internal ────────────────────────────────────────────────────────────────

function persistAddresses(addresses: SavedWithdrawAddress[]): void {
    if (!isClient()) return
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(addresses))
    } catch {
        // storage quota exceeded — silently skip
    }
}
