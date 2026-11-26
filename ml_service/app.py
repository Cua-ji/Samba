"""Microservicio FastAPI para inferencia con las 3 redes neuronales de Samba."""

import pickle
import unicodedata
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any

import numpy as np
import torch
from fastapi import FastAPI
from pydantic import BaseModel, Field

from models_arch import AffinityMLP, IntentMLP, SafetyMLP
from training.build_datasets import BUDGET_LABELS, MEAL_TIME_LABELS, SAFETY_LABELS
from training.train_all import AFFINITY_FEATURE_ORDER

BASE_DIR = Path(__file__).resolve().parent
MODELS_DIR = BASE_DIR / "models"

STATE: dict[str, Any] = {}


def normalize_text(text: str) -> str:
    nfd = unicodedata.normalize("NFD", str(text).lower())
    return "".join(ch for ch in nfd if unicodedata.category(ch) != "Mn")


@asynccontextmanager
async def lifespan(_app: FastAPI):
    # Cargar IntentNet
    intent_ckpt = torch.load(MODELS_DIR / "intent_net.pt", map_location="cpu", weights_only=True)
    intent_model = IntentMLP(input_dim=intent_ckpt["input_dim"])
    intent_model.load_state_dict(intent_ckpt["state_dict"])
    intent_model.eval()
    with open(MODELS_DIR / "intent_vectorizer.pkl", "rb") as f:
        intent_vec = pickle.load(f)

    # Cargar SafetyNet
    safety_ckpt = torch.load(MODELS_DIR / "safety_net.pt", map_location="cpu", weights_only=True)
    safety_model = SafetyMLP(input_dim=safety_ckpt["input_dim"], num_labels=len(SAFETY_LABELS))
    safety_model.load_state_dict(safety_ckpt["state_dict"])
    safety_model.eval()
    with open(MODELS_DIR / "safety_vectorizer.pkl", "rb") as f:
        safety_vec = pickle.load(f)

    # Cargar AffinityNet
    affinity_ckpt = torch.load(MODELS_DIR / "affinity_net.pt", map_location="cpu", weights_only=True)
    affinity_model = AffinityMLP(input_dim=affinity_ckpt["input_dim"])
    affinity_model.load_state_dict(affinity_ckpt["state_dict"])
    affinity_model.eval()
    with open(MODELS_DIR / "affinity_scaler.pkl", "rb") as f:
        affinity_scaler = pickle.load(f)

    STATE.update({
        "intent_model": intent_model,
        "intent_vec": intent_vec,
        "safety_model": safety_model,
        "safety_vec": safety_vec,
        "affinity_model": affinity_model,
        "affinity_scaler": affinity_scaler,
    })
    yield
    STATE.clear()


app = FastAPI(title="Samba Neural Networks Service", version="1.0.0", lifespan=lifespan)


class IntentRequest(BaseModel):
    query: str


class SafetyRequest(BaseModel):
    text: str
    threshold: float = Field(default=0.6, ge=0.1, le=0.99)


class AffinityCandidate(BaseModel):
    id: str
    is_meal: int
    calories: float = 0
    protein: float = 0
    carbs: float = 0
    fat: float = 0
    cost_usd: float = 0
    prep_min: float = 0
    duration_min: float = 0
    impact_num: int = 0


class AffinityRequest(BaseModel):
    sex: int = 1
    age: float = 28
    weight_kg: float = 72.5
    height_cm: float = 176.0
    goal_idx: int = 0
    activity_idx: int = 1
    candidates: list[AffinityCandidate]


@app.get("/health")
def health():
    return {
        "status": "ok",
        "models_loaded": ["IntentNet", "SafetyNet", "AffinityNet"],
    }


@app.post("/predict/intent")
def predict_intent(req: IntentRequest):
    vec = STATE["intent_vec"].transform([normalize_text(req.query)]).toarray().astype(np.float32)
    with torch.no_grad():
        pm, pb, pf = STATE["intent_model"](torch.tensor(vec))
        meal_probs = torch.softmax(pm, dim=1)[0]
        budget_probs = torch.softmax(pb, dim=1)[0]
        flag_probs = torch.sigmoid(pf)[0]

    meal_idx = int(meal_probs.argmax().item())
    budget_idx = int(budget_probs.argmax().item())
    meal_time = None if MEAL_TIME_LABELS[meal_idx] == "none" else MEAL_TIME_LABELS[meal_idx]
    budget_tier = None if BUDGET_LABELS[budget_idx] == "none" else BUDGET_LABELS[budget_idx]

    return {
        "model": "IntentNet",
        "mealTime": meal_time,
        "mealTimeConfidence": round(float(meal_probs[meal_idx].item()), 4),
        "budgetTier": budget_tier,
        "budgetConfidence": round(float(budget_probs[budget_idx].item()), 4),
        "mentionsWorkout": bool(flag_probs[0].item() >= 0.5),
        "mentionsMeal": bool(flag_probs[1].item() >= 0.5),
        "mentionsWhyDiscard": bool(flag_probs[2].item() >= 0.5),
        "mentionsMacros": bool(flag_probs[3].item() >= 0.5),
        "flagConfidences": {
            "workout": round(float(flag_probs[0].item()), 4),
            "meal": round(float(flag_probs[1].item()), 4),
            "whyDiscard": round(float(flag_probs[2].item()), 4),
            "macros": round(float(flag_probs[3].item()), 4),
        },
    }


@app.post("/predict/safety")
def predict_safety(req: SafetyRequest):
    vec = STATE["safety_vec"].transform([normalize_text(req.text)]).toarray().astype(np.float32)
    with torch.no_grad():
        probs = torch.sigmoid(STATE["safety_model"](torch.tensor(vec)))[0].numpy()

    scores = {lbl: round(float(p), 4) for lbl, p in zip(SAFETY_LABELS, probs)}
    allergens = [lbl for lbl in SAFETY_LABELS[:5] if scores[lbl] >= req.threshold]
    contraindications = [lbl for lbl in SAFETY_LABELS[6:] if scores[lbl] >= req.threshold]
    high_impact = scores["alto_impacto"] >= req.threshold

    return {
        "model": "SafetyNet",
        "allergens": allergens,
        "contraindications": contraindications,
        "highImpact": high_impact,
        "scores": scores,
    }


@app.post("/predict/affinity")
def predict_affinity(req: AffinityRequest):
    if not req.candidates:
        return {"model": "AffinityNet", "scores": {}}

    rows = []
    for c in req.candidates:
        feat_dict = {
            "sex": req.sex,
            "age": req.age,
            "weight_kg": req.weight_kg,
            "height_cm": req.height_cm,
            "goal_idx": req.goal_idx,
            "activity_idx": req.activity_idx,
            "is_meal": c.is_meal,
            "calories": c.calories,
            "protein": c.protein,
            "carbs": c.carbs,
            "fat": c.fat,
            "cost_usd": c.cost_usd,
            "prep_min": c.prep_min,
            "duration_min": c.duration_min,
            "impact_num": c.impact_num,
        }
        rows.append([feat_dict[k] for k in AFFINITY_FEATURE_ORDER])

    X = STATE["affinity_scaler"].transform(np.array(rows, dtype=np.float32)).astype(np.float32)
    with torch.no_grad():
        probs = torch.sigmoid(STATE["affinity_model"](torch.tensor(X))).numpy()

    scores = {c.id: round(float(p), 4) for c, p in zip(req.candidates, probs)}
    return {"model": "AffinityNet", "scores": scores}
