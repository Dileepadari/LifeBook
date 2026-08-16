<p align="center">
  <img src="./src/assets/logo-mark.png" alt="" width="96" />
</p>

# LifeBook

Your life is a book, and every day is one page. LifeBook turns what you study, how you sleep, what you commit to and what you reflect on into a single dated page - and enough pages into a book you can hold in print.

> **Building or deploying LifeBook?** Architecture, data model, the AI layer, API surface, environment variables and deployment steps are in **[DEVDOC.md](./DEVDOC.md)**.

---

## Where this came from

LifeBook is the built version of a 2024 Design Thinking study on student study-life balance by Ashwani Raj, G Yuvaraj and Adari Dileep - 22 in-depth interviews, a survey, and a review of 15 papers on study technique, time management, extracurriculars and student wellbeing.

The finding the whole product exists to answer, verbatim from the interview analysis:

> They dont measure their life hence cant see their improvements/backlogs.

Supporting findings the app is shaped around: most students did no exercise or mindfulness at all, could not delay gratification, had no organised study schedule, did shallow rather than deep work, and treated motivation as all-or-nothing. Almost none of them were tracking any of it.

So LifeBook is an instrument first and a journal second. Every screen exists to produce a number or a sentence that ends up on a page.

## The loop

```
Study Now ─┐
Plan your day ─┤
Health Booster ─┤
Challenge Hub ─┼──▶  insight engine  ──▶  one LifePage per day  ──▶  your LifeBook
Motivation Hub ─┤    (summary, wins,       (dated; sealed when              (printable)
Your Feed ─┤          gaps, one thing       the day is done)
Personal Journal ─┤    for tomorrow)
Feeling Low? ─┘
```

Log through the day, then close the day. LifeBook reads everything you recorded and writes the page: what happened, what went well, what to tighten, a quote from your own journal, and the single most useful thing to change tomorrow.

## What you can do

### Close the day
One button, on every screen. It reads that day's sessions, tasks, sleep, movement, habits, mood and journal, and writes a dated page. Pages can be **sealed** once you have read them - a sealed page is what gets bound into a printed book, so LifeBook refuses to quietly rewrite one.

### Just say it
A small assistant sits in the corner of every screen. Tell it about your day the way you would tell a friend - "slept 5 hours, finished the problem set, still haven't done the ML assignment, need to book the exam slot" - and it files the whole thing: to-dos onto the board, finished things as completed, the ones you missed as an honest backlog, the sleep and screen time into Health Booster, the study block into your focus history, the mood into your check-ins, the gratitude into your journal.

It shows you every row it wrote and keeps an **Undo** next to it, so a misread sentence costs one click. If you would rather read before it writes, turn *Auto* off and the same card grows a Save button instead. It will not turn a feeling into a task: say "I feel behind on everything" and you get a mood entry, not five invented chores.

### Study Now
A real focus timer that writes a real row: planned versus actual minutes, technique, subject, an honest focus rating and an interruption count. That rating is the number every insight about your focus is built from.

Alongside it, a spaced-repetition queue running SM-2 - cards come back the day before you would forget them - and a generator that turns your own notes into flashcards, a timed practice test, or a mind map of the topic.

### Plan your day
A drag-and-drop board across To do, Ongoing, Blocked and Done. Moving a card into Done is what stamps completion, so "tasks completed" is measured rather than asserted. The app tells you your plan accuracy over time; if you routinely plan more than the day holds, that shows up as a number.

### Health Booster
Sleep, movement, water, screen time, mindfulness, daylight and breakfast, each against a target you set yourself. Health Points is a weighted score of those against *your* targets, not a generic ideal. A guided 4-7-8 breathing timer logs the minutes it runs.

### Personal Journal
A rotating daily prompt, a gratitude list, wins and things to improve. Whatever you write is quoted on that night's page.

### Challenge Hub
Eight challenges, each aimed at a specific finding from the research - Deep Study, 5 AM, Digital Detox, Meditation, Social, Eat Well, Workout, Revise Right. Enroll, check in daily, keep a streak. There is a leaderboard across everyone on your instance.

### Feeling Low?
A mood check-in with trigger tags, three coping actions with evidence behind them, a full-screen breathing exercise, and an SOS panel holding your own emergency contacts plus verified Indian helplines. Crisis help sits at the top of the page, above the charts. If low days start clustering, LifeBook says so plainly.

### Analytics
Focus over time, focus by weekday, time by subject, and the correlations from *your own logs* - whether your focus really does track last night's sleep, whether screen time really is costing you. Every insight quotes the number it came from. There is a table view of the same data.

### Your LifeBook
Read the whole book a page at a time, jump to any day, export a print-ready PDF at A5, and record an order for a bound copy.

### Also
Resources (upload notes, tag them, and feed the text ones to the generators), Motivation Hub (quotes, affirmations and stories drawn from the research, plus your own goal board), Your Feed (research digests you can save, and posts anyone on the instance writes), Badges (thirteen, all measured from real rows - none can be clicked into existence), and a Profile where your goals and targets live.

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
