import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Sparkles, Check, X, Loader2, Download, Trash2, Moon, Sun, Palette, KeyRound, Bell,
} from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { useSettings, useSaveSettings, useAIStatus } from '@/hooks/useLifeData';
import { useTheme, colorPalettes, type ColorPalette } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { insights, auth } from '@/lib/api';
import { PROVIDER_LABELS } from '@/lib/format';
import { cn } from '@/lib/utils';
import { CardListSkeleton, PageHeaderSkeleton } from '@/components/skeletons/pages';

const PALETTE_LABELS: Record<string, string> = {
  emerald: 'Emerald', ocean: 'Ocean', sunset: 'Sunset',
  violet: 'Violet', rose: 'Rose', slate: 'Slate',
};

export default function SettingsPage() {
  const { data: settings, isLoading } = useSettings();
  const { data: aiStatus } = useAIStatus();
  const save = useSaveSettings();
  const { theme, setThemeMode, colorPalette, setColorPalette } = useTheme();
  const { signOut } = useAuth();

  if (isLoading || !settings) {
    return <div><PageHeaderSkeleton /><CardListSkeleton count={3} height="h-48" /></div>;
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header>
        <h1 className="font-display text-3xl font-semibold">Settings</h1>
        <p className="mt-1 text-muted-foreground">How LifeBook looks, thinks and stores your data.</p>
      </header>

      <AISection settings={settings} status={aiStatus} onSave={(p) => save.mutateAsync(p)} />

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2"><Palette className="h-4 w-4" /> Appearance</CardTitle>
          <CardDescription>Stored on this device.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <Label className="mb-3 block">Mode</Label>
            <div className="grid grid-cols-2 gap-3">
              {(['light', 'dark'] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setThemeMode(m)}
                  className={cn(
                    'flex items-center justify-center gap-2 rounded-lg border p-4 text-sm font-medium transition-colors',
                    theme === m ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'border-border hover:bg-muted',
                  )}
                >
                  {m === 'light' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                  {m === 'light' ? 'Light' : 'Dark'}
                </button>
              ))}
            </div>
          </div>

          <div>
            <Label className="mb-3 block">Accent</Label>
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
              {(Object.keys(colorPalettes) as Exclude<ColorPalette, 'custom'>[]).map((id) => {
                const p = colorPalettes[id];
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setColorPalette(id)}
                    className={cn(
                      'flex flex-col items-center gap-2 rounded-lg border p-3 transition-colors',
                      colorPalette === id ? 'border-primary ring-1 ring-primary' : 'border-border hover:bg-muted',
                    )}
                  >
                    <span className="flex gap-1">
                      <span className="h-5 w-5 rounded-full" style={{ background: `hsl(${p.primary})` }} />
                      <span className="h-5 w-5 rounded-full" style={{ background: `hsl(${p.accent})` }} />
                    </span>
                    <span className="text-[0.65rem]">{PALETTE_LABELS[id]}</span>
                  </button>
                );
              })}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Charts keep their own fixed colours regardless - a series has to mean the same thing
              whichever accent you pick.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2"><Bell className="h-4 w-4" /> Notifications</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1">
          {[
            { key: 'notify_daily_page', label: 'Daily page reminder', hint: 'A nudge to close the day.' },
            { key: 'notify_streaks', label: 'Streak warnings', hint: 'When a chain is about to break.' },
            { key: 'notify_challenges', label: 'Challenge check-ins', hint: 'Daily prompt for active challenges.' },
          ].map((row) => (
            <div key={row.key} className="flex items-center justify-between gap-4 py-3">
              <div>
                <p className="text-sm font-medium">{row.label}</p>
                <p className="text-xs text-muted-foreground">{row.hint}</p>
              </div>
              <Switch
                checked={Boolean(settings[row.key as keyof typeof settings])}
                onCheckedChange={(v) => save.mutate({ [row.key]: v ? 1 : 0 })}
              />
            </div>
          ))}
        </CardContent>
      </Card>

      <DangerZone onSignOut={signOut} />
    </div>
  );
}

/**
 * The AI panel. The key is write-only from the browser's point of view - it is
 * sent up, stored server-side, and only ever comes back as a masked hint, so a
 * screenshot of this page never leaks it.
 */
function AISection({
  settings, status, onSave,
}: {
  settings: { ai_provider: string; ai_model: string | null; has_ai_key: boolean; ai_key_hint: string | null };
  status?: { provider: string; defaults: Record<string, string>; env_keys: Record<string, boolean> };
  onSave: (patch: Record<string, unknown>) => Promise<unknown>;
}) {
  const [provider, setProvider] = useState(settings.ai_provider);
  const [model, setModel] = useState(settings.ai_model || '');
  const [key, setKey] = useState('');
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; detail: string } | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setProvider(settings.ai_provider);
    setModel(settings.ai_model || '');
  }, [settings.ai_provider, settings.ai_model]);

  const defaultModel = status?.defaults?.[provider] || '';

  const commit = async () => {
    setSaving(true);
    try {
      const patch: Record<string, unknown> = { ai_provider: provider, ai_model: model.trim() || null };
      // Only send the key when the user actually typed one - an untouched field
      // must not blank out a saved key.
      if (key.trim()) patch.ai_key = key.trim();
      await onSave(patch);
      setKey('');
      setResult(null);
      toast.success('AI settings saved');
    } finally {
      setSaving(false);
    }
  };

  const test = async () => {
    setTesting(true);
    setResult(null);
    try {
      const res = await insights.testAI(
        key.trim() ? { provider, apiKey: key.trim(), model: model.trim() || undefined } : undefined,
      );
      setResult({ ok: res.ok, detail: res.detail });
    } catch (err) {
      setResult({ ok: false, detail: err instanceof Error ? err.message : 'Test failed.' });
    } finally {
      setTesting(false);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2"><Sparkles className="h-4 w-4" /> AI</CardTitle>
        <CardDescription>
          LifeBook works with no key at all - the built-in engine writes real pages from your own
          numbers. A key upgrades the prose; it never unlocks a feature.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-muted-foreground">Currently using</span>
          <Badge variant="secondary" className="gap-1.5">
            <Sparkles className="h-3 w-3" />
            {status ? PROVIDER_LABELS[status.provider] || status.provider : '...'}
          </Badge>
          {settings.has_ai_key && (
            <Badge variant="outline" className="gap-1.5 font-mono text-[0.65rem]">
              <KeyRound className="h-3 w-3" /> {settings.ai_key_hint}
            </Badge>
          )}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Provider</Label>
            <Select value={provider} onValueChange={(v) => { setProvider(v); setResult(null); }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">Automatic</SelectItem>
                <SelectItem value="anthropic">Claude (Anthropic)</SelectItem>
                <SelectItem value="gemini">Gemini (Google)</SelectItem>
                <SelectItem value="builtin">Built-in engine only</SelectItem>
              </SelectContent>
            </Select>
            {provider === 'auto' && (
              <p className="text-xs text-muted-foreground">
                Uses whichever key it finds - a saved key first, then the server's environment.
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="model">Model</Label>
            <Input
              id="model"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder={defaultModel || 'provider default'}
              disabled={provider === 'builtin'}
            />
            {defaultModel && !model && (
              <p className="text-xs text-muted-foreground">Defaults to {defaultModel}.</p>
            )}
          </div>
        </div>

        {provider !== 'builtin' && (
          <div className="space-y-1.5">
            <Label htmlFor="apikey">API key</Label>
            <Input
              id="apikey"
              type="password"
              value={key}
              onChange={(e) => { setKey(e.target.value); setResult(null); }}
              placeholder={settings.has_ai_key ? 'A key is saved - type to replace it' : 'sk-ant-... or an AIza... key'}
              autoComplete="off"
            />
            <p className="text-xs text-muted-foreground">
              Stored on your own server and never returned to the browser. The page generator calls
              the provider server-side, so the key is never in a page someone could screenshot.
              {status?.env_keys?.anthropic && ' An Anthropic key is also set in the environment.'}
              {status?.env_keys?.gemini && ' A Gemini key is also set in the environment.'}
            </p>
          </div>
        )}

        {result && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            className={cn(
              'flex items-start gap-2 rounded-lg border p-3 text-sm',
              result.ok ? 'border-success/30 bg-success/5 text-success' : 'border-destructive/30 bg-destructive/5 text-destructive',
            )}
          >
            {result.ok ? <Check className="mt-0.5 h-4 w-4 shrink-0" /> : <X className="mt-0.5 h-4 w-4 shrink-0" />}
            <span>{result.detail}</span>
          </motion.div>
        )}

        <div className="flex flex-wrap gap-2">
          <Button onClick={commit} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save
          </Button>
          <Button variant="outline" onClick={test} disabled={testing || provider === 'builtin'}>
            {testing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Test connection
          </Button>
          {settings.has_ai_key && (
            <Button
              variant="ghost"
              className="text-muted-foreground"
              onClick={async () => { await onSave({ ai_key: '' }); toast.success('Key removed'); }}
            >
              Remove key
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function DangerZone({ onSignOut }: { onSignOut: () => void }) {
  const [password, setPassword] = useState('');
  const [deleting, setDeleting] = useState(false);

  const exportData = () => {
    // Goes through a hidden anchor rather than fetch so the browser's own
    // download flow handles it - the endpoint sets Content-Disposition.
    const token = localStorage.getItem('lifebook_token');
    fetch(auth.exportUrl(), { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.blob())
      .then((blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'lifebook-export.json';
        a.click();
        URL.revokeObjectURL(url);
        toast.success('Export downloaded');
      })
      .catch(() => toast.error('Export failed'));
  };

  const remove = async () => {
    setDeleting(true);
    try {
      await auth.deleteAccount(password);
      toast.success('Account deleted');
      onSignOut();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not delete the account.');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle>Your data</CardTitle>
        <CardDescription>It lives on the server you run. Nothing is shared anywhere else.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium">Export everything</p>
            <p className="text-xs text-muted-foreground">
              Every page, session, log and journal entry as one JSON file. The API key is excluded.
            </p>
          </div>
          <Button variant="outline" onClick={exportData} className="gap-2">
            <Download className="h-4 w-4" /> Export
          </Button>
        </div>

        <Separator />

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-destructive">Delete your account</p>
            <p className="text-xs text-muted-foreground">
              Every page and every log, permanently. Export first if you want to keep the book.
            </p>
          </div>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" className="gap-2"><Trash2 className="h-4 w-4" /> Delete</Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete your account?</AlertDialogTitle>
                <AlertDialogDescription>
                  This cannot be undone. Your LifeBook, every logged session, every journal entry and
                  every page will be removed from the database.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <div className="space-y-1.5">
                <Label htmlFor="confirmpw">Confirm with your password</Label>
                <Input id="confirmpw" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
              </div>
              <AlertDialogFooter>
                <AlertDialogCancel>Keep my account</AlertDialogCancel>
                <AlertDialogAction
                  onClick={remove}
                  disabled={!password || deleting}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  {deleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Delete permanently
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </CardContent>
    </Card>
  );
}
