# Working on this repo

Read `README.md` first. Develop on the `planner` branch; `main` changes only when the owner says "merge".

## Code style: ponytail (github.com/DietrichGebert/ponytail)

- Read the code a change touches first; then make the smallest change that fully solves the task.
- Reuse in this order: something already in this repo, the platform or standard library, an installed dependency. Never add a dependency for a few lines.
- No options, wrappers, abstractions or "for later" code nobody asked for. Deleting beats adding. Keep the existing folders, layers and conventions.
- Comment only the why the code can't show, in one line. Design reasoning goes in the README.
- Never cut: validation at the API boundary (zod), error handling that prevents data loss, security, accessibility, Undo.
- Logic with a branch, loop, parser, money or dates gets a small Vitest test, with made-up data.

## Conventions

- Business logic is pure functions in `shared/src`; models are zod schemas in `shared/src/models`.
- Dates are local strings (`YYYY-MM-DD`, `YYYY-MM-DDTHH:mm`) handled with `shared/src/dateMath.ts` and `dateTime.ts`; show times as 12-hour.
- Colors come from design tokens and palette keys, never hex values in components.
- Every drag has a non-drag alternative. Migrations are append-only and tested on a copy of the real database.
- Don't run a formatter: there is no config, and it would rewrite whole files.
- Never commit personal data. `.private/` is ignored; commit files by explicit path, not `git add -A`.
