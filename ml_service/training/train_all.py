"""Entrena las 3 redes neuronales de Samba (IntentNet, SafetyNet, AffinityNet) y guarda pesos + metricas."""

import json
import pickle
import sys
import unicodedata
from pathlib import Path

import numpy as np
import torch
import torch.nn as nn
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.pipeline import FeatureUnion
from sklearn.metrics import accuracy_score, f1_score
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
from torch.utils.data import DataLoader, TensorDataset

BASE_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BASE_DIR))

from models_arch import AffinityMLP, IntentMLP, SafetyMLP  # noqa: E402
from training.build_datasets import (  # noqa: E402
    BUDGET_LABELS,
    MEAL_TIME_LABELS,
    SAFETY_LABELS,
    main as generate_datasets,
)
from training.common import get_device, save_training_plot  # noqa: E402

DATA_DIR = BASE_DIR / "data"
MODELS_DIR = BASE_DIR / "models"
REPORTS_DIR = BASE_DIR / "reports"

AFFINITY_FEATURE_ORDER = [
    "sex",
    "age",
    "weight_kg",
    "height_cm",
    "goal_idx",
    "activity_idx",
    "is_meal",
    "calories",
    "protein",
    "carbs",
    "fat",
    "cost_usd",
    "prep_min",
    "duration_min",
    "impact_num",
]


def normalize_text(text: str) -> str:
    nfd = unicodedata.normalize("NFD", str(text).lower())
    return "".join(ch for ch in nfd if unicodedata.category(ch) != "Mn")


def train_intent_net(device: torch.device) -> dict:
    raw = json.loads((DATA_DIR / "intent_dataset.json").read_text(encoding="utf-8"))
    texts = [normalize_text(r["query"]) for r in raw]
    y_meal = np.array([MEAL_TIME_LABELS.index(r["mealTime"]) for r in raw], dtype=np.int64)
    y_budget = np.array([BUDGET_LABELS.index(r["budgetTier"]) for r in raw], dtype=np.int64)
    y_flags = np.array([r["flags"] for r in raw], dtype=np.float32)

    idx = np.arange(len(texts))
    idx_train, idx_tmp = train_test_split(idx, test_size=0.30, random_state=42)
    idx_val, idx_test = train_test_split(idx_tmp, test_size=0.50, random_state=42)

    vectorizer = FeatureUnion([
        ("word", TfidfVectorizer(ngram_range=(1, 2), max_features=600, sublinear_tf=True)),
        ("char", TfidfVectorizer(analyzer="char_wb", ngram_range=(3, 5), max_features=600, sublinear_tf=True)),
    ])
    X_train = vectorizer.fit_transform([texts[i] for i in idx_train]).toarray().astype(np.float32)
    X_val = vectorizer.transform([texts[i] for i in idx_val]).toarray().astype(np.float32)
    X_test = vectorizer.transform([texts[i] for i in idx_test]).toarray().astype(np.float32)

    train_ds = TensorDataset(
        torch.tensor(X_train),
        torch.tensor(y_meal[idx_train]),
        torch.tensor(y_budget[idx_train]),
        torch.tensor(y_flags[idx_train]),
    )
    train_loader = DataLoader(train_ds, batch_size=32, shuffle=True)

    model = IntentMLP(input_dim=X_train.shape[1]).to(device)
    optimizer = torch.optim.Adam(model.parameters(), lr=3e-3, weight_decay=1e-4)
    ce_loss = nn.CrossEntropyLoss()
    bce_loss = nn.BCEWithLogitsLoss()

    history = {"train_loss": [], "val_loss": [], "train_metric": [], "val_metric": [], "metric_name": "Acc"}
    best_val_loss = float("inf")
    best_state = None

    for _ in range(35):
        model.train()
        total_loss, correct, total = 0.0, 0, 0
        for bx, bm, bb, bf in train_loader:
            bx, bm, bb, bf = bx.to(device), bm.to(device), bb.to(device), bf.to(device)
            optimizer.zero_grad()
            pm, pb, pf = model(bx)
            loss = ce_loss(pm, bm) + ce_loss(pb, bb) + bce_loss(pf, bf)
            loss.backward()
            optimizer.step()
            total_loss += loss.item() * len(bx)
            correct += ((pm.argmax(1) == bm) & (pb.argmax(1) == bb)).sum().item()
            total += len(bx)

        model.eval()
        with torch.no_grad():
            vx = torch.tensor(X_val, device=device)
            vm = torch.tensor(y_meal[idx_val], device=device)
            vb = torch.tensor(y_budget[idx_val], device=device)
            vf = torch.tensor(y_flags[idx_val], device=device)
            pm, pb, pf = model(vx)
            v_loss = (ce_loss(pm, vm) + ce_loss(pb, vb) + bce_loss(pf, vf)).item()
            v_acc = ((pm.argmax(1) == vm) & (pb.argmax(1) == vb)).float().mean().item()

        history["train_loss"].append(total_loss / total)
        history["val_loss"].append(v_loss)
        history["train_metric"].append(correct / total)
        history["val_metric"].append(v_acc)

        if v_loss < best_val_loss:
            best_val_loss = v_loss
            best_state = {k: v.cpu().clone() for k, v in model.state_dict().items()}

    model.load_state_dict(best_state)
    model.eval()
    with torch.no_grad():
        tx = torch.tensor(X_test, device=device)
        pm, pb, pf = model(tx)
        meal_acc = accuracy_score(y_meal[idx_test], pm.argmax(1).cpu().numpy())
        budget_acc = accuracy_score(y_budget[idx_test], pb.argmax(1).cpu().numpy())
        flags_pred = (torch.sigmoid(pf).cpu().numpy() >= 0.5).astype(int)
        flags_f1 = f1_score(y_flags[idx_test], flags_pred, average="macro", zero_division=0)

    torch.save({"state_dict": best_state, "input_dim": X_train.shape[1]}, MODELS_DIR / "intent_net.pt")
    with open(MODELS_DIR / "intent_vectorizer.pkl", "wb") as f:
        pickle.dump(vectorizer, f)

    save_training_plot(history, "IntentNet (NLP)", REPORTS_DIR / "intent_net_training.png")
    return {"meal_time_acc": round(meal_acc, 4), "budget_acc": round(budget_acc, 4), "flags_f1": round(flags_f1, 4)}


def train_safety_net(device: torch.device) -> dict:
    raw = json.loads((DATA_DIR / "safety_dataset.json").read_text(encoding="utf-8"))
    texts = [normalize_text(r["text"]) for r in raw]
    Y = np.array([r["labels"] for r in raw], dtype=np.float32)

    idx = np.arange(len(texts))
    idx_train, idx_tmp = train_test_split(idx, test_size=0.30, random_state=42)
    idx_val, idx_test = train_test_split(idx_tmp, test_size=0.50, random_state=42)

    vectorizer = FeatureUnion([
        ("word", TfidfVectorizer(ngram_range=(1, 2), max_features=700, sublinear_tf=True)),
        ("char", TfidfVectorizer(analyzer="char_wb", ngram_range=(3, 5), max_features=700, sublinear_tf=True)),
    ])
    X_train = vectorizer.fit_transform([texts[i] for i in idx_train]).toarray().astype(np.float32)
    X_val = vectorizer.transform([texts[i] for i in idx_val]).toarray().astype(np.float32)
    X_test = vectorizer.transform([texts[i] for i in idx_test]).toarray().astype(np.float32)

    train_ds = TensorDataset(torch.tensor(X_train), torch.tensor(Y[idx_train]))
    train_loader = DataLoader(train_ds, batch_size=24, shuffle=True)

    model = SafetyMLP(input_dim=X_train.shape[1], num_labels=len(SAFETY_LABELS)).to(device)
    optimizer = torch.optim.Adam(model.parameters(), lr=3e-3, weight_decay=1e-4)
    criterion = nn.BCEWithLogitsLoss()

    history = {"train_loss": [], "val_loss": [], "train_metric": [], "val_metric": [], "metric_name": "F1"}
    best_val_loss = float("inf")
    best_state = None

    for _ in range(45):
        model.train()
        total_loss, all_p, all_y = 0.0, [], []
        for bx, by in train_loader:
            bx, by = bx.to(device), by.to(device)
            optimizer.zero_grad()
            logits = model(bx)
            loss = criterion(logits, by)
            loss.backward()
            optimizer.step()
            total_loss += loss.item() * len(bx)
            all_p.append((torch.sigmoid(logits).detach().cpu().numpy() >= 0.5).astype(int))
            all_y.append(by.cpu().numpy())

        train_f1 = f1_score(np.vstack(all_y), np.vstack(all_p), average="micro", zero_division=0)

        model.eval()
        with torch.no_grad():
            vx = torch.tensor(X_val, device=device)
            vy = torch.tensor(Y[idx_val], device=device)
            v_logits = model(vx)
            v_loss = criterion(v_logits, vy).item()
            v_pred = (torch.sigmoid(v_logits).cpu().numpy() >= 0.5).astype(int)
            val_f1 = f1_score(Y[idx_val], v_pred, average="micro", zero_division=0)

        history["train_loss"].append(total_loss / len(idx_train))
        history["val_loss"].append(v_loss)
        history["train_metric"].append(train_f1)
        history["val_metric"].append(val_f1)

        if v_loss < best_val_loss:
            best_val_loss = v_loss
            best_state = {k: v.cpu().clone() for k, v in model.state_dict().items()}

    model.load_state_dict(best_state)
    model.eval()
    with torch.no_grad():
        tx = torch.tensor(X_test, device=device)
        t_pred = (torch.sigmoid(model(tx)).cpu().numpy() >= 0.5).astype(int)
        test_micro_f1 = f1_score(Y[idx_test], t_pred, average="micro", zero_division=0)
        test_macro_f1 = f1_score(Y[idx_test], t_pred, average="macro", zero_division=0)

    torch.save({"state_dict": best_state, "input_dim": X_train.shape[1]}, MODELS_DIR / "safety_net.pt")
    with open(MODELS_DIR / "safety_vectorizer.pkl", "wb") as f:
        pickle.dump(vectorizer, f)

    save_training_plot(history, "SafetyNet (Alergenos/Impacto)", REPORTS_DIR / "safety_net_training.png")
    return {"micro_f1": round(test_micro_f1, 4), "macro_f1": round(test_macro_f1, 4)}


def train_affinity_net(device: torch.device) -> dict:
    raw = json.loads((DATA_DIR / "affinity_dataset.json").read_text(encoding="utf-8"))
    X = np.array([[r["features"][k] for k in AFFINITY_FEATURE_ORDER] for r in raw], dtype=np.float32)
    y = np.array([r["label"] for r in raw], dtype=np.float32)

    X_train, X_tmp, y_train, y_tmp = train_test_split(X, y, test_size=0.30, random_state=42, stratify=y)
    X_val, X_test, y_val, y_test = train_test_split(X_tmp, y_tmp, test_size=0.50, random_state=42, stratify=y_tmp)

    scaler = StandardScaler()
    X_train = scaler.fit_transform(X_train).astype(np.float32)
    X_val = scaler.transform(X_val).astype(np.float32)
    X_test = scaler.transform(X_test).astype(np.float32)

    train_ds = TensorDataset(torch.tensor(X_train), torch.tensor(y_train))
    train_loader = DataLoader(train_ds, batch_size=64, shuffle=True)

    model = AffinityMLP(input_dim=X_train.shape[1]).to(device)
    optimizer = torch.optim.Adam(model.parameters(), lr=2e-3, weight_decay=1e-4)
    criterion = nn.BCEWithLogitsLoss()

    history = {"train_loss": [], "val_loss": [], "train_metric": [], "val_metric": [], "metric_name": "Acc"}
    best_val_loss = float("inf")
    best_state = None

    for _ in range(40):
        model.train()
        total_loss, correct, total = 0.0, 0, 0
        for bx, by in train_loader:
            bx, by = bx.to(device), by.to(device)
            optimizer.zero_grad()
            logits = model(bx)
            loss = criterion(logits, by)
            loss.backward()
            optimizer.step()
            total_loss += loss.item() * len(bx)
            preds = (torch.sigmoid(logits) >= 0.5).float()
            correct += (preds == by).sum().item()
            total += len(bx)

        model.eval()
        with torch.no_grad():
            vx = torch.tensor(X_val, device=device)
            vy = torch.tensor(y_val, device=device)
            v_logits = model(vx)
            v_loss = criterion(v_logits, vy).item()
            v_acc = ((torch.sigmoid(v_logits) >= 0.5).float() == vy).float().mean().item()

        history["train_loss"].append(total_loss / total)
        history["val_loss"].append(v_loss)
        history["train_metric"].append(correct / total)
        history["val_metric"].append(v_acc)

        if v_loss < best_val_loss:
            best_val_loss = v_loss
            best_state = {k: v.cpu().clone() for k, v in model.state_dict().items()}

    model.load_state_dict(best_state)
    model.eval()
    with torch.no_grad():
        tx = torch.tensor(X_test, device=device)
        t_probs = torch.sigmoid(model(tx)).cpu().numpy()
        t_pred = (t_probs >= 0.5).astype(int)
        test_acc = accuracy_score(y_test, t_pred)
        test_f1 = f1_score(y_test, t_pred, zero_division=0)

    torch.save({"state_dict": best_state, "input_dim": X_train.shape[1]}, MODELS_DIR / "affinity_net.pt")
    with open(MODELS_DIR / "affinity_scaler.pkl", "wb") as f:
        pickle.dump(scaler, f)

    save_training_plot(history, "AffinityNet (Tabular)", REPORTS_DIR / "affinity_net_training.png")
    return {"accuracy": round(test_acc, 4), "f1": round(test_f1, 4)}


def main() -> None:
    MODELS_DIR.mkdir(parents=True, exist_ok=True)
    REPORTS_DIR.mkdir(parents=True, exist_ok=True)
    generate_datasets()

    device = get_device()
    print(f"Entrenando en dispositivo: {device}")

    metrics = {
        "intent_net": train_intent_net(device),
        "safety_net": train_safety_net(device),
        "affinity_net": train_affinity_net(device),
    }
    (REPORTS_DIR / "metrics.json").write_text(json.dumps(metrics, indent=2), encoding="utf-8")
    print("Metricas finales en Test:")
    print(json.dumps(metrics, indent=2))


if __name__ == "__main__":
    main()
