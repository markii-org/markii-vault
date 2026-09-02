-- Shared helpers for the edge status board (scripts/etl.lua requires this
-- as "scripts/util", the bundle-local module path docs/scripting.md
-- describes). Kept as a real module: direction and status classification
-- both live here so etl.lua stays a thin fetch-and-shape script. Reading
-- assets/sites.json is etl.lua's own job, through the `json` table
-- (docs/scripting.md), so this module carries no parsing of its own.

local M = {}

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
