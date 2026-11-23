---------------------------- MODULE ChargeSendFlow ----------------------------
(* The client flow behind every wallet payment that pays an order: direct send, request pay, pot
   contribution, and the crypto, Bridge and Manteca withdraws. Create the order -> send -> record
   payment. The order is a charge, a Bridge transfer created before the deposit, or a Manteca price
   lock whose withdrawal the backend submits before it creates the order: in each, a lost answer
   after the send left the device is the same state. One user intent: the user keeps tapping Send
   until a status screen shows.
   Models: src/features/payments/shared/hooks/usePendingChargeSend.ts, src/features/payments/shared/utils/decide-recovery.ts
   Spec-local: every constant. The recovery rules have no exported table yet.

   Fixed = FALSE: Send is disabled only while a request is loading, and any failure after the send
   shows the error on the input view, so the user can send again.
   Fixed = TRUE, as the code does: the order id and user-op hash are persisted before signing, any
   failure after signing goes to recovery, and recovery waits for the user op to be final before it
   offers Send again, unless one saved op executed and the order is unbooked: then it books that
   hash at once (RecoverRecord). Recovery that runs out of time shows a "confirming" screen the user can
   leave; the marker stays, so Send stays off and the next visit resumes. op = "dropped" means
   proven never to run: the op reverted, or another saved op of its nonce has a receipt. An op the
   bundler lost but that is still valid stays "inflight": nothing proves it.
   A hold that no proof ends lasts one wait window (a day, the Age action); the next recovery after
   it offers Pay again with the existing "could not be confirmed, contact support if money left"
   error (ReleaseWarned). That is the only way Pay comes back without proof. If local storage
   refuses the marker, it lives in page memory: the guard holds on this page, and a reload or
   another tab sees no marker (`degraded`).

   Latch = FALSE: a second tap in the same tick; React state lags the tap, so both taps see Send on
   and both start (TapSameTick). Latch = TRUE: `claim`, a ref set before the first await.

   Gaps (Fixed = TRUE only) names a path the guard must not have; each is a Buggy cfg:
     SentDeadline         recovery hit its deadline with the money moved and the order unbooked,
                          and deleted the marker. The marker must stay; every visit records the
                          hash again.
     UnknownByAge         after a day, an op whose order and chain reads all failed counted as
                          dropped. A failed read proves nothing.
     StorageFail          local storage refused the marker and the guard never read page memory.
     SubmitTimeout        a 408 (or a 409 "still confirming") from the card-balance submit counted
                          as a refusal. Only the answers the API gives before it sends release the
                          guard.
     SpentNonce           recovery read this op's nonce as spent and its receipt as missing (the
                          index lags), and called it replaced. Only another saved op of that nonce
                          with a receipt proves it.
     CrossTab             the tap latch lived in one tab's memory and the marker was written after
                          the order, so another tab could tap in that window. `claim` writes the
                          marker.
     PermanentHold        a hold with no proof never ended: Pay stayed off for that recipient on
                          that device for good. ReleaseWarned ends it after the wait window.
     RefuseOnStorageFail  a marker storage refused stopped the payment, so those users could not
                          pay. The marker lives in page memory and the send goes on.
     LeaseSteal           another tab dropped this tab's unsent claim after the 15-minute lease,
                          and this tab sent with no marker. A tab broadcasts only while its own
                          marker is there. (Two tabs read and write storage in separate steps; the
                          model makes each check-and-write atomic.)
     SignOutForgets       sign-out removed the Manteca withdraw marker, because its key named the
                          bank account or Pix key; the same user signed in again and Pay was back
                          with no proof. The key holds a hash of it, so sign-out keeps the marker
                          and signing in again is a Reload.

   Properties: AtMostOneTransfer and NoSilentDoubleSend (one intent moves money once, unless the
   warning showed or storage refused the marker), NoRetryWhileMoneyMayExist,
   PayNeverRefusedForStorage and HoldEndsEventually (every hold ends, so no user is locked out of
   paying). *)
EXTENDS Naturals

CONSTANTS Fixed, Latch, MaxTaps, Gaps

VARIABLES view,      \* the screen the user sees
          op,        \* the current attempt's user op
          orphans,   \* user ops still in flight that no screen tracks
          chainTxs,  \* transfers on chain for this one intent
          pending,   \* client marker the guard reads: a send for this intent may exist
          taps,
          booked,    \* the backend recorded the payment: the charge is COMPLETED
          memOnly,   \* storage refused this attempt's marker; it lives in page memory only
          aged,      \* the marker is older than the wait window
          warned,    \* Pay came back without proof, with the warning
          degraded,  \* a marker only page memory held was out of reach (reload, other tab)
          refused,   \* a payment was refused because storage refused its marker
          claimB,    \* another tab's attempt that has sent nothing yet
          bLease     \* the marker is that tab's claim

vars == <<view, op, orphans, chainTxs, pending, taps, booked, memOnly,
          aged, warned, degraded, refused, claimB, bLease>>

Views == {"input", "creating", "sending", "recording", "recovering", "confirming", "status", "error"}

TypeOK == /\ view \in Views
          /\ op \in {"none", "inflight", "landed", "dropped"}
          /\ orphans \in 0..MaxTaps
          /\ chainTxs \in 0..MaxTaps
          /\ taps \in 0..MaxTaps
          /\ {pending, booked, memOnly, aged, warned, degraded, refused, bLease} \subseteq BOOLEAN
          /\ claimB \in {"none", "claimed"}
          /\ Gaps \subseteq {"SentDeadline", "UnknownByAge", "StorageFail", "SubmitTimeout", "SpentNonce",
                             "CrossTab", "PermanentHold", "RefuseOnStorageFail", "LeaseSteal",
                             "SignOutForgets"}

Init == /\ view = "input" /\ op = "none" /\ orphans = 0
        /\ chainTxs = 0 /\ pending = FALSE /\ taps = 0
        /\ booked = FALSE /\ memOnly = FALSE /\ aged = FALSE /\ warned = FALSE
        /\ degraded = FALSE /\ refused = FALSE /\ claimB = "none" /\ bLease = FALSE

Gap(g) == Fixed /\ g \in Gaps

\* The marker goes: Pay comes back.
ClearMarker == pending' = FALSE /\ bLease' = FALSE /\ aged' = FALSE /\ memOnly' = FALSE
Hist == <<warned, degraded, refused, claimB>>

\* dev disables Send only while isLoading (and on balance).
CanTap == IF Fixed THEN ~pending ELSE TRUE

\* Fixed: `claim` writes the marker before the first await, so every tab sees it.
Tap == /\ view \in {"input", "error"} /\ CanTap /\ taps < MaxTaps
       /\ view' = "creating" /\ op' = "none" /\ taps' = taps + 1 /\ memOnly' = FALSE
       /\ pending' = (pending \/ (Fixed /\ ~Gap("CrossTab")))
       /\ aged' = FALSE
       /\ UNCHANGED <<orphans, chainTxs, booked, bLease, Hist>>

\* A second tap before the screen re-rendered: its attempt runs on its own,
\* untracked by the screen and by the marker the first attempt writes.
TapSameTick == /\ view = "creating" /\ ~Latch /\ CanTap /\ taps < MaxTaps
               /\ orphans' = orphans + 1 /\ taps' = taps + 1
               /\ UNCHANGED <<view, op, chainTxs, pending, booked, memOnly, aged, bLease, Hist>>

CreateOk == /\ view = "creating" /\ view' = "sending"
            /\ pending' = (Fixed \/ pending)        \* Fixed: persisted before signing
            /\ UNCHANGED <<op, orphans, chainTxs, taps, booked, memOnly, aged, bLease, Hist>>
\* Fixed: the attempt ends before `begin`; `release` removes its claim.
CreateFail == /\ view = "creating" /\ view' = "error"
              /\ IF Fixed THEN ClearMarker ELSE UNCHANGED <<pending, bLease, aged, memOnly>>
              /\ UNCHANGED <<op, orphans, chainTxs, taps, booked, Hist>>

\* Another tab of the same user taps Pay for the same intent while this one
\* creates the charge. Its attempt runs on its own: no screen here tracks it.
\* Only the marker other tabs read stops it.
TapOtherTab == /\ Fixed /\ view = "creating" /\ ~pending /\ taps < MaxTaps
               /\ orphans' = orphans + 1 /\ taps' = taps + 1
               /\ UNCHANGED <<view, op, chainTxs, pending, booked, memOnly, aged, bLease, Hist>>

\* A marker in page memory is invisible to other tabs: one may pay meanwhile.
TapOtherTabUnseen == /\ Fixed /\ memOnly /\ pending /\ taps < MaxTaps
                     /\ orphans' = orphans + 1 /\ taps' = taps + 1 /\ degraded' = TRUE
                     /\ UNCHANGED <<view, op, chainTxs, pending, booked, memOnly, aged, bLease,
                                    warned, refused, claimB>>

\* Fixed: local storage refuses the marker (full, blocked, private mode). The
\* fix keeps it in page memory, which the guard reads, and the send goes on.
\* StorageFail: the guard never read page memory. RefuseOnStorageFail: `begin`
\* threw and nothing was sent.
StoreFail == /\ Fixed /\ view = "creating" /\ ~memOnly
             /\ CASE "StorageFail" \in Gaps ->
                        view' = "sending" /\ memOnly' = TRUE /\ pending' = FALSE /\ UNCHANGED refused
                  [] "RefuseOnStorageFail" \in Gaps ->
                        view' = "error" /\ refused' = TRUE /\ pending' = FALSE /\ UNCHANGED memOnly
                  [] OTHER ->
                        view' = "sending" /\ memOnly' = TRUE /\ pending' = TRUE /\ UNCHANGED refused
             /\ UNCHANGED <<op, orphans, chainTxs, taps, booked, aged, bLease, warned, degraded, claimB>>

\* --- the user op, independent of the screen ---
Env == <<view, pending, taps, booked, memOnly, aged, bLease, Hist>>
Submit == view = "sending" /\ op = "none" /\ op' = "inflight" /\ UNCHANGED <<orphans, chainTxs, Env>>
Land   == op = "inflight" /\ op' = "landed" /\ chainTxs' = chainTxs + 1 /\ UNCHANGED <<orphans, Env>>
Drop   == op = "inflight" /\ op' = "dropped" /\ UNCHANGED <<orphans, chainTxs, Env>>
OrphanLand == orphans > 0 /\ orphans' = orphans - 1 /\ chainTxs' = chainTxs + 1 /\ UNCHANGED <<op, Env>>
OrphanDrop == orphans > 0 /\ orphans' = orphans - 1 /\ UNCHANGED <<op, chainTxs, Env>>

\* An op the screen stops tracking keeps going.
Abandon == IF op = "inflight" THEN orphans' = orphans + 1 /\ op' = "none"
                              ELSE UNCHANGED <<orphans, op>>

\* --- sendMoney outcomes seen by the client ---
SendFailClean == /\ view = "sending" /\ op = "none" /\ view' = "error"
                 /\ IF Fixed THEN ClearMarker ELSE UNCHANGED <<pending, bLease, aged, memOnly>>
                 /\ UNCHANGED <<op, orphans, chainTxs, taps, booked, Hist>>
\* markSent: a marker storage refused stays invisible to the guard (StorageFail).
SendOk == /\ view = "sending" /\ op = "landed" /\ view' = "recording"
          /\ pending' = (pending \/ ~memOnly)
          /\ UNCHANGED <<op, orphans, chainTxs, taps, booked, memOnly, aged, bLease, Hist>>
\* After signing: bundler timeout, receipt wait dropped. useSpendBundle.ts
\* knows it may have broadcast but rethrows the raw error (dev: generic error).
SendFailAfterSubmit ==
       /\ view = "sending" /\ op /= "none"
       /\ view' = IF Fixed THEN "recovering" ELSE "error"
       /\ IF Fixed THEN UNCHANGED <<op, orphans>> ELSE Abandon
       /\ UNCHANGED <<chainTxs, pending, taps, booked, memOnly, aged, bLease, Hist>>
\* SubmitTimeout: the backend accepted the card-balance submit, then a gateway
\* answered 408 (or the API 409 "still confirming"). The gap read any 4xx as a
\* refusal: the flow cleared the marker and showed the error.
SubmitAnswerAsRefusal ==
       /\ Gap("SubmitTimeout") /\ view = "sending" /\ op = "inflight"
       /\ view' = "error" /\ ClearMarker /\ Abandon
       /\ UNCHANGED <<chainTxs, taps, booked, Hist>>

\* --- recordPayment outcomes ---
RecordOk == /\ view = "recording" /\ view' = "status" /\ booked' = TRUE /\ ClearMarker
            /\ UNCHANGED <<op, orphans, chainTxs, taps, Hist>>
\* MutationResponseTimeoutError: the only error dev routes to recovery. The
\* backend may have booked the payment before the answer was lost.
RecordTimeout == /\ view = "recording" /\ view' = "recovering" /\ booked' \in {booked, TRUE}
                 /\ UNCHANGED <<op, orphans, chainTxs, pending, taps, memOnly, aged, bLease, Hist>>
\* 5xx, abort, dropped connection: dev shows the error on the input view.
RecordHttpFail == /\ view = "recording"
                  /\ view' = IF Fixed THEN "recovering" ELSE "error"
                  /\ booked' \in {booked, TRUE}
                  /\ UNCHANGED <<op, orphans, chainTxs, pending, taps, memOnly, aged, bLease, Hist>>

\* What recovery can prove: no op of this intent is in flight and either
\* nothing moved (Pay again) or the charge is booked (success).
Proof == op /= "inflight" /\ orphans = 0 /\ (chainTxs = 0 \/ booked)

\* Recovery reads server and chain truth for the intent. Fixed ends the guard
\* only on proof. dev's recoverPaymentStatus reads the charge only.
Recover == /\ view = "recovering"
           /\ Fixed => Proof
           /\ IF chainTxs > 0 THEN view' = "status" ELSE view' = "input"
           /\ ClearMarker /\ Abandon
           /\ UNCHANGED <<chainTxs, taps, booked, Hist>>

\* Fixed: money moved and the charge is unbooked; recovery records the hash
\* (the backend answers a repeated hash idempotently) and it books. It books as
\* soon as one saved op executed, also while another op still runs: every
\* saved op pays the same order, which books once.
RecoverRecord == /\ Fixed /\ view = "recovering" /\ op = "landed" /\ ~booked
                 /\ booked' = TRUE /\ view' = "status" /\ ClearMarker
                 /\ UNCHANGED <<op, orphans, chainTxs, taps, Hist>>

\* UnknownByAge: past the wait window, the charge read and the chain reads
\* all failed, and the gap counted that as dropped: Pay came back as "not
\* sent", with no warning.
RecoverUnreadable == /\ Gap("UnknownByAge") /\ view = "recovering" /\ aged
                     /\ view' = "input" /\ ClearMarker /\ Abandon
                     /\ UNCHANGED <<chainTxs, taps, booked, Hist>>

\* SpentNonce: this op executed and spent its nonce, but the bundler's receipt
\* index has not caught up; the gap read "nonce spent, no receipt" as replaced
\* by another op. In the fix that read proves nothing and recovery waits.
RecoverNonceSpent == /\ Gap("SpentNonce") /\ view = "recovering" /\ op = "landed" /\ ~booked
                     /\ view' = "input" /\ ClearMarker /\ Abandon
                     /\ UNCHANGED <<chainTxs, taps, booked, Hist>>

\* Fixed: the recovery window ends while the op may still land, or with the
\* money moved and the charge unbooked (recording keeps failing). The user
\* sees "confirming" and may leave it; the marker stays, and the next visit
\* resumes. SentDeadline deleted the marker when the money had moved. Past
\* the wait window the fix does not wait: ReleaseWarned ends it.
RecoverTimeout == /\ Fixed /\ view = "recovering" /\ (~aged \/ Gap("PermanentHold"))
                  /\ view' = "confirming"
                  /\ IF Gap("SentDeadline") /\ chainTxs > 0 /\ ~booked
                        THEN ClearMarker ELSE UNCHANGED <<pending, bLease, aged, memOnly>>
                  /\ UNCHANGED <<op, orphans, chainTxs, taps, booked, Hist>>
LeaveConfirming == /\ view = "confirming" /\ view' = "input"
                   /\ UNCHANGED <<op, orphans, chainTxs, pending, taps, booked, memOnly, aged, bLease, Hist>>

\* Time passes: the marker outlives the wait window.
Age == /\ Fixed /\ pending /\ ~aged /\ aged' = TRUE
       /\ UNCHANGED <<view, op, orphans, chainTxs, pending, taps, booked, memOnly, bLease, Hist>>

\* Fixed: past the wait window, a recovery with no proof drops the marker and
\* shows Pay with `errors.externalPaymentNotConfirmed`. An op still in flight
\* keeps going, untracked.
ReleaseWarned == /\ Fixed /\ ~Gap("PermanentHold") /\ view = "recovering" /\ aged /\ ~Proof
                 /\ view' = "input" /\ warned' = TRUE /\ ClearMarker /\ Abandon
                 /\ UNCHANGED <<chainTxs, taps, booked, degraded, refused, claimB>>

\* Refresh, back, leaving the screen: React state is lost. Fixed resumes in
\* recovery from the persisted marker; a marker in page memory is gone.
Reload == /\ view /= "status"
          /\ CASE Fixed /\ pending /\ memOnly ->
                     view' = "input" /\ degraded' = TRUE /\ ClearMarker /\ Abandon
                  [] Fixed /\ pending ->
                     view' = "recovering" /\ UNCHANGED <<op, orphans, pending, bLease, aged, memOnly, degraded>>
                  [] OTHER ->
                     view' = "input" /\ ClearMarker /\ Abandon /\ UNCHANGED degraded
          /\ UNCHANGED <<chainTxs, taps, booked, warned, refused, claimB>>

\* SignOutForgets: sign-out, then the same user signs in again. The fix keeps
\* the marker, so this is a Reload; the gap removed it with the screen's state.
SignOutForget == /\ Gap("SignOutForgets") /\ pending /\ view /= "status"
                 /\ view' = "input" /\ ClearMarker /\ Abandon
                 /\ UNCHANGED <<chainTxs, taps, booked, Hist>>

\* --- another tab of the same user, with `claim` (Fixed, not CrossTab) ---
\* It taps Pay while this tab shows no attempt: its claim is the marker.
OtherTabClaim == /\ Fixed /\ ~Gap("CrossTab") /\ claimB = "none" /\ ~pending
                 /\ view \in {"input", "error", "confirming"} /\ taps < MaxTaps
                 /\ claimB' = "claimed" /\ pending' = TRUE /\ bLease' = TRUE /\ aged' = FALSE
                 /\ taps' = taps + 1
                 /\ UNCHANGED <<view, op, orphans, chainTxs, booked, memOnly, warned, degraded, refused>>
\* Its op leaves only while its own claim is the marker (LeaseSteal: always).
OtherTabSend == /\ claimB = "claimed" /\ (bLease \/ Gap("LeaseSteal"))
                /\ claimB' = "none" /\ orphans' = orphans + 1 /\ bLease' = FALSE
                /\ UNCHANGED <<view, op, chainTxs, pending, taps, booked, memOnly, aged, warned, degraded, refused>>
OtherTabRefuse == /\ claimB = "claimed" /\ ~bLease /\ ~Gap("LeaseSteal")
                  /\ claimB' = "none"
                  /\ UNCHANGED <<view, op, orphans, chainTxs, pending, taps, booked, memOnly, aged, bLease,
                                 warned, degraded, refused>>
\* Its attempt ends before it sends: `release` removes its claim.
OtherTabRelease == /\ claimB = "claimed" /\ bLease /\ claimB' = "none" /\ ClearMarker
                   /\ UNCHANGED <<view, op, orphans, chainTxs, taps, booked, warned, degraded, refused>>
\* The tab is closed: its claim stays in storage.
OtherTabDies == /\ claimB = "claimed" /\ claimB' = "none"
                /\ UNCHANGED <<view, op, orphans, chainTxs, pending, taps, booked, memOnly, aged, bLease,
                               warned, degraded, refused>>
\* 15 minutes after the claim, this tab drops it (a timer, also while the screen stays open).
LeaseExpire == /\ bLease /\ ClearMarker
               /\ UNCHANGED <<view, op, orphans, chainTxs, taps, booked, Hist>>

Next == \/ Tap \/ TapSameTick \/ TapOtherTab \/ TapOtherTabUnseen \/ CreateOk \/ CreateFail \/ StoreFail
        \/ Submit \/ Land \/ Drop \/ OrphanLand \/ OrphanDrop
        \/ SendFailClean \/ SendOk \/ SendFailAfterSubmit \/ SubmitAnswerAsRefusal
        \/ RecordOk \/ RecordTimeout \/ RecordHttpFail
        \/ Recover \/ RecoverRecord \/ RecoverUnreadable \/ RecoverNonceSpent \/ Reload
        \/ RecoverTimeout \/ LeaveConfirming \/ Age \/ ReleaseWarned \/ SignOutForget
        \/ OtherTabClaim \/ OtherTabSend \/ OtherTabRefuse \/ OtherTabRelease \/ OtherTabDies \/ LeaseExpire

Spec == Init /\ [][Next]_vars

\* Each call returns, the user comes back to the screen, time passes, and
\* another tab's attempt ends. Nothing makes an op land or drop.
Fairness == /\ WF_vars(CreateOk \/ CreateFail \/ StoreFail)
            /\ WF_vars(Submit \/ SendFailClean \/ SendOk \/ SendFailAfterSubmit)
            /\ WF_vars(RecordOk \/ RecordTimeout \/ RecordHttpFail)
            /\ WF_vars(Recover \/ RecoverRecord \/ RecoverTimeout \/ ReleaseWarned)
            /\ WF_vars(Reload) /\ WF_vars(Age) /\ WF_vars(LeaseExpire)
            /\ WF_vars(OtherTabSend \/ OtherTabRefuse \/ OtherTabRelease \/ OtherTabDies)
FairSpec == Spec /\ Fairness

\* One intent moves money at most once (dev and the guard without warnings).
AtMostOneTransfer == chainTxs <= 1

\* A second transfer needs the warning first, or a marker storage refused.
NoSilentDoubleSend == chainTxs > 1 => (warned \/ degraded)

\* Send is never offered while money for this intent exists or is in flight,
\* unless the warning showed or storage refused the marker.
NoRetryWhileMoneyMayExist ==
    (view \in {"input", "error"} /\ (chainTxs > 0 \/ op = "inflight" \/ orphans > 0))
        => (~CanTap \/ warned \/ degraded)

\* Storage that refuses the marker never stops a payment.
PayNeverRefusedForStorage == ~refused

\* Every hold ends: Pay comes back for this intent on this device.
HoldEndsEventually == pending ~> ~pending
=============================================================================
