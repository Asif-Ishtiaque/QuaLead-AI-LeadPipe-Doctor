import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";

// Poll the read endpoints on a light interval so the dashboard feels live,
// mirroring the Streamlit app's 5s cache TTL.
const live = { refetchInterval: 8000, staleTime: 4000 };

export const useStats = () => useQuery({ queryKey: ["stats"], queryFn: api.stats, ...live });
export const useLeads = (limit = 5000) =>
  useQuery({ queryKey: ["leads", limit], queryFn: () => api.leads(limit), ...live });
export const useDuplicates = () => useQuery({ queryKey: ["duplicates"], queryFn: () => api.duplicates(), ...live });
export const useInvalid = () => useQuery({ queryKey: ["invalid"], queryFn: () => api.invalid(), ...live });
export const useHealing = () => useQuery({ queryKey: ["healing"], queryFn: () => api.healingEvents(), ...live });
export const useHumanReview = () => useQuery({ queryKey: ["human-review"], queryFn: api.humanReview, ...live });
