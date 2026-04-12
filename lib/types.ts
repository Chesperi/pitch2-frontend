/** Tipi allineati al backend `pitch-backend/src/types.ts` (snake_case da API). */

export interface AppliedRuleFields {
  standard_onsite?: string;
  standard_cologno?: string;
  facilities?: string;
  studio?: string;
  show_name?: string;
  pre_duration_minutes?: number;
  standard_combo_id?: number;
}

export interface ImportPreviewItem {
  external_match_id: string;
  competition_name: string;
  competition_code: string;
  matchday: number;
  home_team: string;
  away_team: string;
  ko_utc: string;
  ko_italy: string;
  venue: string | null;
  already_exists: boolean;
  suggested_fields: AppliedRuleFields;
}

export interface EventRule {
  id: number;
  competition_name: string | null;
  day_of_week: number | null;
  ko_time_from: string | null;
  ko_time_to: string | null;
  standard_onsite: string | null;
  standard_cologno: string | null;
  facilities: string | null;
  studio: string | null;
  show_name: string | null;
  pre_duration_minutes: number | null;
  priority: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export type CreateEventRulePayload = {
  competition_name?: string;
  day_of_week?: number | null;
  ko_time_from?: string | null;
  ko_time_to?: string | null;
  standard_onsite?: string | null;
  standard_cologno?: string | null;
  facilities?: string | null;
  studio?: string | null;
  show_name?: string | null;
  pre_duration_minutes?: number | null;
  priority?: number;
  notes?: string | null;
};

export type UpdateEventRulePayload = Partial<CreateEventRulePayload>;

export interface LookupValue {
  id: number;
  category: string;
  value: string;
  sort_order: number;
  created_at: string;
}

export interface CreateLookupValuePayload {
  category: string;
  value: string;
  sort_order?: number;
}

export type UpdateLookupValuePayload = Partial<CreateLookupValuePayload>;
