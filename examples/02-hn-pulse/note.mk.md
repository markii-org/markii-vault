---
title: Tech Community Pulse
description: A live pulse dashboard for Hacker News — trending threads, top domains, and comment velocity, fed by the Algolia HN Search API.
uses: [hn]
---

# Tech Community Pulse

:::::row{cols=4}

::::card
:::center
::stat{data=pulse.stats.threads label="front-page threads"}
:::
::::

::::card
:::center
::stat{data=pulse.stats.points label="total points"}
:::
::::

::::card
:::center
::stat{data=pulse.stats.comments label="total comments"}
:::
::::

::::card
:::center
::stat{data=pulse.stats.domain label="top domain"}
:::
::::

:::::

## Trending right now

The current front page, ranked two ways: by points, and by how fast each thread's comment count is moving relative to its age.

::::row{cols=2}

:::card{title="Top Threads"}
::hn-list{data=pulse.front max=6}
:::

:::card{title="Trending Threads"}
::hn-list{data=pulse.front by=velocity max=5}
:::

::::

## Top domains

Where the front page's stories actually point, counted and weighted by points.

::::cell
:::right
::hn-topics{data=pulse.topics max=10}
:::
::::

::hn-domains{data=pulse.domains max=6}

:::card{title="Threads / per hour"}
::hn-activity{data=pulse.pool}
:::


---

```lua {name=pulse}
-- Two requests from the Algolia HN Search API, cached together for five
-- minutes. Each request asks only for the fields the components below use
-- (attributesToRetrieve) and turns highlighting off (attributesToHighlight),
-- so a response stays well inside the sandbox's per-response node budget: a
-- full 1000-story pool decodes to ~30k JSON nodes and is refused, while the
-- trimmed 800-story pool below is ~6k.
--   1. the current front page (50 stories): title, url, points, comments.
--   2. the ~800 most recent stories, which feed the hourly activity chart
--      (it bins timestamps into a 24-hour window, so 800 is ample).
-- Comments per hour (velocity) needs a clock; the sandbox has none by
-- design (docs/security.md: no `os` in the curated standard library), so
-- this script returns raw unix timestamps and the hn-* components compute
-- age and velocity at render time with the host's clock.

local FIELDS = "objectID,url,title,points,num_comments,created_at_i,created_at"
local FRONT_URL = "https://hn.algolia.com/api/v1/search?"
  .. "tags=front_page&hitsPerPage=50"
  .. "&attributesToRetrieve=" .. FIELDS
  .. "&attributesToHighlight=%5B%5D"
local POOL_URL = "https://hn.algolia.com/api/v1/search_by_date?"
  .. "tags=%28story%2Cask_hn%2Cshow_hn%29&hitsPerPage=800"
  .. "&attributesToRetrieve=" .. FIELDS
  .. "&attributesToHighlight=%5B%5D"

-- Words that say nothing about a topic. Front-page titles are tokenized
-- and every non-stop word becomes a candidate "topic".
local STOP = {
  ["a"] = true, ["an"] = true, ["the"] = true, ["and"] = true, ["or"] = true,
  ["of"] = true, ["for"] = true, ["to"] = true, ["in"] = true, ["on"] = true,
  ["is"] = true, ["are"] = true, ["was"] = true, ["were"] = true, ["be"] = true,
  ["been"] = true, ["being"] = true, ["am"] = true, ["it"] = true, ["its"] = true,
  ["with"] = true, ["from"] = true, ["at"] = true, ["by"] = true, ["you"] = true,
  ["your"] = true, ["we"] = true, ["our"] = true, ["i"] = true, ["my"] = true,
  ["me"] = true, ["us"] = true, ["they"] = true, ["them"] = true,
  ["their"] = true, ["this"] = true, ["that"] = true, ["these"] = true,
  ["those"] = true, ["there"] = true, ["here"] = true, ["who"] = true,
  ["what"] = true, ["when"] = true, ["where"] = true, ["why"] = true,
  ["how"] = true, ["not"] = true, ["no"] = true, ["yes"] = true, ["all"] = true,
  ["any"] = true, ["some"] = true, ["more"] = true, ["most"] = true,
  ["other"] = true, ["another"] = true, ["one"] = true, ["two"] = true,
  ["three"] = true, ["first"] = true, ["new"] = true, ["into"] = true,
  ["about"] = true, ["over"] = true, ["after"] = true, ["before"] = true,
  ["out"] = true, ["off"] = true, ["just"] = true, ["only"] = true,
  ["now"] = true, ["then"] = true, ["than"] = true, ["so"] = true, ["if"] = true,
  ["as"] = true, ["but"] = true, ["do"] = true, ["does"] = true, ["did"] = true,
  ["done"] = true, ["can"] = true, ["could"] = true, ["would"] = true,
  ["should"] = true, ["will"] = true, ["may"] = true, ["might"] = true,
  ["must"] = true, ["have"] = true, ["has"] = true, ["had"] = true,
  ["get"] = true, ["got"] = true, ["let"] = true, ["make"] = true,
  ["made"] = true, ["use"] = true, ["used"] = true, ["using"] = true,
  ["show"] = true, ["ask"] = true, ["hn"] = true, ["hacker"] = true,
  ["news"] = true, ["launch"] = true, ["launched"] = true,
  ["launching"] = true, ["build"] = true, ["built"] = true,
  ["building"] = true, ["day"] = true, ["days"] = true, ["week"] = true,
  ["weeks"] = true, ["year"] = true, ["years"] = true, ["time"] = true,
  ["times"] = true, ["free"] = true, ["real"] = true, ["really"] = true,
  ["like"] = true, ["best"] = true, ["good"] = true, ["great"] = true,
  ["big"] = true, ["small"] = true, ["fast"] = true, ["faster"] = true,
  ["ever"] = true, ["still"] = true, ["every"] = true, ["anyone"] = true,
  ["anything"] = true,
}

local function domain_of(url)
  if url == nil then
    return "self"
  end
  local host = url:match("^https?://([^/]+)")
  if host == nil then
    return "self"
  end
  host = host:gsub("^www%.", "")
  if host == "" then
    return "self"
  end
  return host
end

local function item(hit)
  local id = tostring(hit.objectID or "")
  local url = hit.url
  local item_url = url
  if item_url == nil or item_url == "" then
    item_url = "https://news.ycombinator.com/item?id=" .. id
  end
  return {
    title = tostring(hit.title or "untitled"),
    domain = domain_of(url),
    points = hit.points or 0,
    comments = hit.num_comments or 0,
    created_at_i = hit.created_at_i or 0,
    url = item_url,
    id = id,
  }
end

local upstream = cache.get("hn-pulse", 300, function()
  local front_raw = net.fetch_json(FRONT_URL)
  if front_raw == nil or front_raw.hits == nil then
    error("HN API: front-page request failed")
  end
  local pool_raw = net.fetch_json(POOL_URL)
  if pool_raw == nil or pool_raw.hits == nil then
    error("HN API: recent-stories request failed")
  end
  local newest = pool_raw.hits[1]
  local fetched = "unknown"
  if newest ~= nil and newest.created_at ~= nil then
    fetched = string.sub(tostring(newest.created_at), 1, 16) .. " UTC"
  end
  return { front_raw = front_raw, pool_raw = pool_raw, fetched = fetched }
end)

local front = {}
for i = 1, #upstream.front_raw.hits do
  front[i] = item(upstream.front_raw.hits[i])
end
table.sort(front, function(a, b)
  if a.points ~= b.points then
    return a.points > b.points
  end
  return a.comments > b.comments
end)

local pool = {}
for i = 1, #upstream.pool_raw.hits do
  pool[i] = item(upstream.pool_raw.hits[i])
end

local domains = {}
for i = 1, #front do
  local entry = domains[front[i].domain]
  if entry == nil then
    entry = { domain = front[i].domain, count = 0, points = 0 }
    domains[front[i].domain] = entry
  end
  entry.count = entry.count + 1
  entry.points = entry.points + front[i].points
end
local domain_list = {}
for _, entry in pairs(domains) do
  domain_list[#domain_list + 1] = entry
end
table.sort(domain_list, function(a, b)
  if a.count ~= b.count then
    return a.count > b.count
  end
  return a.points > b.points
end)

local terms = {}
for i = 1, #front do
  local title = (front[i].title):lower()
  for token in title:gmatch("[%a%d_'-]+") do
    if STOP[token] == nil and #token > 1 then
      local entry = terms[token]
      if entry == nil then
        entry = { term = token, count = 0 }
        terms[token] = entry
      end
      entry.count = entry.count + 1
    end
  end
end
local topic_list = {}
for _, entry in pairs(terms) do
  topic_list[#topic_list + 1] = entry
end
table.sort(topic_list, function(a, b)
  if a.count ~= b.count then
    return a.count > b.count
  end
  return a.term < b.term
end)

local threads = #front
local points = 0
local comments = 0
for i = 1, threads do
  points = points + front[i].points
  comments = comments + front[i].comments
end

return {
  updated = upstream.fetched,
  stats = {
    threads = threads,
    points = points,
    comments = comments,
    domain = (domain_list[1] ~= nil and domain_list[1].domain) or "—",
  },
  front = front,
  pool = pool,
  domains = domain_list,
  topics = topic_list,
}
```
