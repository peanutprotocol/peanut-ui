PR: https://github.com/peanutprotocol/peanut-ui/pull/2274   base: dev   head: 1aaf95e9d
scope: ONE PR = rejection feature + force-directed collage (full-merged with keep-out fixes)
commits: rejection(8cd3) · eslint(444f) · appeal-fallback(3728) · force-directed-collage(57ab) · keepout+corner-trap merge(1aaf)
gate: prettier ✅ typecheck ✅ unit ✅ eslint baseline-2 (suppressed 2 styled-jsx) — not worsened
CI 1aaf95e9d: typecheck/unit/format/analyze/e2e ✅ · eslint 🟡 baseline · Capgo 🟡 TEMP · MERGEABLE (BLOCKED=awaiting human)
self-review: rejection (fixed appeal silent-failure). collage (agent: corner-trap worst 0.216) -> FIXED: final separation pass, sweep worst 0.75, 0 overlaps; broadened test to 160 seeds.
CR threads: hero-keepout + pill-keepout RE-APPLIED (replied); appeal-unmeasured fixed (replied); bake-@joinpeanut DECLINED w/ reason (replied).
NOT in this PR: psyops badge (#2275); api-ts .env.sample CARD_PUBLIC_LAUNCH_DATE removal (different repo, flagged).
todo: readiness report to user (NO merge). Optional: visual render of merged collage if wanted.
