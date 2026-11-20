"""API kalk NFL. Ejecuta: .venv/bin/uvicorn backend.main:app --reload

Datos en memoria (data/*.csv), PressureRate por jugador y hueco, y asignación
óptima exacta 4 jugadores -> 4 huecos con itertools.permutations.
"""
from __future__ import annotations

import re
from contextlib import asynccontextmanager
from itertools import permutations
from pathlib import Path
from typing import Annotated, Any, Literal

import numpy as np
import pandas as pd
from fastapi import FastAPI, HTTPException, Query
from pydantic import BaseModel, ConfigDict, Field, field_validator

DATA_DIR = Path(__file__).resolve().parent.parent / "data"

# Orden izquierda -> derecha para presentar los huecos; los 4 huecos de cada equipo
# son sus 4 posiciones de pass rush más frecuentes (p. ej. LE/DLT/DRT/RE en 4-3, LOLB/ROLB en 3-4).
SLOT_ORDER: tuple[str, ...] = (
    "LOLB", "LEO", "LE", "DLT", "NLT", "NT", "NRT", "DRT", "RE", "REO", "ROLB",
    "LILB", "LLB", "MLB", "RILB", "RLB",
)
N_SLOTS = 4
MIN_SNAPS = 5
TOP_N = 8
# Tasa base (baja) para un jugador sin muestra suficiente (>= MIN_SNAPS) en un hueco.
BASE_RATE = 0.02
SITUATIONS: tuple[str, ...] = ("all", "3rd_down", "3rd_long")
SITUATION_LABELS = {
    "all": "Todas las jugadas",
    "3rd_down": "3er down",
    "3rd_long": "3er down y largo (>= 7 yardas)",
}
TEAM_RE = re.compile(r"^[A-Z]{2,3}$")

# Estado en memoria, llenado al iniciar.
STATE: dict[str, Any] = {"agg": {}, "players": {}, "teams": [], "slots": {}}


# ----------------------------------------------------------------- datos
def pressure_rate(sacks, hits, hurries, snaps):
    """PressureRate = (1.5*Sacks + 1.0*Hits + 0.7*Hurries) / Snaps."""
    return (1.5 * sacks + 1.0 * hits + 0.7 * hurries) / snaps


def build_aggregates(
    scouting: pd.DataFrame, plays: pd.DataFrame
) -> dict[tuple[str, str], pd.DataFrame]:
    """Agrega por (situación, equipo) -> filas jugador/posición con snaps >= MIN_SNAPS."""
    # El CSV trae "Pass Rush"; se compara sin distinguir mayúsculas.
    rush = scouting[scouting["pff_role"].str.casefold() == "pass rush"].copy()
    for col in ("pff_sack", "pff_hit", "pff_hurry"):
        rush[col] = pd.to_numeric(rush[col], errors="coerce").fillna(0).astype(int)
    rush = rush.dropna(subset=["pff_positionLinedUp", "nflId"])

    # Jugadas de pase válidas: con dropback registrado y down real (excluye down 0).
    valid = plays[(plays["down"] >= 1) & plays["dropBackType"].notna()]
    valid = valid[["gameId", "playId", "defensiveTeam", "down", "yardsToGo"]]
    df = rush.merge(valid, on=["gameId", "playId"], how="inner")

    masks = {
        "all": pd.Series(True, index=df.index),
        "3rd_down": df["down"] == 3,
        "3rd_long": (df["down"] == 3) & (df["yardsToGo"] >= 7),
    }
    out: dict[tuple[str, str], pd.DataFrame] = {}
    for sit, mask in masks.items():
        g = (
            df[mask]
            .groupby(["defensiveTeam", "nflId", "pff_positionLinedUp"], as_index=False)
            .agg(
                sacks=("pff_sack", "sum"),
                hits=("pff_hit", "sum"),
                hurries=("pff_hurry", "sum"),
                snaps=("pff_sack", "size"),
            )
        )
        g = g[g["snaps"] >= MIN_SNAPS].copy()
        g["pressure_rate"] = pressure_rate(g["sacks"], g["hits"], g["hurries"], g["snaps"])
        for team, sub in g.groupby("defensiveTeam"):
            out[(sit, team)] = sub.drop(columns="defensiveTeam").reset_index(drop=True)
    return out


def load_data(data_dir: Path = DATA_DIR) -> None:
    scouting = pd.read_csv(
        data_dir / "pffScoutingData.csv",
        usecols=["gameId", "playId", "nflId", "pff_role", "pff_positionLinedUp",
                 "pff_hit", "pff_hurry", "pff_sack"],
    )
    plays = pd.read_csv(
        data_dir / "plays.csv",
        usecols=["gameId", "playId", "defensiveTeam", "down", "yardsToGo", "dropBackType"],
    )
    players = pd.read_csv(
        data_dir / "players.csv",
        usecols=["nflId", "displayName", "officialPosition", "height", "weight"],
    )
    agg = build_aggregates(scouting, plays)
    pl = players.set_index("nflId")
    STATE["agg"] = agg
    STATE["players"] = {
        int(i): {
            "displayName": None if pd.isna(r.displayName) else str(r.displayName),
            "officialPosition": None if pd.isna(r.officialPosition) else str(r.officialPosition),
            "height": None if pd.isna(r.height) else str(r.height),
            "weight": None if pd.isna(r.weight) else int(r.weight),
        }
        for i, r in pl.iterrows()
    }
    STATE["teams"] = sorted({team for (_, team) in agg})
    STATE["slots"] = {}
    for team in STATE["teams"]:
        full = agg.get(("all", team))
        if full is None:
            continue
        freq = full[full["pff_positionLinedUp"].isin(SLOT_ORDER)].groupby(
            "pff_positionLinedUp")["snaps"].sum().sort_values(ascending=False, kind="stable")
        top = list(freq.index[:N_SLOTS])
        if len(top) == N_SLOTS:
            STATE["slots"][team] = tuple(sorted(top, key=SLOT_ORDER.index))


# ----------------------------------------------------------- optimización
def optimize_front(
    team_df: pd.DataFrame, all_df: pd.DataFrame, SLOTS: tuple[str, ...]
) -> dict[str, Any] | None:
    """Asigna 4 jugadores distintos a SLOTS maximizando la suma de PressureRate.

    Exacto sobre el Top 8 de pass rushers del equipo (8P4 = 1680 permutaciones).
    Si el filtro deja menos de 4 jugadores con muestra, se completa con los
    jugadores del frente en "all"; sin muestra en el filtro reciben BASE_RATE.
    """
    in_slots = team_df[team_df["pff_positionLinedUp"].isin(SLOTS)]
    all_slots = all_df[all_df["pff_positionLinedUp"].isin(SLOTS)]
    vol = in_slots.groupby("nflId")["snaps"].sum()
    vol_all = all_slots.groupby("nflId")["snaps"].sum()
    rank = pd.DataFrame({"sit": vol, "all": vol_all}).fillna(0)
    rank = rank.sort_values(["sit", "all"], ascending=False, kind="stable")
    if len(rank) < len(SLOTS):
        return None
    ids = [int(i) for i in rank.index[:TOP_N]]

    lookup = {
        (int(r.nflId), r.pff_positionLinedUp): r for r in in_slots.itertuples(index=False)
    }
    n, k = len(ids), len(SLOTS)
    P = np.full((n, k), BASE_RATE)
    S = np.zeros((n, k), dtype=int)
    for i, pid in enumerate(ids):
        for j, slot in enumerate(SLOTS):
            r = lookup.get((pid, slot))
            if r is not None:
                P[i, j] = r.pressure_rate
                S[i, j] = r.snaps

    # Mejor suma; el desempate es determinista (primera permutación en orden).
    best_perm, best_score = None, -1.0
    for perm in permutations(range(n), k):
        score = float(P[list(perm), np.arange(k)].sum())
        if score > best_score + 1e-12:
            best_perm, best_score = perm, score

    # Alineación habitual: cada hueco lo ocupa quien más snaps tiene en él (voraz, sin repetir).
    base = [None] * k
    used: set[int] = set()
    pairs = sorted(
        ((S[i, j], -i, -j) for i in range(n) for j in range(k) if S[i, j] > 0), reverse=True
    )
    for _, ni, nj in pairs:
        i, j = -ni, -nj
        if base[j] is None and i not in used:
            base[j] = i
            used.add(i)
    for j in range(k):  # huecos sin dueño: el siguiente jugador libre del Top 8
        if base[j] is None:
            i = next(x for x in range(n) if x not in used)
            base[j] = i
            used.add(i)
    base_score = float(sum(P[base[j], j] for j in range(k)))

    return {"ids": ids, "P": P, "S": S, "best": list(best_perm), "best_score": best_score,
            "base": base, "base_score": base_score}


def _pct(x: float) -> str:
    return f"{x * 100:.1f}%"


def build_response(team: str, situation: str, team_df: pd.DataFrame) -> dict[str, Any] | None:
    SLOTS = STATE["slots"].get(team)
    all_df = STATE["agg"].get(("all", team))
    if SLOTS is None or all_df is None:
        return None
    res = optimize_front(team_df, all_df, SLOTS)
    if res is None:
        return None
    ids, P, S = res["ids"], res["P"], res["S"]
    best, base = res["best"], res["base"]
    names = {pid: (STATE["players"].get(pid, {}).get("displayName") or str(pid)) for pid in ids}
    label = SITUATION_LABELS[situation]
    stats = {
        (int(r.nflId), r.pff_positionLinedUp): r for r in team_df.itertuples(index=False)
    }

    lineup = []
    for j, slot in enumerate(SLOTS):
        i = best[j]
        pid = ids[i]
        r = stats.get((pid, slot))
        estimated = r is None
        by_pos = [
            {
                "position": pos,
                "pressure_rate": round(float(rr.pressure_rate), 4),
                "snaps": int(rr.snaps),
            }
            for (p2, pos), rr in stats.items()
            if p2 == pid
        ]
        by_pos.sort(key=lambda d: -d["pressure_rate"])
        own_base = next((jj for jj in range(len(SLOTS)) if base[jj] == i), None)
        displaced_i = base[j]

        parts = []
        if estimated:
            parts.append(
                f"Sin muestra suficiente (<{MIN_SNAPS} snaps) en {slot}; se usa tasa base {_pct(BASE_RATE)}."
            )
        else:
            parts.append(
                f"{names[pid]} genera {_pct(float(r.pressure_rate))} de presión en {slot} "
                f"({int(r.snaps)} snaps) en {label}."
            )
        if own_base is not None and own_base != j and S[i, own_base] > 0:
            parts.append(
                f"Su hueco habitual es {SLOTS[own_base]} ({_pct(P[i, own_base])}, "
                f"{int(S[i, own_base])} snaps)."
            )
        if displaced_i != i and S[displaced_i, j] > 0:
            parts.append(
                f"{names[ids[displaced_i]]}, habitual en {slot}, rinde {_pct(P[displaced_i, j])} "
                f"({int(S[displaced_i, j])} snaps) ahí."
            )
        lineup.append(
            {
                "position": slot,
                "nflId": pid,
                **STATE["players"].get(pid, {}),
                "pressure_rate": round(float(P[i, j]), 4),
                "sacks": 0 if estimated else int(r.sacks),
                "hits": 0 if estimated else int(r.hits),
                "hurries": 0 if estimated else int(r.hurries),
                "snaps": int(S[i, j]),
                "estimated": estimated,
                "by_position": by_pos,
                "habitual_position": SLOTS[own_base] if own_base is not None else None,
                "explanation": " ".join(parts),
            }
        )

    habitual = [
        {"position": slot, "nflId": ids[base[j]], "displayName": names[ids[base[j]]],
         "pressure_rate": round(float(P[base[j], j]), 4), "snaps": int(S[base[j], j])}
        for j, slot in enumerate(SLOTS)
    ]
    gain = res["best_score"] - res["base_score"]
    matrix = [
        {
            "nflId": pid,
            "displayName": names[pid],
            "rates": {
                slot: {"pressure_rate": round(float(P[i, j]), 4), "snaps": int(S[i, j]),
                       "estimated": bool(S[i, j] == 0)}
                for j, slot in enumerate(SLOTS)
            },
        }
        for i, pid in enumerate(ids)
    ]
    return {
        "team": team,
        "situation": situation,
        "slots": list(SLOTS),
        "min_snaps": MIN_SNAPS,
        "base_rate": BASE_RATE,
        "lineup": lineup,
        "optimal_score": round(res["best_score"], 4),
        "habitual_score": round(res["base_score"], 4),
        "gain": round(gain, 4),
        "gain_pp": round(gain * 100, 2),
        "habitual_lineup": habitual,
        "alternatives_matrix": matrix,
    }


# ------------------------------------------------------------ validación
class OptimizeQuery(BaseModel):
    """Parámetros de /api/optimize: lista blanca estricta, sin parámetros extra."""

    model_config = ConfigDict(extra="forbid", strict=True)

    team: str = Field(min_length=2, max_length=3)
    situation: Literal["all", "3rd_down", "3rd_long"]

    @field_validator("team")
    @classmethod
    def team_whitelist(cls, v: str) -> str:
        if not TEAM_RE.fullmatch(v):
            raise ValueError("team debe ser 2-3 letras mayúsculas (A-Z)")
        if v not in STATE["teams"]:
            raise ValueError("equipo no disponible")
        return v


# ------------------------------------------------------------------- app
@asynccontextmanager
async def lifespan(_: FastAPI):
    load_data()
    yield


app = FastAPI(title="Hackathon NFL UNAM", lifespan=lifespan)


@app.get("/health")
def health() -> dict:
    return {"status": "ok"}


@app.get("/api/teams")
def teams() -> dict:
    return {"teams": STATE["teams"], "situations": [
        {"value": s, "label": SITUATION_LABELS[s]} for s in SITUATIONS]}


@app.get("/api/optimize")
def optimize(q: Annotated[OptimizeQuery, Query()]) -> dict:
    team_df = STATE["agg"].get((q.situation, q.team))
    if team_df is None:  # sin ninguna fila elegible en el filtro
        team_df = STATE["agg"][("all", q.team)].iloc[0:0]
    result = build_response(q.team, q.situation, team_df)
    if result is None:
        raise HTTPException(
            status_code=404,
            detail="Snaps insuficientes para formar un frente de 4 jugadores con este filtro.",
        )
    return result
