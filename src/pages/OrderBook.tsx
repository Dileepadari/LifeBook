/** Orders a printed copy of a date range: format, cover title and address. */
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Package, Printer, Loader2, Info, BookOpen } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useLifePages, useOrders, useCreateOrder } from '@/hooks/useLifeData';
import { useAuth } from '@/contexts/AuthContext';
import { todayStr, addDays, longDate, shortDate } from '@/lib/format';
import { cn } from '@/lib/utils';

const FORMATS = [
  { id: 'hardcover', label: 'Hardcover', hint: 'Cloth-bound, sewn. The one worth keeping on a shelf.' },
  { id: 'paperback', label: 'Paperback', hint: 'Lighter and cheaper. Good for a single semester.' },
  { id: 'pdf', label: 'PDF only', hint: 'No physical copy - just the file, ready to print anywhere.' },
];

export default function OrderBook() {
  const { user } = useAuth();
  const { data: pages = [] } = useLifePages();
  const { data: orders = [] } = useOrders();
  const create = useCreateOrder();

  const [from, setFrom] = useState(addDays(todayStr(), -29));
  const [to, setTo] = useState(todayStr());
  const [format, setFormat] = useState('hardcover');
  const [coverTitle, setCoverTitle] = useState('');
  const [recipient, setRecipient] = useState(user?.display_name || '');
  const [address, setAddress] = useState('');

  const inRange = pages.filter((p) => p.date >= from && p.date <= to);
  const sealed = inRange.filter((p) => p.sealed_at).length;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await create.mutateAsync({
        from_date: from, to_date: to, format,
        cover_title: coverTitle.trim() || null,
        recipient: recipient.trim() || null,
        address: address.trim() || null,
      });
      toast.success('Order recorded', { description: 'Export the PDF any time from the print view.' });
      setAddress('');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not record the order.');
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header className="flex items-center justify-between gap-4">
        <div>
          <Button asChild variant="ghost" size="sm" className="-ml-3 mb-2 gap-2">
            <Link to="/lifebook"><ArrowLeft className="h-4 w-4" /> Back to the book</Link>
          </Button>
          <h1 className="font-display text-3xl font-semibold">Order a printed copy</h1>
          <p className="mt-1 text-muted-foreground">
            The point of the whole thing: a year you can hold.
          </p>
        </div>
      </header>

      {/* Being straight about what this actually does. Recording an order and
          producing the file is real; there is no print vendor wired up. */}
      <Card className="border-primary/30 bg-primary/5">
        <CardContent className="flex gap-3 py-4">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <div className="text-sm">
            <p className="font-medium">How this works right now</p>
            <p className="mt-1 text-muted-foreground">
              LifeBook records your order and produces the print-ready file - it is not connected to
              a print shop or a payment provider, because this runs on your own server. Use the print
              view to export a PDF and take it to any binding service, or keep the record here so the
              details are ready when you do.
            </p>
          </div>
        </CardContent>
      </Card>

      <form onSubmit={submit}>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle>What to bind</CardTitle>
            <CardDescription>
              {inRange.length} {inRange.length === 1 ? 'page' : 'pages'} in this range
              {sealed < inRange.length && `, ${sealed} of them sealed`}.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="from">From</Label>
                <Input id="from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="to">To</Label>
                <Input id="to" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
              </div>
            </div>

            {inRange.length > 0 && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="rounded-lg border border-border p-4">
                <div className="flex items-center gap-2 text-sm">
                  <BookOpen className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">
                    {longDate(inRange[inRange.length - 1].date)} - {longDate(inRange[0].date)}
                  </span>
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {inRange.slice(0, 12).map((p) => (
                    <Badge key={p.id} variant="secondary" className="text-[0.6rem]">
                      {shortDate(p.date)}
                    </Badge>
                  ))}
                  {inRange.length > 12 && (
                    <Badge variant="outline" className="text-[0.6rem]">+{inRange.length - 12} more</Badge>
                  )}
                </div>
              </motion.div>
            )}

            <div>
              <Label className="mb-3 block">Format</Label>
              <RadioGroup value={format} onValueChange={setFormat} className="gap-3">
                {FORMATS.map((f) => (
                  <label
                    key={f.id}
                    className={cn(
                      'flex cursor-pointer items-start gap-3 rounded-lg border p-4 transition-colors',
                      format === f.id ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'border-border hover:bg-muted',
                    )}
                  >
                    <RadioGroupItem value={f.id} className="mt-0.5" />
                    <div>
                      <p className="text-sm font-medium">{f.label}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">{f.hint}</p>
                    </div>
                  </label>
                ))}
              </RadioGroup>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="cover">Title on the cover</Label>
              <Input
                id="cover"
                value={coverTitle}
                onChange={(e) => setCoverTitle(e.target.value)}
                placeholder={`${user?.display_name || 'My'} - Volume One`}
              />
            </div>

            {format !== 'pdf' && (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="recipient">Ship to</Label>
                  <Input id="recipient" value={recipient} onChange={(e) => setRecipient(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="address">Address</Label>
                  <Textarea id="address" rows={3} value={address} onChange={(e) => setAddress(e.target.value)} />
                </div>
              </>
            )}

            <div className="flex flex-wrap gap-2">
              <Button type="submit" disabled={create.isPending || inRange.length === 0} className="gap-2">
                {create.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Package className="h-4 w-4" />}
                Record this order
              </Button>
              <Button asChild type="button" variant="outline" className="gap-2">
                <Link to="/lifebook/print"><Printer className="h-4 w-4" /> Export the PDF now</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </form>

      {orders.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle>Your orders</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="divide-y divide-border">
              {orders.map((o: { id: string; from_date: string; to_date: string; page_count: number; format: string; status: string; cover_title: string | null; created_at: string }) => (
                <li key={o.id} className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{o.cover_title || 'Untitled volume'}</p>
                    <p className="text-xs text-muted-foreground">
                      {o.page_count} pages, {o.format} - {shortDate(o.from_date)} to {shortDate(o.to_date)}
                    </p>
                  </div>
                  <Badge variant="secondary" className="shrink-0 capitalize">{o.status}</Badge>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
