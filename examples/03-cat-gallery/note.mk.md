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
- Fed by the Cat API (`api.thecatapi.com/v1/images/search` with a comma-separated `breed_ids`), one request per run, the batch cached for 10 minutes under a single key.

- Ten curated breeds fill the 5×2 wall exactly: the API returns only photos of those breeds, each carrying its breed data. A failed request aborts the run with a clear error instead of a half-filled wall.

- The `cat` pack ships `::cat-gallery`, `::cat-card`, and the interactive `::cat-finder`, all data-bound like the stdlib components.
:::

---

```lua {name=cats}
-- Ten curated breeds asked for in ONE request: a comma-separated
-- breed_ids makes the Cat API attach full breed data (name, origin,
-- temperament, wikipedia link) to each photo it returns. `limit=10`
-- fills the 5×2 grid exactly — every tile named, no half-filled rows.
-- The batch is cached under a single key for ten minutes.

local API = "https://api.thecatapi.com/v1/images/search?limit=10&breed_ids="
  .. "beng,sibe,pers,siam,mco,bsh,srex,abys,ragd,norw"

local gallery = cache.get("cat-gallery", 600, function()
  local images = net.fetch_json(API)
  if images == nil then
    error("Cat API: request failed")
  end
  local cats = {}
  for i = 1, #images do
    local image = images[i]
    local breed = image.breeds and image.breeds[1] or nil
    cats[#cats + 1] = {
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
  if #cats == 0 then
    error("Cat API: no breed photos returned")
  end
  return cats
end)

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
