import { Link } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { BookOpen, LineChart, Sparkles, HeartPulse } from 'lucide-react';
import { Button } from '@/components/ui/button';
import logoMark from '@/assets/logo-mark.png';

const PILLARS = [
  {
    icon: BookOpen,
    title: 'One page a day',
    body: 'Everything you log becomes a dated page: what you studied, how you slept, what you were grateful for, what slipped.',
  },
  {
    icon: LineChart,
    title: 'Numbers, not vibes',
    body: 'Focus hours against your target. Sleep against your focus. Screen time against both. Correlations from your own logs.',
  },
  {
    icon: HeartPulse,
    title: 'The whole student',
    body: 'Study, movement, sleep, mood and reflection sit on one page, because they were never separate problems.',
  },
  {
    icon: Sparkles,
    title: 'Written for you',
    body: 'Each page is narrated from your real day. Bring a Claude or Gemini key, or use the built-in engine - both work.',
  },
];

export default function Welcome() {
  const reduceMotion = useReducedMotion();

  return (
    <div className="book-wash min-h-screen bg-background">
      <div className="mx-auto flex min-h-screen max-w-6xl flex-col px-6 py-6">
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 p-1.5">
              <img src={logoMark} alt="" className="h-full w-full object-contain logo-mono" />
            </div>
            <span className="text-lg font-semibold">LifeBook</span>
          </div>
          <Button asChild variant="ghost">
            <Link to="/auth">Log in</Link>
          </Button>
        </header>

        <main className="flex flex-1 flex-col items-center justify-center py-16 text-center">
          {/* The book opens. This is the product's whole metaphor, so it gets
              the one genuinely theatrical animation in the app. */}
          <motion.div
            initial={reduceMotion ? false : { opacity: 0, scale: 0.9, rotateX: 40 }}
            animate={{ opacity: 1, scale: 1, rotateX: 0 }}
            transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
            className="mb-10 [perspective:1200px]"
          >
            <div className="relative flex h-40 w-64 items-end justify-center sm:h-52 sm:w-80">
              <div className="absolute inset-x-0 bottom-0 h-4 rounded-full bg-primary/20 blur-lg" />
              <motion.div
                initial={reduceMotion ? false : { rotateY: 0 }}
                animate={{ rotateY: -22 }}
                transition={{ delay: 0.5, duration: 1.1, ease: [0.16, 1, 0.3, 1] }}
                className="page-surface h-36 w-1/2 origin-right rounded-l-md sm:h-48"
                style={{ transformStyle: 'preserve-3d' }}
              />
              <motion.div
                initial={reduceMotion ? false : { rotateY: 0 }}
                animate={{ rotateY: 22 }}
                transition={{ delay: 0.5, duration: 1.1, ease: [0.16, 1, 0.3, 1] }}
                className="page-surface h-36 w-1/2 origin-left rounded-r-md sm:h-48"
                style={{ transformStyle: 'preserve-3d' }}
              />
            </div>
          </motion.div>

          <motion.h1
            initial={reduceMotion ? false : { opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25, duration: 0.6 }}
            className="font-display text-4xl font-semibold leading-tight tracking-tight sm:text-6xl"
          >
            Your life is a book,
            <br />
            <span className="text-primary">every day is one page.</span>
          </motion.h1>

          <motion.p
            initial={reduceMotion ? false : { opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.6 }}
            className="mt-6 max-w-2xl text-balance text-lg text-muted-foreground"
          >
            Students do not measure their lives, so they cannot see their own progress or their
            backlogs. LifeBook is the instrument - study, wellness and reflection on one page a day,
            until you have a book worth printing.
          </motion.p>

          <motion.div
            initial={reduceMotion ? false : { opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.55, duration: 0.6 }}
            className="mt-10 flex flex-col gap-3 sm:flex-row"
          >
            <Button asChild size="lg" className="h-12 px-8 text-base">
              <Link to="/auth?mode=signup">Get started</Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="h-12 px-8 text-base">
              <Link to="/auth">I already have an account</Link>
            </Button>
          </motion.div>
        </main>

        <section className="grid gap-6 pb-16 sm:grid-cols-2 lg:grid-cols-4">
          {PILLARS.map(({ icon: Icon, title, body }, i) => (
            <motion.div
              key={title}
              initial={reduceMotion ? false : { opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ delay: i * 0.08, duration: 0.5 }}
              className="rounded-xl border border-border bg-card/60 p-5 backdrop-blur"
            >
              <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Icon className="h-4 w-4" />
              </div>
              <h3 className="mb-1.5 font-semibold">{title}</h3>
              <p className="text-sm leading-relaxed text-muted-foreground">{body}</p>
            </motion.div>
          ))}
        </section>

        <footer className="border-t border-border py-6 text-center text-xs text-muted-foreground">
          Built from a 2024 Design Thinking study on student study-life balance - 22 interviews, a
          survey and 15 papers. See the README for the research it came from.
        </footer>
      </div>
    </div>
  );
}
