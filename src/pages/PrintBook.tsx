/** Print stylesheet view: every page in range, one per sheet, no app chrome. */
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { LifePage } from '@/components/lifebook/LifePage';
import { useLifePages } from '@/hooks/useLifeData';
import { useAuth } from '@/contexts/AuthContext';
import { longDate, todayStr, addDays } from '@/lib/format';
import logoMark from '@/assets/logo-mark.png';

/**
 * The whole book, rendered for paper. Deliberately outside AppShell - the
 * browser's own print-to-PDF is the export engine, and the @media print rules
 * in index.css are the binding (A5, one page per LifePage, no chrome).
 *
 * Doing it this way rather than generating a PDF server-side means the exported
 * file is exactly what is on screen, with no second renderer to drift.
 */
export default function PrintBook() {
  const { data: pages = [], isLoading } = useLifePages();
  const { user } = useAuth();

  const [from, setFrom] = useState(addDays(todayStr(), -29));
  const [to, setTo] = useState(todayStr());
  const [sealedOnly, setSealedOnly] = useState(false);

  const selected = pages
    .filter((p) => p.date >= from && p.date <= to)
    .filter((p) => (sealedOnly ? p.sealed_at : true))
    .sort((a, b) => a.date.localeCompare(b.date));

  useEffect(() => {
    document.title = `LifeBook - ${user?.display_name || 'My book'}`;
    return () => { document.title = 'LifeBook'; };
  }, [user]);

  return (
    <div className="min-h-screen bg-background">
      {/* Controls never reach paper. */}
      <div className="no-print sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-4xl flex-wrap items-end gap-4 px-6 py-4">
          <Button asChild variant="ghost" size="sm" className="gap-2">
            <Link to="/lifebook"><ArrowLeft className="h-4 w-4" /> Back</Link>
          </Button>

          <div className="space-y-1">
            <Label htmlFor="from" className="text-xs">From</Label>
            <Input id="from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-9 w-40" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="to" className="text-xs">To</Label>
            <Input id="to" type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-9 w-40" />
          </div>

          <label className="flex items-center gap-2 pb-2 text-sm">
            <input
              type="checkbox"
              checked={sealedOnly}
              onChange={(e) => setSealedOnly(e.target.checked)}
              className="h-4 w-4 rounded border-border"
            />
            Sealed pages only
          </label>

          <div className="ml-auto flex items-center gap-3 pb-1">
            <span className="text-sm text-muted-foreground">
              <span className="tabular-nums">{selected.length}</span> pages
            </span>
            <Button onClick={() => window.print()} disabled={!selected.length} className="gap-2">
              <Printer className="h-4 w-4" /> Print / Save as PDF
            </Button>
          </div>
        </div>
        <p className="mx-auto max-w-4xl px-6 pb-3 text-xs text-muted-foreground">
          In the print dialog choose "Save as PDF", A5, and turn on background graphics for the
          paper texture.
        </p>
      </div>

      <div className="mx-auto max-w-4xl px-6 py-10">
        {isLoading ? (
          <p className="py-20 text-center text-muted-foreground">Loading your book...</p>
        ) : !selected.length ? (
          <p className="py-20 text-center text-muted-foreground">
            No pages in that range{sealedOnly && ' that are sealed'}.
          </p>
        ) : (
          <>
            {/* Title page. */}
            <section className="print-page page-surface mb-10 flex min-h-[60vh] flex-col items-center justify-center rounded-xl p-12 text-center">
              <img src={logoMark} alt="" className="logo-mono mb-8 h-12 w-12 object-contain" />
              <h1 className="font-display text-5xl font-semibold">LifeBook</h1>
              <p className="font-display mt-3 text-lg text-paper-foreground/70">
                {user?.display_name}
              </p>
              <p className="mt-10 text-sm text-paper-foreground/60">
                {longDate(selected[0].date)}
              </p>
              <p className="text-sm text-paper-foreground/60">to</p>
              <p className="text-sm text-paper-foreground/60">
                {longDate(selected[selected.length - 1].date)}
              </p>
              <p className="font-display mt-12 text-sm italic text-paper-foreground/50">
                Your life is a book, and every day is one page.
              </p>
            </section>

            <div className="space-y-10">
              {selected.map((page) => (
                <LifePage key={page.id} page={page} printMode />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
