import type { QuizDefinition } from '../types'

// Content grounded in mono/projects/card/observability/ (event glossary + funnel state
// machine) and the card-beta email funnel docs. Update there first, here second.
export const funnelQuiz: QuizDefinition = {
    slug: 'funnel-quiz',
    title: 'Funnel Fundamentals',
    emoji: '🥜',
    description:
        "Peanut's real funnel + analytics definitions. The distractors are real event names, so guessing won't save you.",
    grades: [
        { minFraction: 1, title: 'Certified Funnel Nut 🥜🎓', subtitle: 'You may now correct people in dashboards.' },
        { minFraction: 0.75, title: 'Well-Shelled', subtitle: 'Solid. Retry the missed ones and go flawless.' },
        { minFraction: 0.5, title: 'Half-Cracked', subtitle: 'You know the words. The definitions, less so.' },
        { minFraction: 0.25, title: 'Soggy Shell', subtitle: 'Read the explanations. They are the whole point.' },
        { minFraction: 0, title: 'Raw Peanut', subtitle: 'Everyone starts raw. Hit retry.' },
    ],
    questions: [
        {
            prompt: 'In the card application funnel, which event comes immediately after card_sumsub_completed?',
            options: ['card_terms_viewed', 'card_terms_accepted', 'card_apply_succeeded', 'card_add_to_wallet_viewed'],
            correctIndex: 0,
            explanation:
                'The application funnel is: card_state_viewed (add-card) → card_sumsub_opened → card_sumsub_completed → card_terms_viewed → card_terms_accepted → card_apply_succeeded. Finishing KYC drops you on the terms screen — viewing terms and accepting them are separate steps, and the gap between them is an alerting metric.',
            wrongQuip: 'So close. KYC done ≠ terms accepted.',
        },
        {
            prompt: "A dashboard says 'cards issued: 371'. Which event is it counting?",
            options: [
                'card_apply_card_created',
                'card_apply_succeeded',
                "card_state_viewed with state='active'",
                'card_spend_authorized',
            ],
            correctIndex: 0,
            explanation:
                "card_apply_card_created is THE 'card issued' event — Rain actually created the card. card_apply_succeeded only means the application was submitted successfully; the card doesn't exist yet. state='active' is a screen view, which double-counts every visit.",
            wrongQuip: "'apply_succeeded' is the classic trap. Application ≠ card.",
        },
        {
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
            prompt: "'First spend' fires on card_spend_authorized, not card_spend_settled. What's the actual difference between the two?",
            options: [
                'Authorization is the merchant hold at tap time; settlement is when funds actually clear, often days later',
                'Authorization is our app approving the spend; settlement is the user confirming it',
                'They are synonyms from two different providers',
                'Settlement always happens first, authorization confirms it',
            ],
            correctIndex: 0,
            explanation:
                'card_spend_authorized = the moment the user tapped and the merchant got a hold — the behavioral event we care about. card_spend_settled = money actually moving, days later. Between them a spend can also become card_spend_declined or card_spend_reversed. Use authorized for behavior, settled for money.',
        },
        {
            prompt: 'A user finished KYC and got a card issued, but never opened the add-to-wallet screen. For the tokenization step, this user is:',
            options: ['Never-reached', 'Stalled', 'Churned', 'Converted with delay'],
            correctIndex: 0,
            explanation:
                "Never-reached = the user never arrived at the step. Stalled = they arrived (opened the screen) but didn't complete it. The fix differs completely: never-reached is a discovery/comms problem, stalled is a UX/product problem. Merging them hides which one you have.",
            wrongQuip: "Can't stall on a screen you never opened.",
        },
        {
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
            prompt: "'Last-touch attribution' credits a conversion to:",
            options: [
                'The final touchpoint before the conversion, 100% of it',
                'Every touchpoint, split evenly',
                'The first channel that ever reached the user',
                'The most expensive channel involved',
            ],
            correctIndex: 0,
            explanation:
                'Last-touch gives the entire conversion to the final touch before converting. Cheap and simple, but it systematically undercredits everything that warmed the user up earlier — which is exactly why we state the attribution model next to every conversion number.',
        },
        {
            prompt: 'A user signs up, passes KYC, gets a card — and never spends. Which stage of the growth funnel failed?',
            options: ['Activation', 'Acquisition', 'Retention', 'Referral'],
            correctIndex: 0,
            explanation:
                "Acquisition got them in the door; activation = reaching the first moment of real value — for the card, that's first spend. You can't retain a user who never activated: retention only starts counting after the first value moment.",
            wrongQuip: "Can't churn from a habit you never formed.",
        },
        {
            prompt: 'We alert when terms-acceptance rate drops below 60%, rather than alerting on weekly issued-card counts. Why?',
            options: [
                "It's a leading indicator — a mid-funnel breakage shows up there within hours, weeks before it dents issued counts",
                'Terms acceptance is legally more important',
                'Issued counts are too noisy to alert on',
                'PostHog cannot alert on weekly aggregates',
            ],
            correctIndex: 0,
            explanation:
                'Leading indicators (mid-funnel step rates) move immediately when something breaks; lagging indicators (issued cards, revenue) move after the damage is done. Alert on leading, report on lagging.',
        },
        {
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
            prompt: 'A card spend shows card_spend_authorized but a card_spend_reversed arrives the next day. What happened?',
            options: [
                'The hold was released without settling — e.g. a hotel deposit or a merchant-cancelled charge; no money finally moved',
                'The user disputed the charge and won',
                'Our ledger rejected the settlement',
                'The card was frozen mid-transaction',
            ],
            correctIndex: 0,
            explanation:
                'The spend lifecycle is authorized → (settled | reversed | declined-at-auth). A reversal means the authorization hold was released without clearing — common for deposits, gas-station preauths, and cancelled orders. If your spend metric counts authorized only, reversals silently inflate it.',
        },
    ],
}
