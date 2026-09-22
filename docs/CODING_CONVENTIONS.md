# Coding conventions

TickerLens follows the style guides Google publishes at
https://google.github.io/styleguide/. This document records which guides we
use, how they are enforced, and where we deliberately deviate.

## Which guides

| Language                 | Guide                                                                                | Notes                                                                                      |
| ------------------------ | ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------ |
| TypeScript, JavaScript   | [Google TypeScript Style Guide](https://google.github.io/styleguide/tsguide.html)    | Google's JavaScript guide is frozen; Google recommends the TypeScript guide for new code.  |
| Python (future services) | [Google Python Style Guide](https://google.github.io/styleguide/pyguide.html)        | 4-space indent (see `.editorconfig`); use `pylint`/`black`-compatible settings when added. |
| HTML and CSS             | [Google HTML/CSS Style Guide](https://google.github.io/styleguide/htmlcssguide.html) | Formatting is delegated to Prettier.                                                       |

## How the TypeScript guide is enforced

Google ships its guide as a tool: [gts](https://github.com/google/gts)
("Google TypeScript Style"), which is an ESLint rule set plus a Prettier
configuration. The frontend uses exactly that configuration:

- `frontend/.prettierrc.json` is a verbatim copy of gts 7.0.0's Prettier
  settings: single quotes, no spaces inside braces (`{foo}`), trailing commas
  everywhere, and no parentheses around single arrow-function parameters.
- `frontend/eslint.config.js` contains the gts 7.0.0 rule set (the base rules
  and the TypeScript rules) copied rule for rule, minus rules that no longer
  exist in typescript-eslint 8 or belong to the Node-only `n` plugin, with `prettier/prettier`
  reported as an error so formatting is part of linting.
- `frontend/tsconfig.app.json` adds the strictness options from gts's
  `tsconfig-google.json` (`strict`, `noImplicitReturns`,
  `noFallthroughCasesInSwitch`, `allowUnreachableCode: false`,
  `allowUnusedLabels: false`, `forceConsistentCasingInFileNames`) on top of
  Vite's defaults.
- `.editorconfig` at the repository root matches what `gts init` generates.

Run `npm run lint` to check and `npm run fix` to auto-correct. `npm run check`
runs lint, type-check and tests together.

### Why the rules are copied instead of depending on `gts`

gts 7 pins ESLint 9 and expects a single `tsconfig.json`. The Vite template
uses ESLint 10 (flat config) and TypeScript project references
(`tsconfig.app.json` + `tsconfig.node.json`). Copying the rules keeps one
ESLint version in the tree and lets typed rules such as
`@typescript-eslint/no-floating-promises` use `projectService`. When gts
publishes ESLint 10 support, the copied block can be replaced with
`...gts` and the behaviour stays the same.

## The rules in practice

The points below are the ones that come up most in day-to-day code. The full
guide is the source of truth.

**Files and modules**

- File names are `snake_case`: `text_size_control.tsx`, `how_it_works.tsx`.
  The guide's own example is `import * as fooBar from './foo_bar'`.
- Use ES modules only. Named exports everywhere, no `export default`. This is
  why `App` is imported as `{App}` and Vite's `App.tsx` was renamed `app.tsx`.
- Order inside a file: `@fileoverview` JSDoc (if any), imports, implementation.
- Tests sit next to the code as `<name>.test.ts` / `<name>.test.tsx`.

**Naming**

- `UpperCamelCase` for types, interfaces, classes and React components.
- `lowerCamelCase` for variables, functions, methods, properties.
- `CONSTANT_CASE` for module-level constants (`FEATURES`, `TEXT_SIZES`).
- Treat acronyms as words: `loadHttpUrl`, not `loadHTTPURL`.
- No `I` prefix on interfaces, no leading underscores for private members.

**Language features**

- `const` by default, `let` when reassigned, never `var`. One declaration per
  statement.
- Prefer function declarations for named functions, including components:
  `export function Hero() {}`. Arrow functions for callbacks.
- Always use braces on control statements. `===` and `!==` only.
- Every `switch` has a `default` case (use a `never` check for exhaustiveness).
- Throw and reject only with `Error` instances; narrow caught values with
  `instanceof Error`.
- Do not use `@ts-ignore`; fix the type instead. Type assertions (`as`) and
  non-null assertions (`!`) need a comment explaining why they are safe, and
  a runtime check is usually better (see `main.tsx`).

**Types**

- Use `interface` for object shapes, `type` for unions, tuples and aliases.
- `T[]` for simple element types, `Array<T>` only for complex ones
  (`@typescript-eslint/array-type: array-simple` enforces this).
- Prefer `unknown` over `any`; narrow before use.
- Prefer optional fields (`error?: TickerError`) over `| undefined`.
- Use string-literal unions instead of `enum` (see below).

**Comments**

- `/** JSDoc */` for anything another file will use; `//` for implementation
  notes. Multi-line comments are stacked `//` lines, not `/* */` blocks.

## Adaptations for this repository

| Topic              | Google default             | Here                                                          | Why                                                                                               |
| ------------------ | -------------------------- | ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Module output      | `commonjs` (gts tsconfig)  | `esnext` + `bundler` resolution                               | Vite bundles ES modules for the browser.                                                          |
| `enum`             | Allowed (not `const enum`) | Not used; string-literal unions instead                       | Vite's template enables `erasableSyntaxOnly`, which forbids `enum` and parameter properties.      |
| React              | Not covered                | `eslint-plugin-react-hooks` and `eslint-plugin-react-refresh` | Hook rules and Fast Refresh safety are React-specific and orthogonal to the style guide.          |
| Tests              | Not specified              | Vitest + Testing Library, `*.test.tsx`, explicit imports      | Explicit `import {describe, it, expect} from 'vitest'` fits the "no globals" spirit of the guide. |
| Accessibility lint | Not covered                | Not yet: `eslint-plugin-jsx-a11y` does not support ESLint 10  | Add it when a compatible release ships. Meanwhile tests assert roles and names.                   |
| Unused code        | Not enforced by gts        | `noUnusedLocals` and `noUnusedParameters` are compile errors  | Vite default; stricter is fine.                                                                   |

## Checklist before opening a pull request

1. `npm run check` passes in `frontend/`.
2. New behaviour has a test next to it.
3. Public functions and components have a one-line JSDoc.
4. No `any`, `@ts-ignore`, `console.log`, or `.only` left behind.
