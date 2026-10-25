# Night sky catalog

This project identifies objects in a night-sky photo from a database you own. Stars come from Hipparcos. Planets and the Moon are computed from the JPL DE421 kernel. Satellites are propagated from CelesTrak general-perturbation elements. A local plate solver turns a photo into sky coordinates, and the catalog is projected back onto the pixels.

Bright Data is not the catalog. It is a Web Unlocker client for a public page that has no file download. The Cursor MCP config lets the coding agent call that same account. The token stays in your environment, not in the repo.

## Run it

Postgres 16 needs to be running. Either:

```bash
docker compose up -d
```

or, on a machine that already has PostgreSQL:

```bash
bash scripts/bootstrap_postgres.sh
```

Then:

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -e ".[dev]"
cp .env.example .env
python -m nightsky all
```

Put `BRIGHTDATA_API_TOKEN` in `.env`. The CLI loads that file and does not override variables already set in the shell. `.env` is gitignored.

`python -m nightsky all` creates the tables, loads Hipparcos stars of magnitude 8 and brighter, loads the CelesTrak `stations` and `visual` groups, downloads `de421.bsp`, plate-solves a synthetic photo of Orion, and writes `output/orion_labeled.png`.

The Orion check prints Mintaka, Alnilam, and Alnitak. Their solved pixels should sit on the stars. The solved field center should be within a few arcminutes of right ascension 84° and declination −1.2°.

Useful pieces:

```bash
python -m nightsky load-stars
python -m nightsky load-satellites
python -m nightsky solve-demo
pytest
```

Satellite elements refresh when the cached CSV is older than three days. A reload never replaces a row with an older epoch. Star rows are loaded once; load them again only if you change the magnitude limit. The planet kernel stays on disk under `data/skyfield/`.

## See it

```bash
python -m nightsky serve
```

Open [http://127.0.0.1:8741](http://127.0.0.1:8741). The sky map draws Hipparcos, the bright planets, the Moon, and visible satellites from your latitude, longitude, and the time. Polaris is true north, and its height above the horizon is your latitude. Drag the heading and lens height to look around. On a phone, Turn with the phone follows the compass and tilt, and Show the sky behind the names puts the rear camera under the labels. A laptop has no compass, so the sliders are the control there.

The Orion demo is the labeled field already solved from the catalog. Time is taken to the minute. Latitude and longitude are decimal degrees, north and east positive. The browser can fill the device location. A star with no common name is marked with its Hipparcos number.

The solver matches the pattern of stars in the photo to Hipparcos. A field with no very bright triangle is tried again against stars down to magnitude 5, and a name is kept only when the guesses agree on one sky. A daylight photo, or a pattern that fits several skies equally well, stays unsolved and nothing is invented.

## What is stored

`landing` keeps each raw fetch (Hipparcos checksum, CelesTrak CSV rows, Unlocker HTML). `stars` and `satellites` are the queryable catalog. Planets are not rows. `captures`, `plate_solutions`, and `identifications` are the photo, the solved WCS, and the labels.

A field that crosses 0h/24h right ascension is queried as two right-ascension ranges.

## Bright Data

Do this in the Bright Data control panel before a live call:

1. Create an account at [brightdata.com](https://brightdata.com). The free trial is 5,000 credits per month. Unused credits do not roll over.
2. Copy the API token from [brightdata.com/cp/setting/users](https://brightdata.com/cp/setting/users) into a password manager. Export it as `BRIGHTDATA_API_TOKEN`. Do not commit it and do not paste it into chat.
3. The allowance is 5,000 free-trial credits per UTC month (`BRIGHTDATA_FREE_MONTHLY_CREDITS`) plus prepaid balance (`BRIGHTDATA_PREPAID_USD`). At $1.50 per 1,000 Unlocker requests, $300 is 200,000 credits. A month can spend the 5,000 renewing credits and whatever prepaid credits are still left. The prepaid balance does not renew. Set `BRIGHTDATA_SPEND_CAP_SET=1` once you accept that ceiling. Browser traffic is separate: Bright Data charges the browser zone 5 credits per megabyte, and that usage is metered on their side.
4. Create one Web Unlocker zone named `mcp_unlocker` (Web Access, Create API, Web Unlocker). The name is permanent.

Prove the live request:

```bash
export BRIGHTDATA_API_TOKEN=...
export BRIGHTDATA_SPEND_CAP_SET=1
python -m nightsky prove-unlocker --url https://example.com
```

The response is stored in `landing` with source `brightdata:mcp_unlocker`. It is not written into `stars` or `satellites`. With no token, the same command proves the client against a local stand-in so you can see the request shape: `POST https://api.brightdata.com/request` with `Authorization: Bearer <token>` and `{"zone":"mcp_unlocker","url":"...","format":"raw"}`.

The phone or browser client should never see the token. A server job calls the Unlocker, then a parser you trust copies checked fields into the catalog.

## Cursor

`python -m nightsky prove-mcp` writes the Bright Data server into `.cursor/mcp.json` and `~/.cursor/mcp.json` without putting the token in either file:

```json
{
  "mcpServers": {
    "brightdata": {
      "command": "npx",
      "args": ["-y", "@brightdata/mcp"],
      "env": {
        "API_TOKEN": "${env:BRIGHTDATA_API_TOKEN}",
        "GROUPS": "advanced_scraping",
        "WEB_UNLOCKER_ZONE": "mcp_unlocker"
      }
    }
  }
}
```

Reload MCP in Cursor (Settings, Tools and Integrations, MCP). `GROUPS=advanced_scraping` exposes `search_engine`, `scrape_as_markdown`, `scrape_as_html`, `extract`, and `session_stats`.

`python -m nightsky prove-mcp` starts that server and calls `session_stats`. The tool only reports calls inside that process, so it also runs when `BRIGHTDATA_API_TOKEN` is unset. Search and scrape still need the real token. The MCP client does not identify photos. The app calls the Unlocker over HTTP.

Use `scrape_as_markdown` for a public page that has no official file. Check a few parsed rows by hand before inserting them into the catalog.
