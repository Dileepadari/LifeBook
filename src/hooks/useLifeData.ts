import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  tasks, resources, decks, habitsApi, goalVisions, sosContacts,
  study, day, lifebook, insights, profile, settings, assistant,
  type DayProposal, type UndoToken,
  type Task, type Habit, type Challenge, type LifePage, type Badge,
  type FeedPost, type Resource, type Deck, type Flashcard, type Mood,
  type JournalEntry, type WellnessLog, type Profile, type Settings,
} from '@/lib/api';
import { todayStr } from '@/lib/format';

// Anything that changes a number the Dashboard, the LifePage or the badge
// engine reads has to invalidate all three - which is most writes in this app.
// Rather than remember that at 30 call sites, every mutation funnels through
// this one helper.
function useInvalidate() {
  const qc = useQueryClient();
  return () => {
    ['dashboard', 'analytics', 'lifepages', 'lifebook-stats', 'badges', 'notifications'].forEach((key) =>
      qc.invalidateQueries({ queryKey: [key] }),
    );
  };
}

/** Badge awards come back on the mutation response rather than as a separate
 *  fetch, so surface them the moment they happen. */
function celebrate(awarded?: { name: string; description: string }[]) {
  for (const badge of awarded || []) {
    toast.success(`Badge earned: ${badge.name}`, { description: badge.description });
  }
}

// --- profile & settings ---

export const useProfile = () => useQuery<Profile>({ queryKey: ['profile'], queryFn: profile.get });

export function useSaveProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: Partial<Profile> & { complete?: boolean }) => profile.save(patch),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['profile'] });
      qc.invalidateQueries({ queryKey: ['habits'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

export const useSettings = () => useQuery<Settings>({ queryKey: ['settings'], queryFn: settings.get });

export function useSaveSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: Record<string, unknown>) => settings.save(patch),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['settings'] });
      qc.invalidateQueries({ queryKey: ['ai-status'] });
    },
  });
}

// --- tasks ---

export const useTasks = () => useQuery<Task[]>({ queryKey: ['tasks'], queryFn: tasks.list });

export function useCreateTask() {
  const qc = useQueryClient();
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (payload: Partial<Task>) => tasks.create(payload),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['tasks'] }); invalidate(); },
  });
}

export function useUpdateTask() {
  const qc = useQueryClient();
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<Task> }) => tasks.update(id, payload),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['tasks'] }); invalidate(); },
  });
}

export function useDeleteTask() {
  const qc = useQueryClient();
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (id: string) => tasks.remove(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['tasks'] }); invalidate(); },
  });
}

// --- study ---

export const useSessions = (from?: string, to?: string) =>
  useQuery({ queryKey: ['sessions', from, to], queryFn: () => study.sessions(from, to) });

export function useLogSession() {
  const qc = useQueryClient();
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (payload: Record<string, unknown>) => study.logSession(payload),
    onSuccess: (res: { awarded?: { name: string; description: string }[] }) => {
      qc.invalidateQueries({ queryKey: ['sessions'] });
      invalidate();
      celebrate(res.awarded);
    },
  });
}

export const useResources = () => useQuery<Resource[]>({ queryKey: ['resources'], queryFn: resources.list });

export function useUploadResource() {
  const qc = useQueryClient();
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ file, meta }: { file: File; meta?: Record<string, string> }) => resources.upload(file, meta),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['resources'] }); invalidate(); },
  });
}

export function useDeleteResource() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => resources.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['resources'] }),
  });
}

export function useUpdateResource() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<Resource> }) => resources.update(id, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['resources'] }),
  });
}

export const useDecks = () => useQuery<Deck[]>({ queryKey: ['decks'], queryFn: decks.list });
export const useDueCards = () => useQuery<Flashcard[]>({ queryKey: ['due-cards'], queryFn: study.dueCards });

export function useReviewCard() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, grade }: { id: string; grade: number }) => study.reviewCard(id, grade),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['due-cards'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

export function useGenerate(kind: 'flashcards' | 'quiz' | 'mindmap') {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      kind === 'flashcards' ? study.generateFlashcards(body)
        : kind === 'quiz' ? study.generateQuiz(body)
          : study.generateMindMap(body),
    onSuccess: (res: { degradedFrom?: string; providerError?: string }) => {
      ['decks', 'due-cards', 'quizzes', 'mind-maps'].forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
      // Be honest when the key failed rather than passing off the fallback as
      // the provider's work.
      if (res.degradedFrom) {
        toast.warning(`${res.degradedFrom} was unavailable - used the built-in engine`, { description: res.providerError });
      }
    },
  });
}

export const useQuizAttempts = () => useQuery({ queryKey: ['quiz-attempts'], queryFn: study.attempts });

// --- day ---

export const useWellness = (from?: string, to?: string) =>
  useQuery<WellnessLog[]>({ queryKey: ['wellness', from, to], queryFn: () => day.wellness(from, to) });

export function useSaveWellness() {
  const qc = useQueryClient();
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ date, payload }: { date: string; payload: Partial<WellnessLog> }) => day.saveWellness(date, payload),
    onSuccess: (res: { awarded?: { name: string; description: string }[] }) => {
      qc.invalidateQueries({ queryKey: ['wellness'] });
      invalidate();
      celebrate(res.awarded);
    },
  });
}

export const useJournal = (date: string) =>
  useQuery<JournalEntry | null>({ queryKey: ['journal', date], queryFn: () => day.journal(date) });

export const useJournalList = () => useQuery<JournalEntry[]>({ queryKey: ['journal-list'], queryFn: day.journalList });

export function useSaveJournal() {
  const qc = useQueryClient();
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ date, payload }: { date: string; payload: Partial<JournalEntry> }) => day.saveJournal(date, payload),
    onSuccess: (res: { awarded?: { name: string; description: string }[] }, vars) => {
      qc.invalidateQueries({ queryKey: ['journal', vars.date] });
      qc.invalidateQueries({ queryKey: ['journal-list'] });
      invalidate();
      celebrate(res.awarded);
    },
  });
}

export const useMoods = (from?: string, to?: string) =>
  useQuery<Mood[]>({ queryKey: ['moods', from, to], queryFn: () => day.moods(from, to) });

export function useLogMood() {
  const qc = useQueryClient();
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (payload: { score: number; note?: string; triggers?: string[] }) => day.logMood(payload),
    onSuccess: (res: { awarded?: { name: string; description: string }[] }) => {
      qc.invalidateQueries({ queryKey: ['moods'] });
      invalidate();
      celebrate(res.awarded);
    },
  });
}

export const useHabits = () => useQuery<Habit[]>({ queryKey: ['habits'], queryFn: habitsApi.list });

export function useToggleHabit() {
  const qc = useQueryClient();
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (id: string) => habitsApi.toggle(id),
    onSuccess: (res: { awarded?: { name: string; description: string }[] }) => {
      qc.invalidateQueries({ queryKey: ['habits'] });
      invalidate();
      celebrate(res.awarded);
    },
  });
}

export function useCreateHabit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: { name: string; icon?: string; target_days?: number }) => habitsApi.create(payload),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['habits'] }); qc.invalidateQueries({ queryKey: ['dashboard'] }); },
  });
}

export function useDeleteHabit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => habitsApi.remove(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['habits'] }); qc.invalidateQueries({ queryKey: ['dashboard'] }); },
  });
}

export const useChallenges = () => useQuery<Challenge[]>({ queryKey: ['challenges'], queryFn: day.challenges });
export const useLeaderboard = () => useQuery({ queryKey: ['leaderboard'], queryFn: day.leaderboard });

export function useChallengeAction() {
  const qc = useQueryClient();
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ id, action }: { id: string; action: 'enroll' | 'unenroll' | 'checkin' }) =>
      action === 'enroll' ? day.enroll(id) : action === 'unenroll' ? day.unenroll(id) : day.checkin(id),
    onSuccess: (res: { awarded?: { name: string; description: string }[] }) => {
      qc.invalidateQueries({ queryKey: ['challenges'] });
      qc.invalidateQueries({ queryKey: ['leaderboard'] });
      invalidate();
      celebrate(res.awarded);
    },
  });
}

// --- lifebook ---

export const useLifePages = () => useQuery<LifePage[]>({ queryKey: ['lifepages'], queryFn: lifebook.pages });
export const useLifePage = (date: string) =>
  useQuery<LifePage | null>({ queryKey: ['lifepage', date], queryFn: () => lifebook.page(date) });
export const useLifeBookStats = () => useQuery({ queryKey: ['lifebook-stats'], queryFn: lifebook.stats });
export const useDaySnapshot = (date: string) =>
  useQuery({ queryKey: ['snapshot', date], queryFn: () => lifebook.snapshot(date) });

export function useGeneratePage() {
  const qc = useQueryClient();
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ date, force }: { date: string; force?: boolean }) => lifebook.generate(date, force),
    onSuccess: (res, vars) => {
      qc.invalidateQueries({ queryKey: ['lifepage', vars.date] });
      invalidate();
      if (res.degradedFrom) {
        toast.warning(`${res.degradedFrom} was unavailable - page written by the built-in engine`, {
          description: res.providerError,
        });
      }
    },
  });
}

export function useSealPage() {
  const qc = useQueryClient();
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (date: string) => lifebook.seal(date),
    onSuccess: (res: { awarded?: { name: string; description: string }[] }, date) => {
      qc.invalidateQueries({ queryKey: ['lifepage', date] });
      invalidate();
      celebrate(res.awarded);
    },
  });
}

export const useOrders = () => useQuery({ queryKey: ['orders'], queryFn: lifebook.orders });

export function useCreateOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: Record<string, unknown>) => lifebook.order(payload),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['orders'] }); qc.invalidateQueries({ queryKey: ['notifications'] }); },
  });
}

// --- insights ---

export const useDashboard = () => useQuery({ queryKey: ['dashboard'], queryFn: insights.dashboard });
export const useAnalytics = (days: number) =>
  useQuery({ queryKey: ['analytics', days], queryFn: () => insights.analytics(days) });
export const useBadges = () => useQuery<Badge[]>({ queryKey: ['badges'], queryFn: insights.badges });
export const useFeed = () => useQuery<FeedPost[]>({ queryKey: ['feed'], queryFn: insights.feed });
export const useMotivation = () => useQuery({ queryKey: ['motivation'], queryFn: insights.motivation });
export const useSupport = () => useQuery({ queryKey: ['support'], queryFn: insights.support });
export const useNotifications = () => useQuery({ queryKey: ['notifications'], queryFn: insights.notifications });
export const useAIStatus = () => useQuery({ queryKey: ['ai-status'], queryFn: insights.aiStatus });

export function useGenerateInsights() {
  return useMutation({ mutationFn: (days: number) => insights.generate(days) });
}

export function useCoach() {
  return useMutation({ mutationFn: (message: string) => insights.coach(message) });
}

export function useSavePost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => insights.savePost(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['feed'] }),
  });
}

export function useSaveMotivation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => insights.saveMotivation(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['motivation'] }),
  });
}

// --- day assistant ---
//
// Applying a brief can touch tasks, wellness, a study session, a mood and the
// journal in one transaction, so both apply and undo invalidate the same wide
// set. Undo has to invalidate too, or the board keeps showing rows the server
// has already deleted.
const ASSISTANT_KEYS = ['tasks', 'wellness', 'sessions', 'moods', 'journal', 'journal-list'];

export function useDayAssistant() {
  const qc = useQueryClient();
  const invalidate = useInvalidate();
  const refreshAll = () => {
    ASSISTANT_KEYS.forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
    invalidate();
  };

  const parse = useMutation({
    mutationFn: ({ message, date }: { message: string; date?: string }) => assistant.parse(message, date),
  });

  const apply = useMutation({
    mutationFn: ({ proposal, date }: { proposal: DayProposal; date?: string }) => assistant.apply(proposal, date),
    onSuccess: (res) => { refreshAll(); celebrate(res.awarded); },
  });

  const undo = useMutation({
    mutationFn: (token: UndoToken) => assistant.undo(token),
    onSuccess: refreshAll,
  });

  return { parse, apply, undo };
}

export const useGoalVisions = () => useQuery({ queryKey: ['goal-visions'], queryFn: goalVisions.list });

export function useGoalVisionAction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ action, id, payload }: { action: 'create' | 'update' | 'remove'; id?: string; payload?: Record<string, unknown> }) =>
      action === 'create' ? goalVisions.create(payload as { text: string })
        : action === 'update' ? goalVisions.update(id!, payload!)
          : goalVisions.remove(id!),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['goal-visions'] }); qc.invalidateQueries({ queryKey: ['motivation'] }); },
  });
}

export const useSOSContacts = () => useQuery({ queryKey: ['sos-contacts'], queryFn: sosContacts.list });

export function useSOSContactAction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ action, id, payload }: { action: 'create' | 'remove'; id?: string; payload?: { name: string; phone?: string; relation?: string } }) =>
      action === 'create' ? sosContacts.create(payload!) : sosContacts.remove(id!),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['sos-contacts'] }); qc.invalidateQueries({ queryKey: ['support'] }); },
  });
}

export { todayStr };
