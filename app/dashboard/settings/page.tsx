"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  ArrowDown, ArrowLeft, ArrowUp, BriefcaseBusiness, Check, Clock3, LoaderCircle,
  Plus, Settings2, Trash2, Dumbbell, Target, Sparkles,
} from "lucide-react";
import AccountMenu from "@/components/AccountMenu";
import {
  type RoutineTask, type TaskCategory, defaultRoutine, deleteRoutineTask,
  loadUserConfiguration, saveRoutineTask, saveUserSettings,
} from "@/lib/supabaseClient";

const weekdays = [
  { label: "Mon", value: 1 },
  { label: "Tue", value: 2 },
  { label: "Wed", value: 3 },
  { label: "Thu", value: 4 },
  { label: "Fri", value: 5 },
  { label: "Sat", value: 6 },
  { label: "Sun", value: 7 },
];

const categories: Array<{ value: TaskCategory; label: string }> = [
  { value: "fitness", label: "Fitness" },
  { value: "dsa", label: "DSA practice" },
  { value: "career", label: "Career growth" },
  { value: "work", label: "Work" },
];

const categoryIcons: Record<TaskCategory, typeof Dumbbell> = {
  fitness: Dumbbell,
  dsa: Target,
  career: Sparkles,
  work: BriefcaseBusiness,
};

function errorMessage(reason: unknown): string {
  return reason instanceof Error ? reason.message : "Something went wrong. Please try again.";
}

export default function SettingsPage() {
  const [routines, setRoutines] = useState<RoutineTask[]>([]);
  const [officeDays, setOfficeDays] = useState<number[]>([3, 4]);
  const [targetSleepHours, setTargetSleepHours] = useState(5.5);
  const [newTask, setNewTask] = useState({ task_name: "", category: "fitness" as TaskCategory, weight: 1 });
  const [loading, setLoading] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);
  const [savingTaskId, setSavingTaskId] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const configuration = await loadUserConfiguration();
      setRoutines(configuration.routines);
      setOfficeDays(configuration.settings.office_days);
      setTargetSleepHours(Number(configuration.settings.target_sleep_hours));
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  function updateRoutine(taskId: string, update: Partial<RoutineTask>) {
    setRoutines((current) => current.map((task) => task.id === taskId ? { ...task, ...update } : task));
  }

  function toggleOfficeDay(day: number) {
    setOfficeDays((current) => current.includes(day)
      ? current.filter((value) => value !== day)
      : [...current, day].sort((a, b) => a - b));
  }

  async function saveSchedule() {
    setSavingSettings(true);
    setError(null);
    setNotice(null);
    try {
      await saveUserSettings({ office_days: officeDays, target_sleep_hours: targetSleepHours });
      setNotice("Schedule and sleep target saved. New daily plans will use these settings.");
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setSavingSettings(false);
    }
  }

  async function saveTask(task: RoutineTask) {
    setSavingTaskId(task.id);
    setError(null);
    setNotice(null);
    try {
      const savedTask = await saveRoutineTask({
        id: task.id,
        task_name: task.task_name.trim(),
        category: task.category,
        weight: Number(task.weight),
        sort_order: task.sort_order,
        is_active: task.is_active,
      });
      setRoutines((current) => current.map((item) => item.id === savedTask.id ? savedTask : item));
      setNotice(`Saved “${savedTask.task_name}”. Existing daily logs are unchanged.`);
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setSavingTaskId(null);
    }
  }

  async function addTask(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = newTask.task_name.trim();
    if (!name) return;
    if (routines.some((task) => task.task_name.trim().toLocaleLowerCase() === name.toLocaleLowerCase())) {
      setError("A routine task with that name already exists.");
      return;
    }

    setIsAdding(true);
    setError(null);
    setNotice(null);
    try {
      const savedTask = await saveRoutineTask({
        task_name: name,
        category: newTask.category,
        weight: Number(newTask.weight),
        sort_order: routines.length ? Math.max(...routines.map((task) => task.sort_order)) + 1 : 0,
        is_active: true,
      });
      setRoutines((current) => [...current, savedTask].sort((a, b) => a.sort_order - b.sort_order));
      setNewTask({ task_name: "", category: "fitness", weight: 1 });
      setNotice(`Added “${savedTask.task_name}” to your routine.`);
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setIsAdding(false);
    }
  }

  async function removeTask(task: RoutineTask) {
    if (!window.confirm(`Remove “${task.task_name}” from future daily plans? Existing logs will stay unchanged.`)) return;
    setSavingTaskId(task.id);
    setError(null);
    setNotice(null);
    try {
      await deleteRoutineTask(task.id);
      setRoutines((current) => current.filter((item) => item.id !== task.id));
      setNotice(`Removed “${task.task_name}” from your routine. Existing daily logs are unchanged.`);
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setSavingTaskId(null);
    }
  }

  async function moveTask(index: number, direction: -1 | 1) {
    const destination = index + direction;
    if (destination < 0 || destination >= routines.length) return;
    const reordered = [...routines];
    [reordered[index], reordered[destination]] = [reordered[destination], reordered[index]];
    const normalized = reordered.map((task, position) => ({ ...task, sort_order: position }));
    setRoutines(normalized);
    setError(null);
    setNotice(null);
    setSavingTaskId("reorder");
    try {
      for (const task of normalized) {
        if (routines.find((item) => item.id === task.id)?.sort_order !== task.sort_order) {
          await saveRoutineTask({
            id: task.id,
            task_name: task.task_name,
            category: task.category,
            weight: Number(task.weight),
            sort_order: task.sort_order,
            is_active: task.is_active,
          });
        }
      }
      setNotice("Routine order saved for new daily plans.");
    } catch (reason) {
      await refresh();
      setError(errorMessage(reason));
    } finally {
      setSavingTaskId(null);
    }
  }

  async function restoreDefaults() {
    if (!window.confirm("Restore the five starter routine tasks? Existing tasks will be kept, and deleted starter tasks will be recreated.")) return;
    setError(null);
    setNotice(null);
    setSavingTaskId("defaults");
    try {
      const restored = await Promise.all(defaultRoutine.map((task) => {
        const existing = routines.find((routine) => routine.task_name.toLocaleLowerCase() === task.task_name.toLocaleLowerCase());
        return saveRoutineTask({ ...task, id: existing?.id, is_active: true });
      }));
      setRoutines((current) => {
        const byName = new Map(current.map((task) => [task.task_name.toLocaleLowerCase(), task]));
        restored.forEach((task) => byName.set(task.task_name.toLocaleLowerCase(), task));
        return [...byName.values()].sort((a, b) => a.sort_order - b.sort_order);
      });
      setNotice("Starter routine tasks restored. You can edit them to match your routine.");
    } catch (reason) {
      await refresh();
      setError(errorMessage(reason));
    } finally {
      setSavingTaskId(null);
    }
  }

  return (
    <main className="min-h-screen pb-12">
      <header className="border-b border-line/80">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-5 sm:px-8">
          <Link href="/dashboard" className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500/15 text-indigo-300"><Settings2 size={21} /></span>
            <span><span className="block text-sm font-bold tracking-[0.14em] text-white">APEXTRACK</span><span className="block text-xs text-slate-500">Routine & schedule settings</span></span>
          </Link>
          <nav className="flex items-center gap-2">
            <Link href="/dashboard" className="rounded-lg px-3 py-2 text-sm text-slate-400 transition hover:bg-slate-800 hover:text-white">Dashboard</Link>
            <Link href="/dashboard/analytics" className="rounded-lg px-3 py-2 text-sm text-slate-400 transition hover:bg-slate-800 hover:text-white">Analytics</Link>
            <AccountMenu />
          </nav>
        </div>
      </header>

      <div className="mx-auto max-w-4xl px-5 pt-8 sm:px-8">
        <div className="mb-7">
          <Link href="/dashboard" className="mb-4 inline-flex items-center gap-2 text-sm text-slate-500 transition hover:text-white"><ArrowLeft size={15} /> Back to dashboard</Link>
          <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-indigo-300"><Settings2 size={14} /> Personalize your system</div>
          <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">Make it your routine.</h1>
          <p className="mt-2 text-sm text-slate-400">Your changes apply to new daily plans. Past logs keep their original tasks and office schedule.</p>
        </div>

        {error && <div role="alert" className="mb-4 rounded-xl border border-rose-400/30 bg-rose-400/10 px-4 py-3 text-sm text-rose-200">{error}</div>}
        {notice && <div role="status" className="mb-4 rounded-xl border border-emerald-400/30 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-200">{notice}</div>}

        <section className="mb-6 rounded-2xl border border-line bg-panel p-5 sm:p-6">
          <div className="mb-5 flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-400/10 text-amber-300"><BriefcaseBusiness size={18} /></span>
            <div><h2 className="font-semibold text-white">Hybrid work schedule</h2><p className="mt-1 text-xs text-slate-500">Choose the weekdays you usually work from the office.</p></div>
          </div>
          <div className="flex flex-wrap gap-2">
            {weekdays.map((day) => {
              const selected = officeDays.includes(day.value);
              return (
                <button key={day.value} type="button" aria-pressed={selected} onClick={() => toggleOfficeDay(day.value)} className={`flex min-w-16 items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-medium transition ${selected ? "border-amber-400/40 bg-amber-400/10 text-amber-200" : "border-line text-slate-400 hover:border-slate-600 hover:text-white"}`}>
                  {selected && <Check size={14} />}{day.label}
                </button>
              );
            })}
          </div>
          <p className="mt-3 text-xs text-slate-500">{officeDays.length ? `Office: ${weekdays.filter((day) => officeDays.includes(day.value)).map((day) => day.label).join(", ")}` : "No office days selected; all days will show as WFH."}</p>

          <div className="mt-6 flex flex-col gap-4 border-t border-line pt-5 sm:flex-row sm:items-end sm:justify-between">
            <div className="max-w-xs">
              <label htmlFor="target-sleep" className="flex items-center gap-2 text-sm font-medium text-slate-200"><Clock3 size={15} className="text-indigo-300" /> Sleep target</label>
              <p className="mt-1 text-xs leading-5 text-slate-500">Used in analytics and displayed on your dashboard.</p>
            </div>
            <div className="flex items-center gap-3">
              <input id="target-sleep" type="number" min="0.5" max="24" step="0.5" value={targetSleepHours} onChange={(event) => setTargetSleepHours(Number(event.target.value))} className="w-28 rounded-lg border border-line bg-slate-950/70 px-3 py-2 text-sm text-white outline-none focus:border-indigo-400" />
              <span className="text-sm text-slate-500">hours</span>
              <button type="button" onClick={() => void saveSchedule()} disabled={savingSettings || loading || !Number.isFinite(targetSleepHours) || targetSleepHours < 0.5 || targetSleepHours > 24} className="rounded-lg bg-indigo-400 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-indigo-300 disabled:opacity-50">
                {savingSettings ? "Saving..." : "Save schedule"}
              </button>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-line bg-panel p-5 sm:p-6">
          <div className="mb-5 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
            <div>
              <h2 className="font-semibold text-white">Daily routine</h2>
              <p className="mt-1 text-xs text-slate-500">Active blocks are copied into each new day. Swaps earn half of the task weight.</p>
            </div>
            <button type="button" onClick={() => void restoreDefaults()} disabled={loading || savingTaskId !== null} className="self-start rounded-lg border border-line px-3 py-2 text-xs font-medium text-slate-400 transition hover:border-slate-600 hover:text-white disabled:opacity-50">Restore starter tasks</button>
          </div>

          {loading ? (
            <div className="flex items-center justify-center gap-2 rounded-xl border border-line bg-slate-950/40 p-8 text-sm text-slate-500"><LoaderCircle size={16} className="animate-spin" /> Loading your routine...</div>
          ) : routines.length === 0 ? (
            <div className="mb-4 rounded-xl border border-dashed border-line p-6 text-center text-sm text-slate-500">Your routine is empty. Add a task below or restore the starter routine.</div>
          ) : (
            <div className="space-y-3">
              {routines.map((task, index) => {
                const Icon = categoryIcons[task.category];
                const isSaving = savingTaskId === task.id || savingTaskId === "reorder" || savingTaskId === "defaults";
                return (
                  <article key={task.id} className={`rounded-xl border p-4 transition ${task.is_active ? "border-line bg-slate-950/40" : "border-line/70 bg-slate-950/20 opacity-70"}`}>
                    <div className="flex flex-col gap-4">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-800 text-slate-300"><Icon size={16} /></span>
                        <div className="grid flex-1 gap-3 sm:grid-cols-[minmax(0,1fr)_170px_100px]">
                          <div>
                            <label htmlFor={`task-name-${task.id}`} className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-slate-600">Task name</label>
                            <input id={`task-name-${task.id}`} maxLength={100} value={task.task_name} onChange={(event) => updateRoutine(task.id, { task_name: event.target.value })} className="w-full rounded-lg border border-line bg-slate-950/70 px-3 py-2 text-sm text-white outline-none focus:border-indigo-400" />
                          </div>
                          <div>
                            <label htmlFor={`task-category-${task.id}`} className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-slate-600">Category</label>
                            <select id={`task-category-${task.id}`} value={task.category} onChange={(event) => updateRoutine(task.id, { category: event.target.value as TaskCategory })} className="w-full rounded-lg border border-line bg-slate-950/70 px-3 py-2 text-sm text-white outline-none focus:border-indigo-400">
                              {categories.map((category) => <option key={category.value} value={category.value}>{category.label}</option>)}
                            </select>
                          </div>
                          <div>
                            <label htmlFor={`task-weight-${task.id}`} className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-slate-600">Weight</label>
                            <input id={`task-weight-${task.id}`} type="number" min="0.1" max="100" step="0.05" value={task.weight} onChange={(event) => updateRoutine(task.id, { weight: Number(event.target.value) })} className="w-full rounded-lg border border-line bg-slate-950/70 px-3 py-2 text-sm text-white outline-none focus:border-indigo-400" />
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line/70 pt-3">
                        <label className="flex cursor-pointer items-center gap-2 text-xs text-slate-400">
                          <input type="checkbox" checked={task.is_active} onChange={(event) => updateRoutine(task.id, { is_active: event.target.checked })} className="h-4 w-4 accent-indigo-400" />
                          Include in new daily plans
                        </label>
                        <div className="flex items-center gap-2">
                          <button type="button" onClick={() => void moveTask(index, -1)} disabled={index === 0 || isSaving} className="rounded-lg border border-line p-2 text-slate-400 hover:text-white disabled:opacity-30" aria-label={`Move ${task.task_name} up`}><ArrowUp size={15} /></button>
                          <button type="button" onClick={() => void moveTask(index, 1)} disabled={index === routines.length - 1 || isSaving} className="rounded-lg border border-line p-2 text-slate-400 hover:text-white disabled:opacity-30" aria-label={`Move ${task.task_name} down`}><ArrowDown size={15} /></button>
                          <button type="button" onClick={() => void saveTask(task)} disabled={isSaving || !task.task_name.trim() || !Number.isFinite(Number(task.weight)) || Number(task.weight) < 0.1 || Number(task.weight) > 100} className="rounded-lg bg-indigo-400 px-3 py-2 text-xs font-semibold text-slate-950 transition hover:bg-indigo-300 disabled:opacity-50">{savingTaskId === task.id ? "Saving..." : "Save task"}</button>
                          <button type="button" onClick={() => void removeTask(task)} disabled={isSaving} className="rounded-lg border border-line p-2 text-slate-500 transition hover:border-rose-400/30 hover:text-rose-300 disabled:opacity-50" aria-label={`Remove ${task.task_name}`}><Trash2 size={15} /></button>
                        </div>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}

          <form onSubmit={(event) => void addTask(event)} className="mt-5 rounded-xl border border-dashed border-indigo-400/30 bg-indigo-400/[0.04] p-4">
            <h3 className="mb-3 flex items-center gap-2 text-sm font-medium text-indigo-100"><Plus size={15} /> Add a routine task</h3>
            <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_170px_100px_auto]">
              <div>
                <label htmlFor="new-task-name" className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-slate-600">Task name</label>
                <input id="new-task-name" required maxLength={100} value={newTask.task_name} onChange={(event) => setNewTask((current) => ({ ...current, task_name: event.target.value }))} placeholder="e.g. Read for 20 minutes" className="w-full rounded-lg border border-line bg-slate-950/70 px-3 py-2 text-sm text-white outline-none placeholder:text-slate-600 focus:border-indigo-400" />
              </div>
              <div>
                <label htmlFor="new-task-category" className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-slate-600">Category</label>
                <select id="new-task-category" value={newTask.category} onChange={(event) => setNewTask((current) => ({ ...current, category: event.target.value as TaskCategory }))} className="w-full rounded-lg border border-line bg-slate-950/70 px-3 py-2 text-sm text-white outline-none focus:border-indigo-400">
                  {categories.map((category) => <option key={category.value} value={category.value}>{category.label}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="new-task-weight" className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-slate-600">Weight</label>
                <input id="new-task-weight" type="number" min="0.1" max="100" step="0.05" required value={newTask.weight} onChange={(event) => setNewTask((current) => ({ ...current, weight: Number(event.target.value) }))} className="w-full rounded-lg border border-line bg-slate-950/70 px-3 py-2 text-sm text-white outline-none focus:border-indigo-400" />
              </div>
              <button type="submit" disabled={isAdding || !newTask.task_name.trim() || !Number.isFinite(newTask.weight) || newTask.weight < 0.1 || newTask.weight > 100} className="mt-auto flex items-center justify-center gap-2 rounded-lg bg-indigo-400 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-indigo-300 disabled:opacity-50">
                {isAdding ? <LoaderCircle size={15} className="animate-spin" /> : <Plus size={15} />} Add
              </button>
            </div>
          </form>
          <p className="mt-4 text-xs leading-5 text-slate-600">Edits affect new daily plans only. A daily plan keeps the task names, categories, and weights it was created with, so your historical scores stay consistent.</p>
        </section>
      </div>
    </main>
  );
}
