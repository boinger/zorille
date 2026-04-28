# Pillar 5: Per-language grep discipline + tool escape hatches

Lazy-loaded reference for `/issue-forensics` Pillar 5. **Do not load on
every invocation** — load only when triggered (see SKILL.md Pillar 5
section for trigger conditions). Most Pillar 5 work doesn't need this.

This file exists because a multi-round investigation
(see `references/decisions/2026-04-graph-investigation.md`)
established that:
1. The user's actual Pillar 5 corpus is 100% string-findable (Type-A)
   failures — grep with discipline is sufficient.
2. Type-B (structural / indirect) failures *will* eventually appear in
   future investigations on different languages or codebases, even
   though they didn't in the existing corpus.
3. When Type-B appears, the investigator needs the per-language
   discipline AND the awareness that escape-hatch tools exist.

This reference codifies that discipline.

## Per-language structural-feature checklists

These features can defeat naive name-based grep. Apply the relevant
discipline based on the target repo's language. **Most are not
exhaustive — they raise floor recall, they don't guarantee 100%.**

### C / C++

- **Anonymous-namespace symbols.** If the symbol is declared in an
  anonymous namespace (`namespace { ... }`) inside a `.cpp`/`.cc`
  file, the search space is closed to that translation unit.
  `grep -n <symbol> <that-file>` is provably exhaustive — confirm
  the namespace bound and state it in the trace ("declared in
  anonymous namespace, caller set is closed to this TU"). This is
  the cheapest exhaustiveness proof in any language.
- **Function-pointer / callback-table dispatch.** Search for the
  symbol taken by address (`&symbol`) and bare-symbol use in struct
  initializer position. `grep -nE '\b<symbol>\b'` catches both,
  but bare-symbol callsites in initializers (`{ .handler = symbol,
  ... }`) are easy to misread as forward declarations.
- **Macro expansion.** If the symbol is wrapped in a macro
  (`HAL_GPIO_WritePin` → underlying `HAL_GPIO_WritePin_Impl`),
  search for both forms. `grep -nE '#define\s+<symbol>'` finds
  `<symbol>`-defining macros; back-trace what callers actually
  wrote at the call site.
- **Vtable / virtual dispatch.** For `obj->method()` where `obj` is
  a base-class pointer, find the class hierarchy first
  (`grep -nE 'class\s+\w+\s*:\s*public\s+<Base>'`), then enumerate
  overrides per derived class. Each override is a potential
  effective caller.
- **`extern "C"` boundaries.** Symbols crossing the C++↔C boundary
  may appear in `extern "C"` blocks; search both with and without
  the wrapper.
- **Preprocessor-conditional code.** `#ifdef` arms, `#if
  CONFIG_FEATURE_X` blocks, etc. Grep returns matches in *both*
  arms. The trace must note when the relevant arm is the one
  actually compiled — `git grep` doesn't know what's enabled.

### Go

- **Interface satisfaction is implicit.** Method `Foo` defined on
  `*Bar` makes `*Bar` satisfy any interface declaring `Foo` with the
  same signature. To find effective callers of an interface method:
  - Find the interface declaration:
    `grep -rn 'interface {' -A 20 | grep <MethodName>`
  - Find concrete types implementing it:
    `grep -rnE 'func \(\w+ \*?[A-Z]\w+\) <MethodName>\b'`
  - Each concrete type's callers (via direct `<Type>.<Method>` AND
    via the interface name) are the effective caller set.
- **Package-qualified imports.** `<pkg>.<Symbol>` is callable
  anywhere the package is imported. `grep -rn '<pkg>\.<Symbol>'`
  plus an importer audit (`grep -rnE 'import.*<pkg-path>'`) gets
  the candidate set.
- **Method values vs method calls.** `x.Method` (no parens) takes a
  method value, often passed to a callback. Find these with
  `grep -rnE '<Type>\.<Method>\b[^(]'` to exclude direct calls.
- **Generics + type parameters.** Generic functions look like
  `func F[T any](...)`; callers may not type-instantiate visibly.
  Treat as direct calls but state that effective dispatch is
  resolved by the compiler.

### Python

- **MRO / `super()` dispatch.** Find the class hierarchy first:
  `grep -rnE 'class\s+\w+\([^)]*<BaseClass>[,\)]'`. Each subclass
  that doesn't override the method inherits it; calls on instances
  of those subclasses are effective callers. `super().<method>()`
  chains can be surfaced with `grep -rnE 'super\(\)\.\w+'`.
- **Decorators that rewrite calls.** If the symbol is a decorator
  target (`@<symbol>`), the function passes through whatever the
  decorator defines. Find decorator definitions in addition to
  direct uses.
- **Metaclass dispatch.** Genuinely hard with grep. State the limit
  explicitly in the trace if the target uses metaclasses
  (`grep -rnE 'metaclass\s*='`). This is a common Type-B candidate
  — escalate to escape-hatch tools if metaclass-driven dispatch is
  load-bearing for the finding.
- **Dynamic attribute lookup** (`getattr`, `__getattr__`,
  `__getattribute__`). Same caveat as metaclasses — grep can find
  the dispatch site but cannot enumerate effective targets.

### TypeScript / JavaScript

- **Overload resolution.** Multiple declarations of the same name
  with different signatures all share the symbol. Grep finds them
  all; the question is which overload matches each caller's
  argument shape (read context, don't trust grep alone).
- **Re-exports.** `export { foo } from './bar'` makes `foo`
  reachable via the re-exporting module. Trace the chain:
  `grep -rnE 'export.*\bfoo\b.*from' --include='*.ts'`.
- **Default exports.** Default exports get aliased at the import
  site (`import myName from './x'`). Search for the import path
  and the full set of aliases callers used.
- **Dynamic imports** (`await import('./x')`). The string is the
  module path; the import shape is resolved at runtime. Grep finds
  the dynamic import site; tracing what's used afterward requires
  reading the surrounding code.

### Any language — cross-cutting patterns

- **Generated / build-time-injected callers.** If the project has
  code generators (proto, OpenAPI, Swagger, GraphQL codegen),
  regenerate before tracing — generated callers don't show up in
  `git grep` if they're git-ignored.
- **Test fixtures.** Test code is real production-trust code if the
  finding is about a security or correctness contract. Don't filter
  out `_test.go` / `*.test.ts` / `tests/` reflexively.

## Reasoning about each call site (the harder half)

Once you have the candidate caller set, annotate each:

- **Concurrency context:** is this call inside a goroutine,
  errgroup, thread, ISR, async callback? Does the caller serialize
  access? Is shared state actually shared, or does each call own
  its inputs?
- **Lifetime / freshness:** is the callee invoked on a fresh
  instance per call (e.g., `expr.Pipeline()` returning
  `log.NewPipeline(...)` per query) or reused (e.g., a tailer
  holding one pipeline across streams)? Reuse implies state
  durability across calls.
- **Polarity:** does the caller treat the result as
  pass/fail/either? E.g., `if (path_allowed(...))` vs
  `if (!path_allowed(...))` — same callee, opposite control flow,
  different evidentiary weight for "is the gate enforced?"
- **Trust shape:** is the input to this caller from a trusted
  source (peer service, internal config) or untrusted (user,
  network)? The callee's correctness pressure differs.

These annotations are what makes Pillar 5 evidence vs. a list. The
gold-standard exemplar's Pillar 5 (see `references/loki-21524.md`,
the "Why no production caller hits any of these races" section) is
the model: each of 5+ caller pathways is annotated with concurrency
context, freshness, and lifetime.

## Tool escape hatches — explicitly NOT defaults

These tools exist. They are **NOT part of the default Pillar 5
workflow.** Use them only when **all three** conditions hold:

1. The per-language checklist above has been **exhausted**.
2. The caller trace is still **incomplete** (fewer real callers
   identified than the finding requires for confidence).
3. The missing calls are **structural (Type-B)** — function
   pointer, vtable, macro, dynamic dispatch — **not string-findable
   (Type-A)** — typo, wrong scope, common name confusion.

If you reach for these tools, **document why in the scratchpad.**
That documentation is future signal for whether the graph project
should be revisited (see `references/decisions/2026-04-graph-investigation.md`
for the prior evaluation).

| Tool | License | When it actually helps | Setup cost |
|---|---|---|---|
| `clangd` | Apache-2.0 | C/C++ specifically. Runs full clang frontend, sees the preprocessor. Highest accuracy for C/C++ cross-references when macros and `#ifdef` are involved. | Highest — needs `compile_commands.json` |
| `scip-clang` (Sourcegraph) | Apache-2.0 | C/C++. Same use case as `clangd` but produces a queryable graph index. Useful when the trace needs to be exported / re-queried. | High — `compile_commands.json` + scip-clang binary |
| `scip-go` | Apache-2.0 | Go. Useful when an interface method has many implementations across packages and the implementer-set is hard to enumerate by grep. | Medium |
| `scip-typescript` | Apache-2.0 | TS/JS. Useful for re-export chains and overload resolution at scale. | Medium |
| `scip-python` | Apache-2.0 | Python. Useful for metaclass / `__getattr__` dispatch where grep can't see effective targets. | Medium |
| `ast-grep` | MIT | Any tree-sitter language. Pattern-matches on AST shape rather than text — good for "find all functions matching this signature." Does NOT see preprocessor (so not useful for C/C++ with `#ifdef` arms). | Low (single binary) |

**Pattern for documenting an escape-hatch use in the scratchpad:**

```
P5 escape-hatch invocation:
  Tool: <scip-go|clangd|ast-grep|...>
  Why: <one sentence: per-language checklist exhausted; missing call is
        structural (vtable/macro/etc.); grep returned <N> candidates,
        manual cross-check showed <M> were correct>
  Result: <how many additional callers found; verified vs hallucinated>
  Friction encountered: <e.g., compile_commands.json took 20 min; scip
        index was 150MB; tool version X had a bug Y; etc.>
```

The friction note is especially valuable — accumulated friction
reports across multiple investigations is the data point that would
re-justify a graph-tool investigation.

## Why this discipline exists

`references/decisions/2026-04-graph-investigation.md` documents the
audit that produced this guidance. Short version: a multi-round
evaluation considered adopting GitNexus, building a custom code
graph, and adopting scip-clang. The full corpus (3 investigations:
2 Prusa C++, 1 Loki Go) showed all Pillar 5 traces were
string-findable; the build project would have been infrastructure
looking for a problem to solve. The discipline above is what *did*
prove worth shipping — sharper grep prose codifying patterns the
existing corpus already followed implicitly.

If a future investigation produces a clear Type-B failure that this
discipline can't handle, the escape-hatch tools above are the
documented next step. The decision document above is the baseline
to argue against if the graph-project conversation ever reopens.
