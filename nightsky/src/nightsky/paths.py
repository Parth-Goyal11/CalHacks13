"""Locations for catalogs, SQL, and generated photos."""

from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / "data"
SKYFIELD = DATA / "skyfield"
CELESTRAK = DATA / "celestrak"
OUTPUT = ROOT / "output"
SCHEMA = ROOT / "sql" / "schema.sql"
STAR_NAMES = DATA / "star_names.csv"

SKYFIELD.mkdir(parents=True, exist_ok=True)
CELESTRAK.mkdir(parents=True, exist_ok=True)
OUTPUT.mkdir(parents=True, exist_ok=True)
