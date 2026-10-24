"""python -m sky_photo → export JSON schema."""

from sky_photo.main import export_json_schema

if __name__ == "__main__":
    path = export_json_schema()
    print(f"Wrote schema → {path}")
