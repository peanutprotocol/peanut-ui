# Peanut document selection

Depends on peanutprotocol/peanut-api-ts#1816. Deploy that API before this UI,
then activate its checked `kyc.workflow.policy` manifest only when supported
clients can use this flow. No tenant configuration is deployed by this PR.

For enabled new identities, the shared KYC hook reads a plan without creating a
Sumsub applicant. Peanut shows requested payment features and the exact required
document bundle, collects document types and issuing countries, then sends only
those catalogue identifiers to reserve an immutable backend attempt. A resume
or token refresh uses the saved attempt and its backend SDK configuration.
Replacement identity documents use the same selector before the existing,
authorised reset flow; interrupted resets keep their saved choices.

WebSDK uses `documentDefinitions.IDENTITY` and
`autoSelectDocumentDefinitions`. Cordova uses
`withPreferredDocumentDefinitions` (present in the installed 1.42 plugin).
Binaries without that method show an update error. Neither driver restarts an
active SDK merely because its access token refreshes.

For identity + PoA, the backend bundle must reference an actually deployed,
single-type PoA preset. There is no invented WebSDK PoA preselection key.
Do not activate a manifest until the advertised combinations have been accepted
in sandbox, including native/web, token expiry, reload and replacement resets.

There are no local address, DOB, document-number, tax-ID or questionnaire-answer
inputs. New app copy is included in en, es-419, es-AR and pt-BR. Existing action,
residence-change and installed-client compatibility flows keep their ledgers.
Missed identity websocket events use the read-only profile endpoint for these
attempts, rather than reopening a verification session.
