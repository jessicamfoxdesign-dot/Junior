export interface Starter {
  id: string;
  user_id: string;
  name: string;
  notes: string | null;
  hydration_pct: number;
  created_at: string;
}

export interface Feeding {
  id: string;
  user_id: string;
  starter_id: string;
  fed_at: string;
  kept_g: number | null;
  flour_g: number | null;
  flour_type: string | null;
  water_g: number | null;
  room_temp_f: number | null;
  start_level_in: number | null;
  note: string | null;
}

export interface Reading {
  id: string;
  user_id: string;
  starter_id: string;
  taken_at: string;
  level_in: number;
  streak_in: number | null;
  source: "manual" | "ai";
  ai_level_in: number | null;
  ai_streak_in: number | null;
  ai_model: string | null;
  ai_note: string | null;
  photo_path: string | null;
  note: string | null;
}

/** What the photo reader returns. */
export interface AiReading {
  version: string;
  level_in: number | null;
  streak_in: number | null;
  confidence: "high" | "medium" | "low";
  note: string;
  model: string;
}

export interface Levain {
  id: string;
  user_id: string;
  starter_id: string;
  built_at: string;
  seed_g: number;
  feed_flour_g: number;
  feed_water_g: number;
  seed_hydration_pct: number;
  ratio_label: string | null;
  note: string | null;
}

export interface Bake {
  id: string;
  user_id: string;
  starter_id: string;
  levain_id: string | null;
  mixed_at: string;
  target_mode: "flour" | "loaves";
  target_flour_g: number | null;
  loaves: number | null;
  loaf_g: number | null;
  hydration_pct: number;
  salt_pct: number;
  second_flour: string | null;
  second_flour_pct: number;
  levain_used_g: number;
  total_flour_g: number;
  flour_add_g: number;
  second_flour_add_g: number;
  water_add_g: number;
  salt_g: number;
  dough_g: number;
  note: string | null;
}
