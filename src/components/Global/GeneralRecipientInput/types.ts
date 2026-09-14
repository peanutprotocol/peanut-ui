/** Recipient input state: the resolved address plus the name that produced it
 * (ENS/username), when there is one. Produced by `GeneralRecipientInput`. */
export interface RecipientState {
    name: string | undefined
    address: string
}
