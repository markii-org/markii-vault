---
title: Edge Site Status Board
description: A bundle-backed monitoring note for five edge sites, fed by Open-Meteo and checked against each site's own wind threshold.
---

# Edge Site Status Board

::::figure{src="assets/diagram.png" alt="Diagram of five edge sites feeding one status board"}

:::center
Five sites, one request, one board.
:::

::::

An operator watching a handful of edge sites does not want five separate
notes. This one keeps the site list, the fetch script, the shared helper
code, and the diagram all together, so opening the note anywhere opens the
whole thing. That is why this example is a bundle rather than a plain
`.mk.md` file: a single file has nowhere to put a data file, a long script,
and an image without turning the note itself into an unreadable wall of
Lua.

Values below appear after you press Run. Rendering never executes a
script, so a freshly opened bundle shows its last known figures, or nothing
at all the first time, until a run fetches real data.

## Current conditions

:::callout{type=info title="Checked just now"}
:value[board.stats.checked] sites checked, with :value[board.stats.alerts] on
alert. The windiest site right now is :badge[:value[board.stats.windiest]].
:::

::table{data=board.sites columns="name,region,wind_kmh,direction,status" caption="Wind by site"}

:::::row{cols=3}

::::card{title="Sites checked"}
:::center
::stat{data=board.stats.checked format=number label="sites"}
:::
::::

::::card{title="On alert"}
:::center
::stat{data=board.stats.alerts format=number label="sites over threshold"}
:::
::::

::::card{title="Windiest site"}
:::center
::stat{data=board.stats.windiest label="right now"}
:::
::::

:::::

## Tomorrow's outlook

The board above is the ETL script's job: fetch, shape, and score five sites
at once. The chart below is a second, smaller script that lives inline in
this note instead of in the bundle, to show the other end of that scale:
a short block is fine to keep right here.

::chart{data=outlook.max_wind kind=bar}

:::details{title="Why a bundle"}

- **Portability.** `manifest.json`, `note.mk.md`, `assets/sites.csv`,
  `assets/diagram.png`, and `scripts/etl.lua` and `scripts/util.lua` travel
  together. Copy the folder, or zip it into `edge-status.mkz`, and nothing
  is left behind.
- **The coordinates are in the URL on purpose.** `scripts/etl.lua` fetches
  all five sites in one Open-Meteo request by writing the latitude and
  longitude list directly into the request URL, as one complete string
  literal. The host reads a script's source for literal URLs before it
  ever runs the script, to work out which hostname to ask permission for;
  a URL built from a variable or joined with `..` offers no hostname to
  grant and is denied at run time. That is why the coordinates are typed
  out in the script itself instead of read out of `assets/sites.csv`, even
  though the same five sites, in the same order, also live in that file as
  plain, human-readable metadata (name, region, wind threshold). It is a
  deliberate redundancy, not an oversight, and `etl.lua` checks that the
  two lists still agree on count before it trusts either one.
- **No committed cache.** There is no `.cache/` folder in this bundle.
  Nothing is stored until a host actually runs the note; the table and
  stats above are blank on a first open until you press Run.

:::

---

```lua {src=scripts/etl.lua name=board}
```

```lua {name=outlook}
-- Tomorrow's peak wind for the same five sites, one API call, cached
-- longer than the board above since a next-day forecast does not need to
-- be as fresh as current conditions.
return cache.get("edge-status-outlook", 21600, function()
  local results = net.fetch_json(
    "https://api.open-meteo.com/v1/forecast?latitude=37.7749,40.7128,51.5074,35.6762,-33.8688&longitude=-122.4194,-74.0060,-0.1278,139.6503,151.2093&daily=wind_speed_10m_max&forecast_days=2&timezone=auto"
  )
  if results.reason then
    error("Open-Meteo: " .. tostring(results.reason))
  end

  local tomorrow = {}
  for i = 1, #results do
    local daily = results[i].daily
    -- index 2 is tomorrow: index 1 is today, already shown on the board.
    tomorrow[i] = daily.wind_speed_10m_max[2]
  end
  return { max_wind = tomorrow }
end)
```
