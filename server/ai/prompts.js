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

export const COACH_SYSTEM = `You are the study coach inside LifeBook. You are given the student's real, current numbers and one question.

Answer in two or three short paragraphs, grounded in their numbers - quote the actual figures back to them. Be direct and practical. Never invent data you were not given; if the relevant number is missing, say what they should start logging.

If the question suggests real distress, respond with care, point them at the Feeling Low page for their SOS contacts and verified helplines, and suggest talking to someone in person. Do not attempt therapy.`;

export function coachPrompt(message, context) {
  return `Their current numbers:\n${JSON.stringify(context, null, 2)}\n\nTheir question: ${message}`;
}
