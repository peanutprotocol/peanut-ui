// The two transaction-row taxonomies, shared by components, strategies, and
// utils. They live here (not in a component file, per the repo export rules)
// so importing a type never drags a component module along — history.utils
// importing from TransactionDetailsHeaderCard used to create a type-only
// import cycle (utils → component → … → utils).
//
// The taxonomies are deliberately distinct, not a duplicated enum:
//   - `TransactionDirection` = how the balance moved (semantic axis; drives
//     the +/- sign and receipt wording).
//   - `TransactionType` = what the feed row displays (presentation axis;
//     drives icon, label, and avatar). It has members with no direction
//     counterpart — e.g. `card_pay` exists so the avatar can render a
//     credit-card icon while the direction stays `qr_payment`.
// Every strategy picks one of each (see strategies/types.ts).

export type TransactionDirection =
    | 'send'
    | 'receive'
    | 'request_sent'
    | 'request_received'
    | 'withdraw'
    | 'add'
    | 'bank_withdraw'
    | 'bank_claim'
    | 'bank_deposit'
    | 'bank_request_fulfillment'
    | 'claim_external'
    | 'qr_payment'

export type TransactionType =
    | 'send'
    | 'withdraw'
    | 'add'
    | 'request'
    | 'cashout'
    | 'receive'
    | 'bank_withdraw'
    | 'bank_deposit'
    | 'bank_request_fulfillment'
    | 'claim_external'
    | 'bank_claim'
    | 'pay'
    // Rain card-spend / card-refund. Distinct from 'pay' (Manteca QR pay)
    // so the avatar logic can render a credit-card icon instead of the
    // Mercado Pago / PIX brand mark or the generic wallet fallback.
    | 'card_pay'
    // Refund credit rows — Rain card refunds (negative-amount spend auths or
    // kind=REFUND) and Manteca QR-pay refunds. Direction stays 'receive' (so
    // the balance-change sign is '+'); this presentation type drives the
    // arrow-down-left icon + "Refund" label and keeps the row visually
    // distinct from a plain 'receive'.
    | 'refund'
