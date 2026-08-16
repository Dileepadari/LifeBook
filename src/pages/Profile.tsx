import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import { Loader2, Save, KeyRound, BookOpen, Timer, Flame, Award } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Slider } from '@/components/ui/slider';
import { Separator } from '@/components/ui/separator';
import { CardListSkeleton, PageHeaderSkeleton } from '@/components/skeletons/pages';
import { useAuth } from '@/contexts/AuthContext';
import { useProfile, useSaveProfile, useLifeBookStats, useBadges, useHabits, useAnalytics } from '@/hooks/useLifeData';
import { auth } from '@/lib/api';
import { duration, PERSONA_LABELS, longDate } from '@/lib/format';

export default function Profile() {
  const { user, refreshUser } = useAuth();
  const { data: profile, isLoading } = useProfile();
  const { data: stats } = useLifeBookStats();
  const { data: badges = [] } = useBadges();
  const { data: habits = [] } = useHabits();
  const { data: analytics } = useAnalytics(365);
  const saveProfile = useSaveProfile();

  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [savingUser, setSavingUser] = useState(false);

  const [academicGoal, setAcademicGoal] = useState('');
  const [personalGoal, setPersonalGoal] = useState('');
  const [institution, setInstitution] = useState('');
  const [examDate, setExamDate] = useState('');
  const [deepWork, setDeepWork] = useState(4);
  const [sleep, setSleep] = useState(7.5);
  const [screenTime, setScreenTime] = useState(2);

  useEffect(() => {
    if (user) { setDisplayName(user.display_name); setBio(user.bio || ''); }
  }, [user]);

  useEffect(() => {
    if (!profile) return;
    setAcademicGoal(profile.academic_goal || '');
    setPersonalGoal(profile.personal_goal || '');
    setInstitution(profile.institution || '');
    setExamDate(profile.exam_date || '');
    setDeepWork(profile.target_deep_work ?? 4);
    setSleep(profile.target_sleep ?? 7.5);
    setScreenTime(profile.target_screen_time ?? 2);
  }, [profile]);

  if (isLoading) {
    return <div><PageHeaderSkeleton /><CardListSkeleton count={2} height="h-56" /></div>;
  }

  const saveUser = async () => {
    setSavingUser(true);
    try {
      await auth.updateMe({ display_name: displayName.trim(), bio: bio.trim() });
      await refreshUser();
      toast.success('Profile saved');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not save.');
    } finally {
      setSavingUser(false);
    }
  };

  const saveTargets = async () => {
    await saveProfile.mutateAsync({
      academic_goal: academicGoal.trim(),
      personal_goal: personalGoal.trim(),
      institution: institution.trim() || null,
      exam_date: examDate || null,
      target_deep_work: deepWork,
      target_sleep: sleep,
      target_screen_time: screenTime,
    });
    toast.success('Goals and targets saved', { description: 'Future pages are measured against these.' });
  };

  const bestStreak = habits.reduce((best, h) => Math.max(best, h.streak), 0);
  const earned = badges.filter((b) => b.earned_at).length;
  const initials = (user?.display_name || user?.username || '?').slice(0, 2).toUpperCase();

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header className="flex flex-wrap items-center gap-4">
        <Avatar className="h-16 w-16">
          {user?.avatar_url && <AvatarImage src={user.avatar_url} alt="" />}
          <AvatarFallback className="text-lg">{initials}</AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <h1 className="font-display text-3xl font-semibold">{user?.display_name}</h1>
          <p className="text-muted-foreground">@{user?.username}</p>
          {profile?.persona && (
            <Badge variant="secondary" className="mt-1.5">{PERSONA_LABELS[profile.persona]}</Badge>
          )}
        </div>
      </header>

      <section className="grid gap-4 sm:grid-cols-4">
        <Stat icon={BookOpen} label="Pages" value={stats?.total_pages ?? 0} />
        <Stat icon={Timer} label="Focused" value={analytics ? duration(analytics.analytics.study.totalMinutes) : '-'} />
        <Stat icon={Flame} label="Best streak" value={`${bestStreak}d`} />
        <Stat icon={Award} label="Badges" value={earned} />
      </section>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle>About you</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="name">Display name</Label>
            <Input id="name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="bio">Bio</Label>
            <Textarea id="bio" rows={3} value={bio} onChange={(e) => setBio(e.target.value)} />
          </div>
          <Button onClick={saveUser} disabled={savingUser} className="gap-2">
            {savingUser ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}Save
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle>Goals and targets</CardTitle>
          <CardDescription>
            Every page and every insight is measured against these numbers, so they are worth
            keeping honest.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-1.5">
            <Label htmlFor="agoal">Academic goal</Label>
            <Input id="agoal" value={academicGoal} onChange={(e) => setAcademicGoal(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pgoal">Personal goal</Label>
            <Input id="pgoal" value={personalGoal} onChange={(e) => setPersonalGoal(e.target.value)} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="inst">Institution</Label>
              <Input id="inst" value={institution} onChange={(e) => setInstitution(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edate">Target date</Label>
              <Input id="edate" type="date" value={examDate} onChange={(e) => setExamDate(e.target.value)} />
            </div>
          </div>

          <Separator />

          <TargetRow label="Deep work" value={deepWork} onChange={setDeepWork} min={1} max={10} step={0.5} unit="hours a day" />
          <TargetRow label="Sleep" value={sleep} onChange={setSleep} min={5} max={10} step={0.5} unit="hours a night" />
          <TargetRow label="Screen time limit" value={screenTime} onChange={setScreenTime} min={0.5} max={8} step={0.5} unit="hours a day" />

          <Button onClick={saveTargets} disabled={saveProfile.isPending} className="gap-2">
            {saveProfile.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save goals
          </Button>
        </CardContent>
      </Card>

      <PasswordCard />

      {stats?.first_page && (
        <p className="text-center text-sm text-muted-foreground">
          Your book opened on {longDate(stats.first_page)}.{' '}
          <Link to="/lifebook" className="text-primary hover:underline">Read it</Link>.
        </p>
      )}
    </div>
  );
}

function Stat({ icon: Icon, label, value }: { icon: typeof BookOpen; label: string; value: string | number }) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="font-display truncate text-lg font-semibold tabular-nums">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function TargetRow({
  label, value, onChange, min, max, step, unit,
}: {
  label: string; value: number; onChange: (v: number) => void;
  min: number; max: number; step: number; unit: string;
}) {
  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between">
        <Label>{label}</Label>
        <span className="text-sm font-semibold tabular-nums text-primary">{value} {unit}</span>
      </div>
      <Slider value={[value]} onValueChange={([v]) => onChange(v)} min={min} max={max} step={step} />
    </div>
  );
}

function PasswordCard() {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await auth.changePassword(current, next);
      toast.success('Password changed');
      setCurrent(''); setNext('');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not change the password.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2"><KeyRound className="h-4 w-4" /> Password</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="cur">Current</Label>
            <Input id="cur" type="password" value={current} onChange={(e) => setCurrent(e.target.value)} autoComplete="current-password" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="new">New</Label>
            <Input id="new" type="password" value={next} onChange={(e) => setNext(e.target.value)} autoComplete="new-password" />
          </div>
          <div className="sm:col-span-2">
            <Button type="submit" disabled={saving || !current || next.length < 8} variant="outline">
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Change password
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
