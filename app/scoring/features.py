"""Turns a validated Lead into a flat numeric feature vector for scoring.
Shared by both the rule-based scorer and the XGBoost model so the two stay
comparable."""

from app.schema.canonical import Lead, LeadSource

SOURCE_ORDER = [s.value for s in LeadSource]

FEATURE_NAMES = [
    "has_first_name",
    "has_last_name",
    "has_email",
    "has_phone",
    "has_campaign_id",
    "consent",
    "email_is_free_provider",
    "created_hour",
    *[f"source_{s}" for s in SOURCE_ORDER],
]

FREE_EMAIL_DOMAINS = {"gmail.com", "yahoo.com", "hotmail.com", "outlook.com", "icloud.com"}


def build_features(lead: Lead) -> dict[str, float]:
    email_domain = (lead.email or "").split("@")[-1].lower() if lead.email else ""
    source_value = lead.source.value if isinstance(lead.source, LeadSource) else lead.source

    features = {
        "has_first_name": float(bool(lead.first_name)),
        "has_last_name": float(bool(lead.last_name)),
        "has_email": float(bool(lead.email)),
        "has_phone": float(bool(lead.phone_e164)),
        "has_campaign_id": float(bool(lead.campaign_id)),
        "consent": float(bool(lead.consent)),
        "email_is_free_provider": float(email_domain in FREE_EMAIL_DOMAINS),
        "created_hour": float(lead.created_at.hour),
    }
    for s in SOURCE_ORDER:
        features[f"source_{s}"] = float(source_value == s)

    return features


def features_to_vector(features: dict[str, float]) -> list[float]:
    return [features[name] for name in FEATURE_NAMES]
