-- Edge status board: current wind conditions for five edge sites, checked
-- against each site's own wind threshold. Loaded by a src= block
-- (see note.mk.md), so the note keeps a one-line marker instead of this
-- whole script.
--
-- Deliberate redundancy, explained here and in the note's "Why a bundle"
-- section: the coordinates below are typed directly into the net.fetch_json
-- URL literal, in the same order as the entries in assets/sites.json. The
-- host scans a script's source for a literal URL to work out which
-- hostname to ask permission for (docs/scripting.md, "The language"); a
-- URL built from a variable or from table.concat gets no hostname offered
-- and is denied at run time. That scan requirement is exactly why the
-- coordinates cannot simply be read out of sites.json and assembled into
-- the URL: they have to sit in this literal, spelled out, for the
-- permission prompt to work. The human-readable half of the same five
-- sites (name, region, city, wind threshold) lives in sites.json instead,
-- matched back up by array position. The assert below is what keeps that
-- positional match honest if the two ever drift apart.

local util = require "scripts/util"

local sites_text = bundle.read("assets/sites.json")
local sites = json.decode(sites_text)

local board = cache.get("edge-status-etl", 900, function()
  -- Five locations, one request: Open-Meteo accepts comma-separated
  -- latitude/longitude lists and returns one result per location, in the
  -- same order they were given. Order here must match assets/sites.json:
  -- San Francisco, New York, London, Tokyo, Sydney.
  local results = net.fetch_json(
    "https://api.open-meteo.com/v1/forecast?latitude=37.7749,40.7128,51.5074,35.6762,-33.8688&longitude=-122.4194,-74.0060,-0.1278,139.6503,151.2093&current=temperature_2m,wind_speed_10m,wind_direction_10m,weather_code&timezone=auto"
  )
  if results.reason then
    error("Open-Meteo: " .. tostring(results.reason))
  end
  return results
end)

-- The fetched result is written into the bundle's cache, using the
-- write:.cache/ grant this manifest declares (docs/bundles.md,
-- docs/security.md): a host that later reads .cache/edge-status.json
-- directly sees the same raw Open-Meteo response this run fetched, without
-- calling the API again.
bundle.write(".cache/edge-status.json", json.encode(board))

-- The URL above names five locations; sites.json must list exactly five
-- entries in the same order, or every entry past a drift point would be
-- silently matched against the wrong site. Fail loudly instead.
if #board ~= #sites then
  error(
    "sites.json has " .. #sites .. " site(s) but the forecast URL returned "
      .. #board .. "; keep both lists in the same order and count"
  )
end

local rows = {}
local alert_count = 0
local windiest_name = nil
local windiest_speed = -1

for i = 1, #sites do
  local site = sites[i]
  local current = board[i].current
  local max_wind = site.max_wind_kmh
  local wind_kmh = current.wind_speed_10m
  local status = util.wind_status(wind_kmh, max_wind)

  if status == "alert" then
    alert_count = alert_count + 1
  end
  if wind_kmh > windiest_speed then
    windiest_speed = wind_kmh
    windiest_name = site.name
  end

  rows[#rows + 1] = {
    id = site.id,
    name = site.name,
    region = site.region,
    city = site.city,
    temperature_c = current.temperature_2m,
    wind_kmh = wind_kmh,
    direction = util.compass_direction(current.wind_direction_10m),
    max_wind_kmh = max_wind,
    status = status,
  }
end

return {
  sites = rows,
  stats = {
    checked = #rows,
    alerts = alert_count,
    windiest = windiest_name,
  },
  updated = board[1].current.time,
}
