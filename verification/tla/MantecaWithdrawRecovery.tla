----------------------- MODULE MantecaWithdrawRecovery -----------------------
(* Manteca bank withdrawal recovery & cross-device correlation protocol.
   Models: src/features/withdraw/manteca-withdraw-recovery.ts, src/features/withdraw/views/MantecaBankWithdrawFlow.tsx
   Spec-local: Manteca UI recovery states (holdKind, accountsLoaded, historyRow, submitOutcome).

   Captures the Manteca-specific recovery hazards above ChargeSendFlow:
   - Saved-account hold vs unsaved (`new`) or deleted-account hold (`destination = null`).
   - Cold reload while `user.accounts` is still hydrating (`accountsLoaded = FALSE`):
     must wait (`settling`), never degrade `destination` to `null` or mis-match.
   - Cross-device safety: when `destination = null` (`holdKind = "new"` or saved account
     deleted), a completed Manteca withdrawal from another device in `/users/history`
     must NEVER clear this device's guard or render as this submission's success.
   - Ambiguous submit outcomes (`USER_OP_RECEIPT_TIMEOUT`, `FUNDING_PENDING_CONFIRMATION`,
     `Unexpected error`) must route to recovery and keep the guard held until chain/Rain
     proof (`not_sent`) or aged `ReleaseWarned`.

   Mode = "fixed"                          All guards enforced.
   Mode = "buggy_unsaved_match"            `destination = null` matches another device's
                                           single COMPLETED history row -> false completion.
   Mode = "buggy_accounts_race"            Saved-account hold reads before `accountsLoaded`
                                           and degrades destination to null -> mis-matches.
   Mode = "buggy_receipt_timeout_clears"   `USER_OP_RECEIPT_TIMEOUT` clears pay guard instead
                                           of calling recover -> double send possible. *)

EXTENDS Naturals

CONSTANTS Mode

VARIABLES
    holdKind,           \* "saved" | "new" | "deleted"
    accountsLoaded,     \* BOOLEAN
    guardActive,        \* BOOLEAN
    submitOutcome,      \* "none" | "receipt_timeout" | "funding_pending" | "clean_fail"
    otherDeviceHistory, \* "none" | "completed"
    ownHistory,         \* "none" | "completed" | "failed"
    chainProof,         \* "unknown" | "not_sent" | "sent"
    screen,             \* "review" | "recovering" | "success" | "failed" | "warned"
    sends,              \* 0..2
    falseSuccess        \* BOOLEAN ghost: another device's completed row rendered as our success

vars == <<holdKind, accountsLoaded, guardActive, submitOutcome, otherDeviceHistory,
          ownHistory, chainProof, screen, sends, falseSuccess>>

TypeOK ==
    /\ holdKind \in {"saved", "new", "deleted"}
    /\ accountsLoaded \in BOOLEAN
    /\ guardActive \in BOOLEAN
    /\ submitOutcome \in {"none", "receipt_timeout", "funding_pending", "clean_fail"}
    /\ otherDeviceHistory \in {"none", "completed"}
    /\ ownHistory \in {"none", "completed", "failed"}
    /\ chainProof \in {"unknown", "not_sent", "sent"}
    /\ screen \in {"review", "recovering", "success", "failed", "warned"}
    /\ sends \in 0..2
    /\ falseSuccess \in BOOLEAN

Init ==
    /\ holdKind \in {"saved", "new", "deleted"}
    /\ accountsLoaded \in BOOLEAN
    /\ guardActive = FALSE
    /\ submitOutcome = "none"
    /\ otherDeviceHistory \in {"none", "completed"}
    /\ ownHistory = "none"
    /\ chainProof = "unknown"
    /\ screen = "review"
    /\ sends = 0
    /\ falseSuccess = FALSE

\* User initiates withdrawal (requires ~guardActive)
StartSubmit ==
    /\ ~guardActive
    /\ screen \in {"review", "failed"}
    /\ sends < 2
    /\ guardActive' = TRUE
    /\ sends' = sends + 1
    /\ submitOutcome' = "none"
    /\ UNCHANGED <<holdKind, accountsLoaded, otherDeviceHistory, ownHistory, chainProof, screen, falseSuccess>>

\* Response arrives: ambiguous receipt timeout / funding pending, or clean pre-send failure
SubmitReturns(out) ==
    /\ guardActive
    /\ submitOutcome = "none"
    /\ out \in {"receipt_timeout", "funding_pending", "clean_fail"}
    /\ submitOutcome' = out
    /\ IF out = "clean_fail"
       THEN /\ guardActive' = FALSE
            /\ screen' = "failed"
       ELSE IF out = "receipt_timeout" /\ Mode = "buggy_receipt_timeout_clears"
            THEN /\ guardActive' = FALSE
                 /\ screen' = "failed"
            ELSE /\ screen' = "recovering"
                 /\ UNCHANGED guardActive
    /\ UNCHANGED <<holdKind, accountsLoaded, otherDeviceHistory, ownHistory, chainProof, sends, falseSuccess>>

\* User accounts finish hydrating after cold reload
AccountsHydrate ==
    /\ ~accountsLoaded
    /\ accountsLoaded' = TRUE
    /\ UNCHANGED <<holdKind, guardActive, submitOutcome, otherDeviceHistory, ownHistory, chainProof, screen, sends, falseSuccess>>

\* Chain/backend eventually learns real outcome of this send
WorldSettles(hist, proof) ==
    /\ guardActive
    /\ submitOutcome \in {"receipt_timeout", "funding_pending"}
    /\ ownHistory = "none"
    /\ hist \in {"completed", "failed"}
    /\ proof \in {"not_sent", "sent"}
    /\ ~(hist = "completed" /\ proof = "not_sent")
    /\ ownHistory' = hist
    /\ chainProof' = proof
    /\ UNCHANGED <<holdKind, accountsLoaded, guardActive, submitOutcome, otherDeviceHistory, screen, sends, falseSuccess>>

\* Recovery pass reads /users/history + chain proof
RunRecovery ==
    /\ guardActive
    /\ screen = "recovering"
    /\ LET waitingForAccounts == (holdKind = "saved" /\ ~accountsLoaded /\ Mode # "buggy_accounts_race")
           destinationKnown   == (holdKind = "saved" /\ accountsLoaded)
           buggyNullMatch     == (Mode = "buggy_unsaved_match" /\ ~destinationKnown /\ otherDeviceHistory = "completed" /\ ownHistory = "none")
           buggyRaceMatch     == (Mode = "buggy_accounts_race" /\ holdKind = "saved" /\ ~accountsLoaded /\ otherDeviceHistory = "completed" /\ ownHistory = "none")
       IN
       IF waitingForAccounts THEN
           UNCHANGED vars
       ELSE IF buggyNullMatch \/ buggyRaceMatch THEN
           /\ guardActive' = FALSE
           /\ screen' = "success"
           /\ falseSuccess' = TRUE
           /\ UNCHANGED <<holdKind, accountsLoaded, submitOutcome, otherDeviceHistory, ownHistory, chainProof, sends>>
       ELSE IF destinationKnown /\ ownHistory = "completed" THEN
           /\ guardActive' = FALSE
           /\ screen' = "success"
           /\ UNCHANGED <<holdKind, accountsLoaded, submitOutcome, otherDeviceHistory, ownHistory, chainProof, sends, falseSuccess>>
       ELSE IF chainProof = "not_sent" THEN
           /\ guardActive' = FALSE
           /\ screen' = "failed"
           /\ UNCHANGED <<holdKind, accountsLoaded, submitOutcome, otherDeviceHistory, ownHistory, chainProof, sends, falseSuccess>>
       ELSE
           \* Still settling (e.g. unsaved hold or in-flight tx) — release only via aged ReleaseWarned
           /\ guardActive' = FALSE
           /\ screen' = "warned"
           /\ UNCHANGED <<holdKind, accountsLoaded, submitOutcome, otherDeviceHistory, ownHistory, chainProof, sends, falseSuccess>>

Next ==
    \/ StartSubmit
    \/ \E o \in {"receipt_timeout", "funding_pending", "clean_fail"} : SubmitReturns(o)
    \/ AccountsHydrate
    \/ \E h \in {"completed", "failed"}, p \in {"not_sent", "sent"} : WorldSettles(h, p)
    \/ RunRecovery

Spec == Init /\ [][Next]_vars

NoCrossDeviceFalseCompletion == ~falseSuccess
NoDoubleSendAfterReceiptTimeout ==
    (submitOutcome = "receipt_timeout" /\ chainProof # "not_sent" /\ screen # "warned" /\ screen # "success") => guardActive

=============================================================================
