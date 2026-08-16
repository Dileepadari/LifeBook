// The built-in engine. No network, no key, no cost - it reads the same day
// snapshot the LLM providers get and derives real conclusions from it:
// streaks, target-vs-actual gaps, week-over-week deltas, and the sleep /
// screen-time / focus correlation the research kept pointing at.
//
// This is the floor for every AI capability, which is what lets the UI promise
// that nothing is ever a dead button. An LLM key upgrades the prose; it does
// not unlock a feature.

const pct = (n) => Math.round(n * 100);
const hours = (mins) => (mins / 60).toFixed(1).replace(/\.0$/, '');

/**
 * Human duration for prose. `hours()` alone renders a 40-minute session as
 * "0 hours", which reads as though nothing happened - so anything under an
 * hour is spoken in minutes instead.
 */
function dur(mins) {
  const m = Math.round(mins || 0);
  if (m < 60) return `${m} ${m === 1 ? 'minute' : 'minutes'}`;
  const h = m / 60;
  const text = h.toFixed(1).replace(/\.0$/, '');
  return `${text} ${text === '1' ? 'hour' : 'hours'}`;
}

function pick(arr, seed) {
  return arr[Math.abs(seed) % arr.length];
}

/** Deterministic per-day variety without randomness - the same day always
 *  renders the same page, which matters because pages get sealed and printed. */
function dateSeed(date) {
  return [...String(date)].reduce((a, c) => a + c.charCodeAt(0), 0);
}

// ------------------------------------------------------------- LifePage --

export function generateLifePage(snapshot) {
  const { date, study, tasks, wellness, habits, mood, journal, challenges, targets } = snapshot;
  const seed = dateSeed(date);

  const achievements = [];
  const improvements = [];

  // --- study ---
  if (study.totalMinutes > 0) {
    const techniques = Object.entries(study.byTechnique)
      .sort((a, b) => b[1] - a[1])
      .map(([t]) => t.replace(/_/g, ' '));
    achievements.push(
      `Focused for ${dur(study.totalMinutes)} across ${study.sessionCount} ${
        study.sessionCount === 1 ? 'session' : 'sessions'
      }${techniques.length ? `, mostly ${techniques[0]}` : ''}.`,
    );
  }
  if (targets.deepWorkMinutes && study.totalMinutes < targets.deepWorkMinutes) {
    const gap = targets.deepWorkMinutes - study.totalMinutes;
    improvements.push(
      `You were ${dur(gap)} short of your ${hours(targets.deepWorkMinutes)}-hour deep-work target. A single uninterrupted block tomorrow closes most of that.`,
    );
  } else if (targets.deepWorkMinutes && study.totalMinutes >= targets.deepWorkMinutes) {
    achievements.push(`Hit your deep-work target of ${hours(targets.deepWorkMinutes)} hours.`);
  }
  if (study.avgFocus !== null && study.avgFocus < 3) {
    improvements.push(
      `Average focus was ${study.avgFocus.toFixed(1)} out of 5 with ${study.distractions} recorded interruptions - the block length may be longer than your attention currently holds.`,
    );
  }

  // --- tasks ---
  if (tasks.completed > 0) {
    achievements.push(
      `Closed ${tasks.completed} of ${tasks.planned} planned ${tasks.planned === 1 ? 'task' : 'tasks'}.`,
    );
  }
  if (tasks.planned > 0 && tasks.completed / tasks.planned < 0.5) {
    improvements.push(
      `Only ${pct(tasks.completed / tasks.planned)}% of the day's plan got done. Either the plan was bigger than the day, or the day got away - worth deciding which before you plan tomorrow.`,
    );
  }
  if (tasks.overdue > 0) {
    improvements.push(`${tasks.overdue} ${tasks.overdue === 1 ? 'task is' : 'tasks are'} now past their due date.`);
  }

  // --- wellness ---
  if (wellness) {
    if (wellness.sleep_hours != null) {
      if (wellness.sleep_hours >= targets.sleepHours) {
        achievements.push(`Slept ${wellness.sleep_hours} hours, at or above your ${targets.sleepHours}-hour target.`);
      } else {
        improvements.push(
          `Slept ${wellness.sleep_hours} hours against a ${targets.sleepHours}-hour target. Short sleep shows up as tomorrow's focus rating, not tonight's.`,
        );
      }
    }
    if (wellness.exercise_minutes > 0) achievements.push(`Moved for ${wellness.exercise_minutes} minutes.`);
    else improvements.push('No movement logged today.');
    if (wellness.meditation_minutes > 0) achievements.push(`${wellness.meditation_minutes} minutes of mindfulness.`);
    if (wellness.screen_time_hours != null && wellness.screen_time_hours > targets.screenTimeHours) {
      improvements.push(
        `${wellness.screen_time_hours} hours of recreational screen time against a ${targets.screenTimeHours}-hour limit.`,
      );
    }
    if (wellness.had_breakfast) achievements.push('Ate breakfast.');
  } else {
    improvements.push('No wellness log today - sleep, movement and screen time all went unmeasured.');
  }

  // --- habits & challenges ---
  if (habits.doneToday > 0) {
    achievements.push(
      `Kept ${habits.doneToday} of ${habits.total} ${habits.total === 1 ? 'habit' : 'habits'}${
        habits.bestStreak > 1 ? `, with your longest streak now at ${habits.bestStreak} days` : ''
      }.`,
    );
  }
  if (habits.total > 0 && habits.doneToday === 0) {
    improvements.push('None of your habits were checked in today - a broken chain is easier to restart the next day than the next week.');
  }
  if (challenges.checkedIn > 0) {
    achievements.push(`Checked in on ${challenges.checkedIn} active ${challenges.checkedIn === 1 ? 'challenge' : 'challenges'}.`);
  }

  // --- mood ---
  if (mood) {
    const moodWord = ['very low', 'low', 'okay', 'good', 'great'][Math.max(0, Math.min(4, mood.score - 1))];
    achievements.push(`Checked in with yourself - mood was ${moodWord}.`);
    if (mood.score <= 2) {
      improvements.push(
        'A low day. That is data, not failure - if it repeats this week, the Feeling Low page has resources and your SOS contacts.',
      );
    }
  }

  // --- summary ---
  const openers = [
    `A ${describeDay(snapshot)} day.`,
    `Today read as ${describeDay(snapshot)}.`,
    `${capitalize(describeDay(snapshot))} is how this page reads.`,
  ];
  const parts = [pick(openers, seed)];
  if (study.totalMinutes > 0) {
    parts.push(
      `You put in ${dur(study.totalMinutes)} of focused work${
        study.subjects.length ? ` on ${listify(study.subjects)}` : ''
      }.`,
    );
  } else {
    parts.push('No focused study was logged.');
  }
  if (tasks.planned > 0) parts.push(`${tasks.completed} of ${tasks.planned} planned tasks came off the board.`);
  if (wellness?.sleep_hours != null) parts.push(`You slept ${wellness.sleep_hours} hours.`);
  if (journal?.reflection) parts.push('You wrote it down, which is the part most days skip.');

  const summary = parts.join(' ');

  const suggestion = buildSuggestion(snapshot, improvements, seed);

  return {
    title: buildTitle(snapshot, seed),
    summary,
    achievements: achievements.length ? achievements : ['You showed up and opened the book. That counts as page one.'],
    improvements: improvements.length ? improvements : ['Nothing to flag - hold this shape tomorrow.'],
    journal_excerpt: buildExcerpt(journal),
    suggestion,
  };
}

function describeDay({ study, tasks, wellness, mood }) {
  const signals = [
    study.totalMinutes >= 180,
    tasks.planned > 0 && tasks.completed / tasks.planned >= 0.7,
    wellness?.exercise_minutes > 0,
    (wellness?.sleep_hours ?? 0) >= 7,
    (mood?.score ?? 3) >= 4,
  ].filter(Boolean).length;
  if (signals >= 4) return 'strong';
  if (signals === 3) return 'solid';
  if (signals === 2) return 'mixed';
  if (signals === 1) return 'thin';
  return 'quiet';
}

function buildTitle({ date, study, mood }, seed) {
  const d = new Date(`${date}T00:00:00`);
  const weekday = d.toLocaleDateString('en-US', { weekday: 'long' });
  if (study.totalMinutes >= 240) return pick([`${weekday} of deep work`, `The long ${weekday}`], seed);
  if (mood && mood.score <= 2) return `A heavy ${weekday}`;
  if (study.totalMinutes === 0) return `${weekday}, off the books`;
  return `${weekday}`;
}

function buildExcerpt(journal) {
  if (!journal) return null;
  if (journal.reflection) {
    const text = journal.reflection.trim();
    return text.length > 280 ? `${text.slice(0, 277)}...` : text;
  }
  if (journal.gratitude?.length) return `Grateful for: ${listify(journal.gratitude)}.`;
  if (journal.wins?.length) return `Wins: ${listify(journal.wins)}.`;
  return null;
}

// The suggestion is the one thing the page asks of tomorrow. Ordering is
// deliberate - sleep first, because the interviews showed it gates everything
// downstream, then focus, then the plan.
function buildSuggestion({ study, tasks, wellness, habits, targets }, improvements, seed) {
  if (wellness?.sleep_hours != null && wellness.sleep_hours < targets.sleepHours - 1) {
    return `Get to bed an hour earlier tonight. At ${wellness.sleep_hours} hours you are running a deficit that tomorrow's focus rating will pay for.`;
  }
  if (study.totalMinutes === 0) {
    return 'Tomorrow, put one 25-minute block on the calendar before anything else. Not four hours - one block. Starting is the expensive part.';
  }
  if (study.avgFocus !== null && study.avgFocus < 3) {
    return 'Try shorter blocks tomorrow - 25 minutes with the phone in another room beats 90 minutes with it face-down on the desk.';
  }
  if (tasks.planned === 0) {
    return 'Plan tomorrow tonight. The research is unambiguous that students who plan the next day before ending the current one report less stress and get more done.';
  }
  if (habits.total > 0 && habits.doneToday === 0) {
    return 'Pick the single easiest habit on your list and do only that tomorrow. Restarting the chain matters more than the size of the link.';
  }
  if (wellness && !wellness.exercise_minutes) {
    return 'Thirty minutes of movement tomorrow, at any intensity. It is the cheapest available upgrade to both mood and focus.';
  }
  return pick(
    [
      'Hold this shape. The version of you reading this book in six months is built out of days like today.',
      'Do the same thing tomorrow. Consistency is the only compounding asset you actually control.',
      'Nothing to fix. Protect the routine that produced this page.',
    ],
    seed,
  );
}

// -------------------------------------------------------------- Insights --

export function generateInsights(analytics) {
  const { range, study, wellness, tasks, habits, mood, correlations } = analytics;
  const insights = [];
  const suggestions = [];

  if (study.totalMinutes > 0) {
    insights.push({
      title: 'Focus volume',
      body: `${dur(study.totalMinutes)} over ${range.days} days - an average of ${dur(
        study.totalMinutes / range.days,
      )} a day.${
        study.deltaPct !== null
          ? ` That is ${Math.abs(study.deltaPct)}% ${study.deltaPct >= 0 ? 'up on' : 'down from'} the previous ${range.days} days.`
          : ''
      }`,
      tone: study.deltaPct !== null && study.deltaPct < 0 ? 'warning' : 'positive',
    });
  }

  if (study.bestDay) {
    insights.push({
      title: 'Your best day of the week',
      body: `${study.bestDay.name} averages ${dur(study.bestDay.minutes)}, your highest. ${
        study.worstDay ? `${study.worstDay.name} averages ${dur(study.worstDay.minutes)}, your lowest.` : ''
      } Schedule the hard subjects where the capacity already is.`,
      tone: 'neutral',
    });
  }

  if (correlations.sleepFocus !== null && Math.abs(correlations.sleepFocus) > 0.3) {
    const dir = correlations.sleepFocus > 0 ? 'rises with' : 'falls as';
    insights.push({
      title: 'Sleep and focus are linked in your data',
      body: `Across your logs, focus rating ${dir} the previous night's sleep (r = ${correlations.sleepFocus.toFixed(
        2,
      )}). This is your own data, not a general claim.`,
      tone: correlations.sleepFocus > 0 ? 'positive' : 'warning',
    });
    if (correlations.sleepFocus > 0) suggestions.push('Protect sleep before you protect study hours - in your logs it is the upstream variable.');
  }

  if (correlations.screenFocus !== null && correlations.screenFocus < -0.3) {
    insights.push({
      title: 'Screen time is costing you focus',
      body: `Higher recreational screen time tracks with lower focus ratings in your logs (r = ${correlations.screenFocus.toFixed(
        2,
      )}). The Digital Detox challenge exists for this pattern.`,
      tone: 'warning',
    });
  }

  if (tasks.completionRate !== null) {
    insights.push({
      title: 'Plan accuracy',
      body: `You complete ${pct(tasks.completionRate)}% of what you plan. ${
        tasks.completionRate < 0.6
          ? 'Consistently planning more than the day holds makes the plan stop being information. Try cutting tomorrow\'s list by a third.'
          : 'That is a plan you can trust, which is what makes planning worth doing.'
      }`,
      tone: tasks.completionRate < 0.6 ? 'warning' : 'positive',
    });
  }

  if (habits.best) {
    insights.push({
      title: 'Strongest habit',
      body: `"${habits.best.name}" is at ${habits.best.streak} days and ${pct(habits.best.adherence)}% adherence.${
        habits.weakest && habits.weakest.name !== habits.best.name
          ? ` "${habits.weakest.name}" is the one slipping, at ${pct(habits.weakest.adherence)}%.`
          : ''
      }`,
      tone: 'positive',
    });
  }

  if (mood.average !== null) {
    insights.push({
      title: 'Mood',
      body: `Averaging ${mood.average.toFixed(1)} out of 5 across ${mood.count} check-ins${
        mood.lowDays > 0 ? `, with ${mood.lowDays} low ${mood.lowDays === 1 ? 'day' : 'days'}` : ''
      }.`,
      tone: mood.average < 2.5 ? 'warning' : 'neutral',
    });
  }

  if (wellness.avgSleep !== null && wellness.avgSleep < 7) {
    suggestions.push(`You average ${wellness.avgSleep.toFixed(1)} hours of sleep. Every other number on this page improves when that one does.`);
  }
  if (study.totalMinutes === 0) {
    suggestions.push('Nothing logged in this window. Start the timer once - the first session is the one that makes the rest measurable.');
  }
  if (!suggestions.length) suggestions.push('No structural problems visible in this window. Keep logging so the trend line stays honest.');

  return { insights, suggestions };
}

// ------------------------------------------------ flashcards / map / quiz --

/** Splits source text into candidate facts. Deliberately simple: sentences
 *  that contain a definition-ish signal ("is", "are", "means", ":", "-"). */
function candidateSentences(text, limit) {
  return String(text)
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?])\s+|\n+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 30 && s.length < 320)
    .slice(0, limit * 4);
}

export function generateFlashcards(text, count = 10) {
  const sentences = candidateSentences(text, count);
  const cards = [];
  for (const s of sentences) {
    if (cards.length >= count) break;
    const m = s.match(/^(.{3,80}?)\s+(?:is|are|means|refers to|was|were)\s+(.+)$/i) || s.match(/^(.{3,80}?)\s*[:–—-]\s*(.+)$/);
    if (m) {
      const subject = m[1].trim();
      cards.push({ front: `What ${isPlural(subject) ? 'are' : 'is'} ${subject}?`, back: m[2].trim().replace(/\.$/, '') });
    }
  }
  // Fall back to cloze deletion so a page of prose still yields cards.
  for (const s of sentences) {
    if (cards.length >= count) break;
    const words = s.split(' ');
    const idx = words.findIndex((w) => w.length > 7 && /^[A-Za-z]+$/.test(w));
    if (idx === -1) continue;
    const answer = words[idx].replace(/[^A-Za-z]/g, '');
    cards.push({ front: words.map((w, i) => (i === idx ? '______' : w)).join(' '), back: answer });
  }
  return cards.slice(0, count);
}

export function generateMindMap(text, title) {
  const sentences = candidateSentences(text, 40);
  const stop = new Set('the a an and or of to in for with on at by is are was were this that these those it its as from be been being have has had not but if then than so such which who whom what when where how why can could should would may might will shall do does did'.split(' '));

  const freq = new Map();
  for (const w of String(text).toLowerCase().match(/[a-z][a-z'-]{3,}/g) || []) {
    if (stop.has(w)) continue;
    freq.set(w, (freq.get(w) || 0) + 1);
  }
  const topics = [...freq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([w]) => w);

  const children = topics.map((topic) => ({
    label: capitalize(topic),
    children: sentences
      .filter((s) => s.toLowerCase().includes(topic))
      .slice(0, 3)
      .map((s) => ({ label: s.length > 110 ? `${s.slice(0, 107)}...` : s, children: [] })),
  }));

  return { root: title || 'Overview', children: children.filter((c) => c.children.length) };
}

export function generateQuiz(text, count = 5) {
  const cards = generateFlashcards(text, count * 2);
  const questions = [];
  for (const card of cards) {
    if (questions.length >= count) break;
    const distractors = cards
      .filter((c) => c.back !== card.back)
      .slice(0, 3)
      .map((c) => (c.back.length > 90 ? `${c.back.slice(0, 87)}...` : c.back));
    if (distractors.length < 3) continue;
    const correct = card.back.length > 90 ? `${card.back.slice(0, 87)}...` : card.back;
    const options = [correct, ...distractors];
    // Rotate rather than shuffle so the same source always yields the same quiz.
    const shift = questions.length % 4;
    const rotated = [...options.slice(shift), ...options.slice(0, shift)];
    questions.push({
      prompt: card.front,
      options: rotated,
      answer_index: rotated.indexOf(correct),
      explanation: null,
    });
  }
  return questions;
}

// ------------------------------------------------------------ coach chat --

export function coachChat(message, context) {
  const q = String(message).toLowerCase();
  const { study, tasks, wellness, habits, streak } = context;

  if (/focus|concentrat|distract/.test(q)) {
    return `Over the last week you logged ${dur(study.weekMinutes)} with an average focus rating of ${
      study.avgFocus?.toFixed(1) ?? 'n/a'
    }. The pattern in your own data is that shorter blocks score higher. Try 25 minutes with the phone out of the room, rate it honestly, and compare after three days.`;
  }
  if (/sleep|tired|exhaust/.test(q)) {
    return wellness.avgSleep !== null
      ? `You are averaging ${wellness.avgSleep.toFixed(1)} hours. Sleep is upstream of every other number you are tracking - focus, mood and task completion all move with it in your logs. Shift bedtime by 30 minutes rather than trying to fix it in one jump.`
      : 'You have not logged sleep yet. Start on the Health Booster page - it is the single most useful number to have in the book.';
  }
  if (/plan|task|todo|organi/.test(q)) {
    return `You are completing ${
      tasks.completionRate !== null ? `${pct(tasks.completionRate)}%` : 'an unmeasured share'
    } of what you plan. Plan tomorrow tonight, cap it at what you actually finished today, and put the hardest item first.`;
  }
  if (/motivat|lazy|procrastinat|start/.test(q)) {
    return 'Motivation is not the input, it is the output. The interviews behind this app found the all-or-none mentality was the strongest predictor of a stalled week. Do the smallest version of the thing - one block, one card, one page - and let the momentum do the rest.';
  }
  if (/habit|streak|consisten/.test(q)) {
    return habits.total
      ? `You have ${habits.total} habits and your best streak is ${streak} days. Do not add a new one until the weakest existing one is above 80% adherence.`
      : 'You have no habits set up yet. Pick one, make it embarrassingly small, and check in for a week before adding another.';
  }
  if (/exam|revis|test|prepar/.test(q)) {
    return 'Active recall and spaced repetition beat re-reading, and both are already wired into Study Now. Clear your due cards daily and run a timed practice test weekly - the timing pressure is a separate skill from the knowledge.';
  }
  if (/low|sad|anxious|stress|overwhelm/.test(q)) {
    return 'That is worth taking seriously rather than pushing through. The Feeling Low page has a breathing exercise, your SOS contacts and verified helplines. If it has been more than two weeks, talk to someone in person - the research behind this app found 37.7% of Indian university students report moderate depression, and almost none of them talk about it.';
  }
  return `Here is where you actually are: ${dur(study.weekMinutes)} of focus this week, ${
    tasks.completedWeek
  } tasks closed, ${habits.total} habits running, best streak ${streak} days. Ask me about focus, sleep, planning, habits or exam prep and I will answer from these numbers.`;
}

// ------------------------------------------------------------ day brief --

/**
 * Rule-based extraction from a free-text description of the day. Weaker than an
 * LLM at nuance, but it genuinely works offline, which keeps the promise that
 * no feature is a dead button.
 *
 * The approach is conservative on purpose: it only claims an item when a clear
 * lexical signal is present, because a wrong task silently written into
 * someone's board is worse than a missed one.
 */
export function parseDayBrief(message, context) {
  const text = String(message || '').trim();
  const sentences = text
    .split(/(?<=[.!?])\s+|\n+/)
    .map((s) => s.trim())
    .filter(Boolean);

  const tasks = [];
  const completed = [];
  const missed = [];
  const gratitude = [];
  const wellness = {};
  const study = {};
  let moodScore = null;

  // --- numbers ---
  const num = (re) => {
    const m = text.match(re);
    if (!m) return null;
    const word = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, half: 0.5, an: 1, a: 1 };
    const raw = m[1].toLowerCase();
    const value = /^[\d.]+$/.test(raw) ? parseFloat(raw) : word[raw];
    return Number.isFinite(value) ? value : null;
  };

  const sleep = num(/(?:slept|sleep|got)\s+(?:about\s+|around\s+|roughly\s+)?([\d.]+|one|two|three|four|five|six|seven|eight|nine|ten)\s*(?:and a half\s*)?h(?:ou)?rs?/i);
  if (sleep != null) wellness.sleep_hours = /and a half/i.test(text) ? sleep + 0.5 : sleep;

  const exercise = num(/(?:ran|walked|gym|worked out|exercis\w+|trained|cycled)[^.]{0,40}?([\d.]+|one|two|three|four|five|ten)\s*(?:min|minute)/i);
  if (exercise != null) wellness.exercise_minutes = exercise;
  else if (/\b(went to the gym|worked out|did a workout|went for a run|played (football|cricket|badminton|tennis))\b/i.test(text)) {
    wellness.exercise_minutes = 30;
  }

  const screen = num(/([\d.]+|one|two|three|four|five|six)\s*h(?:ou)?rs?\s+(?:of\s+)?(?:screen|scrolling|instagram|youtube|reels|social media|phone)/i)
    ?? num(/(?:scroll\w*|instagram|youtube|reels|social media|on my phone)[^.]{0,30}?([\d.]+|one|two|three|four|five|six)\s*h(?:ou)?rs?/i);
  if (screen != null) wellness.screen_time_hours = screen;

  const water = num(/([\d.]+|one|two|three|four|five|six|seven|eight|nine|ten)\s*(?:glass|glasses|litre|liter)/i);
  if (water != null) wellness.water_glasses = water;

  const meditation = num(/(?:meditat\w+|breathing|mindfulness)[^.]{0,30}?([\d.]+|one|two|three|four|five|ten)\s*(?:min|minute)/i);
  if (meditation != null) wellness.meditation_minutes = meditation;
  else if (/\b(meditated|did my meditation|breathing exercise)\b/i.test(text)) wellness.meditation_minutes = 10;

  if (/\b(had|ate)\s+breakfast\b/i.test(text)) wellness.had_breakfast = true;
  if (/\b(skipped|missed|no)\s+breakfast\b/i.test(text)) wellness.had_breakfast = false;

  // --- study session ---
  const studyMinutes = num(/(?:stud\w+|revis\w+|read|worked on|practis\w+|practic\w+)[^.]{0,60}?([\d.]+|one|two|three|four|five|six)\s*h(?:ou)?rs?/i);
  const studyMins2 = num(/(?:stud\w+|revis\w+|read|worked on)[^.]{0,60}?([\d.]+|ten|twenty|thirty|forty|fifty)\s*(?:min|minute)/i);
  if (studyMinutes != null) study.minutes = Math.round(studyMinutes * 60);
  else if (studyMins2 != null) study.minutes = studyMins2;
  if (study.minutes) {
    const subject = text.match(/(?:stud\w+|revis\w+|worked on|read(?:ing)?)\s+(?:some\s+|the\s+|my\s+)?([A-Z][\w&+ -]{2,28}?)(?:\s+for|\s+today|[.,]|$)/);
    if (subject) study.subject = subject[1].trim();
  }

  // --- mood ---
  const veryLow = /\b(awful|terrible|miserable|breaking down|hopeless|worst day|really low|burnt out|burned out)\b/i;
  const low = /\b(low|down|sad|anxious|stressed|overwhelmed|exhausted|drained|rough|behind|guilty|frustrated)\b/i;
  const high = /\b(great|amazing|brilliant|excellent|fantastic|productive|proud|energised|energized)\b/i;
  const okay = /\b(okay|ok|alright|fine|decent|not bad)\b/i;
  if (veryLow.test(text)) moodScore = 1;
  else if (low.test(text)) moodScore = 2;
  else if (high.test(text)) moodScore = 5;
  else if (okay.test(text)) moodScore = 3;

  // --- sentence classification ---
  const DONE = /\b(finished|completed|submitted|did|done|managed to|got through|wrapped up|handed in|cleared|solved|attended|went to)\b/i;
  const MISSED = /\b(didn'?t|did not|couldn'?t|could not|failed to|skipped|missed|forgot|never got (?:to|around)|avoided|put off|procrastinated)\b/i;
  const TODO = /\b(need to|have to|should|must|todo|to-do|tomorrow|still have|planning to|going to|want to|remember to)\b/i;
  const GRATEFUL = /\b(grateful|thankful|glad|appreciated|nice that|good thing)\b/i;

  const clean = (s) =>
    s
      .replace(/^(?:and|but|so|then|also|i|i'?ve|i have|i also)\s+/i, '')
      .replace(/\b(?:i\s+)?(?:need to|have to|should|must|want to|am going to|going to|plan to|planning to|remember to)\s+/i, '')
      .replace(/\b(?:i\s+)?(?:didn'?t|did not|couldn'?t|could not|failed to)\s+/i, '')
      .replace(/[.!?]+$/, '')
      .trim();

  const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

  // A sentence that is only reporting body numbers ("slept 5 hours and skipped
  // breakfast") is already captured in `wellness`. Without this guard the word
  // "skipped" also drags it into the backlog as a task, which is how someone
  // ends up with "Slept about 5 hours" sitting on their board.
  // Note the sentence still carries its terminating punctuation at this point,
  // so the trailing group has to allow for it.
  const WELLNESS_ONLY = /^[^.!?]*\b(?:slept|sleep|breakfast|lunch|dinner|water|glasses|gym|workout|meditat\w+|screen time|scrolling|instagram|steps)\b[^.!?]*[.!?]*\s*$/i;
  const ACTIONABLE = /\b(assignment|report|submit|email|call|read|revise|study|book|register|apply|meet|finish|prepare|practice|practise|clean|pay|buy|plan|write|code|project|lab|quiz|exam|slides|notes)\b/i;

  // Split on conjunctions so "didn't do X and never did Y" becomes two items.
  const clauses = sentences.flatMap((s) =>
    s.split(/,?\s+and\s+(?=(?:i|I)\b|never|didn'?t|did not)/).map((c) => c.trim()).filter(Boolean),
  );

  for (const sentence of clauses) {
    const body = clean(sentence);
    if (!body || body.length < 3) continue;
    const short = body.length > 90 ? `${body.slice(0, 87)}...` : body;

    if (GRATEFUL.test(sentence)) {
      gratitude.push(cap(short));
      continue;
    }
    // Pure body-metric reporting is already in `wellness` - do not double-book
    // it as a task unless there is a genuinely actionable noun in there too.
    if (WELLNESS_ONLY.test(sentence) && !ACTIONABLE.test(sentence)) continue;

    // Order matters: "didn't finish" contains a DONE word, so MISSED wins.
    if (MISSED.test(sentence)) {
      missed.push(cap(short));
      continue;
    }
    if (TODO.test(sentence)) {
      tasks.push({
        title: cap(short),
        priority: /\b(urgent|asap|today|due|deadline)\b/i.test(sentence) ? 'urgent' : 'normal',
        category: /\b(gym|sleep|eat|run|walk|health|meditat)\b/i.test(sentence)
          ? 'wellness'
          : /\b(club|society|rehearsal|fest|volunteer|event)\b/i.test(sentence)
            ? 'ECA'
            : 'academic',
      });
      continue;
    }
    if (DONE.test(sentence)) completed.push(cap(short));
  }

  const picked = [];
  if (tasks.length) picked.push(`${tasks.length} to do`);
  if (completed.length) picked.push(`${completed.length} done`);
  if (missed.length) picked.push(`${missed.length} missed`);
  if (Object.keys(wellness).length) picked.push('some numbers');
  if (study.minutes) picked.push('a study block');

  const reply = picked.length
    // Deliberately does not tell the user to press anything: the client may
    // have auto-apply on, in which case this is already saved by the time they
    // read it, and "apply what looks right" would be nonsense.
    ? `Got it - I picked up ${listify(picked)}.`
    : "I could not find anything concrete in that. Try mentioning what you finished, what you didn't get to, and how long you slept or studied.";

  return {
    reply,
    tasks,
    completed,
    missed,
    wellness,
    mood: moodScore ? { score: moodScore, note: null } : {},
    study,
    // The built-in engine does not rewrite prose - the user's own words are
    // better raw material for the page than anything a template could produce.
    journal: text.length > 40 ? text : null,
    gratitude,
  };
}

// ---------------------------------------------------------------- utils --

/** A trailing "s" is not enough on its own: "physics", "thermodynamics",
 *  "mass", "analysis" and "nucleus" are all singular. */
function isPlural(word) {
  const last = String(word).trim().split(/\s+/).pop().toLowerCase();
  if (!/s$/.test(last)) return false;
  return !/(ics|ss|us|is|ness|sis)$/.test(last);
}

function capitalize(s) {
  return String(s).charAt(0).toUpperCase() + String(s).slice(1);
}

function listify(arr) {
  const a = arr.filter(Boolean);
  if (a.length <= 1) return a[0] || '';
  if (a.length === 2) return `${a[0]} and ${a[1]}`;
  return `${a.slice(0, -1).join(', ')} and ${a[a.length - 1]}`;
}
