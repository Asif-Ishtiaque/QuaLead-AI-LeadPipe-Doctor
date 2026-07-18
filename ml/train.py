"""Trains the XGBoost lead-scoring model.

There's no real historical "did this lead convert" outcome in this demo, so
we bootstrap training labels from the deterministic rule-based scorer plus
noise -- this teaches XGBoost to approximate (and generalize past) the
rule-based heuristic. Swap in real conversion outcomes here once they
exist; nothing else in the pipeline needs to change since app/scoring/
scorer.py only depends on the saved model's predict() interface.

Run with: python -m ml.train
"""

import random
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

import joblib
import mlflow
import xgboost as xgb
from sklearn.metrics import mean_absolute_error
from sklearn.model_selection import train_test_split

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.schema.canonical import Lead, LeadSource  # noqa: E402
from app.scoring.features import FEATURE_NAMES, build_features, features_to_vector  # noqa: E402
from app.scoring.rule_based import rule_based_score  # noqa: E402
from app.utils.config import settings  # noqa: E402

MODEL_OUT = Path(__file__).resolve().parent / "models" / "lead_scorer.joblib"
N_SAMPLES = 20_000


def _synthetic_lead(i: int) -> Lead:
    has_email = random.random() > 0.15
    has_phone = random.random() > 0.15
    email = f"lead{i}@{'gmail.com' if random.random() > 0.5 else 'company.com'}" if has_email else "placeholder@example.com"
    phone = f"+1415555{i % 10000:04d}" if has_phone else "+15550000000"

    return Lead(
        lead_id=f"train-{i}",
        first_name="Sample",
        last_name="Lead" if random.random() > 0.1 else "X",
        email=email,
        phone_e164=phone,
        source=random.choice(list(LeadSource)),
        campaign_id=f"camp_{i % 20}" if random.random() > 0.3 else None,
        consent=random.random() > 0.4,
        created_at=datetime.now(timezone.utc) - timedelta(hours=random.randint(0, 500)),
    )


def build_training_set(n: int = N_SAMPLES):
    X, y = [], []
    for i in range(n):
        lead = _synthetic_lead(i)
        X.append(features_to_vector(build_features(lead)))
        label = rule_based_score(lead) + random.gauss(0, 5)
        y.append(max(0.0, min(100.0, label)))
    return X, y


def main():
    random.seed(42)
    mlflow.set_tracking_uri(settings.mlflow_tracking_uri)
    mlflow.set_experiment("leadpipe-doctor-scoring")

    X, y = build_training_set()
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

    with mlflow.start_run():
        params = {"n_estimators": 200, "max_depth": 4, "learning_rate": 0.1, "random_state": 42}
        mlflow.log_params(params)

        model = xgb.XGBRegressor(**params)
        model.fit(X_train, y_train)

        mae = mean_absolute_error(y_test, model.predict(X_test))
        mlflow.log_metric("mae", mae)
        print(f"Validation MAE: {mae:.3f}")

        MODEL_OUT.parent.mkdir(parents=True, exist_ok=True)
        joblib.dump(model, MODEL_OUT)
        mlflow.log_artifact(str(MODEL_OUT))
        print(f"Saved model to {MODEL_OUT}")
        print(f"Feature order: {FEATURE_NAMES}")


if __name__ == "__main__":
    main()
