<div align="center">

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="./docs/assets/adk_dev_logo_light.png">
  <img src="./docs/assets/adk_dev_logo_dark.png" width="150" alt="ADK DEV" loading="lazy">
</picture>

# LifeBook

**Your life is a book, and every day is one page. LifeBook turns what you study, how you sleep, what you commit to and what you reflect on into a single dated page - and enough pages into a book you can hold in print.**

<img alt="React" src="https://img.shields.io/badge/React_19-20232A?style=for-the-badge&logo=react&logoColor=61DAFB" loading="lazy">
<img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white" loading="lazy">
<img alt="Vite" src="https://img.shields.io/badge/Vite_7-646CFF?style=for-the-badge&logo=vite&logoColor=white" loading="lazy">
<img alt="Tailwind CSS" src="https://img.shields.io/badge/Tailwind_4-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white" loading="lazy">
<br>
<img alt="Express" src="https://img.shields.io/badge/Express_4-000000?style=for-the-badge&logo=express&logoColor=white" loading="lazy">
<img alt="SQLite" src="https://img.shields.io/badge/SQLite-003B57?style=for-the-badge&logo=sqlite&logoColor=white" loading="lazy">
<img alt="Claude" src="https://img.shields.io/badge/Claude-D97757?style=for-the-badge&logo=anthropic&logoColor=white" loading="lazy">
<img alt="Gemini" src="https://img.shields.io/badge/Gemini-8E75B2?style=for-the-badge&logo=googlegemini&logoColor=white" loading="lazy">
<img alt="MIT License" src="https://img.shields.io/badge/License-MIT-3DA639?style=for-the-badge" loading="lazy">

<br><br>

**[Developer documentation](./DEVDOC.md)** · [Features](#features) · [Getting started](#getting-started)

<p><b>Dark mode</b> · <a href="./README-light.md">View this page in light mode</a></p>

</div>

---

## Contents

- [Why this project matters](#why-this-project-matters)
- [Where it came from](#where-it-came-from)
- [Screenshots](#screenshots)
- [Responsive layout](#responsive-layout)
- [The loop](#the-loop)
- [Features](#features)
- [AI, and working without it](#ai-and-working-without-it)
- [Your data stays yours](#your-data-stays-yours)
- [Getting started](#getting-started)
- [Honest limits](#honest-limits)
- [Contributors](#contributors)
- [Contributing](#contributing)
- [License](#license)

---

## Why this project matters

Students are told to work harder and sleep better and stop scrolling, and none of that advice lands, because nobody knows what they are currently doing. Ask how many hours you studied last week, how many of the tasks you planned you actually closed, or whether your bad days follow bad nights, and the honest answer is a shrug.

LifeBook is the instrument. Every screen exists to produce one number or one sentence about a real day: minutes actually sat through rather than planned, tasks moved to Done rather than asserted, hours slept, mood checked in, a line written down. Then it closes the day by writing that into a page you can read - what happened, what went well, what slipped, and the single most useful thing to change tomorrow.

The point of making the output a *book* rather than a dashboard is that a dashboard is something you glance at and a book is something you read. Thirty pages in, the trend is not a chart you have to interpret; it is a run of days in your own numbers, with your own journal quoted back at you, and it is uncomfortable in a way a bar chart never manages.

## Where it came from

LifeBook is the built version of a 2024 Design Thinking study on student study-life balance by Ashwani Raj, G Yuvaraj and Adari Dileep - 22 in-depth interviews, a survey, and a review of 15 papers on study technique, time management, extracurriculars and student wellbeing.

The finding the whole product exists to answer, verbatim from the interview analysis:

> They dont measure their life hence cant see their improvements/backlogs.

Supporting findings the app is shaped around: most students did no exercise or mindfulness at all, could not delay gratification, had no organised study schedule, did shallow rather than deep work, and treated motivation as all-or-nothing. Almost none of them were tracking any of it.

Every feature traces back to one of those. Spaced repetition and the focus timer answer shallow work; the challenge hub answers delayed gratification; Health Booster answers the exercise and sleep findings; the Motivation Hub is written for the day the motivation has already gone rather than for the day it is high.

## Screenshots

Every image is a real 1440x1180 viewport render of the app against the seeded demo account. This page shows **dark mode**; the same gallery in light mode is at **[README-light.md](./README-light.md)**.

<table>
  <tr>
    <td width="33%" valign="top">
      <img src="./docs/screenshots/dark/dashboard.png" alt="Dashboard with four stat tiles, a focus chart, today's open tasks and the habit grid" loading="lazy">
      <p align="center"><b>Dashboard</b><br><sub>Health points, focus this week, what is still open, and yesterday's page.</sub></p>
    </td>
    <td width="33%" valign="top">
      <img src="./docs/screenshots/dark/lifepage.png" alt="A single sealed LifePage with the day's narrated summary, metrics and achievements" loading="lazy">
      <p align="center"><b>A LifePage</b><br><sub>One day, written from that day's rows and sealed once you have read it.</sub></p>
    </td>
    <td width="33%" valign="top">
      <img src="./docs/screenshots/dark/lifebook-shelf.png" alt="The book reader open on a spread, with page count and print controls" loading="lazy">
      <p align="center"><b>Your LifeBook</b><br><sub>The pages bound together, turned like a book, printable at A5.</sub></p>
    </td>
  </tr>
  <tr>
    <td width="33%" valign="top">
      <img src="./docs/screenshots/dark/study.png" alt="Study Now with a pomodoro timer, the spaced repetition queue and the study material generator" loading="lazy">
      <p align="center"><b>Study Now</b><br><sub>Focus timer, cards due today, and a generator fed by your own notes.</sub></p>
    </td>
    <td width="33%" valign="top">
      <img src="./docs/screenshots/dark/plan-day.png" alt="Task board with To do, Ongoing, Blocked and Done columns" loading="lazy">
      <p align="center"><b>Plan your day</b><br><sub>Drag between columns; moving to Done is what stamps completion.</sub></p>
    </td>
    <td width="33%" valign="top">
      <img src="./docs/screenshots/dark/analytics.png" alt="Analytics with daily focus, focus by weekday and a sleep against focus rating chart" loading="lazy">
      <p align="center"><b>Analytics</b><br><sub>Focus over time and by weekday, and correlations from your own logs.</sub></p>
    </td>
  </tr>
  <tr>
    <td width="33%" valign="top">
      <img src="./docs/screenshots/dark/wellness.png" alt="Health Booster with sliders for sleep, exercise, screen time, water, mindfulness and daylight" loading="lazy">
      <p align="center"><b>Health Booster</b><br><sub>Six numbers against targets you set, plus guided breathing.</sub></p>
    </td>
    <td width="33%" valign="top">
      <img src="./docs/screenshots/dark/journal.png" alt="Personal Journal with today's reflection, gratitude list, wins and improvements" loading="lazy">
      <p align="center"><b>Personal Journal</b><br><sub>Reflection, gratitude, wins and gaps - quoted on tonight's page.</sub></p>
    </td>
    <td width="33%" valign="top">
      <img src="./docs/screenshots/dark/challenges.png" alt="Challenge Hub showing an active challenge and the catalogue of eight" loading="lazy">
      <p align="center"><b>Challenge Hub</b><br><sub>Eight challenges, each aimed at one finding from the research.</sub></p>
    </td>
  </tr>
  <tr>
    <td width="33%" valign="top">
      <img src="./docs/screenshots/dark/feeling-low.png" alt="Feeling low page with a mood scale, trigger tags, coping actions and a mood trend chart" loading="lazy">
      <p align="center"><b>Feeling Low?</b><br><sub>Mood, triggers, three things that help, and helplines above the charts.</sub></p>
    </td>
    <td width="33%" valign="top">
      <img src="./docs/screenshots/dark/badges.png" alt="Badges page showing five earned badges and eight still to earn with progress bars" loading="lazy">
      <p align="center"><b>Badges</b><br><sub>Thirteen, every one measured from real rows.</sub></p>
    </td>
    <td width="33%" valign="top">
      <img src="./docs/screenshots/dark/settings.png" alt="Settings with AI provider and key, appearance mode and accent palettes, and notification toggles" loading="lazy">
      <p align="center"><b>Settings</b><br><sub>Bring a key or use none, pick a theme and an accent, own your data.</sub></p>
    </td>
  </tr>
  <tr>
    <td width="33%" valign="top">
      <img src="./docs/screenshots/dark/resources.png" alt="Resource library listing five study materials with category, subject and size" loading="lazy">
      <p align="center"><b>Your Resources</b><br><sub>Notes in one place, tagged and searchable; text ones feed the generators.</sub></p>
    </td>
    <td width="33%" valign="top">
      <img src="./docs/screenshots/dark/motivation.png" alt="Motivation Hub with a quote, a goal board and affirmation cards" loading="lazy">
      <p align="center"><b>Motivation Hub</b><br><sub>Goals with dates against them, for the days the motivation has gone.</sub></p>
    </td>
    <td width="33%" valign="top">
      <img src="./docs/screenshots/dark/feed.png" alt="Feed of research digests with citations" loading="lazy">
      <p align="center"><b>Your Feed</b><br><sub>The research behind the app, digested, plus anything your instance writes.</sub></p>
    </td>
  </tr>
</table>

## Responsive layout

The same screens at a phone and a tablet viewport. Each is a single render at that exact size, not a scaled-down desktop shot.

<table>
  <tr>
    <td width="28%" valign="top">
      <img src="./docs/screenshots/responsive/dark/phone-dashboard.png" alt="Dashboard on a 390x844 phone viewport" loading="lazy">
      <p align="center"><b>Phone, 390x844</b><br><sub>Tiles stack, the sidebar becomes a sheet behind the menu button.</sub></p>
    </td>
    <td width="28%" valign="top">
      <img src="./docs/screenshots/responsive/dark/phone-lifepage.png" alt="A LifePage on a 390x844 phone viewport" loading="lazy">
      <p align="center"><b>Phone, a page</b><br><sub>The book drops to a single leaf; the page itself is unchanged.</sub></p>
    </td>
    <td width="44%" valign="top">
      <img src="./docs/screenshots/responsive/dark/tablet-plan.png" alt="Task board on an 820x1180 tablet viewport" loading="lazy">
      <p align="center"><b>Tablet, 820x1180</b><br><sub>The four-column board reflows to two by two, still drag and drop.</sub></p>
    </td>
  </tr>
</table>

## The loop

```
Study Now      -+
Plan your day  -+
Health Booster -+
Challenge Hub  -+--> insight engine --> one LifePage per day --> your LifeBook
Motivation Hub -+    (summary, wins,     (dated; sealed when       (printable)
Your Feed      -+     gaps, one thing     the day is done)
Personal Journal -+   for tomorrow)
Feeling Low?   -+
```

Log through the day, then close the day. LifeBook reads everything you recorded and writes the page: what happened, what went well, what to tighten, a quote from your own journal, and the single most useful thing to change tomorrow.

## Features

- [Close the day](#close-the-day)
- [Just say it](#just-say-it)
- [Study Now](#study-now)
- [Plan your day](#plan-your-day)
- [Health Booster](#health-booster)
- [Personal Journal](#personal-journal)
- [Challenge Hub](#challenge-hub)
- [Feeling Low?](#feeling-low)
- [Analytics](#analytics)
- [Your LifeBook](#your-lifebook)
- [Resources, Motivation, Feed and Badges](#resources-motivation-feed-and-badges)

### Close the day

One button, on every screen. It reads that day's sessions, tasks, sleep, movement, habits, mood and journal, and writes a dated page.

**Using it.** Press **Today's page** from anywhere, or open a day from the book index and generate it there. Pages can be **sealed** once you have read them - a sealed page is what gets bound into a printed book, so LifeBook refuses to quietly rewrite one. Unseal from the page itself if you want it regenerated.

### Just say it

A small assistant sits in the corner of every screen. Tell it about your day the way you would tell a friend - "slept 5 hours, finished the problem set, still haven't done the ML assignment, need to book the exam slot" - and it files the whole thing: to-dos onto the board, finished things as completed, the ones you missed as an honest backlog, the sleep and screen time into Health Booster, the study block into your focus history, the mood into your check-ins, the gratitude into your journal.

**Using it.** Click the round button at the bottom right and type, or press the **mic** and talk. It shows you every row it wrote with an **Undo** beside it, so a misread sentence costs one click. Turn *Auto* off and the same card grows a Save button instead, if you would rather read before it writes. It will not turn a feeling into a task: say "I feel behind on everything" and you get a mood entry, not five invented chores.

It also works on what is already there rather than piling up beside it:

- **It closes tasks you already have.** "Finished revising thermodynamics" ticks off the *Revise thermodynamics* card on your board - it does not add a second one marked done. A to-do you mention that already exists is skipped; one you finished last week and mention again is reopened.
- **It asks before overwriting.** If your sleep is already logged as 6.5h and you now say four, it stops and asks which is right, with both numbers in front of you. Nothing is written until you answer, and you answer per number - change the sleep, keep the exercise.
- **It remembers the conversation.** "Sorry, that was organic chemistry, and closer to three hours" corrects the block you just logged instead of being read as a fresh one.

The dictation uses your browser's own speech recognition rather than anything LifeBook runs, which means it needs no key, but also that in Chrome the audio goes to Google to be transcribed. If you would rather it did not, type instead; the button hides itself entirely in browsers with no recogniser.

### Study Now

A real focus timer that writes a real row: planned versus actual minutes, technique, subject, an honest focus rating and an interruption count. That rating is the number every insight about your focus is built from.

**Using it.** Pick a block length (pomodoro, deep work or a long block), name the subject, and start. When you finish, rate the focus honestly - the number is only useful if it is true. Alongside the timer sits a **spaced repetition queue** running SM-2, so cards come back the day before you would forget them, and a **generator** that turns your own notes into flashcards, a timed practice test or a mind map of the topic.

### Plan your day

A drag-and-drop board across To do, Ongoing, Blocked and Done. Moving a card into Done is what stamps completion, so "tasks completed" is measured rather than asserted.

**Using it.** Add a task with a priority, category and due date, then drag it across as it moves. Done shows the day's closures rather than an ever-growing archive; everything older lives on the page for the day it was finished. The app reports your plan accuracy over time, so routinely planning more than the day holds shows up as a number rather than a feeling.

### Health Booster

Sleep, movement, water, screen time, mindfulness, daylight and breakfast, each against a target you set yourself.

**Using it.** Move the sliders for today and press save. **Health Points** is a weighted score of those against *your* targets, not a generic ideal, and the weighting is printed under the score so it is never mysterious. The guided 4-7-8 breathing timer logs the minutes it actually runs for.

### Personal Journal

A rotating daily prompt, a gratitude list, wins and things to improve.

**Using it.** Write as much or as little as you like; whatever is there is quoted on that night's page. Earlier entries are listed beside today's, so the pattern in what you keep writing down becomes visible.

### Challenge Hub

Eight challenges, each aimed at a specific finding from the research: Deep Study, 5 AM, Digital Detox, Meditation, Social, Eat Well, Workout, Revise Right.

**Using it.** Enroll in one, check in daily, keep the chain unbroken. A challenge you break is not deleted, it just shows the gap. There is a leaderboard across everyone with an account on your instance.

### Feeling Low?

A mood check-in with trigger tags, three coping actions with evidence behind them, a full-screen breathing exercise, and an SOS panel holding your own emergency contacts alongside verified Indian helplines.

**Using it.** Pick a face, tag what is behind it if you want to, and log. Crisis help sits at the top of the page, above the charts, because that is the order it matters in. If low days start clustering, LifeBook says so plainly rather than leaving you to spot it.

### Analytics

Focus over time, focus by weekday, time by subject, and the correlations from *your own logs* - whether your focus really does track last night's sleep, whether screen time really is costing you.

**Using it.** Switch the range between 7, 30 and 90 days. Every insight quotes the number it came from, and there is a table view of the same data for anyone who would rather read it than look at it.

### Your LifeBook

The book opens as a spread - yesterday on the left, today on the right - and turns like one. The sheet hinges on the spine rather than sliding, carries one page on each face, loses light as it stands up and casts a shadow across whatever it passes over, so a turn advances two pages the way a real book does.

**Using it.** Drag a page across and let go past halfway, or flick it, and it finishes on its own; the arrow keys work too. Below a spread's worth of width it becomes a single leaf hinged at the left, and with reduced motion turned on it simply changes page. Jump to any day from the index, export a print-ready PDF at A5, and record an order for a bound copy.

### Resources, Motivation, Feed and Badges

**Resources** holds your notes in one tagged, searchable place; the text ones are indexed and can be fed to the generators. **Motivation Hub** carries quotes, affirmations and stories drawn from the research, plus your own goal board with dates against each goal. **Your Feed** is the research behind LifeBook digested into readable posts you can save, alongside anything anyone on your instance writes. **Badges** are thirteen markers measured from real rows - none of them can be clicked into existence.

## AI, and working without it

**LifeBook works with no API key at all.** A built-in engine reads the same data an LLM would and writes genuinely useful pages from it - streaks, target-versus-actual gaps, week-over-week deltas, real correlations. The prose is templated, the numbers are yours.

Add a **Claude (Anthropic)** or **Gemini (Google)** key in Settings and the same features are written by that model instead. Whichever you supply is used; you can also let LifeBook pick automatically. If a provider errors, rate-limits or is unreachable, LifeBook falls back to the built-in engine and tells you it did - a key upgrades the prose, it never unlocks a feature, and no button is ever dead.

Your key is stored on your own server and never sent back to the browser. The model is called server-side, so the key is never sitting in a page you might screenshot.

## Your data stays yours

Everything lives in a SQLite file on the machine you run this on. There is no hosted service and no telemetry. Nothing leaves the box unless you add an AI key, and then only the day's summary numbers go to the provider you chose. Export the lot as JSON whenever you like, and delete your account and every row with it from Settings.

## Getting started

```sh
npm install
cp .env.example .env    # optional - LifeBook runs fine with none of it set
npm run dev
```

Then open <http://localhost:8082> and create an account. The API runs on <http://localhost:4000>; `npm run dev` starts both.

A brand new account has an empty book, which is correct but shows very little - the reader, the trends and the correlations only say anything once there is a run of days behind them. To look around a book that already has some life in it:

```sh
npm run seed:demo       # user: demo, password: lifebook123
```

That writes 24 days of study blocks, sleep, tasks, habits, moods and journal entries, a study library with decks due for review, then generates a LifePage for each day through the same engine the app uses. The days are shaped, not random: there is a slump in the middle and an exam push at the end, and focus follows the previous night's sleep and screen time - so the analytics have something true to report rather than noise. Add `-- --reset` to rebuild the account from scratch.

For a single-process deployment:

```sh
npm run build
npm start               # serves the built app and the API together on :4000
```

## Honest limits

- **Ordering a printed copy records the order and produces the print-ready file.** It is not wired to a print shop or a payment provider - this runs on your own server, so there is nobody to bill you. Export the PDF from the print view and take it to any binding service.
- **Text extraction is text-only.** `.txt`, `.md`, `.csv` and similar are indexed and can generate study material. PDFs and Word documents are stored and downloadable, but their contents are not extracted - paste the text if you want cards from them.
- **The community features are per-instance.** The leaderboard and feed span everyone with an account on your server. There is no federation between installations.
- **LifeBook is not a clinical tool.** The mood tracking and Feeling Low page are there to make patterns visible and to put real helplines one tap away. They are not a diagnosis and not therapy.

## Contributors

<table>
  <tr>
    <td align="center">
      <a href="https://github.com/Dileepadari">
        <img src="https://avatars.githubusercontent.com/u/86234192?v=4" width="90" alt="" loading="lazy" style="border-radius:50%">
        <br><sub><b>Dileep Adari</b></sub>
      </a>
      <br><sub>Author and maintainer</sub>
    </td>
  </tr>
</table>

The 2024 Design Thinking study LifeBook is built from was carried out by **Ashwani Raj**, **G Yuvaraj** and **Adari Dileep**. The interviews, survey and literature review are theirs; the application is a build of what they found.

## Contributing

Issues and pull requests are welcome at [github.com/Dileepadari/LifeBook](https://github.com/Dileepadari/LifeBook).

Before opening a pull request:

```sh
npm run verify      # typecheck, lint and a production build
```

CI runs the same checks on every push. Please keep commit messages to a single line, and match the surrounding code rather than introducing a new style. [DEVDOC.md](./DEVDOC.md) explains the architecture, the data model and where things live.

If you change `README.md`, regenerate its light-mode twin so the pair stays in sync:

```sh
npm run docs:readme-light
```

## License

MIT. See [LICENSE](./LICENSE).
