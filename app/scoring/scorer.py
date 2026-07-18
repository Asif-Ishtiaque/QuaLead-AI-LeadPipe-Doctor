"""Lead scoring entrypoint used by the pipeline. Prefers the trained
XGBoost model (ml/models/lead_scorer.joblib); if it hasn't been trained yet
or fails to load, transparently falls back to the rule-based scorer so
scoring never blocks the rest of the pipeline."""

from pathlib import Path

import joblib

from app.scoring.features import build_features, features_to_vector
from app.scoring.rule_based import rule_based_score

MODEL_PATH = Path(__file__).resolve().parents[2] / "ml" / "models" / "lead_scorer.joblib"


class LeadScorer:
    def __init__(self):
        self._model = None
        if MODEL_PATH.exists():
            try:
                self._model = joblib.load(MODEL_PATH)
            except Exception:
                self._model = None

    def score(self, lead) -> float:
        if self._model is None:
            return rule_based_score(lead)
        vector = features_to_vector(build_features(lead))
        predicted = float(self._model.predict([vector])[0])
        return max(0.0, min(100.0, predicted))

    def score_batch(self, leads: list) -> list:
        for lead in leads:
            lead.quality_score = round(self.score(lead), 2)
        return leads
