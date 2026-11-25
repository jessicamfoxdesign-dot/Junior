import { createClient } from "@supabase/supabase-js";
import type { AiReading, Bake, Feeding, Levain, Reading, Starter } from "../types";

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
  { auth: { persistSession: true, autoRefreshToken: true } },
);

const BUCKET = "sourdough-photos";
/** The reader's contract. Output from any other version is ignored. */
export const READER_VERSION = "junior-reader-1";

function check<T>(res: { data: T | null; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return res.data as T;
}

/** The user's first starter, made on first use. */
export async function ensureStarter(userId: string): Promise<Starter> {
  const rows = check(await supabase.from("sourdough_starters").select("*").order("created_at").limit(1));
  if (rows.length) return rows[0] as Starter;
  return check(await supabase.from("sourdough_starters").insert({ user_id: userId, name: "Junior" }).select().single()) as Starter;
}

export async function loadAll(starterId: string): Promise<{ feedings: Feeding[]; readings: Reading[] }> {
  const [f, r] = await Promise.all([
    supabase.from("sourdough_feedings").select("*").eq("starter_id", starterId).order("fed_at", { ascending: false }).limit(500),
    supabase.from("sourdough_readings").select("*").eq("starter_id", starterId).order("taken_at", { ascending: false }).limit(2000),
  ]);
  return { feedings: check(f) as Feeding[], readings: check(r) as Reading[] };
}

export type NewFeeding = Omit<Feeding, "id">;
export async function addFeeding(row: NewFeeding): Promise<void> {
  check(await supabase.from("sourdough_feedings").insert(row).select().single());
}
export async function updateFeeding(id: string, patch: Partial<NewFeeding>): Promise<void> {
  check(await supabase.from("sourdough_feedings").update(patch).eq("id", id).select().single());
}
export async function deleteFeeding(id: string): Promise<void> {
  check(await supabase.from("sourdough_feedings").delete().eq("id", id).select());
}

export type NewReading = Omit<Reading, "id">;
export async function addReading(row: NewReading): Promise<void> {
  check(await supabase.from("sourdough_readings").insert(row).select().single());
}
export async function updateReading(id: string, patch: Partial<NewReading>): Promise<void> {
  check(await supabase.from("sourdough_readings").update(patch).eq("id", id).select().single());
}
/** Removes the reading and, when asked, its photo. */
export async function deleteReading(r: Reading, withPhoto: boolean): Promise<void> {
  if (withPhoto && r.photo_path) {
    const { error } = await supabase.storage.from(BUCKET).remove([r.photo_path]);
    if (error) throw new Error(error.message);
  }
  check(await supabase.from("sourdough_readings").delete().eq("id", r.id).select());
}

export async function uploadPhoto(userId: string, blob: Blob): Promise<string> {
  const path = `${userId}/${crypto.randomUUID()}.jpg`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, blob, { contentType: "image/jpeg" });
  if (error) throw new Error(error.message);
  return path;
}

const urlCache = new Map<string, { url: string; until: number }>();
export async function photoUrl(path: string): Promise<string | null> {
  const hit = urlCache.get(path);
  if (hit && hit.until > Date.now()) return hit.url;
  const { data } = await supabase.storage.from(BUCKET).createSignedUrl(path, 3600);
  if (!data?.signedUrl) return null;
  urlCache.set(path, { url: data.signedUrl, until: Date.now() + 50 * 60_000 });
  return data.signedUrl;
}

/** Asks Claude to read the jar. Throws with a readable message on failure. */
export async function readJar(dataUrl: string): Promise<AiReading> {
  const { data, error } = await supabase.functions.invoke("read-starter-level", { body: { imageBase64: dataUrl } });
  if (error) {
    let msg = "Couldn't read the photo.";
    try {
      const body = await (error as { context?: Response }).context?.json();
      if (body?.error) msg = body.error;
    } catch { /* keep the plain message */ }
    throw new Error(msg);
  }
  if (data?.version !== READER_VERSION) throw new Error("The photo reader is out of date. Type the level for now.");
  return data as AiReading;
}

/* Levain builds and bakes */
export async function loadBakes(starterId: string): Promise<{ levains: Levain[]; bakes: Bake[] }> {
  const [l, b] = await Promise.all([
    supabase.from("sourdough_levains").select("*").eq("starter_id", starterId).order("built_at", { ascending: false }).limit(200),
    supabase.from("sourdough_bakes").select("*").eq("starter_id", starterId).order("mixed_at", { ascending: false }).limit(200),
  ]);
  return { levains: check(l) as Levain[], bakes: check(b) as Bake[] };
}
export type NewLevain = Omit<Levain, "id">;
export async function addLevain(row: NewLevain): Promise<Levain> {
  return check(await supabase.from("sourdough_levains").insert(row).select().single()) as Levain;
}
export async function deleteLevain(id: string): Promise<void> {
  check(await supabase.from("sourdough_levains").delete().eq("id", id).select());
}
export type NewBake = Omit<Bake, "id">;
export async function addBake(row: NewBake): Promise<void> {
  check(await supabase.from("sourdough_bakes").insert(row).select().single());
}
export async function updateBakeNote(id: string, note: string | null): Promise<void> {
  check(await supabase.from("sourdough_bakes").update({ note }).eq("id", id).select().single());
}
export async function deleteBake(id: string): Promise<void> {
  check(await supabase.from("sourdough_bakes").delete().eq("id", id).select());
}
export async function setStarterHydration(id: string, pct: number): Promise<Starter> {
  return check(await supabase.from("sourdough_starters").update({ hydration_pct: pct }).eq("id", id).select().single()) as Starter;
}
