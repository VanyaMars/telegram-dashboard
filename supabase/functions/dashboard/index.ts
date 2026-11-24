// Supabase Edge Function: dashboard
// Deploy with the shared authentication module from the repository.
// Required secret in Supabase: TG_BOT_TOKEN (NEVER put it in GitHub).
// Optional secret: TG_ALLOWED_USER_ID, to restrict app to one Telegram account.
// Function setting: "Verify JWT" OFF. Telegram initData HMAC is checked below.

import { createClient } from "npm:@supabase/supabase-js@2";
import { browserSiteOrigin, verifyBrowserUser } from "../_shared/browser-auth.ts";

const SITE_ORIGIN = browserSiteOrigin();
const corsHeaders = {
  "Access-Control-Allow-Origin": SITE_ORIGIN,
  "Access-Control-Allow-Headers": "content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json; charset=utf-8",
  "Vary": "Origin",
};
const enc = new TextEncoder();

type MiniUser = { id: number; first_name?: string; username?: string };

type RequestBody = {
  action?: "read" | "adjust" | "reset" | "tasks_list" | "task_save" | "task_toggle" | "task_delete" | "task_restore" | "goals_list" | "goal_save" | "goal_delete";
  id?: string;
  completed?: boolean;
  task?: TaskInput;
  goal?: GoalInput;
  initData?: string;
  browserSession?: string;
  week?: string;
  day?: string;
  kind?: "task" | "sale" | "sport";
  delta?: -1 | 1;
};

function respond(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: corsHeaders });
}

function isValidYMD(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(value + "T00:00:00Z");
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function weekDates(monday: string): string[] {
  const base = Date.parse(monday + "T00:00:00Z");
  return Array.from({ length: 7 }, (_, i) => new Date(base + i * 86400000).toISOString().slice(0, 10));
}

async function validateTelegramInitData(raw: string, botToken: string): Promise<MiniUser | null> {
  if (!raw || raw.length > 8192 || !botToken) return null;
  try {
    const params = new URLSearchParams(raw);
    const receivedHash = params.get("hash") || "";
    if (!/^[0-9a-f]{64}$/i.test(receivedHash)) return null;

    const issuedAt = Number(params.get("auth_date"));
    const age = Math.floor(Date.now() / 1000) - issuedAt;
    // Telegram does not prescribe a specific expiry; this app accepts one day.
    if (!Number.isInteger(issuedAt) || age < -60 || age > 86400) return null;

    const fields = [...params.entries()]
      .filter(([key]) => key !== "hash")
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([key, value]) => `${key}=${value}`)
      .join("\n");

    const firstKey = await crypto.subtle.importKey(
      "raw", enc.encode("WebAppData"), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
    );
    const intermediate = await crypto.subtle.sign("HMAC", firstKey, enc.encode(botToken));
    const secondKey = await crypto.subtle.importKey(
      "raw", intermediate, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
    );
    const signature = new Uint8Array(await crypto.subtle.sign("HMAC", secondKey, enc.encode(fields)));
    const incoming = Uint8Array.from(receivedHash.match(/.{2}/g)!.map((hex) => parseInt(hex, 16)));
    // Constant-time compare so the hash itself does not reveal where bytes differ.
    let diff = signature.length ^ incoming.length;
    for (let i = 0; i < signature.length; i++) diff |= signature[i] ^ incoming[i];
    if (diff !== 0) return null;

    const userRaw = params.get("user");
    if (!userRaw) return null;
    const user = JSON.parse(userRaw) as MiniUser;
    return Number.isSafeInteger(user?.id) && user.id > 0 ? user : null;
  } catch {
    return null;
  }
}

function getAdminKey(): string | undefined {
  try {
    const json = Deno.env.get("SUPABASE_SECRET_KEYS");
    if (json) {
      const keys = JSON.parse(json) as Record<string, string>;
      if (keys.default) return keys.default;
    }
  } catch { /* fall back to the legacy key if available */ }
  return Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
}

// Personal OS 4.0 feature handlers. These are merged into dashboard/index.ts.
// All queries are scoped to the Telegram ID validated by the existing function.

type TaskInput = {
  title?: unknown; notes?: unknown; sphere?: unknown;
  day?: unknown; priority?: unknown;
};
type GoalInput = {
  title?: unknown; notes?: unknown; sphere?: unknown;
  start_value?: unknown; current_value?: unknown; target_value?: unknown;
  unit?: unknown; deadline?: unknown;
};
const ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function getId(input: unknown): string | null {
  return typeof input === "string" && ID_PATTERN.test(input) ? input : null;
}
function cleanString(value: unknown, length: number): string | null {
  if (typeof value !== "string" || value.trim().length > length) return null;
  return value.trim();
}
function cleanText(value: unknown, length: number): string | null {
  if (typeof value !== "string" || value.length > length) return null;
  return value;
}
function parseNumber(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value) || Math.abs(value) > 9999999999) return null;
  return Math.round(value * 100) / 100;
}
function validTask(raw: unknown): {title:string; notes:string; sphere:string; day:string|null; priority:string} | null {
  if (!raw || typeof raw !== "object") return null;
  const p = raw as TaskInput;
  const title = cleanString(p.title, 180);
  const notes = cleanText(p.notes, 6000);
  const sphere = cleanString(p.sphere, 60);
  const day = p.day === null ? null : isValidYMD(p.day) ? p.day : undefined;
  if (!title || notes === null || !sphere || day === undefined || !["important", "extra"].includes(String(p.priority))) return null;
  return { title, notes, sphere, day, priority:String(p.priority) };
}
function validGoal(raw: unknown): {title:string;notes:string;sphere:string;start_value:number;current_value:number;target_value:number;unit:string;deadline:string|null} | null {
  if (!raw || typeof raw !== "object") return null;
  const p = raw as GoalInput;
  const title = cleanString(p.title,180);
  const notes = cleanText(p.notes,6000);
  const sphere = cleanString(p.sphere,60);
  const unit = cleanString(p.unit,20);
  const start_value = parseNumber(p.start_value);
  const current_value = parseNumber(p.current_value);
  const target_value = parseNumber(p.target_value);
  const deadline = p.deadline === null ? null : isValidYMD(p.deadline) ? p.deadline : undefined;
  if (!title || notes === null || !sphere || unit === null || start_value === null || current_value === null || target_value === null || start_value === target_value || deadline === undefined) return null;
  return {title,notes,sphere,unit,start_value,current_value,target_value,deadline};
}

async function handleV4(db: ReturnType<typeof createClient>, uid: number, body: RequestBody): Promise<Response | null> {
  const action = body.action;
  // Read tasks for one day and the inbox. Other dates are never overwritten.
  if (action === "tasks_list") {
    if (!isValidYMD(body.day)) return respond({error:"Неверная дата"},400);
    const [day,buffer] = await Promise.all([
      db.from("personal_tasks").select("*").eq("telegram_user_id",uid).eq("day",body.day).order("created_at",{ascending:true}).limit(500),
      db.from("personal_tasks").select("*").eq("telegram_user_id",uid).is("day",null).order("created_at",{ascending:false}).limit(500),
    ]);
    if (day.error) throw day.error;
    if (buffer.error) throw buffer.error;
    return respond({ok:true, daily:day.data||[], buffer:buffer.data||[]});
  }
  if (action === "task_save") {
    const task = validTask(body.task);
    if (!task) return respond({error:"Заполни название, сферу и корректные поля задачи"},400);
    const now = new Date().toISOString();
    const id = body.id == null ? null : getId(body.id);
    if (body.id != null && !id) return respond({error:"Неверный ID задачи"},400);
    if (id) {
      const {data:old,error:lookupError}=await db.from("personal_tasks").select("id,day,completed").eq("id",id).eq("telegram_user_id",uid).maybeSingle();
      if (lookupError) throw lookupError;
      if (!old) return respond({error:"Задача не найдена"},404);
      const completed = old.day === task.day ? old.completed : false;
      const {data,error}=await db.from("personal_tasks").update({...task,completed,updated_at:now}).eq("id",id).eq("telegram_user_id",uid).select("id").maybeSingle();
      if (error) throw error;
      if (!data) return respond({error:"Задача не найдена"},404);
    } else {
      const {error}=await db.from("personal_tasks").insert({...task,telegram_user_id:uid,completed:false,updated_at:now});
      if (error) throw error;
    }
    return respond({ok:true});
  }
  if (action === "task_toggle") {
    const id = getId(body.id);
    if (!id || typeof body.completed !== "boolean") return respond({error:"Неверные параметры задачи"},400);
    const {data,error}=await db.from("personal_tasks").update({completed:body.completed,updated_at:new Date().toISOString()})
      .eq("id",id).eq("telegram_user_id",uid).not("day","is",null).select("id").maybeSingle();
    if (error) throw error;
    return data ? respond({ok:true}) : respond({error:"Задача дня не найдена"},404);
  }
  if (action === "task_delete") {
    const id = getId(body.id);
    if (!id) return respond({error:"Неверный ID задачи"},400);
    const {error}=await db.from("personal_tasks").delete().eq("id",id).eq("telegram_user_id",uid);
    if (error) throw error;
    return respond({ok:true});
  }
  // Reinsert a just-deleted task with the same UUID for the Undo action.
  // Telegram user identity is validated above; never trust uid from the client.
  if (action === "task_restore") {
    const id=getId(body.id);
    const task=validTask(body.task);
    if(!id || !task || typeof body.completed !== "boolean")
      return respond({error:"Не удалось восстановить задачу: неверные поля"},400);
    // A duplicate UUID cannot overwrite an existing (possibly other user's) row.
    const {error}=await db.from("personal_tasks").insert({
      id,telegram_user_id:uid,...task,
      completed:task.day!==null ? body.completed : false,
      updated_at:new Date().toISOString()
    });
    if(error) {
      if(error.code==="23505")return respond({error:"Эта задача уже существует"},409);
      throw error;
    }
    return respond({ok:true});
  }
  if (action === "goals_list") {
    const [goals,events]=await Promise.all([
      db.from("ambitious_goals").select("*").eq("telegram_user_id",uid).order("created_at",{ascending:false}).limit(250),
      db.from("goal_history").select("goal_id,value,recorded_at").eq("telegram_user_id",uid).order("recorded_at",{ascending:false}).limit(1500)
    ]);
    if (goals.error) throw goals.error;
    if (events.error) throw events.error;
    return respond({ok:true,goals:goals.data||[],history:events.data||[]});
  }
  if (action === "goal_save") {
    const goal = validGoal(body.goal);
    if (!goal) return respond({error:"Проверь значения цели: старт и финиш должны отличаться"},400);
    const id = body.id == null ? null : getId(body.id);
    if (body.id != null && !id) return respond({error:"Неверный ID цели"},400);
    let goalID = id;
    let changed = true;
    if (id) {
      const {data:existing,error:oldError}=await db.from("ambitious_goals").select("id,current_value").eq("id",id).eq("telegram_user_id",uid).maybeSingle();
      if (oldError) throw oldError;
      if (!existing) return respond({error:"Цель не найдена"},404);
      changed = Number(existing.current_value) !== goal.current_value;
      const {data,error}=await db.from("ambitious_goals").update({...goal,updated_at:new Date().toISOString()})
        .eq("id",id).eq("telegram_user_id",uid).select("id").maybeSingle();
      if (error) throw error;
      if (!data) return respond({error:"Цель не найдена"},404);
    } else {
      const {data,error}=await db.from("ambitious_goals").insert({...goal,telegram_user_id:uid}).select("id").single();
      if (error) throw error;
      goalID = data.id;
    }
    if (changed && goalID) {
      const {error}=await db.from("goal_history").insert({goal_id:goalID,telegram_user_id:uid,value:goal.current_value});
      if (error) throw error;
    }
    return respond({ok:true});
  }
  if (action === "goal_delete") {
    const id=getId(body.id);
    if (!id) return respond({error:"Неверный ID цели"},400);
    const {error}=await db.from("ambitious_goals").delete().eq("id",id).eq("telegram_user_id",uid);
    if (error) throw error;
    return respond({ok:true});
  }
  return null;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== "POST") return respond({ error: "Method not allowed" }, 405);

  try {
    const body = (await req.json()) as RequestBody;
    const botToken = Deno.env.get("TG_BOT_TOKEN") || "";
    if (!botToken) return respond({ error: "TG_BOT_TOKEN secret is not configured" }, 500);
    const user = body.initData ? await validateTelegramInitData(body.initData, botToken) : await verifyBrowserUser(body.browserSession);
    if (!user) return respond({ error: "Не удалось подтвердить вход через Telegram. Закрой и открой Mini App заново." }, 401);

    const allowedUser = Deno.env.get("TG_ALLOWED_USER_ID");
    if (allowedUser && allowedUser !== String(user.id)) {
      return respond({ error: "Этот дашборд доступен только владельцу." }, 403);
    }

    const adminKey = getAdminKey();
    const baseURL = Deno.env.get("SUPABASE_URL");
    if (!adminKey || !baseURL) return respond({ error: "Supabase server credentials unavailable" }, 500);
    const db = createClient(baseURL, adminKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // On the FIRST authenticated launch, create this Telegram user's profile.
    // Mini App launches refresh the profile. Browser launches keep the existing profile fields.
    // The Telegram ID comes from verified Mini App data or a verified browser session.
    const firstName = typeof user.first_name === "string" ? user.first_name.slice(0, 128) : "";
    const username = typeof user.username === "string" ? user.username.slice(0, 64) : null;
    const { error: profileError } = await db.from("profiles").upsert({
      telegram_user_id: user.id,
      first_name: firstName,
      username,
      last_seen_at: new Date().toISOString(),
    }, { onConflict: "telegram_user_id", ignoreDuplicates: !body.initData });
    if (profileError) throw profileError;

    const v4Response = await handleV4(db, user.id, body);
    if (v4Response) return v4Response;

    if (!isValidYMD(body.week) || new Date(body.week + "T00:00:00Z").getUTCDay() !== 1) {
      return respond({ error: "Неверная дата начала недели" }, 400);
    }
    const dates = weekDates(body.week);
    const start = dates[0];
    const end = dates[6];
    const userID = user.id; // Taken from the verified Telegram identity

    if (body.action === "adjust") {
      const columns = { task: "tasks", sale: "sales", sport: "workouts" } as const;
      if (!body.kind || !(body.kind in columns) || (body.delta !== 1 && body.delta !== -1) || !dates.includes(body.day || "")) {
        return respond({ error: "Неверные параметры изменения" }, 400);
      }
      const { data: existing, error: readError } = await db.from("daily_stats")
        .select("tasks, sales, workouts")
        .eq("telegram_user_id", userID).eq("day", body.day!).maybeSingle();
      if (readError) throw readError;
      const row = {
        telegram_user_id: userID,
        day: body.day!,
        tasks: Number(existing?.tasks || 0),
        sales: Number(existing?.sales || 0),
        workouts: Number(existing?.workouts || 0),
        updated_at: new Date().toISOString(),
      };
      const col = columns[body.kind];
      row[col] = Math.max(0, row[col] + body.delta);
      const { error } = await db.from("daily_stats").upsert(row, { onConflict: "telegram_user_id,day" });
      if (error) throw error;
    } else if (body.action === "reset") {
      const { error } = await db.from("daily_stats").delete()
        .eq("telegram_user_id", userID).gte("day", start).lte("day", end);
      if (error) throw error;
    } else if (body.action !== "read") {
      return respond({ error: "Неизвестное действие" }, 400);
    }

    const { data, error } = await db.from("daily_stats")
      .select("day, tasks, sales, workouts")
      .eq("telegram_user_id", userID).gte("day", start).lte("day", end)
      .order("day", { ascending: true });
    if (error) throw error;
    return respond({ ok: true, days: data || [], user: { first_name: firstName } });
  } catch (error) {
    // Avoid leaking client secrets or database details in responses.
    console.error("Dashboard function error", error);
    return respond({ error: "Сервер не смог обработать запрос. Проверь настройки функции и таблицу." }, 500);
  }
});
