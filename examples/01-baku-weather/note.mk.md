---
title: Weather Forecast: Baku
description: A live weather dashboard for Baku, Azerbaijan, fed by Open-Meteo.
---

# Weather Forecast: Baku

::::figure{src="baku.jpg" alt="Baku skyline"}

:::center
Baku, late summer.
:::

::::


:::callout{type=info title="Right Now in Baku"}

Current conditions report a :badge[:value[baku_weather.condition]] at :value[baku_weather.temperature]°C (feels like :value[baku_weather.feels_like]°C), with humidity at :value[baku_weather.humidity]% and winds from the :value[baku_weather.wind.delta] at :value[baku_weather.wind.value] km/h.

:::

## Forecast


:::::row{cols=4}
::::card
:::center
::stat{data=baku_weather.temperature label="°C now"}
::::

::::card
:::center
::stat{data=baku_weather.feels_like label="feels like"}
::::

::::card
:::center
::stat{data=baku_weather.pressure label="pressure hPa"}
::::

::::card
:::center
::stat{data=baku_weather.precipitation label="precip mm"}
::::
:::::


:::::row{cols=2}

::::card{title="Wind"}
:::center
::stat{data=baku_weather.wind}
:::
::::

:::card{title="Today"}
Expect a day  
between :value[baku_weather.today.low]° 
and :value[baku_weather.today.high]°C.
:::

:::::


### The week ahead

Highs and lows for the next seven days:

:::::row{cols=3}

::::cell
:::card{title="Highs"}
::chart{data=baku_weather.week kind=line}
::::

::::cell
:::card{title="Lows"}
::chart{data=baku_weather.lows kind=bar}
::::

::::cell
:::card{title="Humidity"}
::progress{data=baku_weather.humidity max=100 label=""}
::::

:::::

:::details{title="Forecast Notes"}
- Last update: :value[baku_weather.updated].
- Today: :value[baku_weather.today.low]°C to :value[baku_weather.today.high]°C.
- Right now: :value[baku_weather.condition], wind
  :value[baku_weather.wind.value] km/h.
:::

---

```lua {name=baku_weather}
local params = {
  "latitude=40.4093",
  "longitude=49.8671",
  "current=temperature_2m,relative_humidity_2m,apparent_temperature,"
    .. "precipitation,weather_code,wind_speed_10m,wind_direction_10m,surface_pressure",
  "daily=temperature_2m_max,temperature_2m_min",
  "forecast_days=7",
  "timezone=auto",
}
local url = "https://api.open-meteo.com/v1/forecast?"
  .. table.concat(params, "&")

local r = cache.get("baku-weather", 1800, function()
  local raw = net.fetch_json(url)
  if raw.error then
    error("weather API: " .. tostring(raw.reason or "unknown error"))
  end
  return raw
end)

local c = r.current

local wmo = {
  [0] = "Clear sky", [1] = "Mainly clear", [2] = "Partly cloudy",
  [3] = "Overcast",
  [45] = "Fog", [48] = "Rime fog",
  [51] = "Light drizzle", [53] = "Drizzle", [55] = "Dense drizzle",
  [56] = "Freezing drizzle", [57] = "Freezing drizzle",
  [61] = "Light rain", [63] = "Rain", [65] = "Heavy rain",
  [66] = "Freezing rain", [67] = "Freezing rain",
  [71] = "Light snow", [73] = "Snow", [75] = "Heavy snow",
  [77] = "Snow grains",
  [80] = "Light showers", [81] = "Showers", [82] = "Violent showers",
  [85] = "Snow showers", [86] = "Heavy snow showers",
  [95] = "Thunderstorm",
  [96] = "Thunderstorm with hail", [99] = "Thunderstorm with heavy hail",
}

local compass = { "N", "NE", "E", "SE", "S", "SW", "W", "NW" }
local index = math.floor(((c.wind_direction_10m % 360) + 22.5) / 45) % 8
local wind_dir = compass[index + 1]

local function array_of(t)
  local out = {}
  local i = 1
  local v = t[i]
  while v ~= nil do
    out[i] = v
    i = i + 1
    v = t[i]
  end
  return out
end

local week_highs = array_of(r.daily.temperature_2m_max)
local week_lows = array_of(r.daily.temperature_2m_min)

return {
  city = "Baku, Azerbaijan",
  updated = c.time,
  condition = wmo[c.weather_code] or "Unknown",
  temperature = c.temperature_2m,
  feels_like = c.apparent_temperature,
  humidity = c.relative_humidity_2m,
  pressure = c.surface_pressure,
  precipitation = c.precipitation,
  wind = {
    value = c.wind_speed_10m,
    label = "wind km/h",
    delta = wind_dir,
  },
  today = {
    low = week_lows[1],
    high = week_highs[1],
  },
  week = week_highs,
  lows = week_lows,
  code = c.weather_code,
}
```
