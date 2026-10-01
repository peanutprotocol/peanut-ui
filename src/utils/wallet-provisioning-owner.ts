export type WalletProvisioningOwner = {
    cardId: string | null
    last4: string | null
    flagOn: boolean
}

// AppGlobals outlives the card screen. A pending native write must consult its
// current selection after the screen unmounts, not the screen's frozen props.
let currentOwner: WalletProvisioningOwner | null = null

export function setWalletProvisioningOwner(owner: WalletProvisioningOwner): void {
    currentOwner = owner
}

export function getWalletProvisioningOwner(): WalletProvisioningOwner | null {
    return currentOwner
}

export function clearWalletProvisioningOwner(): void {
    currentOwner = null
}
