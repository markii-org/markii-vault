---
title: Cat Gallery
description: A photo gallery of cats with breed notes, fed by the Cat API.
uses: [cat]
---

# Cat Gallery

:::callout{type=info title="The haul"}

Every run of the script below pulls a fresh batch of photos from the Cat API — :badge[:value[cats.stats.count]] cats this time, with breed data whenever the API had it.

:::

::::row{cols=3}
::stat{data=cats.stats.count label="cats"}
::stat{data=cats.stats.breeds label="breeds"}
::stat{data=cats.stats.largest label="largest photo"}
::::

## The gallery

::cat-gallery{data=cats.gallery max=8}

## Featured cat

The largest photo with a known breed gets the spotlight.

::cat-card{data=cats.featured}

:::details{title="About this note"}
- Fed by the Cat API (`api.thecatapi.com/v1/images/search`), one request per run, cached for 10 minutes.
- `max=` caps the gallery tiles; images and breed notes come straight from the API, dimensions from its metadata.
- The `cat` pack ships `::cat-gallery` and `::cat-card`, both data-bound like the stdlib components.
:::

---

```lua {name=cats}
-- One request to the Cat API: up to 8 random images, with breed data
-- requested (has_breeds=true so the gallery gets names, origins, and
-- temperaments to caption the photos). Cached for ten minutes.

local API_URL = "https://api.thecatapi.com/v1/images/search"
  .. "?limit=8&has_breeds=true"

local raw = cache.get("cat-gallery", 600, function()
  local images = net.fetch_json(API_URL)
  if images == nil then
    error("Cat API: request failed")
  end
  local ok = pcall(function() return #images end)
  -- Top-level JSON arrays arrive as userdata, so guard with pcall:
  -- fail loudly if the API ever returns an object instead of a list.
  if not ok then
    error("Cat API: request failed")
  end
  return images
end)

local cats = {}
for i = 1, #raw do
  local image = raw[i]
  local breed = image.breeds ~= nil and image.breeds[1] or nil
  cats[i] = {
    id = tostring(image.id or ""),
    url = tostring(image.url or ""),
    width = image.width or 0,
    height = image.height or 0,
    breed = (breed ~= nil and tostring(breed.name)) or "",
    origin = (breed ~= nil and tostring(breed.origin)) or "",
    temperament = (breed ~= nil and tostring(breed.temperament)) or "",
    wikipedia = (breed ~= nil and tostring(breed.wikipedia_url)) or "",
  }
end

local breed_set = {}
for i = 1, #cats do
  if cats[i].breed ~= "" then
    breed_set[cats[i].breed] = true
  end
end
local breed_count = 0
for _ in pairs(breed_set) do
  breed_count = breed_count + 1
end

local featured = cats[1]
local best_area = 0
local biggest_w = 0
local biggest_h = 0
for i = 1, #cats do
  local cat = cats[i]
  local area = cat.width * cat.height
  if area > biggest_w * biggest_h then
    biggest_w = cat.width
    biggest_h = cat.height
  end
  if cat.breed ~= "" and area > best_area then
    best_area = area
    featured = cat
  end
end

return {
  stats = {
    count = #cats,
    breeds = breed_count,
    largest = tostring(biggest_w) .. "×" .. tostring(biggest_h) .. " px",
  },
  gallery = cats,
  featured = featured,
}
```