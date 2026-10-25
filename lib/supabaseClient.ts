import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export type TaskStatus = "done" | "swapped" | "missed";
export type TaskCategory = "fitness" | "dsa" | "career" | "work";

export interface UserSettings {
  id: string;
  target_sleep_hours: number;
  office_days: number[];
}

export interface RoutineTask {
  id: string;
  user_id: string;
  task_name: string;
  category: TaskCategory;
  weight: number;
  sort_order: number;
  is_active: boolean;
}

export type RoutineTaskInput = Omit<RoutineTask, "id" | "user_id"> & { id?: string };

export interface DailyLog {
  id: string;
  user_id: string;
  date: string;
  sleep_hours: number;
  is_office_day: boolean;
  daily_score: number;
  has_checkin: boolean;
  tasks_seeded: boolean;
}

export interface DailyTask {
  id: string;
  daily_log_id: string;
  task_name: string;
  category: TaskCategory;
  status: TaskStatus;
  substitution_note: string | null;
  weight: number;
  sort_order: number;
}

export interface DailyPlan {
  log: DailyLog;
  tasks: DailyTask[];
  officeDays: number[];
  targetSleepHours: number;
}

export const defaultRoutine: Array<Pick<RoutineTask, "task_name" | "category" | "weight" | "sort_order">> = [
  { task_name: "Morning gym", category: "fitness", weight: 1, sort_order: 0 },
  { task_name: "Jog or walk", category: "fitness", weight: 0.75, sort_order: 1 },
  { task_name: "DSA practice", category: "dsa", weight: 1.25, sort_order: 2 },
  { task_name: "Side hustle", category: "career", weight: 1.25, sort_order: 3 },
  { task_name: "Focused work", category: "work", weight: 1.5, sort_order: 4 },
];

let client: SupabaseClient | undefined;

export function getSupabaseClient(): SupabaseClient {
  if (client) return client;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY.");
  }

  client = createClient(url, anonKey);
  return client;
}

export async function ensureUserSession(): Promise<string> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  if (data.session?.user) return data.session.user.id;

  const { data: signInData, error: signInError } = await supabase.auth.signInAnonymously();
  if (signInError) throw signInError;
  if (!signInData.user) throw new Error("Supabase did not return a user session.");
  return signInData.user.id;
}

export function isOfficeDay(date: string, officeDays: number[] = [3, 4]): boolean {
  const weekday = new Date(`${date}T12:00:00`).getDay();
  return officeDays.includes(((weekday + 6) % 7) + 1);
}

export async function loadUserConfiguration(): Promise<{ settings: UserSettings; routines: RoutineTask[] }> {
  const supabase = getSupabaseClient();
  const userId = await ensureUserSession();
  const [{ data: settings, error: settingsError }, { data: routines, error: routinesError }] = await Promise.all([
    supabase.from("user_settings").select("*").eq("id", userId).single(),
    supabase.from("user_task_templates").select("*").eq("user_id", userId).order("sort_order", { ascending: true }),
  ]);
  if (settingsError) throw settingsError;
  if (routinesError) throw routinesError;
  return { settings: settings as UserSettings, routines: (routines ?? []) as RoutineTask[] };
}

export async function saveUserSettings(settings: Pick<UserSettings, "office_days" | "target_sleep_hours">): Promise<void> {
  const userId = await ensureUserSession();
  const { error } = await getSupabaseClient()
    .from("user_settings")
    .update(settings)
    .eq("id", userId);
  if (error) throw error;
}

export async function saveRoutineTask(task: RoutineTaskInput): Promise<RoutineTask> {
  const userId = await ensureUserSession();
  const supabase = getSupabaseClient();
  const values = {
    task_name: task.task_name,
    category: task.category,
    weight: task.weight,
    sort_order: task.sort_order,
    is_active: task.is_active,
    user_id: userId,
  };
  const query = task.id
    ? supabase.from("user_task_templates").update(values).eq("id", task.id).eq("user_id", userId)
    : supabase.from("user_task_templates").insert(values);
  const { data, error } = await query.select("*").single();
  if (error) throw error;
  return data as RoutineTask;
}

export async function deleteRoutineTask(taskId: string): Promise<void> {
  const userId = await ensureUserSession();
  const { error } = await getSupabaseClient()
    .from("user_task_templates")
    .delete()
    .eq("user_id", userId)
    .eq("id", taskId);
  if (error) throw error;
}

export function scoreTasks(tasks: DailyTask[]): number {
  const totalWeight = tasks.reduce((sum, task) => sum + task.weight, 0);
  if (totalWeight === 0) return 0;
  const earnedWeight = tasks.reduce((sum, task) => {
    const credit = task.status === "done" ? 1 : task.status === "swapped" ? 0.5 : 0;
    return sum + task.weight * credit;
  }, 0);
  return Math.round((earnedWeight / totalWeight) * 100);
}

export async function loadDailyPlan(date: string): Promise<DailyPlan> {
  const supabase = getSupabaseClient();
  const userId = await ensureUserSession();

  const { data: settings, error: settingsError } = await supabase
    .from("user_settings")
    .select("office_days, target_sleep_hours")
    .eq("id", userId)
    .single();
  if (settingsError) throw settingsError;
  const officeDays = (settings.office_days ?? [3, 4]) as number[];

  const { data: existingLog, error: existingLogError } = await supabase
    .from("daily_logs")
    .select("*")
    .eq("user_id", userId)
    .eq("date", date)
    .maybeSingle();
  if (existingLogError) throw existingLogError;

  let log = existingLog as DailyLog | null;
  if (!log) {
    const { data: createdLog, error: createLogError } = await supabase
    .from("daily_logs")
    .upsert(
      { user_id: userId, date, is_office_day: isOfficeDay(date, officeDays) },
      { onConflict: "user_id,date", ignoreDuplicates: true },
    )
    .select("*")
    .maybeSingle();
    if (createLogError) throw createLogError;
    if (createdLog) {
      log = createdLog as DailyLog;
    } else {
      const { data: concurrentLog, error: concurrentLogError } = await supabase
        .from("daily_logs")
        .select("*")
        .eq("user_id", userId)
        .eq("date", date)
        .single();
      if (concurrentLogError) throw concurrentLogError;
      log = concurrentLog as DailyLog;
    }
  }
  if (!log) throw new Error(`Unable to create or load the daily plan for ${date}.`);

  if (!log.tasks_seeded) {
    const dailyLogId = log.id;
    const { data: templates, error: templatesError } = await supabase
      .from("user_task_templates")
      .select("task_name, category, weight, sort_order")
      .eq("user_id", userId)
      .eq("is_active", true)
      .order("sort_order", { ascending: true });
    if (templatesError) throw templatesError;

    const taskSnapshots = (templates ?? []).map((task) => ({
      ...task,
      daily_log_id: dailyLogId,
      status: "missed" as const,
      substitution_note: null,
    }));
    if (taskSnapshots.length > 0) {
      const { error: seedError } = await supabase
        .from("daily_tasks")
        .upsert(taskSnapshots, {
          onConflict: "daily_log_id,task_name",
          ignoreDuplicates: true,
        });
      if (seedError) throw seedError;
    }

    const { data: updatedLog, error: seedMarkerError } = await supabase
      .from("daily_logs")
      .update({ tasks_seeded: true })
      .eq("id", log.id)
      .select("*")
      .single();
    if (seedMarkerError) throw seedMarkerError;
    log = updatedLog as DailyLog;
  }

  const { data: tasks, error: reloadError } = await supabase
    .from("daily_tasks")
    .select("*")
    .eq("daily_log_id", log.id)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
  if (reloadError) throw reloadError;

  return {
    log,
    tasks: (tasks ?? []) as DailyTask[],
    officeDays,
    targetSleepHours: Number(settings.target_sleep_hours),
  };
}

export async function updateDailyTask(
  logId: string,
  taskId: string,
  status: TaskStatus,
  substitutionNote: string | null,
): Promise<{ task: DailyTask; score: number }> {
  const supabase = getSupabaseClient();
  const { data: task, error: taskError } = await supabase
    .from("daily_tasks")
    .update({ status, substitution_note: status === "swapped" ? substitutionNote : null })
    .eq("id", taskId)
    .eq("daily_log_id", logId)
    .select("*")
    .single();
  if (taskError) throw taskError;

  const { data: tasks, error: tasksError } = await supabase
    .from("daily_tasks")
    .select("*")
    .eq("daily_log_id", logId);
  if (tasksError) throw tasksError;
  const score = scoreTasks((tasks ?? []) as DailyTask[]);

  const { error: scoreError } = await supabase
    .from("daily_logs")
    .update({ daily_score: score, has_checkin: true })
    .eq("id", logId);
  if (scoreError) throw scoreError;

  return { task: task as DailyTask, score };
}

export async function updateSleepHours(logId: string, sleepHours: number): Promise<void> {
  const { error } = await getSupabaseClient()
    .from("daily_logs")
    .update({ sleep_hours: sleepHours, has_checkin: true })
    .eq("id", logId);
  if (error) throw error;
}
