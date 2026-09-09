# not_for_you.md

A personal working log. Not documentation, and nothing here is needed to use or contribute to LifeBook. Everything a newcomer actually needs is in [README.md](./README.md) and [DEVDOC.md](./DEVDOC.md).

This is the record of the small decisions from the documentation and hardening pass: what was wrong, what was changed, and what was deliberately left alone.

---

## Things that were actually wrong

### Chart dots defaulted to white, and ate the line under them

On Analytics, the *Sleep and focus rating* chart rendered as two dashed lines with no dots in light mode. The DOM said otherwise: `stroke-dasharray` was the full path length with a zero gap, and 45 dot elements existed.

Recharts defaults a dot's `fill` to white. Both `<Line>`s were declared `dot={{ r: 3, strokeWidth: 0 }}` with no fill, so every data point painted a white disc over the line it sat on. On the dark card those discs read as deliberate white dots, which is why it had never looked wrong; on the white card they erased the line at regular intervals and the series read as dashed.

Fixed by giving each dot `fill: t.series[n]`. The dashboard's area chart already passed an explicit fill, which is why only this one chart was affected.

### The mood chart's y-axis labels were clipped to stubs

`Mood over the last 30 days` had a bare axis line where 1 to 5 should be. `<YAxis width={30}>` inside `margin={{ left: -20 }}` leaves ten pixels for a label plus its tick padding, so the digits were clipped away entirely. Now `width={34}` and `left: -12`. The Analytics charts use `width={36}` with the same `-20` and were fine, which is why this only showed up on one page.

### The app fetched fonts from Google on every page load

`src/index.css` opened with two `@import url('https://fonts.googleapis.com/...')` lines. The README's claim is "nothing leaves the box unless you add an AI key" and the Settings page says your data stays on the server you run - and then every single page load told Google's CDN who was reading, from where.

Now `@fontsource-variable/inter` and `@fontsource-variable/fraunces` are bundled. The build has zero references to `fonts.googleapis.com` or `fonts.gstatic.com`, and the app renders correctly with no network at all.

**The part worth remembering:** importing them from `index.css` looked like it worked and did not. Tailwind v4 inlines a CSS `@import` without rewriting the relative URLs inside it, so the built stylesheet pointed at `./files/inter-*.woff2` and those files were never emitted - a production build that 404s every font, which is worse than the CDN it replaced. Moving the four imports into `src/main.tsx` makes Vite treat each as its own module: 20 hashed woff2 files in `dist/assets`, correct URLs. The families are `'Inter Variable'` and `'Fraunces Variable'`, not `'Inter'` and `'Fraunces'`, so the `font-family` stacks needed updating too; the old names are kept behind them as a fallback.

### Emoji in the mood scale

`FeelingLow.tsx` had `const MOOD_FACES = ['😞', '🙁', '😐', '🙂', '😄']`. Those are the only emoji that were anywhere in the source. They render differently on every platform, carry their own colour regardless of theme or accent, and sit oddly beside an interface that is otherwise entirely `lucide-react`. Replaced with `Frown, Annoyed, Meh, Smile, Laugh`, which inherit the theme colour and scale with the icon size.

### The task board's Done column was an archive

The column is labelled "Closed today" and was showing every task ever completed - 82 cards on the demo account, dated back to the middle of August. Two ways to fix it: change the label, or make the column mean what it says. Made it mean what it says, since a board is a working surface and an 82-card column is not usable either way. Everything closed earlier lives on the LifePage for the day it was closed, which is the point of the pages.

### The dashboard's chart card stretched to nothing

`grid lg:grid-cols-3` makes items stretch, so the focus chart card - 220px of chart - was stretched to the height of the task list beside it, leaving roughly 250px of empty card. `items-start` fixes the stretch, and capping the task list at six with a "2 more on Plan your day" line keeps the two columns close enough in height that the gap below is not conspicuous.

---

## Demo data, which was thinner than it looked

The seeder wrote 24 days of study, tasks, habits, wellness and journal entries, and then a single resource with the comment "so the study screen is not empty". It was not enough:

- **Study Now** said "Nothing due" with an empty review queue, because there were no decks and no cards at all.
- **Your Resources** was one row with `0 B` and `Today` in every column, because the insert set neither `size_bytes` nor `created_at`.
- **Motivation Hub**, **saved posts**, **saved motivation** and the SOS contact list were all empty.
- The **Quizzer** badge could never show progress because no quiz had ever been attempted.

Added: five resources across four subjects with real byte sizes and staggered dates, two decks of eight cards each spread across the SM-2 schedule with a third of each deck falling due today, a six-question dynamic programming quiz with two attempts behind it, one mind map, four goal visions (one already achieved), three saved motivation items, two saved posts and three SOS contacts.

Three details in the task generation were wrong in a way that only showed up in screenshots:

- **Tasks were sampled with replacement**, so a single day could plan "Practice mock paper" three times. Now sampled without replacement.
- **Open tasks accumulated forever.** 32 items were open on the demo account, which is not a backlog, it is an abandoned account. Days older than four now close out at 93%, leaving twelve open items with distinct titles.
- **The first attempt at "no repeated open titles" had a bug worth recording.** A `while (dayTasks.length < planned) push(shuffled[i])` fallback bypassed the filter it had just applied, so a title could be chosen while an older copy was still open, then closed, then chosen again. Duplicates survived. The fix was to stop topping the list up: if the pool of unused titles is smaller than the day's plan, plan fewer tasks.

One category also had to change: the seeder used `'Cheat sheet'` for the linear algebra resource, which is not in `CATEGORIES` in `Resources.tsx`, so that row rendered with an empty category dropdown. Changed to `'Reference'`. Adding it to `CATEGORIES` instead would have meant a product decision made by a seed script, which is backwards.

---

## Things deliberately left alone

### Vite 5 to 7, for one high advisory

`npm audit` reported a high against `vite` - `server.fs.deny` bypass on Windows alternate paths, plus a path traversal in optimized-deps `.map` handling and a launch-editor UNC issue. All three are dev-server-only and the first is Windows-only, so nothing shipped is affected. But the advisory range is `<=6.4.2`, meaning there is no patched 5.x or 6.x to move to: staying on 5 meant carrying a permanent high.

Took the major. Vite 7 needs Node 20.19+, which `engines` already required. The build, the dev server on :8082 and the Tailwind v4 plugin all work unchanged; no config edits were needed. That also cleared the moderate `esbuild` advisory that came in through Vite.

Not Vite 8, which is what `npm audit fix --force` proposes. 7.3.6 is past the vulnerable range, and one major at a time is enough to verify properly in a pass that is mostly about documentation.

### The react-router open-redirect advisory

`npm audit` reports GHSA-9x8w-3jjq-6vpc against `react-router` for every version in `6.0.0 - 7.17.0`, and the only offered fix is `react-router-dom@7.18.3`, a major version with breaking route API changes.

Checked reachability rather than taking the bump. The advisory needs a user-controlled navigation target. Every `navigate()` call in this codebase takes a string literal. The one data-driven target is `NotificationsBell.tsx:53`, `<Link to={n.link || '#'}>`, and notification rows are only ever created in `server/badges.js:54`, where the link is the hardcoded string `'/badges'`. No user input reaches a routing target anywhere in the app.

So: stayed on `react-router-dom@6.30.6`, and CI gates on `--audit-level=high` so this one advisory does not turn every future pull request red. If a notification ever carries a link from user input or from an AI response, this decision expires immediately.

The other advisories in the tree were real and are fixed: `qs` via `express` and `body-parser` is pinned through an `overrides` block, which cleared three, and the Vite upgrade above cleared two more. What remains is two moderates, both this one advisory reported twice.

### Two dash characters in `deterministic.js`

The em-dash sweep left `[:–—-]` in a regular expression in `server/ai/deterministic.js:357`. That character class exists to *match* dashes in text a user pasted, so removing them would break parsing of any note written with real dashes. They are data, not prose.

### The three `react-refresh` lint warnings

`ThemeContext.tsx` exports `colorPalettes`, `hexToHSL` and `useTheme` alongside the provider component, which trips `react-refresh/only-export-components` three times. Splitting the file would fix it and would also diverge from the same file in `moneyos` and `workos`. Left as-is, as they are in the sibling apps. Zero errors, three warnings, and CI does not fail on warnings.

### The 2 MB single-chunk bundle

Recharts and framer-motion dominate. Route-level `React.lazy` would fix it. Not done: the app is self-hosted and loads from localhost, so a bundle split buys nothing real here, and it is the kind of change that wants its own commit with before-and-after numbers rather than being smuggled into a documentation pass.

### The `lucide-react` namespace import in `Badges.tsx`

Resolves icon names that come out of seed data, so it cannot be a static import list without also making the badge catalog non-data. Same reasoning as above: it is a real cost, but changing it is a product decision about whether badges stay data-driven.

---

## Screenshots, and how they were taken

Thirty-six images: fifteen screens in dark, the same fifteen in light, and three responsive shots per theme. Every one is a real render of the running app against the seeded demo account, signed in through the app's own login form.

The method, because it took a few iterations to get right:

- **An iframe sized to the exact viewport**, inside a throwaway page in `public/`, with injected CSS hiding scrollbars. That gives one image per screen at a true 1440x1180, 390x844 or 820x1180 rather than a scaled desktop shot with a scrollbar down the side. The harness file was deleted afterwards; it is not part of the app.
- **The theme is set through `localStorage` before the frame loads**, not by clicking the toggle, so the page never renders in the wrong theme first.
- **The screenshot scale is not the CSS scale.** The capture came back at 1551px for a 1920px window, a factor of 0.8078 that has to be measured per browser window and re-measured every session. Getting this wrong crops the image.
- **Pages taller than the window** are captured with a CSS `transform: scale(0.8)` on the iframe, so a 1180px-tall page fits a 971px window without stitching two screenshots together.
- **Wait for the animation, not the load.** Framer-motion staggers and Recharts line animations mean a screenshot taken 1.6s after load catches half-drawn charts and cards at 40% opacity. The settle wait is now 3.2s, and the chart-heavy pages got an extra explicit wait on top.
- **Move the mouse out of the frame before capturing**, or the cursor arrow appears in the middle of the image. It resets to the last click position after any top-level navigation, which is how it ended up in three shots that had to be retaken.
- **Reseeding invalidates the session.** `--reset` writes a new user id, so the stored JWT stops matching and the next capture silently renders the login page. Sign in again after every reseed; the number of times this happened is why the seeding is now done in one pass before capturing rather than interleaved.

Images are quantised to a 128-colour palette with no dithering: 6.5 MB to 1.45 MB, with text still crisp.

---

## Documentation

The README kept most of its existing prose, which was already good, and gained the house furniture: the ADK Dev logo header, the tech badges, a contents list, the screenshot galleries, the responsive row, a feature index above the per-feature sections, contributors, contributing and licence.

`README-light.md` is generated by `scripts/build-light-readme.mjs`, not maintained. GitHub has no theme toggle, so the toggle is two pages linking to each other, and two hand-maintained copies of a 350-line document would be out of sync within a week. CI regenerates it and fails on a diff.

Three badge versions were wrong on the first pass - Tailwind 3 and Express 5 against an actual Tailwind 4 and Express 4, and a Vite version that happened to be right only after the upgrade below. Checked against `package.json` rather than memory, which is the lesson.

DEVDOC gained sections for components, seed data, the documentation pipeline and CI, plus five new gotchas from this pass. One thing was removed: it carried an absolute path to a personal external drive (`/media/cherry/Expansion/...`) for the source research. That is a private path in a public repository and says nothing useful to anyone who is not me.

Every file in `src/` and `server/` now opens with a short JSDoc header. The existing in-body comments were left exactly as they were - they explain *why* and are the better half of the commenting in this repo.

---

## CI

There was no CI at all. Now `.github/workflows/ci.yml` runs three jobs: typecheck and lint, build plus an API smoke test plus the README sync check, and a dependency audit at `--audit-level=high`.

The smoke test boots the API against a temporary database and polls `/api/health`. There is no test suite in this repository, so this is the only thing standing between a broken import in `server/` and finding out by running it - a type checker sees none of the server code, since it is plain ESM JavaScript.
