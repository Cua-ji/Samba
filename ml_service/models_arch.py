"""Arquitecturas PyTorch para las 3 redes neuronales de Samba."""

import torch
import torch.nn as nn


class IntentMLP(nn.Module):
    """Red neuronal multitarea para clasificar intenciones de consulta en el chat RAG."""

    def __init__(self, input_dim: int, hidden_dim: int = 96):
        super().__init__()
        self.trunk = nn.Sequential(
            nn.Linear(input_dim, hidden_dim),
            nn.ReLU(),
            nn.Dropout(0.25),
            nn.Linear(hidden_dim, 48),
            nn.ReLU(),
            nn.Dropout(0.15),
        )
        # Cabeza 1: mealTime -> [none, desayuno, almuerzo, cena]
        self.meal_time_head = nn.Linear(48, 4)
        # Cabeza 2: budgetTier -> [none, bajo, medio, alto]
        self.budget_head = nn.Linear(48, 4)
        # Cabeza 3: flags binarias -> [mentionsWorkout, mentionsMeal, mentionsWhyDiscard, mentionsMacros]
        self.flags_head = nn.Linear(48, 4)

    def forward(self, x: torch.Tensor):
        h = self.trunk(x)
        return self.meal_time_head(h), self.budget_head(h), self.flags_head(h)


class SafetyMLP(nn.Module):
    """Red neuronal multietiqueta para detectar alergenos e impacto articular en texto."""

    def __init__(self, input_dim: int, num_labels: int = 10, hidden_dim: int = 128):
        super().__init__()
        self.net = nn.Sequential(
            nn.Linear(input_dim, hidden_dim),
            nn.ReLU(),
            nn.Dropout(0.3),
            nn.Linear(hidden_dim, 64),
            nn.ReLU(),
            nn.Dropout(0.2),
            nn.Linear(64, num_labels),
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        return self.net(x)


class AffinityMLP(nn.Module):
    """Red neuronal tabular para predecir probabilidad de afinidad usuario-platillo/rutina."""

    def __init__(self, input_dim: int, hidden_dim: int = 64):
        super().__init__()
        self.net = nn.Sequential(
            nn.Linear(input_dim, hidden_dim),
            nn.BatchNorm1d(hidden_dim),
            nn.ReLU(),
            nn.Dropout(0.2),
            nn.Linear(hidden_dim, 32),
            nn.ReLU(),
            nn.Linear(32, 1),
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        return self.net(x).squeeze(-1)
