// Mirrors app/schema/canonical.py:Lead and the /stats payload. Fields the
// backend allows to be null are optional here too (the "flag, never drop"
// contract means a lead can arrive with almost nothing populated).
export type LeadStatus = "clean" | "flagged" | "duplicate";

export interface Lead {
  lead_id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone_e164: string | null;
  source: string;
  campaign_id: string | null;
  consent: boolean;
  created_at: string;
  quality_score: number | null;
  status: LeadStatus | string;
  duplicate_of_lead_id: string | null;
  diagnosis?: string | null;
  suggested_action?: string | null;
  raw_payload?: unknown;
}

export interface Stats {
  leads_by_source: Record<string, number>;
  total_clean: number;
  total_flagged: number;
  total_invalid: number;
  total_duplicates: number;
  avg_quality_score: number | null;
  self_healing_events: number;
  human_review_pending: number;
}

export interface HealingEvent {
  attempt?: number;
  exception_type?: string;
  message?: string;
  source?: string;
}

export interface IngestSummary {
  source: string;
  scored: number;
  duplicates: number;
  invalid: number;
  field_mapping: Record<string, string | null>;
}
