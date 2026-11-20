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
SITUATIONS: tuple[str, ...] = ("all", "3rd_down", "3rd_long")
SITUATION_LABELS = {
    "all": "Todas las jugadas",
    "3rd_down": "3er down",
    "3rd_long": "3er down y largo (>= 7 yardas)",
}
TEAM_RE = re.compile(r"^[A-Z]{2,3}$")

# Estado en memoria, llenado al iniciar.
STATE: dict[str, Any] = {"agg": {}, "players": {}, "teams": []}


# ----------------------------------------------------------------- datos
def pressure_rate(sacks, hits, hurries, snaps):
    """PressureRate = (1.5*Sacks + 1.0*Hits + 0.7*Hurries) / Snaps."""
    return (1.5 * sacks + 1.0 * hits + 0.7 * hurries) / snaps


def build_aggregates(
    scouting: pd.DataFrame, plays: pd.DataFrame
) -> dict[tuple[str, str], pd.DataFrame]:
    """Agrega por (situación, equipo) -> filas jugador/posición con bandera eligible (snaps >= MIN_SNAPS)."""
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
        g["eligible"] = g["snaps"] >= MIN_SNAPS
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


# ----------------------------------------------------------- optimización
def select_slots(sit_df: pd.DataFrame) -> tuple[tuple[str, ...], list[str]] | None:
    """4 huecos con candidatos elegibles (snaps >= MIN_SNAPS) en la situación.

    Si hay menos de 4, se completa solo con huecos con snaps reales (> 0).
    Devuelve (huecos ordenados izquierda->derecha, avisos) o None.
    """
    front = sit_df[sit_df["pff_positionLinedUp"].isin(SLOT_ORDER)]
    elig = (front[front["eligible"]].groupby("pff_positionLinedUp")["snaps"].sum()
            .sort_values(ascending=False, kind="stable"))
    chosen = list(elig.index[:N_SLOTS])
    notes: list[str] = []
    if len(chosen) < N_SLOTS:
        rest = (front[~front["pff_positionLinedUp"].isin(chosen)]
                .groupby("pff_positionLinedUp")["snaps"].sum()
                .sort_values(ascending=False, kind="stable"))
        added = list(rest.index[: N_SLOTS - len(chosen)])
        chosen += added
        if added:
            notes.append(
                f"Solo {len(elig)} hueco(s) con >= {MIN_SNAPS} snaps en este filtro; "
                f"se completó con {', '.join(added)} (snaps reales, muestra menor)."
            )
    if len(chosen) < N_SLOTS:
        return None
    return tuple(sorted(chosen, key=SLOT_ORDER.index)), notes


def _search(P: np.ndarray, V: np.ndarray, E: np.ndarray) -> tuple[list[int], float] | None:
    """Mejor permutación (n jugadores -> k huecos) usando solo celdas con snaps > 0.

    P es el puntaje de cada celda. A igualdad de puntaje se prefieren celdas elegibles (E).
    """
    n, k = P.shape
    cols = np.arange(k)
    best, best_score, best_key = None, -1.0, -1.0
    for perm in permutations(range(n), k):
        rows = list(perm)
        if not V[rows, cols].all():
            continue
        score = float(P[rows, cols].sum())
        key = score + 1e-6 * float(E[rows, cols].sum())
        if key > best_key + 1e-12:
            best, best_score, best_key = rows, score, key
    return None if best is None else (best, best_score)


def _average_rate(sit_rows: pd.DataFrame, all_rows: pd.DataFrame) -> dict[str, Any]:
    """PressureRate promedio del jugador (todas sus posiciones) en la situación; si no hay, en la temporada."""
    for src, rows in (("situation_average", sit_rows), ("season_average", all_rows)):
        # Con < MIN_SNAPS en la situación el promedio es ruido: se usa el de la temporada.
        need = MIN_SNAPS if src == "situation_average" else 1
        if not rows.empty and rows["snaps"].sum() >= need:
            w = rows["sacks"].sum() * 1.5 + rows["hits"].sum() + rows["hurries"].sum() * 0.7
            return {"position": None, "pressure_rate": float(w / rows["snaps"].sum()),
                    "snaps": int(rows["snaps"].sum()), "source": src}
    return {"position": None, "pressure_rate": 0.0, "snaps": 0, "source": "none"}


def habitual_lineup(front_ids, sit_df, all_df, slots) -> dict[int, dict[str, Any]]:
    """Cada jugador en su posición con más snaps elegibles, sin repetir hueco.

    Los conflictos los gana quien tiene más snaps en el hueco; el perdedor pasa a su
    siguiente hueco elegible libre. Sin hueco elegible, usa su PressureRate promedio.
    """
    cand = sit_df[sit_df["nflId"].isin(front_ids) & sit_df["eligible"]
                  & sit_df["pff_positionLinedUp"].isin(slots)]
    pairs = sorted(cand.itertuples(index=False),
                   key=lambda r: (-r.snaps, -r.pressure_rate, int(r.nflId), r.pff_positionLinedUp))
    out: dict[int, dict[str, Any]] = {}
    used_slots: set[str] = set()
    for r in pairs:
        pid = int(r.nflId)
        if pid in out or r.pff_positionLinedUp in used_slots:
            continue
        top = cand[cand["nflId"] == pid]["snaps"].max()
        out[pid] = {"position": r.pff_positionLinedUp, "pressure_rate": float(r.pressure_rate),
                    "snaps": int(r.snaps), "source": "modal" if r.snaps == top else "next_best"}
        used_slots.add(r.pff_positionLinedUp)
    for pid in front_ids:
        if pid not in out:
            out[pid] = _average_rate(sit_df[sit_df["nflId"] == pid], all_df[all_df["nflId"] == pid])
    return out


def _pct(x: float) -> str:
    return f"{x * 100:.1f}%"


def build_response(team: str, situation: str) -> dict[str, Any] | None:
    sit_df = STATE["agg"].get((situation, team))
    all_df = STATE["agg"].get(("all", team))
    if sit_df is None or all_df is None:
        return None
    sel = select_slots(sit_df)
    if sel is None:
        return None
    slots, notes = sel
    k = len(slots)

    in_slots = sit_df[sit_df["pff_positionLinedUp"].isin(slots)]
    rank = pd.DataFrame({
        "elig": in_slots[in_slots["eligible"]].groupby("nflId")["snaps"].sum(),
        "tot": in_slots.groupby("nflId")["snaps"].sum(),
    }).fillna(0).sort_values(["elig", "tot"], ascending=False, kind="stable")
    all_ids = [int(i) for i in rank.index[:12]]
    stats = {(int(r.nflId), r.pff_positionLinedUp): r for r in sit_df.itertuples(index=False)}

    # Celdas con snaps > 0. Elegible (>= MIN_SNAPS): puntaje = su tasa observada.
    # No elegible: puntaje = tasa promedio del jugador en la situación (no se confía en la muestra).
    avg = {pid: _average_rate(sit_df[sit_df["nflId"] == pid],
                              all_df[all_df["nflId"] == pid])["pressure_rate"] for pid in all_ids}
    found = None
    for limit in (TOP_N, 12):
        ids = all_ids[:limit]
        if len(ids) < k:
            continue
        P = np.zeros((len(ids), k))
        S = np.zeros((len(ids), k), dtype=int)
        V = np.zeros((len(ids), k), dtype=bool)
        E = np.zeros((len(ids), k), dtype=bool)
        for i, pid in enumerate(ids):
            for j, slot in enumerate(slots):
                r = stats.get((pid, slot))
                if r is not None:
                    V[i, j], E[i, j], S[i, j] = True, bool(r.eligible), r.snaps
                    P[i, j] = r.pressure_rate if r.eligible else avg[pid]
        hit = _search(P, V, E)
        if hit:
            found = (ids, P, S, E, hit)
            break
    if found is None:
        return None
    ids, P, S, E, (best, best_score) = found
    if any(not E[best[j], j] for j in range(k)):
        notes.append(
            f"No hay 4 jugadores distintos con >= {MIN_SNAPS} snaps en estos huecos; se completó con "
            "jugadores con snaps reales pero muestra menor (no elegibles). Su aporte al puntaje es su "
            "tasa promedio en la situación."
        )

    names = {pid: (STATE["players"].get(pid, {}).get("displayName") or str(pid)) for pid in ids}
    label = SITUATION_LABELS[situation]
    front_ids = [ids[best[j]] for j in range(k)]

    # Baseline: cada jugador del frente en su posición habitual.
    habitual, base_score = [], 0.0
    hab = habitual_lineup(front_ids, sit_df, all_df, slots)
    for pid in front_ids:
        h = hab[pid]
        base_score += h["pressure_rate"]
        habitual.append({"nflId": pid, "displayName": names[pid], "position": h["position"],
                         "pressure_rate": round(h["pressure_rate"], 4), "snaps": h["snaps"],
                         "source": h["source"]})
    hab_by_id = {h["nflId"]: h for h in habitual}

    lineup = []
    for j, slot in enumerate(slots):
        pid = front_ids[j]
        r = stats[(pid, slot)]
        eligible = bool(r.eligible)
        pl_all = all_df[all_df["nflId"] == pid].sort_values(
            ["snaps", "pressure_rate"], ascending=False, kind="stable")
        by_pos = []
        for rr in pl_all.itertuples(index=False):
            sr = stats.get((pid, rr.pff_positionLinedUp))
            by_pos.append({
                "position": rr.pff_positionLinedUp,
                "pressure_rate": round(float(rr.pressure_rate), 4),
                "snaps": int(rr.snaps),
                "eligible": bool(rr.eligible),
                "is_assigned": rr.pff_positionLinedUp == slot,
                "situation_pressure_rate": None if sr is None else round(float(sr.pressure_rate), 4),
                "situation_snaps": 0 if sr is None else int(sr.snaps),
            })
        h = hab_by_id[pid]
        text = (f"{names[pid]} genera {_pct(float(r.pressure_rate))} de presión en {slot} "
                f"({int(r.snaps)} snaps) en {label}.")
        if not eligible:
            text += (f" Muestra menor a {MIN_SNAPS} snaps: en el puntaje cuenta su tasa promedio "
                     f"({_pct(float(P[best[j], j]))}).")
        if h["position"] and h["position"] != slot:
            text += f" Su hueco habitual es {h['position']} ({_pct(h['pressure_rate'])}, {h['snaps']} snaps)."
        elif h["source"] != "modal":
            text += (f" Sin snaps elegibles en un hueco del frente; su tasa promedio es "
                     f"{_pct(h['pressure_rate'])} ({h['snaps']} snaps).")
        lineup.append({
            "position": slot,
            "nflId": pid,
            **STATE["players"].get(pid, {}),
            "pressure_rate": round(float(r.pressure_rate), 4),
            "sacks": int(r.sacks), "hits": int(r.hits), "hurries": int(r.hurries),
            "snaps": int(r.snaps),
            "eligible": eligible,
            "score_rate": round(float(P[best[j], j]), 4),
            "rate_source": "observed" if eligible else "player_average",
            "habitual_position": h["position"],
            "by_position": by_pos,
            "explanation": text,
        })

    gain = best_score - base_score
    if gain < -1e-9:
        notes.append(
            "La alineación habitual incluye jugadores sin hueco con snaps reales, valorados con su "
            "tasa promedio; esa estimación supera a la mejor asignación con snaps observados, por lo "
            "que la ganancia es negativa."
        )
    matrix = [
        {
            "nflId": pid, "displayName": names[pid],
            "rates": {
                slot: (None if (pid, slot) not in stats else {
                    "pressure_rate": round(float(stats[(pid, slot)].pressure_rate), 4),
                    "snaps": int(stats[(pid, slot)].snaps),
                    "eligible": bool(stats[(pid, slot)].eligible),
                    "score_rate": round(float(P[i, j]), 4)})
                for j, slot in enumerate(slots)
            },
        }
        for i, pid in enumerate(ids)
    ]
    return {
        "team": team, "situation": situation, "slots": list(slots), "min_snaps": MIN_SNAPS,
        "notices": notes, "completed": any(n.startswith(("Solo", "No hay 4")) for n in notes),
        "lineup": lineup,
        "optimal_score": round(best_score, 4),
        "habitual_score": round(base_score, 4),
        "gain": round(gain, 4), "gain_pp": round(gain * 100, 2),
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
    result = build_response(q.team, q.situation)
    if result is None:
        raise HTTPException(
            status_code=404,
            detail="Snaps insuficientes para formar un frente de 4 jugadores con este filtro.",
        )
    return result
