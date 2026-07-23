import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { api } from "../lib/api";
import type { CallStatus } from "../lib/types";

// Poll the read endpoints on a light interval so the dashboard feels live,
// mirroring the Streamlit app's 5s cache TTL.
const live = { refetchInterval: 8000, staleTime: 4000 };

export const useStats = () => useQuery({ queryKey: ["stats"], queryFn: api.stats, ...live });

// SQL-aggregated metrics behind every chart/KPI — replaces pulling all leads
// into the browser to reduce them client-side.
export const useAnalytics = () => useQuery({ queryKey: ["analytics"], queryFn: api.analytics, ...live });

export const useTopLeads = (
  limit = 8,
  opts?: { source?: string; minScore?: number; maxScore?: number },
) =>
  useQuery({
    queryKey: ["top-leads", limit, opts?.source ?? "all", opts?.minScore ?? "", opts?.maxScore ?? ""],
    queryFn: () => api.topLeads(limit, opts),
    ...live,
  });

// Paginated score-ranked call list. keepPreviousData holds the current page
// on screen while the next one loads, so paging doesn't flash empty.
export const useRankedLeads = (
  limit: number,
  offset: number,
  opts?: { source?: string; minScore?: number; maxScore?: number },
) =>
  useQuery({
    queryKey: ["ranked-leads", limit, offset, opts?.source ?? "all", opts?.minScore ?? "", opts?.maxScore ?? ""],
    queryFn: () => api.rankedLeads(limit, offset, opts),
    placeholderData: keepPreviousData,
    ...live,
  });

// Debounced search string flows in as `q`, plus the smart-filter options.
// keepPreviousData avoids the table flashing empty between keystrokes.
export const useSearchLeads = (
  q: string,
  limit = 200,
  opts?: { source?: string; minScore?: number; flagged?: boolean },
) =>
  useQuery({
    queryKey: ["search-leads", q, limit, opts?.source ?? "", opts?.minScore ?? "", opts?.flagged ?? ""],
    queryFn: () => api.searchLeads(q, limit, opts),
    placeholderData: keepPreviousData,
    ...live,
  });

// The rep call queue. NOT on the live poll -- a rep works a stable snapshot;
// worked leads drop off only on an explicit reload (refetch).
export const useCallList = (limit = 20) =>
  useQuery({ queryKey: ["call-list", limit], queryFn: () => api.callList(limit), staleTime: 60_000, refetchOnWindowFocus: false });

export const useSourcePerformance = () =>
  useQuery({ queryKey: ["source-performance"], queryFn: api.sourcePerformance, ...live });

export const usePipelineRuns = (limit = 20) =>
  useQuery({ queryKey: ["pipeline-runs", limit], queryFn: () => api.pipelineRuns(limit), ...live });

// Set a lead's disposition; refresh the stats/overview counts on success.
export const useSetDisposition = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ leadId, status }: { leadId: string; status: CallStatus }) => api.setLeadStatus(leadId, status),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["stats"] });
    },
  });
};

export const useDuplicates = () => useQuery({ queryKey: ["duplicates"], queryFn: () => api.duplicates(), ...live });
export const useInvalid = () => useQuery({ queryKey: ["invalid"], queryFn: () => api.invalid(), ...live });
export const useHealing = () => useQuery({ queryKey: ["healing"], queryFn: () => api.healingEvents(), ...live });
export const useHumanReview = () => useQuery({ queryKey: ["human-review"], queryFn: api.humanReview, ...live });
