---
title: Cat Gallery
description: A photo gallery of cats with breed notes, fed by the Cat API.
uses: [cat]
---

# Cat Gallery

:::callout{type=info title="Details"}
Every run of the script below pulls ten photos from the Cat API.
:::

:::::row{cols=3}

::::card
:::center
::stat{data=cats.stats.count label="cats"}
::::


::::card
:::center
::stat{data=cats.stats.breeds label="breeds"}
::::

::::card
:::center
::stat{data=cats.stats.largest label="largest photo"}
::::

:::::


## Meet the breeds


::cat-finder{data=cats.gallery}

## Featured cat

The largest photo gets the spotlight.

::cat-card{data=cats.featured}

:::details{title="About this note"}
- Fed by the Cat API (`api.thecatapi.com/v1/images/search`), one request per run, fetched fresh every time: pressing Run always brings a new batch of ten. (The weather and HN Pulse examples are the ones that demonstrate `cache.get`.)

- Breed data needs an API key. Without one the API ignores `breed_ids` and returns anonymous photos, so every cat files under "Mystery cat" and the finder has no origin or temperament to show. A key is free at thecatapi.com: paste it into the URL in the script below (the commented line shows where), keeping the URL one single literal so the host can still read the hostname for the network grant.

- The `cat` pack ships `::cat-gallery`, `::cat-card`, and the interactive `::cat-finder`, all data-bound like the stdlib components.
:::

---

```lua {name=cats}
-- One request, ten photos, fetched fresh on every run: the fun of this
-- note IS pressing Run and meeting ten new cats, so nothing is cached
-- here (the weather and HN Pulse examples demonstrate cache.get).
-- With an API key, the comma-separated breed_ids makes the Cat API
-- attach full breed data (name, origin, temperament, wikipedia link) to
-- each photo. Without one the API ignores the filter and sends anonymous
-- photos, and the wall still fills; the cats just keep their secrets.

-- The URL is written as ONE string literal, directly in the net call. The
-- host reads it before running anything to know which hostname to ask you
-- about, and it only trusts a whole literal: split it across a variable or
-- a `..` concatenation and there is nothing to grant, so the request is
-- denied. See docs/scripting.md.

-- Breed data needs a (free) API key: append &api_key=YOUR_KEY inside
-- the SAME string literal below. Kept as one literal on purpose; see
-- the note above on why a concatenated URL cannot be granted.
local images = net.fetch_json(
  "https://api.thecatapi.com/v1/images/search?limit=10&breed_ids=beng,sibe,pers,siam,mco,bsh,srex,abys,ragd,norw"
)
if images == nil then
  error("Cat API: request failed")
end
local gallery = {}
for i = 1, #images do
  local image = images[i]
  local breed = image.breeds and image.breeds[1] or nil
  gallery[#gallery + 1] = {
    id = tostring(image.id or ""),
    url = tostring(image.url or ""),
    width = image.width or 0,
    height = image.height or 0,
    breed = (breed ~= nil and tostring(breed.name)) or "",
    origin = (breed ~= nil and tostring(breed.origin)) or "",
    temperament = (breed ~= nil and tostring(breed.temperament)) or "",
    -- The API sets wikipedia_url to null for some breeds; a JSON null
    -- object field reads as plain Lua nil, so `or ""` covers it.
    wikipedia = (breed ~= nil and breed.wikipedia_url) or "",
  }
end
if #gallery == 0 then
  error("Cat API: no photos returned")
end

local breed_set = {}
for i = 1, #gallery do
  if gallery[i].breed ~= "" then
    breed_set[gallery[i].breed] = true
  end
end
local breed_count = 0
for _ in pairs(breed_set) do
  breed_count = breed_count + 1
end

local featured = gallery[1]
local best_area = 0
for i = 1, #gallery do
  local cat = gallery[i]
  local area = cat.width * cat.height
  if area > best_area then
    best_area = area
    featured = cat
  end
end

local biggest_w, biggest_h = 0, 0
for i = 1, #gallery do
  local cat = gallery[i]
  if cat.width * cat.height >= biggest_w * biggest_h then
    biggest_w = cat.width
    biggest_h = cat.height
  end
end

return {
  stats = {
    count = #gallery,
    breeds = breed_count,
    largest = tostring(biggest_w) .. "×" .. tostring(biggest_h) .. " px",
  },
  gallery = gallery,
  featured = featured,
}
```
