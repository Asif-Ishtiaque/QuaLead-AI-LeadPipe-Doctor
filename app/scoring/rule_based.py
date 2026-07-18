"""Deterministic, no-training-required lead scorer. Used as the scoring
fallback when no trained model is available, and as the source of pseudo-
labels for training the XGBoost model (see ml/train.py) since this demo has
no real historical conversion outcomes to learn from."""

from app.scoring.features import build_features

WEIGHTS = {
    "has_first_name": 5,
    "has_last_name": 5,
    "has_email": 20,
    "has_phone": 20,
    "has_campaign_id": 10,
    "consent": 30,
    "email_is_free_provider": -5,
}


def rule_based_score(lead) -> float:
    features = build_features(lead)
    score = sum(WEIGHTS.get(name, 0) * value for name, value in features.items())
    return max(0.0, min(100.0, score))
