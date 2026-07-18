"""Streamlit dashboard for LeadPipe Doctor: leads per source, clean vs
dirty rate, score distribution, self-healing events, and dedup stats.

Fetches everything from the FastAPI service (API_BASE_URL) rather than
opening the database directly. DuckDB (the local dev fallback) only
supports a single writer process at a time -- if the dashboard also opened
its own connection, it would lock out the API process running alongside
it. Going through the API keeps exactly one process touching the database,
which works the same way whether that database is DuckDB or Postgres.

Run with: streamlit run dashboard/streamlit_app.py
"""

import json
import os
from datetime import datetime

import pandas as pd
import plotly.express as px
import requests
import streamlit as st

API_BASE_URL = os.getenv("API_BASE_URL", "http://localhost:8000")

# Power BI's own default report theme palette -- reused here (not the
# product itself, just the color sequence) because it's the fastest way
# to make charts read as "BI report" rather than "default plotly demo".
PBI_PALETTE = ["#118DFF", "#12239E", "#E66C37", "#6B007B", "#E044A7", "#744EC2", "#D9B300", "#D64550"]
STATUS_COLORS = {"clean": "#118DFF", "flagged": "#D9B300", "duplicate": "#6B007B", "invalid": "#D64550"}

st.set_page_config(page_title="LeadPipe Doctor", page_icon="\U0001F4CA", layout="wide")

st.markdown(
    """
    <style>
    #MainMenu {visibility: hidden;}
    footer {visibility: hidden;}
    html, body, [class*="css"] {
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    }
    .lpd-header {
        display: flex; justify-content: space-between; align-items: baseline;
        margin-bottom: 0.25rem;
    }
    .lpd-title { font-size: 1.9rem; font-weight: 700; color: #201F1E; }
    .lpd-subtitle { font-size: 0.95rem; color: #605E5C; }
    .lpd-live-badge {
        font-size: 0.75rem; font-weight: 600; color: #107C10;
        background: #DFF6DD; padding: 2px 10px; border-radius: 999px;
    }
    .kpi-card {
        background: #FFFFFF; border-radius: 10px; padding: 14px 18px 12px 18px;
        border-left: 5px solid var(--accent); box-shadow: 0 1px 4px rgba(0,0,0,0.10);
        height: 100%;
    }
    .kpi-label {
        font-size: 0.72rem; font-weight: 600; color: #605E5C;
        text-transform: uppercase; letter-spacing: 0.04em; margin-bottom: 2px;
    }
    .kpi-value { font-size: 1.7rem; font-weight: 700; color: #201F1E; line-height: 1.2; }
    .kpi-sub { font-size: 0.72rem; color: #8A8886; margin-top: 2px; }
    </style>
    """,
    unsafe_allow_html=True,
)


@st.cache_data(ttl=5)
def fetch(path: str, limit: int = 5000):
    try:
        resp = requests.get(f"{API_BASE_URL}{path}", params={"limit": limit}, timeout=10)
        resp.raise_for_status()
        return resp.json()
    except requests.RequestException as exc:
        st.error(f"Couldn't reach the API at {API_BASE_URL}{path}: {exc}")
        return []


def kpi_card(col, label: str, value, accent: str, sub: str = "") -> None:
    col.markdown(
        f"""
        <div class="kpi-card" style="--accent: {accent};">
            <div class="kpi-label">{label}</div>
            <div class="kpi-value">{value:,}</div>
            <div class="kpi-sub">{sub}</div>
        </div>
        """,
        unsafe_allow_html=True,
    )


def parse_json_column(series: pd.Series) -> pd.Series:
    def _safe_load(value):
        try:
            return json.loads(value) if isinstance(value, str) else value
        except (TypeError, json.JSONDecodeError):
            return None

    return series.apply(_safe_load)


header_left, header_right = st.columns([3, 1])
with header_left:
    st.markdown(
        """
        <div class="lpd-header">
            <span class="lpd-title">\U0001F4CA LeadPipe Doctor</span>
        </div>
        <div class="lpd-subtitle">Self-healing lead ingestion &mdash; live pipeline report</div>
        """,
        unsafe_allow_html=True,
    )
with header_right:
    st.markdown(
        f"""
        <div style="text-align:right; padding-top: 8px;">
            <span class="lpd-live-badge">&#9679; LIVE</span>
            <div class="kpi-sub" style="margin-top:4px;">Updated {datetime.now().strftime('%H:%M:%S')}</div>
        </div>
        """,
        unsafe_allow_html=True,
    )
    if st.button("Refresh"):
        fetch.clear()
        st.rerun()

st.write("")

leads = pd.DataFrame(fetch("/leads", limit=100_000))
duplicates = pd.DataFrame(fetch("/duplicates", limit=100_000))
invalid = pd.DataFrame(fetch("/invalid", limit=100_000))
healing = pd.DataFrame(fetch("/healing-events", limit=100_000))
review_queue = fetch("/human-review")

# `leads` holds both "clean" and "flagged" rows -- flagged didn't fail
# validation, it just tripped a quality concern (disposable email,
# placeholder name) worth a human glancing at before treating it like a
# normal lead. See app/agent/pipeline.py:_flag_quality_concerns.
clean_leads = leads[leads["status"] == "clean"] if not leads.empty and "status" in leads.columns else leads
flagged_leads = leads[leads["status"] == "flagged"] if not leads.empty and "status" in leads.columns else pd.DataFrame()
total_seen = len(leads) + len(duplicates) + len(invalid)

with st.sidebar:
    st.markdown("### Filters")
    st.caption("Applied to the charts and the Explore Leads tab below — headline KPI cards always show all-time totals.")

    sources = sorted(leads["source"].dropna().unique().tolist()) if not leads.empty and "source" in leads.columns else []
    selected_sources = st.multiselect("Source", options=sources, default=sources)

    statuses = sorted(leads["status"].dropna().unique().tolist()) if not leads.empty and "status" in leads.columns else []
    selected_statuses = st.multiselect("Status", options=statuses, default=statuses)

    if not leads.empty and "quality_score" in leads.columns and leads["quality_score"].notna().any():
        score_min, score_max = float(leads["quality_score"].min()), float(leads["quality_score"].max())
        score_range = st.slider("Quality score range", min_value=0.0, max_value=100.0, value=(score_min, score_max))
    else:
        score_range = (0.0, 100.0)

    st.divider()
    st.caption("Data pulled live from the FastAPI service every 5s (or on demand via Refresh).")

if not leads.empty:
    filtered_leads = leads[
        leads["source"].isin(selected_sources)
        & leads["status"].isin(selected_statuses)
        & leads["quality_score"].fillna(0).between(score_range[0], score_range[1])
    ]
else:
    filtered_leads = leads
filtered_clean = filtered_leads[filtered_leads["status"] == "clean"] if not filtered_leads.empty else filtered_leads
filtered_flagged = filtered_leads[filtered_leads["status"] == "flagged"] if not filtered_leads.empty else pd.DataFrame()

quality_rate = round(100 * len(clean_leads) / total_seen, 1) if total_seen else 0.0

kpi_cols = st.columns(6)
kpi_card(kpi_cols[0], "Clean leads", len(clean_leads), STATUS_COLORS["clean"], f"{quality_rate}% of all processed")
kpi_card(kpi_cols[1], "Flagged leads", len(flagged_leads), STATUS_COLORS["flagged"], "passed validation, quality concern")
kpi_card(kpi_cols[2], "Duplicates removed", len(duplicates), STATUS_COLORS["duplicate"], "merged into a kept lead")
kpi_card(kpi_cols[3], "Invalid rows", len(invalid), STATUS_COLORS["invalid"], "failed schema validation")
kpi_card(kpi_cols[4], "Self-healing events", len(healing), "#744EC2", "code auto-patched mid-pipeline")
kpi_card(kpi_cols[5], "Pending human review", len(review_queue), "#E66C37", "exhausted self-healing retries")

st.write("")

tab_overview, tab_quality, tab_healing, tab_explore = st.tabs(
    ["\U0001F4C8 Overview", "\U0001F50E Data Quality", "\U0001FA79 Self-Healing", "\U0001F4CB Explore Leads"]
)

with tab_overview:
    left, right = st.columns(2)
    with left:
        st.subheader("Leads per source")
        if not filtered_leads.empty:
            counts = filtered_leads["source"].value_counts().reset_index()
            counts.columns = ["source", "count"]
            fig = px.bar(counts, x="source", y="count", color="source", color_discrete_sequence=PBI_PALETTE, text="count")
            fig.update_layout(showlegend=False, xaxis_title=None, yaxis_title="Leads")
            st.plotly_chart(fig, use_container_width=True)
        else:
            st.info("No leads match the current filters.")

    with right:
        st.subheader("Clean vs. dirty rate")
        if total_seen:
            rate_df = pd.DataFrame(
                {
                    "outcome": ["clean", "flagged", "duplicate", "invalid"],
                    "count": [len(clean_leads), len(flagged_leads), len(duplicates), len(invalid)],
                }
            )
            fig = px.pie(
                rate_df, names="outcome", values="count", hole=0.55, color="outcome", color_discrete_map=STATUS_COLORS
            )
            fig.update_layout(legend_title=None)
            st.plotly_chart(fig, use_container_width=True)
        else:
            st.info("No data processed yet.")

    st.subheader("Lead quality score distribution")
    scored = filtered_leads[filtered_leads["quality_score"].notna()] if not filtered_leads.empty else filtered_leads
    if not scored.empty:
        fig = px.histogram(
            scored, x="quality_score", color="status", nbins=20, barmode="stack", color_discrete_map=STATUS_COLORS
        )
        fig.update_layout(xaxis_title="Quality score", yaxis_title="Leads", legend_title=None)
        st.plotly_chart(fig, use_container_width=True)
    else:
        st.info("No scored leads match the current filters.")

    dup_col, invalid_col = st.columns(2)
    with dup_col:
        st.subheader("Recent duplicates")
        if not duplicates.empty:
            cols = [c for c in ["first_name", "last_name", "email", "source", "duplicate_of_lead_id"] if c in duplicates.columns]
            st.dataframe(duplicates[cols].tail(25), use_container_width=True, hide_index=True)
        else:
            st.info("No duplicates recorded yet.")
    with invalid_col:
        st.subheader("Recent invalid rows")
        if not invalid.empty:
            preview = invalid.tail(25).copy()
            if "record" in preview.columns:
                preview["record"] = parse_json_column(preview["record"])
            st.dataframe(preview, use_container_width=True, hide_index=True)
        else:
            st.info("No invalid rows recorded yet.")

with tab_quality:
    st.subheader("Most common validation failures")
    if not invalid.empty and "errors" in invalid.columns:
        parsed_errors = parse_json_column(invalid["errors"])
        reasons = []
        for error_list in parsed_errors.dropna():
            if isinstance(error_list, list):
                for err in error_list:
                    if isinstance(err, dict):
                        field = ".".join(str(p) for p in err.get("loc", [])) or "unknown field"
                        reasons.append(f"{field}: {err.get('msg', 'invalid value')}")
        if reasons:
            top_reasons = pd.Series(reasons).value_counts().head(10).reset_index()
            top_reasons.columns = ["reason", "count"]
            fig = px.bar(
                top_reasons.sort_values("count"),
                x="count",
                y="reason",
                orientation="h",
                color_discrete_sequence=[STATUS_COLORS["invalid"]],
            )
            fig.update_layout(yaxis_title=None, xaxis_title="Occurrences")
            st.plotly_chart(fig, use_container_width=True)
        else:
            st.info("Invalid rows exist, but no parseable error detail was found.")
    else:
        st.info("No invalid rows recorded yet.")

with tab_healing:
    st.subheader("Self-healing events")
    if not healing.empty:
        event_col, table_col = st.columns([1, 2])
        with event_col:
            if "exception_type" in healing.columns:
                exc_counts = healing["exception_type"].value_counts().reset_index()
                exc_counts.columns = ["exception_type", "count"]
                fig = px.bar(exc_counts, x="count", y="exception_type", orientation="h", color_discrete_sequence=["#744EC2"])
                fig.update_layout(yaxis_title=None, xaxis_title="Retries")
                st.plotly_chart(fig, use_container_width=True)
        with table_col:
            st.dataframe(healing, use_container_width=True, hide_index=True)
    else:
        st.info("No self-healing events recorded yet -- the pipeline hasn't hit a code bug (or Ollama isn't running).")

    st.subheader("Human review queue")
    if review_queue:
        st.dataframe(pd.DataFrame(review_queue), use_container_width=True, hide_index=True)
    else:
        st.info("Empty -- nothing has exhausted self-healing retries.")

with tab_explore:
    st.subheader("Leads")
    search = st.text_input("Search by name or email", placeholder="e.g. curie or marie.curie@radiuminstitute.com")
    table = filtered_leads
    if search and not table.empty:
        needle = search.lower()
        haystack = table[["first_name", "last_name", "email"]].astype(str).apply(lambda c: c.str.lower())
        mask = haystack.apply(lambda c: c.str.contains(needle, na=False)).any(axis=1)
        table = table[mask]

    st.caption(f"Showing {len(table):,} of {len(leads):,} leads (filtered by sidebar + search)")
    st.dataframe(table.sort_values("created_at", ascending=False) if "created_at" in table.columns else table, use_container_width=True, hide_index=True)

    if not table.empty:
        st.download_button(
            "Download filtered leads as CSV",
            data=table.to_csv(index=False).encode("utf-8"),
            file_name="leadpipe_filtered_leads.csv",
            mime="text/csv",
        )
