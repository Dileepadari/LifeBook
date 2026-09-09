/**
 * Prompt text and the JSON schemas shared by both AI providers, so a page from
 * Claude and a page from Gemini have the same shape.
 */
// Shared prompt text and JSON schemas, used identically by the Anthropic and
// Gemini clients so switching provider changes the voice, never the shape.

export const SYSTEM = `You are the writer of a student's LifeBook - one page per day, in a book they will eventually hold in print.

You are given a factual snapshot of one day: study sessions, tasks, sleep and movement, habit check-ins, mood, and anything they journalled. Your job is to turn those numbers into a page worth re-reading in a year.

Rules that matter:
- Never invent a number, an event, or an activity that is not in the snapshot. If they logged nothing, say so plainly.
- Write to the person, as "you". Warm, specific, and honest - a good coach, not a cheerleader.
- Do not moralise about a bad day. A thin day is information, not a failure.
- Improvements must be actionable and small enough to do tomorrow.
- No emoji. No markdown formatting inside field values. Plain sentences.`;

export const LIFEPAGE_SCHEMA = {
  type: 'object',
  properties: {
    title: { type: 'string', description: 'Three to six words naming the day. No date.' },
    summary: { type: 'string', description: 'Two to four sentences narrating the day from the snapshot.' },
    achievements: { type: 'array', items: { type: 'string' }, description: 'What genuinely went well. One sentence each.' },
    improvements: { type: 'array', items: { type: 'string' }, description: 'What to tighten, each doable tomorrow.' },
    journal_excerpt: { type: ['string', 'null'], description: "A short quote from their own journal text, verbatim. Null if they wrote nothing." },
    suggestion: { type: 'string', description: 'The single most useful thing to change tomorrow.' },
  },
  required: ['title', 'summary', 'achievements', 'improvements', 'suggestion'],
  additionalProperties: false,
};

export const INSIGHTS_SCHEMA = {
  type: 'object',
  properties: {
    insights: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          body: { type: 'string' },
          tone: { type: 'string', enum: ['positive', 'neutral', 'warning'] },
        },
        required: ['title', 'body', 'tone'],
        additionalProperties: false,
      },
    },
    suggestions: { type: 'array', items: { type: 'string' } },
  },
  required: ['insights', 'suggestions'],
  additionalProperties: false,
};

export const FLASHCARDS_SCHEMA = {
  type: 'object',
  properties: {
    cards: {
      type: 'array',
      items: {
        type: 'object',
        properties: { front: { type: 'string' }, back: { type: 'string' } },
        required: ['front', 'back'],
        additionalProperties: false,
      },
    },
  },
  required: ['cards'],
  additionalProperties: false,
};

export const QUIZ_SCHEMA = {
  type: 'object',
  properties: {
    questions: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          prompt: { type: 'string' },
          options: { type: 'array', items: { type: 'string' } },
          answer_index: { type: 'integer' },
          explanation: { type: 'string' },
        },
        required: ['prompt', 'options', 'answer_index', 'explanation'],
        additionalProperties: false,
      },
    },
  },
  required: ['questions'],
  additionalProperties: false,
};

export const MINDMAP_SCHEMA = {
  type: 'object',
  properties: {
    root: { type: 'string' },
    children: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          label: { type: 'string' },
          children: {
            type: 'array',
            items: {
              type: 'object',
              properties: { label: { type: 'string' } },
              required: ['label'],
              additionalProperties: false,
            },
          },
        },
        required: ['label', 'children'],
        additionalProperties: false,
      },
    },
  },
  required: ['root', 'children'],
  additionalProperties: false,
};

export function lifePagePrompt(snapshot) {
  return `Write today's LifePage from this snapshot.\n\n${JSON.stringify(snapshot, null, 2)}`;
}

export function insightsPrompt(analytics) {
  return `Analyse this student's last ${analytics.range.days} days and return insights plus suggestions. Every claim must be traceable to a number below - quote the number in the body text. Correlations are computed from their own logs; describe them as such, never as general science.\n\n${JSON.stringify(
    analytics,
    null,
    2,
  )}`;
}

export function flashcardsPrompt(text, count) {
  return `Create exactly ${count} flashcards from this study material. Each front must be a question that can be answered from the material; each back must be the answer, kept under 200 characters. Cover distinct facts - do not paraphrase the same point twice.\n\n---\n${text.slice(0, 40000)}`;
}

export function quizPrompt(text, count) {
  return `Write exactly ${count} multiple-choice questions from this material. Each needs exactly 4 options, a zero-based answer_index, and a one-sentence explanation. Distractors must be plausible and drawn from the material, not obviously wrong.\n\n---\n${text.slice(0, 40000)}`;
}

export function mindMapPrompt(text, title) {
  return `Build a mind map of this study material. The root is "${title}". Give 4-7 top-level branches naming the major concepts, each with 2-4 short leaf nodes. Leaf labels stay under 90 characters.\n\n---\n${text.slice(0, 40000)}`;
}

// --------------------------------------------------------- day brief --

export const DAYBRIEF_SYSTEM = `You turn a student's free-text description of their day into structured entries for their LifeBook.

They are talking, not filling a form. Pull out only what they actually said:

- tasks: things still to do, or that they said they need to do. Imperative, short.
- completed: things they said they finished or achieved. These become tasks already marked done.
- missed: things they said they did not get to, skipped, or avoided.
- wellness: numbers they mentioned - hours slept, minutes exercised, screen time hours, glasses of water, minutes of meditation, whether they ate breakfast.
- mood: a 1-5 score ONLY if their description clearly implies how they felt. 1 very low, 3 okay, 5 great.
- study: a focus session ONLY if they described actually studying - subject and how long in minutes.
- journal: a short reflective paragraph in THEIR voice, first person, drawn from what they said. This is the raw material for tonight's page.
- gratitude: anything they were glad about.

Rules that matter:
- Never invent an item they did not mention. An empty array is the correct answer when they said nothing about that category.
- Do not convert a feeling into a task. "I felt behind" is mood, not a to-do.
- Keep task titles under 80 characters and free of leading verbs like "I need to".
- If they mention a duration vaguely ("a couple of hours"), convert to your best numeric estimate. If there is no basis for a number at all, leave the field out.
- reply: one or two warm, specific sentences back to them, naming what you picked up. No emoji.
- Only name a study subject if they named it in this message. Their usual subjects are not evidence about today - leave it out rather than guessing.
- Omit any wellness field they did not mention. Never use 0 to mean "not mentioned" - 0 is a real measurement, and writing it would overwrite what they logged earlier.
- Never tell them to press, confirm or apply anything. Saving may already have happened by the time they read the reply, so instructions about buttons read as nonsense.`;

export const DAYBRIEF_SCHEMA = {
  type: 'object',
  properties: {
    reply: { type: 'string' },
    tasks: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          priority: { type: 'string', enum: ['low', 'normal', 'important', 'urgent'] },
          category: { type: 'string', enum: ['academic', 'ECA', 'personal', 'wellness'] },
        },
        required: ['title', 'priority', 'category'],
        additionalProperties: false,
      },
    },
    completed: { type: 'array', items: { type: 'string' } },
    missed: { type: 'array', items: { type: 'string' } },
    wellness: {
      type: 'object',
      properties: {
        sleep_hours: { type: ['number', 'null'] },
        exercise_minutes: { type: ['number', 'null'] },
        screen_time_hours: { type: ['number', 'null'] },
        water_glasses: { type: ['number', 'null'] },
        meditation_minutes: { type: ['number', 'null'] },
        had_breakfast: { type: ['boolean', 'null'] },
      },
      required: [],
      additionalProperties: false,
    },
    mood: {
      type: 'object',
      properties: {
        score: { type: ['integer', 'null'] },
        note: { type: ['string', 'null'] },
      },
      required: [],
      additionalProperties: false,
    },
    study: {
      type: 'object',
      properties: {
        subject: { type: ['string', 'null'] },
        minutes: { type: ['number', 'null'] },
        focus_rating: { type: ['integer', 'null'] },
      },
      required: [],
      additionalProperties: false,
    },
    journal: { type: ['string', 'null'] },
    gratitude: { type: 'array', items: { type: 'string' } },
  },
  required: ['reply', 'tasks', 'completed', 'missed'],
  additionalProperties: false,
};

export function dayBriefPrompt(message, context) {
  // Earlier turns come first so a correction ("no, chemistry not physics") or a
  // reference ("the second one") resolves against what was actually said. Only
  // the newest message is the instruction; the rest is background.
  const history = context.history?.length
    ? `Earlier in this conversation:\n${context.history.map((t) => `${t.role === 'user' ? 'They' : 'You'}: ${t.text}`).join('\n')}\n\n`
    : '';

  return `Today is ${context.date}. Here is what is already logged for today, so you do not duplicate it:\n${JSON.stringify(
    context.alreadyLogged,
    null,
    2,
  )}\n\n${history}They just said:\n"""\n${message}\n"""\n\nExtract only from that last message, but read it in the light of what came before - a correction replaces what it corrects rather than adding to it.`;
}

export const COACH_SYSTEM = `You are the study coach inside LifeBook. You are given the student's real, current numbers and one question.

Answer in two or three short paragraphs, grounded in their numbers - quote the actual figures back to them. Be direct and practical. Never invent data you were not given; if the relevant number is missing, say what they should start logging.

If the question suggests real distress, respond with care, point them at the Feeling Low page for their SOS contacts and verified helplines, and suggest talking to someone in person. Do not attempt therapy.`;

export function coachPrompt(message, context) {
  return `Their current numbers:\n${JSON.stringify(context, null, 2)}\n\nTheir question: ${message}`;
}
