"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowUpRight, BriefcaseBusiness, Dumbbell, Moon, Settings2, Sparkles, Target, TrendingUp } from "lucide-react";
import AccountMenu from "@/components/AccountMenu";
import { ensureUserSession, getSupabaseClient, type DailyLog, type DailyTask, type TaskCategory, type TaskStatus } from "@/lib/supabaseClient";

interface AnalyticsDay extends DailyLog {
  daily_tasks: DailyTask[];
}

const pillars: Array<{ label: string; category: TaskCategory | "sleep"; icon: typeof Dumbbell; color: string }> = [
  { label: "Fitness", category: "fitness", icon: Dumbbell, color: "bg-emerald-400" },
  { label: "DSA", category: "dsa", icon: Target, color: "bg-indigo-400" },
  { label: "Side hustle", category: "career", icon: Sparkles, color: "bg-amber-400" },
  { label: "Sleep", category: "sleep", icon: Moon, color: "bg-sky-400" },
];

function dateString(date: Date): string {
  return `${date.getFullYear()}-${`${date.getMonth() + 1}`.padStart(2, "0")}-${`${date.getDate()}`.padStart(2, "0")}`;
}

function startOfWeek(date: Date): Date {
  const result = new Date(date);
  result.setHours(12, 0, 0, 0);
  result.setDate(result.getDate() - ((result.getDay() + 6) % 7));
  return result;
}

function statusCredit(status: TaskStatus): number {
  return status === "done" ? 1 : status === "swapped" ? 0.5 : 0;
}

function average(values: number[]): number {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

export default function AnalyticsPage() {
  const [days, setDays] = useState<AnalyticsDay[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [targetSleep, setTargetSleep] = useState(5.5);
  const weeks = useMemo(() => {
    const currentMonday = startOfWeek(new Date());
    return Array.from({ length: 4 }, (_, weekIndex) => {
      const monday = new Date(currentMonday);
      monday.setDate(currentMonday.getDate() - (3 - weekIndex) * 7);
      return Array.from({ length: 7 }, (_, dayIndex) => {
        const date = new Date(monday);
        date.setDate(monday.getDate() + dayIndex);
        return dateString(date);
      });
    });
  }, []);

  useEffect(() => {
    async function loadAnalytics() {
      setLoading(true);
      setError(null);
      try {
        const userId = await ensureUserSession();
        const supabase = getSupabaseClient();
        const startDate = weeks[0][0];
        const endDate = weeks[3][6];
        const [{ data, error: logsError }, { data: settings, error: settingsError }] = await Promise.all([
          supabase.from("daily_logs").select("*, daily_tasks(*)").eq("user_id", userId).eq("has_checkin", true).gte("date", startDate).lte("date", endDate).order("date", { ascending: true }),
          supabase.from("user_settings").select("target_sleep_hours").eq("id", userId).maybeSingle(),
        ]);
        if (logsError) throw logsError;
        if (settingsError) throw settingsError;
        setDays((data ?? []) as AnalyticsDay[]);
        if (settings?.target_sleep_hours) setTargetSleep(Number(settings.target_sleep_hours));
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : "Unable to load analytics.");
      } finally {
        setLoading(false);
      }
    }
    void loadAnalytics();
  }, [weeks]);

  const daysByDate = useMemo(() => new Map(days.map((day) => [day.date, day])), [days]);
  const loggedDays = days.filter((day) => day.has_checkin);
  const sleepAverage = average(loggedDays.map((day) => Number(day.sleep_hours)));
  const scoreAverage = average(loggedDays.map((day) => Number(day.daily_score)));
  const correlation = loggedDays.length >= 2 ? pearsonCorrelation(loggedDays.map((day) => [Number(day.sleep_hours), Number(day.daily_score)])) : null;

  function pillarCompletion(category: TaskCategory | "sleep"): number {
    if (category === "sleep") {
      const sleepDays = loggedDays.filter((day) => Number(day.sleep_hours) > 0);
      return sleepDays.length ? Math.round((sleepDays.filter((day) => Number(day.sleep_hours) >= targetSleep).length / sleepDays.length) * 100) : 0;
    }
    const tasks = loggedDays.flatMap((day) => day.daily_tasks.filter((task) => task.category === category));
    return tasks.length ? Math.round((tasks.reduce((sum, task) => sum + statusCredit(task.status), 0) / tasks.length) * 100) : 0;
  }

  function dayPillarScore(day: AnalyticsDay | undefined, category: TaskCategory | "sleep"): number | null {
    if (!day) return null;
    if (category === "sleep") {
      return day.sleep_hours > 0 ? Math.min(1, Number(day.sleep_hours) / targetSleep) : 0;
    }
    const relatedTasks = day.daily_tasks.filter((task) => task.category === category);
    return relatedTasks.length ? average(relatedTasks.map((task) => statusCredit(task.status))) : null;
  }

  return (
    <main className="min-h-screen pb-12">
      <header className="border-b border-line/80">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-5 sm:px-8">
          <Link href="/dashboard" className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500/15 text-indigo-300"><TrendingUp size={21} /></span><span><span className="block text-sm font-bold tracking-[0.14em] text-white">APEXTRACK</span><span className="block text-xs text-slate-500">Progress & patterns</span></span></Link>
          <div className="flex items-center gap-2">
            <Link href="/dashboard" className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-400 transition hover:bg-slate-800 hover:text-white"><ArrowLeft size={15} /> Dashboard</Link>
            <Link href="/dashboard/settings" aria-label="Routine and schedule settings" className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-800 hover:text-white"><Settings2 size={17} /></Link>
            <AccountMenu />
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-5 pt-8 sm:px-8">
        <div className="mb-7">
          <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-indigo-300"><TrendingUp size={14} /> Last 4 weeks</div>
          <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">Progress, not perfection.</h1>
          <p className="mt-2 text-sm text-slate-400">Spot the patterns across the habits that move you forward.</p>
        </div>
        {error && <div role="alert" className="mb-5 rounded-xl border border-rose-400/30 bg-rose-400/10 px-4 py-3 text-sm text-rose-200">{error}</div>}

        <section className="grid gap-4 sm:grid-cols-3">
          <StatCard label="Average execution" value={`${Math.round(scoreAverage)}%`} detail={`${loggedDays.length} logged days`} icon={TrendingUp} />
          <StatCard label="Average sleep" value={`${sleepAverage.toFixed(1)}h`} detail={`Target ${targetSleep.toFixed(1)}h`} icon={Moon} />
          <StatCard label="Active days" value={`${loggedDays.length}`} detail="Daily plans with activity" icon={BriefcaseBusiness} />
        </section>

        <section className="mt-7 grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
          <div className="rounded-2xl border border-line bg-panel p-5 sm:p-6">
            <div className="mb-6 flex items-center justify-between">
              <div><h2 className="font-semibold text-white">Consistency heatmap</h2><p className="mt-1 text-xs text-slate-500">Daily completion by pillar · Swaps earn half credit</p></div>
              {loading && <span className="text-xs text-indigo-300">Loading...</span>}
            </div>
            <div className="overflow-x-auto">
              <div className="min-w-[560px]">
                <div className="grid grid-cols-[105px_repeat(7,minmax(0,1fr))] gap-2 pb-2">
                  <span />
                  {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => <span key={day} className="text-center text-[10px] font-semibold uppercase text-slate-600">{day}</span>)}
                </div>
                {pillars.map((pillar) => (
                  <div key={pillar.category} className="mb-3 grid grid-cols-[105px_repeat(7,minmax(0,1fr))] items-center gap-2">
                    <span className="flex items-center gap-2 text-xs text-slate-400"><pillar.icon size={13} />{pillar.label}</span>
                    {weeks.flatMap((week, weekIndex) => week.map((date, dayIndex) => {
                      const value = dayPillarScore(daysByDate.get(date), pillar.category);
                      return <span key={`${weekIndex}-${dayIndex}`} title={`${date}: ${value === null ? "No data" : `${Math.round(value * 100)}%`}`} className={`h-8 rounded-md border ${heatColor(value)}`} />;
                    }))}
                  </div>
                ))}
                <div className="mt-5 flex items-center justify-end gap-2 text-[10px] text-slate-500"><span>Less</span>{[null, 0.2, 0.5, 0.8, 1].map((value, index) => <span key={index} className={`h-3 w-3 rounded-sm border ${heatColor(value)}`} />)}<span>More</span></div>
                <div className="mt-4 grid grid-cols-4 gap-2 text-center text-[10px] text-slate-600">{weeks.map((week, index) => <span key={index}>{new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(new Date(`${week[0]}T12:00:00`))}</span>)}</div>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-line bg-panel p-5 sm:p-6">
            <div className="mb-6"><h2 className="font-semibold text-white">Pillar breakdown</h2><p className="mt-1 text-xs text-slate-500">Completion rate across logged activity</p></div>
            <div className="space-y-5">
              {pillars.map((pillar) => {
                const Icon = pillar.icon;
                const percentage = pillarCompletion(pillar.category);
                return (
                  <div key={pillar.category}>
                    <div className="mb-2 flex items-center justify-between text-sm"><span className="flex items-center gap-2 text-slate-300"><Icon size={15} className="text-slate-500" />{pillar.label}</span><span className="font-medium text-white">{percentage}%</span></div>
                    <div className="h-2 overflow-hidden rounded-full bg-slate-800"><div className={`h-full rounded-full ${pillar.color} transition-all`} style={{ width: `${percentage}%` }} /></div>
                  </div>
                );
              })}
            </div>
            <p className="mt-6 border-t border-line pt-4 text-xs leading-5 text-slate-500">Sleep completion measures days at or above your configured target. Swap logs count as half completion for activity pillars.</p>
          </div>
        </section>

        <section className="mt-6 rounded-2xl border border-line bg-panel p-5 sm:p-6">
          <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-center">
            <div className="max-w-xl">
              <div className="flex items-center gap-2"><Moon size={17} className="text-sky-300" /><h2 className="font-semibold text-white">Sleep vs. output</h2></div>
              <p className="mt-2 text-sm leading-6 text-slate-400">Compare your average sleep with execution scores. The relationship is directional, not a measure of causation.</p>
            </div>
            <div className="flex gap-8">
              <div><div className="text-xs text-slate-500">Avg. sleep</div><div className="mt-1 text-2xl font-semibold text-sky-200">{sleepAverage.toFixed(1)}<span className="ml-1 text-sm font-normal text-slate-500">hrs</span></div></div>
              <div><div className="text-xs text-slate-500">Avg. output</div><div className="mt-1 text-2xl font-semibold text-indigo-200">{Math.round(scoreAverage)}<span className="ml-1 text-sm font-normal text-slate-500">%</span></div></div>
              <div><div className="text-xs text-slate-500">Sleep/output</div><div className="mt-1 flex items-center gap-1 text-2xl font-semibold text-white">{correlation === null ? "—" : `${correlation > 0 ? "+" : ""}${correlation.toFixed(2)}`}<ArrowUpRight size={16} className="text-slate-500" /></div></div>
            </div>
          </div>
          {loggedDays.length < 2 && <p className="mt-5 rounded-lg bg-slate-900/70 px-3 py-2 text-xs text-slate-500">Log at least two days of sleep and tasks to show a correlation.</p>}
        </section>
      </div>
    </main>
  );
}

function StatCard({ label, value, detail, icon: Icon }: { label: string; value: string; detail: string; icon: typeof TrendingUp }) {
  return <div className="rounded-2xl border border-line bg-panel p-5"><div className="flex items-center justify-between"><span className="text-sm text-slate-400">{label}</span><Icon size={17} className="text-indigo-300" /></div><div className="mt-3 text-3xl font-semibold text-white">{value}</div><p className="mt-1 text-xs text-slate-500">{detail}</p></div>;
}

function heatColor(value: number | null): string {
  if (value === null) return "border-line bg-slate-900/80";
  if (value === 0) return "border-rose-500/15 bg-rose-500/10";
  if (value < 0.35) return "border-indigo-500/20 bg-indigo-500/20";
  if (value < 0.7) return "border-indigo-400/25 bg-indigo-400/40";
  return "border-indigo-300/30 bg-indigo-400/80";
}

function pearsonCorrelation(points: Array<[number, number]>): number | null {
  const meanX = average(points.map(([x]) => x));
  const meanY = average(points.map(([, y]) => y));
  const numerator = points.reduce((sum, [x, y]) => sum + (x - meanX) * (y - meanY), 0);
  const denominator = Math.sqrt(
    points.reduce((sum, [x]) => sum + (x - meanX) ** 2, 0)
    * points.reduce((sum, [, y]) => sum + (y - meanY) ** 2, 0),
  );
  return denominator === 0 ? null : numerator / denominator;
}
