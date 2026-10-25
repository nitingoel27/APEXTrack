"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity, ArrowLeft, ArrowRight, BriefcaseBusiness, Check, CheckCircle2, Dumbbell,
  Flame, LayoutDashboard, LoaderCircle, Moon, Settings2, Sparkles, Target, TrendingUp,
} from "lucide-react";
import SubstitutionModal from "@/components/SubstitutionModal";
import AccountMenu from "@/components/AccountMenu";
import {
  type DailyLog, type DailyTask, type TaskCategory, type TaskStatus,
  isOfficeDay, loadDailyPlan, scoreTasks, updateDailyTask, updateSleepHours,
} from "@/lib/supabaseClient";

const categoryLabel: Record<TaskCategory, string> = {
  fitness: "Fitness",
  dsa: "DSA practice",
  career: "Career growth",
  work: "Work",
};

const categoryIcon: Record<TaskCategory, typeof Dumbbell> = {
  fitness: Dumbbell,
  dsa: Target,
  career: Sparkles,
  work: BriefcaseBusiness,
};

const statusClasses: Record<TaskStatus, string> = {
  done: "border-emerald-400/30 bg-emerald-400/10 text-emerald-300",
  swapped: "border-amber-400/30 bg-amber-400/10 text-amber-300",
  missed: "border-rose-400/30 bg-rose-400/10 text-rose-300",
};

const statusLabel: Record<TaskStatus, string> = {
  done: "Done",
  swapped: "Swapped",
  missed: "Missed",
};

function localDate(date: Date): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function weekDates(date: string): string[] {
  const selected = new Date(`${date}T12:00:00`);
  const mondayOffset = (selected.getDay() + 6) % 7;
  selected.setDate(selected.getDate() - mondayOffset);
  return Array.from({ length: 7 }, (_, index) => {
    const day = new Date(selected);
    day.setDate(selected.getDate() + index);
    return localDate(day);
  });
}

function formatDate(date: string, options: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat("en", options).format(new Date(`${date}T12:00:00`));
}

export default function DashboardPage() {
  const [selectedDate, setSelectedDate] = useState(() => localDate(new Date()));
  const [log, setLog] = useState<DailyLog | null>(null);
  const [tasks, setTasks] = useState<DailyTask[]>([]);
  const [sleepHours, setSleepHours] = useState(5.5);
  const [targetSleepHours, setTargetSleepHours] = useState(5.5);
  const [officeDays, setOfficeDays] = useState([3, 4]);
  const [loading, setLoading] = useState(true);
  const [savingTask, setSavingTask] = useState<string | null>(null);
  const [savingSleep, setSavingSleep] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [swapTask, setSwapTask] = useState<DailyTask | null>(null);
  const today = localDate(new Date());
  const dates = useMemo(() => weekDates(selectedDate), [selectedDate]);

  const refresh = useCallback(async (date: string) => {
    setLoading(true);
    setError(null);
    try {
      const plan = await loadDailyPlan(date);
      setLog(plan.log);
      setTasks(plan.tasks);
      setSleepHours(plan.log.sleep_hours);
      setTargetSleepHours(plan.targetSleepHours);
      setOfficeDays(plan.officeDays);
    } catch (reason) {
      setLog(null);
      setTasks([]);
      setError(reason instanceof Error ? reason.message : "Unable to load your daily plan.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh(selectedDate);
  }, [selectedDate, refresh]);

  async function saveTask(task: DailyTask, status: TaskStatus, note: string | null) {
    if (!log) return;
    const previousTasks = tasks;
    const optimistic = tasks.map((item) => item.id === task.id
      ? { ...item, status, substitution_note: status === "swapped" ? note : null }
      : item);
    setTasks(optimistic);
    setLog({ ...log, daily_score: scoreTasks(optimistic) });
    setSavingTask(task.id);
    setError(null);
    try {
      const result = await updateDailyTask(log.id, task.id, status, note);
      setTasks((current) => current.map((item) => item.id === result.task.id ? result.task : item));
      setLog((current) => current ? { ...current, daily_score: result.score } : current);
      setSwapTask(null);
    } catch (reason) {
      setTasks(previousTasks);
      setLog(log);
      setError(reason instanceof Error ? reason.message : "Unable to save this task.");
    } finally {
      setSavingTask(null);
    }
  }

  async function saveSleep(value: number) {
    setSleepHours(value);
    if (!log) return;
    setSavingSleep(true);
    setError(null);
    try {
      await updateSleepHours(log.id, value);
      setLog((current) => current ? { ...current, sleep_hours: value } : current);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to save sleep hours.");
      setSleepHours(log.sleep_hours);
    } finally {
      setSavingSleep(false);
    }
  }

  function moveDate(amount: number) {
    const date = new Date(`${selectedDate}T12:00:00`);
    date.setDate(date.getDate() + amount);
    setSelectedDate(localDate(date));
  }

  const doneCount = tasks.filter((task) => task.status === "done").length;
  const activeCount = tasks.filter((task) => task.status !== "missed").length;
  const score = log ? scoreTasks(tasks) : 0;

  return (
    <main className="min-h-screen pb-12">
      <header className="border-b border-line/80">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-5 sm:px-8">
          <Link href="/dashboard" className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500/15 text-indigo-300"><Activity size={21} /></span>
            <span><span className="block text-sm font-bold tracking-[0.14em] text-white">APEXTRACK</span><span className="block text-xs text-slate-500">Personal execution system</span></span>
          </Link>
          <nav className="flex items-center gap-2">
            <span className="hidden items-center gap-2 rounded-lg border border-indigo-400/20 bg-indigo-400/5 px-3 py-2 text-xs font-medium text-indigo-200 sm:flex"><LayoutDashboard size={14} /> Dashboard</span>
            <Link href="/dashboard/analytics" className="rounded-lg px-3 py-2 text-sm text-slate-400 transition hover:bg-slate-800 hover:text-white">Analytics</Link>
            <Link href="/dashboard/settings" aria-label="Routine and schedule settings" className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-800 hover:text-white"><Settings2 size={17} /></Link>
            <AccountMenu />
          </nav>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-5 pt-8 sm:px-8">
        <section className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
          <div>
            <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-indigo-300"><Flame size={14} /> Daily command center</div>
            <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">Make today count.</h1>
            <p className="mt-2 text-sm text-slate-400">Consistency over perfection. Adapt the plan, then log the tradeoff.</p>
          </div>
          <div className="flex items-center gap-2 self-start rounded-xl border border-line bg-panel p-1.5 md:self-auto">
            <button onClick={() => moveDate(-1)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white" aria-label="Previous day"><ArrowLeft size={16} /></button>
            <input type="date" value={selectedDate} max="9999-12-31" onChange={(event) => event.target.value && setSelectedDate(event.target.value)} className="w-36 bg-transparent px-1 text-sm font-medium text-slate-200 outline-none [color-scheme:dark]" aria-label="Select date" />
            <button onClick={() => moveDate(1)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white" aria-label="Next day"><ArrowRight size={16} /></button>
          </div>
        </section>

        <section aria-label="Current week" className="mt-7 grid grid-cols-7 gap-2">
          {dates.map((date) => {
            const isOffice = date === log?.date ? log.is_office_day : isOfficeDay(date, officeDays);
            const isSelected = date === selectedDate;
            return (
              <button key={date} onClick={() => setSelectedDate(date)} className={`rounded-xl border px-2 py-3 text-center transition sm:px-3 ${isSelected ? "border-indigo-400/60 bg-indigo-500/15 shadow-lg shadow-indigo-950/30" : "border-line bg-panel/70 hover:border-slate-600"}`}>
                <span className={`block text-[10px] font-semibold uppercase tracking-wider sm:text-xs ${isSelected ? "text-indigo-200" : "text-slate-500"}`}>{formatDate(date, { weekday: "short" })}</span>
                <span className={`mt-1 block text-sm font-semibold ${isSelected ? "text-white" : "text-slate-300"}`}>{formatDate(date, { day: "numeric" })}</span>
                <span className={`mx-auto mt-2 block h-1 w-1 rounded-full ${isOffice ? "bg-amber-400" : "bg-slate-600"}`} title={isOffice ? "Office day" : "Work from home"} />
                <span className="mt-1 hidden text-[9px] text-slate-500 sm:block">{isOffice ? "OFFICE" : "WFH"}</span>
              </button>
            );
          })}
        </section>

        {error && <div role="alert" className="mt-5 rounded-xl border border-rose-400/30 bg-rose-400/10 px-4 py-3 text-sm text-rose-200">{error}</div>}

        <section className="mt-6 grid gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-line bg-panel p-5">
            <div className="flex items-center justify-between"><span className="text-sm text-slate-400">Execution score</span><TrendingUp size={17} className="text-indigo-300" /></div>
            <div className="mt-3 flex items-baseline gap-2"><span className="text-3xl font-semibold text-white">{score}%</span><span className="text-xs text-slate-500">weighted</span></div>
            <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-slate-800"><div className="h-full rounded-full bg-indigo-400 transition-all" style={{ width: `${score}%` }} /></div>
          </div>
          <div className="rounded-2xl border border-line bg-panel p-5">
            <div className="flex items-center justify-between"><span className="text-sm text-slate-400">Tasks completed</span><CheckCircle2 size={17} className="text-emerald-300" /></div>
            <div className="mt-3 flex items-baseline gap-2"><span className="text-3xl font-semibold text-white">{doneCount}<span className="text-slate-600">/{tasks.length}</span></span><span className="text-xs text-slate-500">{activeCount} done or adapted</span></div>
            <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-slate-800"><div className="h-full rounded-full bg-emerald-400 transition-all" style={{ width: tasks.length ? `${(activeCount / tasks.length) * 100}%` : "0%" }} /></div>
          </div>
          <div className="rounded-2xl border border-line bg-panel p-5">
            <div className="flex items-center justify-between"><span className="text-sm text-slate-400">Work mode</span><BriefcaseBusiness size={17} className="text-amber-300" /></div>
            <div className="mt-3 text-2xl font-semibold text-white">{log?.is_office_day ? "Office day" : "Work from home"}</div>
            <p className="mt-1 text-xs text-slate-500">{formatDate(selectedDate, { weekday: "long", month: "short", day: "numeric" })} · {selectedDate === today ? "Today" : selectedDate < today ? "Past day" : "Plan ahead"}</p>
          </div>
        </section>

        <section className="mt-8 grid gap-6 lg:grid-cols-[1fr_330px]">
          <div>
            <div className="mb-4 flex items-end justify-between">
              <div><h2 className="text-lg font-semibold text-white">Daily execution</h2><p className="mt-1 text-sm text-slate-500">Mark the outcome that reflects what actually happened.</p></div>
              {loading && <LoaderCircle size={18} className="animate-spin text-indigo-300" aria-label="Loading" />}
            </div>
            <div className="space-y-3">
              {loading && tasks.length === 0 && <div className="rounded-2xl border border-line bg-panel p-8 text-center text-sm text-slate-500">Loading your plan...</div>}
              {!loading && tasks.length === 0 && !error && <div className="rounded-2xl border border-line bg-panel p-8 text-center text-sm text-slate-500">No tasks available for this date.</div>}
              {tasks.map((task) => {
                const Icon = categoryIcon[task.category];
                const isSaving = Boolean(savingTask);
                return (
                  <article key={task.id} className="rounded-2xl border border-line bg-panel p-4 sm:p-5">
                    <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                      <div className="flex min-w-0 items-center gap-3">
                        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-800/80 text-slate-300"><Icon size={19} /></span>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2"><h3 className="font-medium text-white">{task.task_name}</h3><span className="rounded-full border border-line px-2 py-0.5 text-[10px] text-slate-500">{categoryLabel[task.category]}</span></div>
                          <p className="mt-1 text-xs text-slate-500">Weight {task.weight.toFixed(2)} · {task.status === "swapped" && task.substitution_note ? task.substitution_note : `Status: ${statusLabel[task.status]}`}</p>
                        </div>
                      </div>
                      <div className="flex shrink-0 gap-1.5">
                        <button onClick={() => void saveTask(task, "done", null)} disabled={isSaving} aria-label={`Mark ${task.task_name} done`} className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium transition disabled:opacity-50 ${task.status === "done" ? statusClasses.done : "border-line text-slate-400 hover:border-emerald-400/40 hover:text-emerald-300"}`}><Check size={14} /><span className="hidden sm:inline">Done</span></button>
                        <button onClick={() => setSwapTask(task)} disabled={isSaving} aria-label={`Log a substitute for ${task.task_name}`} className={`rounded-lg border px-3 py-2 text-xs font-medium transition disabled:opacity-50 ${task.status === "swapped" ? statusClasses.swapped : "border-line text-slate-400 hover:border-amber-400/40 hover:text-amber-300"}`}>Swap</button>
                        <button onClick={() => void saveTask(task, "missed", null)} disabled={isSaving} aria-label={`Mark ${task.task_name} missed`} className={`rounded-lg border px-3 py-2 text-xs font-medium transition disabled:opacity-50 ${task.status === "missed" ? statusClasses.missed : "border-line text-slate-400 hover:border-rose-400/40 hover:text-rose-300"}`}>Missed</button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>

          <aside className="space-y-4">
            <section className="rounded-2xl border border-line bg-panel p-5">
              <div className="flex items-center justify-between">
                <div><h2 className="font-semibold text-white">Sleep check-in</h2><p className="mt-1 text-xs text-slate-500">Target: {targetSleepHours.toFixed(1)} hours</p></div>
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-400/10 text-indigo-300"><Moon size={18} /></span>
              </div>
              <div className="mt-5 flex items-baseline gap-2"><span className="text-3xl font-semibold text-white">{sleepHours.toFixed(1)}</span><span className="text-sm text-slate-500">hours</span>{savingSleep && <LoaderCircle size={14} className="animate-spin text-indigo-300" />}</div>
              <input type="range" min="0" max="12" step="0.25" value={sleepHours} onChange={(event) => setSleepHours(Number(event.target.value))} onPointerUp={(event) => void saveSleep(Number(event.currentTarget.value))} onKeyUp={(event) => { if (event.key.startsWith("Arrow")) void saveSleep(Number(event.currentTarget.value)); }} className="mt-4 w-full accent-indigo-400" aria-label="Sleep hours" />
              <div className="mt-2 flex justify-between text-[10px] text-slate-600"><span>0h</span><span>12h</span></div>
              <p className="mt-4 text-xs leading-5 text-slate-500">Log what you got, not what you planned. Your analytics will show how sleep tracks with output.</p>
            </section>
            <section className="rounded-2xl border border-indigo-400/15 bg-indigo-400/[0.06] p-5">
              <div className="flex items-center gap-2 text-indigo-200"><Sparkles size={16} /><h2 className="text-sm font-semibold">Flexibility is a feature</h2></div>
              <p className="mt-3 text-sm leading-6 text-slate-400">A swap earns half credit when you record the alternative. A missed block is data, not a verdict. Re-plan without losing the thread.</p>
            </section>
            <Link href="/dashboard/analytics" className="flex items-center justify-between rounded-xl border border-line bg-panel px-4 py-3 text-sm text-slate-300 transition hover:border-indigo-400/30 hover:text-white">
              <span className="flex items-center gap-2"><TrendingUp size={16} className="text-indigo-300" /> View your trends</span><ArrowRight size={15} className="text-slate-500" />
            </Link>
          </aside>
        </section>
      </div>
      <SubstitutionModal
        taskName={swapTask?.task_name ?? ""}
        isOpen={Boolean(swapTask)}
        isSaving={Boolean(swapTask && savingTask === swapTask.id)}
        onClose={() => setSwapTask(null)}
        onSave={(note) => swapTask && void saveTask(swapTask, "swapped", note)}
      />
    </main>
  );
}
