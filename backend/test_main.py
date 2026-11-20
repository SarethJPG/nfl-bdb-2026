import pandas as pd
import pytest
from fastapi.testclient import TestClient

from backend import main
from backend.main import app, build_aggregates, pressure_rate


@pytest.fixture(scope="module")
def client():
    with TestClient(app) as c:
        yield c


def test_pressure_rate_formula():
    assert pressure_rate(1, 2, 10, 10) == pytest.approx((1.5 + 2 + 7) / 10)


def test_min_snaps_and_role_filter():
    rows = []
    for pid, role, n in [(1, "Pass Rush", 5), (2, "Pass Rush", 4), (3, "Coverage", 9)]:
        for k in range(n):
            rows.append(dict(gameId=1, playId=k, nflId=pid, pff_role=role,
                             pff_positionLinedUp="LE", pff_hit=None, pff_hurry=1, pff_sack=None))
    plays = pd.DataFrame(dict(gameId=1, playId=range(9), defensiveTeam="DAL", down=3,
                              yardsToGo=8, dropBackType="TRADITIONAL"))
    agg = build_aggregates(pd.DataFrame(rows), plays)
    df = agg[("3rd_long", "DAL")]
    assert list(df["nflId"]) == [1]  # 2 (<5 snaps) y 3 (no pass rush) excluidos
    assert df.iloc[0]["pressure_rate"] == pytest.approx(0.7)


def test_teams(client):
    r = client.get("/api/teams")
    assert r.status_code == 200
    assert "DAL" in r.json()["teams"]


@pytest.mark.parametrize("situation", ["all", "3rd_down", "3rd_long"])
def test_optimize_ok(client, situation):
    r = client.get("/api/optimize", params={"team": "DAL", "situation": situation})
    assert r.status_code == 200
    d = r.json()
    SLOTS = d["slots"]
    assert len(set(SLOTS)) == 4
    lineup = d["lineup"]
    assert [p["position"] for p in lineup] == list(SLOTS)
    assert len({p["nflId"] for p in lineup}) == 4
    assert all(p["snaps"] >= 0 and "explanation" in p for p in lineup)
    assert d["optimal_score"] >= d["habitual_score"]
    assert d["gain"] == pytest.approx(d["optimal_score"] - d["habitual_score"], abs=1e-3)
    assert sum(p["pressure_rate"] for p in lineup) == pytest.approx(d["optimal_score"], abs=1e-3)


def test_optimal_beats_every_permutation(client):
    r = client.get("/api/optimize", params={"team": "DAL", "situation": "all"})
    d = r.json()
    SLOTS = d["slots"]
    from itertools import permutations
    m = d["alternatives_matrix"]
    best = max(
        sum(m[i]["rates"][s]["pressure_rate"] for i, s in zip(p, SLOTS))
        for p in permutations(range(len(m)), 4)
    )
    assert d["optimal_score"] == pytest.approx(best, abs=1e-3)


@pytest.mark.parametrize(
    "params",
    [
        {"team": "<script>", "situation": "all"},
        {"team": "DAL'; DROP TABLE x;--", "situation": "all"},
        {"team": "dal", "situation": "all"},
        {"team": "ZZZ", "situation": "all"},
        {"team": "DAL", "situation": "5th_short"},
        {"team": "DAL", "situation": "<img src=x>"},
        {"team": "DAL"},
        {"situation": "all"},
        {"team": "DAL", "situation": "all", "extra": "1"},
    ],
)
def test_invalid_params_422(client, params):
    assert client.get("/api/optimize", params=params).status_code == 422
