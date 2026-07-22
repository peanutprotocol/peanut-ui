import type { QuizDefinition } from '../types'

// Content grounded in: engineering/analytics/activation/README.md (the Lexicon),
// projects/analytics-cutover/posthog/lexicon-*.sql, projects/card/observability/
// (event glossary + funnel state machine), peanut-ui useActivationStatus, and the
// card-beta email funnel docs. Update there first, here second.
// Question codes ([E1], [M1], [H1]…) match the candidate picker in
// mono/inbox/funnel-quiz-picker/ — keep them in sync until the final cut lands.
export const funnelQuiz: QuizDefinition = {
    slug: 'funnel-quiz',
    title: 'Funnel Fundamentals',
    emoji: '🥜',
    description:
        "Peanut's real funnel + analytics definitions, easy to brutal. The distractors are real, so guessing won't save you.",
    grades: [
        { minFraction: 1, title: 'Certified Funnel Nut 🥜🎓', subtitle: 'You may now correct people in dashboards.' },
        { minFraction: 0.75, title: 'Well-Shelled', subtitle: 'Solid. Retry the missed ones and go flawless.' },
        { minFraction: 0.5, title: 'Half-Cracked', subtitle: 'You know the words. The definitions, less so.' },
        { minFraction: 0.25, title: 'Soggy Shell', subtitle: 'Read the explanations. They are the whole point.' },
        { minFraction: 0, title: 'Raw Peanut', subtitle: 'Everyone starts raw. Hit retry.' },
    ],
    questions: [
        // ————— EASY — the Lexicon, plain definitions —————
        {
            // [E1]
            level: 'easy',
            prompt: 'What is the correct order of the Peanut Lexicon funnel?',
            options: [
                'Visitor → Registered → Verified → Funded → Activated',
                'Visitor → Registered → Funded → Verified → Activated',
                'Registered → Visitor → Verified → Activated → Funded',
                'Visitor → Verified → Registered → Funded → Activated',
            ],
            correctIndex: 0,
            explanation:
                'The Lexicon is our shared vocabulary for the growth funnel: someone visits, registers (creates a passkey), verifies (KYC), funds (first money in), and activates (first money out). Every growth dashboard tile is one of these words.',
            wrongQuip: 'The Lexicon. Say it with me.',
        },
        {
            // [E2]
            level: 'easy',
            prompt: "In the Lexicon, 'Registered' means the user:",
            options: [
                'Completed signup — their passkey was created',
                'Visited the signup page',
                'Verified their email address',
                'Passed KYC',
            ],
            correctIndex: 0,
            explanation:
                "Registered = an account exists (a row in app.users — signup finished, passkey created). Just landing on /setup keeps you a Visitor; KYC is the next step ('Verified').",
        },
        {
            // [E3]
            level: 'easy',
            prompt: "'Verified' means the user:",
            options: [
                'Had KYC approved by any of our providers',
                'Confirmed their phone number',
                'Was manually approved by support',
                'Linked a bank account',
            ],
            correctIndex: 0,
            explanation:
                'Verified = KYC approved (status ACTIVE/APPROVED) by any provider — Bridge, Manteca, or Sumsub. It unlocks bank deposits, QR payments and local payment rails, which is why the in-app CTA calls it "Unlock payments".',
        },
        {
            // [E4]
            level: 'easy',
            prompt: "'Funded' — the deposit step — means the user:",
            options: [
                'Completed at least one inflow: an onramp, a claimed send link, or a crypto deposit',
                'Linked a funding source like a bank account',
                'Holds a balance of at least $10',
                'Made their first card payment',
            ],
            correctIndex: 0,
            explanation:
                'Funded = money actually arrived at least once: a fiat ONRAMP, a claimed send link (SEND_LINK_CLAIM), or an on-chain CRYPTO_DEPOSIT — completed, within 28 days of registration. Linking a bank moves no money; a card payment is money OUT (that is Activated).',
            wrongQuip: 'Funded = money IN. Actually in.',
        },
        {
            // [E5]
            level: 'easy',
            prompt: "'Activated' — our north-star step — means the user:",
            options: [
                'Completed at least one outbound transaction — a payment, withdrawal, or card spend',
                'Finished signup and KYC',
                'Deposited money for the first time',
                'Opened the app three days in a row',
            ],
            correctIndex: 0,
            explanation:
                'Activated = money OUT at least once: a send link, offramp, QR pay, direct transfer, request payment, crypto withdrawal, or a cleared card spend. Deposit-only users are Funded, not Activated — activation is the first moment Peanut delivered real value.',
            wrongQuip: 'Money in is Funded. Money OUT is Activated.',
        },
        {
            // [E6]
            level: 'easy',
            prompt: "A funnel step's 'conversion rate' is:",
            options: [
                'The share of users who entered the step and completed it',
                'The share of all our users who ever completed the step',
                'The number of users who completed the step this week',
                'Completed steps divided by sessions',
            ],
            correctIndex: 0,
            explanation:
                'Conversion = completed ÷ entered, for the same group of users. The denominator is who ENTERED the step — not all users, not sessions. Get the denominator wrong and every number downstream is fiction.',
        },
        // ————— MID — how the steps are actually measured —————
        {
            // [M1]
            level: 'mid',
            prompt: 'Which of these does NOT count toward Funded?',
            options: [
                'Receiving Peanut points or a reward payout',
                'A completed fiat onramp',
                'Claiming a send link from a friend',
                'An on-chain USDC deposit to your wallet',
            ],
            correctIndex: 0,
            explanation:
                'Rewards and points are explicitly excluded from the Funded definition — they are us moving money, not the user. The three real inflows are ONRAMP, SEND_LINK_CLAIM, and CRYPTO_DEPOSIT, each with status COMPLETED.',
            wrongQuip: 'We can’t "fund" you into activation ourselves.',
        },
        {
            // [M2]
            level: 'mid',
            prompt: 'For the activation KR, Funded and Activated events must happen within what window after registration?',
            options: ['28 days', '7 days', '90 days', 'Any time — there is no window'],
            correctIndex: 0,
            explanation:
                'Both are measured within 28 days of registration. The window makes cohorts comparable: a user who finally pays 6 months later is a win, but not an activation-KR win — and without the window the metric could only ever go up.',
        },
        {
            // [M3]
            level: 'mid',
            prompt: 'A user passed KYC but has zero balance. Which activation step does the home screen show them?',
            options: [
                "Deposit — 'Add money to make your first payment'",
                "Verify — 'Unlock payments'",
                "Outbound — 'Make your first payment'",
                'None — the CTAs disappear after KYC',
            ],
            correctIndex: 0,
            explanation:
                'The in-app activation flow is verify → deposit → (card) → outbound. KYC done + no balance lands you on the deposit step, routing to /add-money. You cannot make a first payment with an empty wallet, so outbound waits until there is balance.',
        },
        {
            // [M4]
            level: 'mid',
            prompt: "In Peanut card metrics, 'tokenization' means:",
            options: [
                'The card is added to Apple/Google wallet',
                'A virtual card number is generated',
                'The KYC provider issues a session token',
                'USDC is converted to a spendable balance',
            ],
            correctIndex: 0,
            explanation:
                'Tokenization = the add-to-wallet step (tracked from card_add_to_wallet_viewed onward). A card can be issued and never tokenized — that user can never tap to pay, which is why issued→tokenized is its own funnel step and its own class of drop-off.',
            wrongQuip: 'Not a crypto thing. A wallet thing.',
        },
        {
            // [M5]
            level: 'mid',
            prompt: "'First spend' fires on card_spend_authorized, not card_spend_settled. What's the actual difference?",
            options: [
                'Authorization is the merchant hold at tap time; settlement is when funds actually clear, often days later',
                'Authorization is our app approving the spend; settlement is the user confirming it',
                'They are synonyms from two different providers',
                'Settlement always happens first, authorization confirms it',
            ],
            correctIndex: 0,
            explanation:
                'card_spend_authorized = the moment the user tapped and the merchant got a hold — the behavioral event. card_spend_settled = money actually moving, days later. Between them a spend can also become declined or reversed. Use authorized for behavior, settled for money.',
        },
        {
            // [M6]
            level: 'mid',
            prompt: "A dashboard says 'cards issued: 371'. Which event is it counting?",
            options: [
                'card_apply_card_created',
                'card_apply_succeeded',
                "card_state_viewed with state='active'",
                'card_spend_authorized',
            ],
            correctIndex: 0,
            explanation:
                "card_apply_card_created is THE 'card issued' event — Rain actually created the card. card_apply_succeeded only means the application was submitted; the card doesn't exist yet. state='active' is a screen view, which double-counts every visit.",
            wrongQuip: "'apply_succeeded' is the classic trap. Application ≠ card.",
        },
        {
            // [M7]
            level: 'mid',
            prompt: 'A user signs up, passes KYC, gets a card — and never spends. Which stage of the growth funnel failed?',
            options: ['Activation', 'Acquisition', 'Retention', 'Referral'],
            correctIndex: 0,
            explanation:
                "Acquisition got them in the door; activation = reaching the first moment of real value — money out. You can't retain a user who never activated: retention only starts counting after the first value moment.",
            wrongQuip: "Can't churn from a habit you never formed.",
        },
        // ————— HARD — the traps we actually fall into —————
        {
            // [H1]
            level: 'hard',
            prompt: 'The canonical Activated definition counts CARD_SPEND_CLEAR but deliberately excludes CARD_SPEND_AUTH. Why?',
            options: [
                'Counting both would double-count the same spend, and an auth can still reverse without money moving',
                'AUTH events are not stored in the database',
                'CLEAR fires first, so it is the earlier signal',
                'AUTH includes declined transactions',
            ],
            correctIndex: 0,
            explanation:
                'One spend produces AUTH and then CLEAR — count both kinds and every card spend activates the user twice; an auth can also drop without settling. This is a live gotcha: one of our own scoreboard scripts drifted to CARD_SPEND_AUTH while the canonical lexicon_activated view uses CLEAR.',
            wrongQuip: 'One swipe, two events, one activation.',
        },
        {
            // [H2]
            level: 'hard',
            prompt: 'A user claims a $20 send link from a friend and never does anything else. In Lexicon terms, after 28 days they are:',
            options: [
                'Funded but not Activated',
                'Activated — the claim was a completed transaction',
                'Only Registered — claims are excluded from the funnel',
                'Verified — claiming requires KYC',
            ],
            correctIndex: 0,
            explanation:
                'A claimed send link (SEND_LINK_CLAIM) is one of the three Funded inflows — money came IN. Activation requires money OUT. This user is exactly who the Funded→Activated conversion (our biggest cliff) is about: they have money sitting there and never spent it.',
            wrongQuip: 'Receiving money is not using money.',
        },
        {
            // [H3]
            level: 'hard',
            prompt: "500 cards were issued this month and 250 first-spends happened this month. A teammate reports 'issued→first-spend is 50%'. What's wrong?",
            options: [
                "The 250 spenders aren't necessarily from the 500 issued — conversion must follow one cohort through both steps",
                'Nothing, that is how funnel conversion is defined',
                'They should have used settled spends instead',
                'The denominator should be all users, not issued cards',
            ],
            correctIndex: 0,
            explanation:
                "Funnel conversion = of the users who did step A in a cohort, how many later did step B. This month's spenders mostly got their cards in earlier months. Dividing this month's B by this month's A mixes cohorts and can even exceed 100%.",
            wrongQuip: 'Cohorts. Always cohorts.',
        },
        {
            // [H4]
            level: 'hard',
            prompt: "We report email results 'matured' (e.g. 65.6% open after a week) instead of day-1 numbers. Why?",
            options: [
                'People act slowly — a metric read too early undercounts, and cohorts become comparable only after the action window closes',
                'Email providers batch-report stats weekly',
                'It averages out weekend effects',
                'Day-1 numbers are inflated by bots',
            ],
            correctIndex: 0,
            explanation:
                "A 'matured' metric is read after enough time has passed for slow actors to act. Day-1 vs day-7 open rates differ hugely, so comparing a fresh campaign's day-1 number against an old campaign's final number is comparing different things.",
        },
        {
            // [H5]
            level: 'hard',
            prompt: 'Why do we treat email CLICK rate as trustworthy but open rate as decoration?',
            options: [
                'Apple Mail privacy protection auto-loads tracking pixels, inflating opens; a click requires a human finger',
                'Opens are sampled, clicks are counted exactly',
                'Open tracking is disabled in our sender',
                'Clicks include opens by definition',
            ],
            correctIndex: 0,
            explanation:
                'Apple MPP (and other prefetchers) fetch the tracking pixel whether or not a human read the email, so open rate is inflated by an unknowable amount. Clicks are deliberate actions. Rank campaigns by clicks; use opens only directionally.',
        },
        {
            // [H6]
            level: 'hard',
            prompt: 'Time-to-first-spend: mean 4.2 days, median 11 hours. What should you conclude?',
            options: [
                'The typical user spends within a day; a long tail of slow users drags the mean up',
                'The data is corrupted — they should match',
                'Users are getting slower over time',
                'The typical user takes about 4 days to spend',
            ],
            correctIndex: 0,
            explanation:
                "When mean >> median, a long right tail is doing the damage. The median is the typical user (11h!); the mean is distorted by a few week-long stragglers. Report medians for 'typical', and look at the tail as its own segment.",
            wrongQuip: 'The mean lies when the tail wags.',
        },
        {
            // [H7]
            level: 'hard',
            prompt: 'A user got a card issued but never opened the add-to-wallet screen. For the tokenization step, this user is:',
            options: ['Never-reached', 'Stalled', 'Churned', 'Converted with delay'],
            correctIndex: 0,
            explanation:
                "Never-reached = the user never arrived at the step. Stalled = they arrived (opened the screen) but didn't complete it. The fix differs completely: never-reached is a discovery/comms problem, stalled is a UX/product problem. Merging them hides which one you have.",
            wrongQuip: "Can't stall on a screen you never opened.",
        },
    ],
}
