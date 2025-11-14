INSERT INTO public.perks
(id, "name", description, "campaignGroup", "discountPercentage", "triggerEvent", conditions, "perUserLimit", "perUserCapUsd", "totalBudgetUsd", "firstNUsers", "limitState", "startAt", "endAt", status, "issuedCount", "issuedAmountUsd", "lastIssuedAt", "createdAt", "updatedAt", "createdBy")
VALUES(uuid_generate_v4(), 'Seedlings - Ambassador Payout', '🌱 Ambassador bonus for growing the Peanut community!', 'SEEDLINGS_DEVCONNECT_BA_2025', 50, 'PAYMENT_COMPLETED'::public."perk_trigger_event", '{}'::json, NULL, 1000.00, NULL, NULL, NULL, '2025-11-01 03:00:00.000', '2026-01-01 02:59:59.000', 'ACTIVE'::public."perk_status", 0, 0.00, NULL, '2025-11-13 23:10:11.539', '2025-11-13 23:10:11.539', 'seedlings-sql');

{"requiredBadges":["SEEDLING_DEVCONNECT_BA_2025"],"transactionTypes":["QR_PAYMENT"],"allowMultipleRedemptions":true}

INSERT INTO public.perks (
    id,
    "name",
    description,
    "campaignGroup",
    "discountPercentage",
    "triggerEvent",
    conditions,
    "perUserLimit",
    "perUserCapUsd",
    "totalBudgetUsd",
    "firstNUsers",
    "limitState",
    "startAt",
    "endAt",
    status,
    "issuedCount",
    "issuedAmountUsd",
    "lastIssuedAt",
    "createdAt",
    "updatedAt",
    "createdBy"
) VALUES (
    '24a324e9-77b0-4e63-b817-c46cbb2f5b04',
    'Seedlings - Ambassador Payout',
    '🌱 Ambassador bonus for growing the Peanut community!',
    'SEEDLING_DEVCONNECT_BA_2025',
    50,
    'PAYMENT_COMPLETED'::public."perk_trigger_event",
    '{"requiredBadges":["SEEDLING_DEVCONNECT_BA_2025"],"transactionTypes":["QR_PAYMENT"],"allowMultipleRedemptions":true}'::json,
    NULL,
    1000.00,
    10000.00,
    NULL,
    DEFAULT,
    '2025-11-01 03:00:00.000',
    '2030-11-01 03:00:00.000',
    'ACTIVE'::public."perk_status",
    0,
    0.00,
    NULL,
    DEFAULT,
    DEFAULT,
    'hugo-and-kush-non-vibe-coded'
);
