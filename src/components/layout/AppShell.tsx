import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import {
  LayoutDashboard, BookOpen, FolderOpen, Target, BarChart3, Award,
  Timer, CalendarCheck, HeartPulse, PenLine, Sparkles, Newspaper, LifeBuoy,
  Settings as SettingsIcon, Menu, LogOut, User as UserIcon,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { NotificationsBell } from '@/components/layout/NotificationsBell';
import { GeneratePageButton } from '@/components/lifebook/GeneratePageButton';
import { DayAssistant } from '@/components/assistant/DayAssistant';
import { cn } from '@/lib/utils';
import logoMark from '@/assets/logo-mark.png';

function LogoBadge({ className }: { className?: string }) {
  return (
    <div className={cn('flex shrink-0 items-center justify-center rounded-lg bg-primary/10 p-1.5', className)}>
      <img src={logoMark} alt="" className="h-full w-full object-contain logo-mono" />
    </div>
  );
}

// Two groups, mirroring the prototype's sidebar: the book and its instruments
// up top, the daily pages below. "Pages" are the screens that write the data a
// LifePage is made of - the grouping is the product's mental model, not decoration.
const NAV_GROUPS = [
  {
    label: null,
    items: [
      { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { to: '/lifebook', label: 'Your LifeBook', icon: BookOpen },
      { to: '/resources', label: 'Your Resources', icon: FolderOpen },
      { to: '/challenges', label: 'Challenge Hub', icon: Target },
      { to: '/analytics', label: 'Analytics', icon: BarChart3 },
      { to: '/badges', label: 'Your Badges', icon: Award },
    ],
  },
  {
    label: 'Pages',
    items: [
      { to: '/study', label: 'Study Now', icon: Timer },
      { to: '/plan', label: 'Plan your day', icon: CalendarCheck },
      { to: '/wellness', label: 'Health Booster', icon: HeartPulse },
      { to: '/journal', label: 'Personal Journal', icon: PenLine },
      { to: '/motivation', label: 'Motivation Hub', icon: Sparkles },
      { to: '/feed', label: 'Your Feed', icon: Newspaper },
      { to: '/feeling-low', label: 'Feeling Low?', icon: LifeBuoy },
    ],
  },
];

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <nav className="flex flex-col gap-4">
      {NAV_GROUPS.map((group, i) => (
        <div key={group.label || i} className="flex flex-col gap-1">
          {group.label && (
            <p className="px-3 pb-1 text-[0.65rem] font-semibold uppercase tracking-wider text-muted-foreground/70">
              {group.label}
            </p>
          )}
          {group.items.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              onClick={onNavigate}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                )
              }
            >
              <Icon className="h-4 w-4 shrink-0" />
              {label}
            </NavLink>
          ))}
        </div>
      ))}
    </nav>
  );
}

function UserFooter({ compact }: { compact?: boolean }) {
  const { user, signOut } = useAuth();
  const initials = (user?.display_name || user?.username || '?').slice(0, 2).toUpperCase();
  return (
    <div className={cn('flex items-center gap-2 border-t border-border pt-4', compact && 'border-t-0 pt-0')}>
      <Link to="/profile" className="flex min-w-0 flex-1 items-center gap-2 rounded-lg p-1 hover:bg-muted">
        <Avatar className="h-8 w-8">
          {user?.avatar_url && <AvatarImage src={user.avatar_url} alt="" />}
          <AvatarFallback>{initials}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{user?.display_name}</p>
          <p className="truncate text-xs text-muted-foreground">@{user?.username}</p>
        </div>
      </Link>
      <Button variant="ghost" size="icon" onClick={signOut} title="Sign out">
        <LogOut className="h-4 w-4" />
      </Button>
    </div>
  );
}

export function AppShell() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const reduceMotion = useReducedMotion();

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto flex max-w-[1500px]">
        {/* Desktop sidebar */}
        <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col overflow-y-auto border-r border-border p-4 md:flex">
          <div className="mb-6 flex items-center justify-between px-2">
            <Link to="/dashboard" className="flex items-center gap-2">
              <LogoBadge className="h-8 w-8" />
              <span className="text-lg font-semibold">LifeBook</span>
            </Link>
            <NotificationsBell />
          </div>
          <NavLinks />
          <div className="mt-auto flex flex-col gap-1 pt-6">
            <NavLink
              to="/settings"
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                  isActive ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                )
              }
            >
              <SettingsIcon className="h-4 w-4 shrink-0" />
              Settings
            </NavLink>
            <div className="pt-3">
              <UserFooter />
            </div>
          </div>
        </aside>

        {/* min-w-0 is load-bearing: a flex child defaults to min-width:auto and
            refuses to shrink below its content's intrinsic width, so without it
            one wide chart or habit row pushes the whole page into a horizontal
            scroll on a phone. */}
        <div className="flex min-h-screen min-w-0 flex-1 flex-col">
          {/* Mobile top bar */}
          <header className="sticky top-0 z-30 flex items-center justify-between border-b border-border bg-background/95 px-4 py-3 backdrop-blur md:hidden">
            <Link to="/dashboard" className="flex items-center gap-2">
              <LogoBadge className="h-7 w-7" />
              <span className="font-semibold">LifeBook</span>
            </Link>
            <div className="flex items-center gap-1">
              <NotificationsBell />
              <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="icon" aria-label="Open menu">
                    <Menu className="h-5 w-5" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="left" className="flex w-64 flex-col overflow-y-auto p-4">
                  <Link to="/dashboard" className="mb-6 flex items-center gap-2 px-2" onClick={() => setMobileOpen(false)}>
                    <LogoBadge className="h-8 w-8" />
                    <span className="text-lg font-semibold">LifeBook</span>
                  </Link>
                  <NavLinks onNavigate={() => setMobileOpen(false)} />
                  <div className="mt-6 flex flex-col gap-1">
                    <NavLink
                      to="/settings"
                      onClick={() => setMobileOpen(false)}
                      className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
                    >
                      <SettingsIcon className="h-4 w-4" /> Settings
                    </NavLink>
                    <NavLink
                      to="/profile"
                      onClick={() => setMobileOpen(false)}
                      className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
                    >
                      <UserIcon className="h-4 w-4" /> Your Profile
                    </NavLink>
                  </div>
                  <div className="mt-auto pt-6">
                    <UserFooter compact />
                  </div>
                </SheetContent>
              </Sheet>
            </div>
          </header>

          <main className="flex-1 p-4 pb-28 md:p-8 md:pb-28">
            {/* Route transition. Purely decorative - the DOM is complete before
                the animation runs, so reduced-motion users lose nothing. */}
            <AnimatePresence mode="wait">
              <motion.div
                key={location.pathname}
                initial={reduceMotion ? false : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={reduceMotion ? undefined : { opacity: 0, y: -6 }}
                transition={{ duration: 0.22, ease: 'easeOut' }}
              >
                <Outlet />
              </motion.div>
            </AnimatePresence>
          </main>
        </div>
      </div>

      {/* The two things you can do from anywhere: talk about your day, and turn
          it into today's page. They share one corner stack so neither covers
          the other on a narrow screen. */}
      <div className="fixed bottom-6 right-4 z-40 flex flex-col items-end gap-3 no-print md:right-6">
        <GeneratePageButton />
        <DayAssistant />
      </div>
    </div>
  );
}
