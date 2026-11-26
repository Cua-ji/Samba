"""Utilidades compartidas de entrenamiento, graficado de curvas y metricas."""

from pathlib import Path
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import torch


def save_training_plot(history: dict, title: str, out_path: Path) -> None:
    """Guarda grafica de Loss (train vs val) y metrica principal."""
    out_path.parent.mkdir(parents=True, exist_ok=True)
    epochs = range(1, len(history["train_loss"]) + 1)

    fig, axes = plt.subplots(1, 2, figsize=(10, 4))
    axes[0].plot(epochs, history["train_loss"], label="Train Loss")
    axes[0].plot(epochs, history["val_loss"], label="Val Loss")
    axes[0].set_title(f"{title} - Loss")
    axes[0].set_xlabel("Epoca")
    axes[0].set_ylabel("Loss")
    axes[0].legend()
    axes[0].grid(True, alpha=0.3)

    metric_name = history.get("metric_name", "Score")
    axes[1].plot(epochs, history["train_metric"], label=f"Train {metric_name}")
    axes[1].plot(epochs, history["val_metric"], label=f"Val {metric_name}")
    axes[1].set_title(f"{title} - {metric_name}")
    axes[1].set_xlabel("Epoca")
    axes[1].set_ylabel(metric_name)
    axes[1].legend()
    axes[1].grid(True, alpha=0.3)

    plt.tight_layout()
    plt.savefig(out_path, dpi=140)
    plt.close(fig)


def get_device() -> torch.device:
    return torch.device("cuda" if torch.cuda.is_available() else "cpu")
