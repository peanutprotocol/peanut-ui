# Weight-stack scanner contract

`fontWeightOnTypeToken` counts source debt: a DS type token and an independent
weight utility supplied together to a class-list producer. It does not execute
application code, prove whole-program reachability, or implement Tailwind's
conflict-removal rules. The other value-match metrics retain their regex rules.

## Supported expressions

- Class-name JSX attributes, calls conventionally named `twMerge`, `clsx`, `cn`,
  `classNames` or `tw`, variable initializers, and template literals are producers.
  Names identify builders; the scanner does not resolve their imported implementations.
- Same-file plain `const` bindings resolve in their declaration scope. Parameters,
  imports, destructuring, `let` and `var` stop resolution. Lexical shadows, including
  function-hoisted and class-static-block vars, are retained. Mutation and control-flow assignment tracking
  are outside this source-initializer analysis.
- Parentheses, `as`, `satisfies`, angle-bracket assertions in `.ts`, and non-null
  assertions are transparent wrappers everywhere, including keys and guards.
- Primitive literals, unary `+`, `-`, `!`, `~`, `void`, binary `+`, `-`, `*`, `/`,
  `%`, `===`, `!==`, `<`, `>`, and template interpolation use primitive values.
  In particular `1 + 1` is numeric `2`, not string `"11"`. Arbitrary calls,
  object-to-primitive coercion, accessors, and other operators remain opaque.
- Ternary and logical expressions select alternatives in every context. A
  statically decidable guard selects only its reachable value. Different unknown
  guards are analyzed independently; correlations across separate expressions
  and side effects are outside scope. This is a deliberate change from the old
  regex policy, which combined both ternary arms.
- Object fields and finite object spreads follow source order. Later fields win.
  Computed keys may have finite primitive alternatives. Unknown keys/spreads remain
  possible overrides; they never make an unrelated named field a selected value.
  Prototype-chain behavior and mutations are outside scope.
- Array literals, finite array spreads, canonical indices, holes, missing elements,
  and known lengths are handled before class interpretation. A known absent value
  is `undefined`, distinct from an opaque value. Positions following an unknown
  spread are conservatively selected from the remaining candidates.
- Selection returns a value in its consumer's context: the array selected by
  `classNames(({x: ['text-body-m', 'font-semibold']}).x)` composes both fragments.
  Lookup tables themselves contain alternatives, not co-applying sibling classes.
- Builder objects emit truthy keys, not their condition values. Known false
  conditions are excluded. Arrays passed to builders compose their items.
- Whitespace `.join` composes top-level elements after primitive string coercion.
  Nested arrays stringify with commas, including holes and nullish entries; object
  coercions remain opaque and never emit builder keys. Other or unknown separators
  retain the existing lookup-only policy. This does not implement general
  JavaScript string assembly via non-whitespace joins.
- Joined and fully folded strings match whole whitespace-delimited classes,
  including variant prefixes and important markers. A comma within a joined
  element is not a class boundary, even after concatenation or template wrapping.

Unknown class values contribute no invented classes. Known pieces of partially
dynamic concatenations/templates/computed keys retain a conservative fragment
summary, which can over-count boundary cases. A count is therefore a scoped debt
metric, not proof that every runtime value is clean. Literal stacks in a stored
constant remain debt even if application control flow never selects that constant.

## CVA is explicitly deferred

There are no CVA consumers under `src/` at this change's baseline. CVA variants,
compound selectors and default-selection semantics require a separate contract.
A call named `cva` or an import from `class-variance-authority` raises
`UNSUPPORTED_CVA` with file/line information. It is not silently ignored and does
not fall back to a successful regex count. A future CVA integration must first
extend this contract and its test oracle. Historical review examples are retained
as diagnostic fixtures in `__tests__/fixtures/ds-lint-cva-review-cases.json`.

## Counting and limits

Counts deduplicate token/weight source-position pairs. Re-reading one literal
pair does not add debt; separately authored pairs can. Folded expressions use
the expression's position; computed keys use the key's position.

The earlier P21/P26 decision is retained: after 256 summary alternatives, full
matches and representatives of token-only, weight-only and empty partials are
kept. This preserves existence, not exact fan-out cardinality. The metric is not
an exact occurrence count or an autofix inventory. The cap can change numeric
cardinality; callers must not interpret a count as such an inventory.

Structural/string expansion is different from summary compaction: more than 256
choices, 100,000 evaluator work units, depth 256, or concatenating string operands
over 65,536 characters raises `ANALYSIS_LIMIT`. The scanner does not turn an
incomplete analysis into a clean numeric result. The CLI computes counts before
printing them or writing a baseline, so these errors stop `--check`, `--json` and
`--write-baseline` with a nonzero exit. Invalid syntax alone retains the historical
regex fallback; a missing parser or evaluator failure remains an error.

## Verification and baseline migration

- Keep historical supported-syntax examples as ordinary regressions.
- Run the generated matrix: every pair of 28 wrappers around six positive/negative
  seeds, across the eight assignments of three independent booleans. Only these
  generated closed programs execute in the test oracle, using the installed
  `classnames`; the production scanner never executes source.
- Compare guard forms, static-block scope boundaries, joined-value wrappers and
  property-key overrides against runtime fixtures in `ds-lint-review-boundaries.test.ts`.
- Test intentional conservative policies and unsupported syntax separately from
  runtime-equality examples. Exercise expansion limits in child processes with
  time and memory ceilings.
- Compare every source file's before/after count, then review and record any
  methodology change in the baseline `_meta`. Do not regenerate other metrics
  as a side effect of modifying this scanner.

The migration from `954861de9` changes only
`src/app/(mobile-ui)/dev/_components/DevSegmented.tsx`, from 1 to 0. Its `size`
ternary has `font-bold` in the small branch and `text-label-m` in the other branch;
no selection supplies both. The weight-stack baseline moves from 46 to 45.
Removing CVA support changes no source-file count. All other debt baselines stay
unchanged.
