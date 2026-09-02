-- Shared helpers for the edge status board (scripts/etl.lua requires this
-- as "scripts/util", the bundle-local module path docs/scripting.md
-- describes). Kept as a real module: parsing, direction, and status
-- classification all live here so etl.lua stays a thin fetch-and-shape
-- script.

local M = {}

-- A tiny CSV reader for exactly one shape: a header row plus data rows,
-- no quoted fields, no embedded commas or newlines inside a value. That is
-- all assets/sites.csv ever needs, so this is not a general CSV parser and
-- should not be reused as one. It exists because scripts have no JSON
-- decoder available for bundle.read()'d text (net.fetch_json parses JSON
-- for you, but a file read back from the bundle is plain text): a
-- line-oriented format that plain string.gmatch can walk was the simpler,
-- more honest choice here than hand-rolling a JSON parser for one small
-- file. See the note's own "Why a bundle" section for the fuller reasoning.
function M.parse_csv(text)
  local lines = {}
  for line in text:gmatch("[^\r\n]+") do
    lines[#lines + 1] = line
  end

  local header = {}
  for field in lines[1]:gmatch("[^,]+") do
    header[#header + 1] = field
  end

  local rows = {}
  for i = 2, #lines do
    local row = {}
    local col = 1
    for field in lines[i]:gmatch("[^,]+") do
      row[header[col]] = field
      col = col + 1
    end
    rows[#rows + 1] = row
  end

  return rows
end

-- 16-point compass from a degree heading (0-360, 0 = north).
local COMPASS = {
  "N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE",
  "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW",
}

function M.compass_direction(degrees)
  local index = math.floor(((degrees % 360) + 11.25) / 22.5) % 16
  return COMPASS[index + 1]
end

-- Status classifier: a site is "ok" under 80% of its own wind threshold,
-- "watch" between 80% and its threshold, and "alert" at or over it. Each
-- site carries its own threshold rather than one global number because a
-- coastal site and a sheltered inland site do not share a safe wind speed.
function M.wind_status(wind_kmh, max_wind_kmh)
  if wind_kmh >= max_wind_kmh then
    return "alert"
  elseif wind_kmh >= max_wind_kmh * 0.8 then
    return "watch"
  else
    return "ok"
  end
end

return M
