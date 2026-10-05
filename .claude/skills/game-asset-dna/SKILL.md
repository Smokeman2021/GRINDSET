---
name: game-asset-dna
description: >
  Generate production-ready image prompts for a cohesive mobile game / app asset kit
  with a unified design DNA (style, palette, lighting, material). Use this skill whenever
  the user asks to: generate prompts for game icons, app assets, mascot/character poses,
  UI icons, node states, nav icons, reward items, or any visual object that must match
  a consistent 3D clay/glossy style. Also trigger when the user mentions "ассет",
  "іконка", "персонаж", "стиль-ДНК", "промпт для Midjourney", "промпт для Firefly",
  "asset kit", "game asset", "style reference", "character reference", or asks to
  "згенерувати промпт". Always use this skill before writing any image prompt —
  it ensures every object shares the same light, material, and palette.
---

# Game Asset DNA Skill

Generates optimized, consistent image-generation prompts for the GRINDSET app asset kit.
Every prompt produced by this skill carries the shared Style DNA so all assets look like
one coherent set.

---

## 1. STYLE DNA (append to EVERY prompt — never omit)

```
3D rendered game asset, soft glossy clay/plastic material, smooth rounded forms,
soft studio lighting, gentle top key light, subtle ambient occlusion, tactile and
chunky, vibrant slightly desaturated palette, brand green #36e27a as accent,
gold #ffce4d for rewards, single centered object, isolated on plain dark background,
mobile game UI icon, crisp, high detail, octane/redshift render look --ar 1:1 --v 6
```

**Project palette — must stay consistent across ALL assets:**
| Role | Hex |
|---|---|
| Brand green (accent) | `#36e27a` |
| Dark green | `#1f9b50` |
| Gold (rewards) | `#ffce4d` |
| Fire/energy | `#ff7a3c` |
| App background | `#0d0f14` |
| Panels | `#161a22` |

---

## 2. WORKFLOW — always follow this order

1. **Generate the COIN first** (section 4.1) — this is the style reference master.
2. Pick the best result → set as `--sref <url>` for all subsequent prompts.
3. For character poses → also add `--cref <character_url>`.
4. For series variations → fix `--seed <number>`.
5. Remove background: remove.bg / Photoshop / Photoroom → PNG with transparency.
6. Save to `app-mvp/assets/` using the naming convention in section 6.

> If not using Midjourney: ignore `--sref/--cref/--seed` flags but upload the coin
> image as "style reference" in your tool (Firefly, Flux, DALL·E, etc.).

---

## 3. CHARACTER — GRINDYK

**Core description (never change between poses):**
```
"Grindyk", a friendly stylized 3D mascot: young guy in a green hoodie, cool round
sunglasses, confident but warm, clean Pixar-like proportions, big readable silhouette
```

### 3.1 Evolution stages
- **Neanderthal:** `...messy hair, tired, no hoodie zipper, caveman vibe, clueless beginner`
- **Sapiens (MVP base):** `...tidy, neutral confident, basic clean look`
- **Civilizer:** `...sharp, well-groomed, small headphones, looks like a pro`

### 3.2 Emotion prompts (5 required for MVP)

| Key | Pose description |
|---|---|
| `neutral` | `standing relaxed, slight smirk, wearing sunglasses, arms crossed` |
| `happy` | `big genuine smile, thumbs up, eyes happy, no sunglasses` |
| `fire` | `hyped, excited, fist pump, small flame accent, sunglasses, energy` |
| `think` | `thoughtful, hand on chin, looking up, curious (teaching moment)` |
| `oops` | `mild surprised wince, supportive not mocking, small shrug` ⚠ NOT mocking |

**Full emotion prompt template:**
```
"Grindyk", a friendly stylized 3D mascot: young guy in a green hoodie, cool round
sunglasses, confident but warm, clean Pixar-like proportions, big readable silhouette,
<POSE_FROM_TABLE_ABOVE>,
3D rendered game asset, soft glossy clay/plastic material, smooth rounded forms,
soft studio lighting, gentle top key light, subtle ambient occlusion, tactile and
chunky, vibrant slightly desaturated palette, brand green #36e27a as accent,
single centered object, isolated on plain dark background, crisp, high detail,
octane/redshift render look --ar 1:1 --v 6 --cref <character_ref_url>
```

**Export:** `assets/character/grindyk_<stage>_<mood>.png` (e.g. `grindyk_sapiens_happy.png`)
Transparent background, 1024×1024.

---

## 4. OBJECTS & ICONS

### 4.1 Coin ⭐ GENERATE THIS FIRST — it becomes the style master
```
a single shiny gold coin with a subtle "G" emboss, thick rounded edge, glossy,
3D rendered game asset, soft glossy clay/plastic material, smooth rounded forms,
soft studio lighting, gentle top key light, subtle ambient occlusion, tactile and
chunky, gold #ffce4d, single centered object, isolated on plain dark background,
mobile game UI icon, crisp, high detail, octane/redshift render look --ar 1:1 --v 6
```
→ `assets/icons/coin.png`

### 4.2 Streak flame
**Active:** `a cute chunky flame icon, warm orange-yellow #ff7a3c, glossy, energetic, <STYLE_DNA>`
**Inactive:** `the same flame icon but grey, dim, "inactive" state, <STYLE_DNA>`
→ `assets/icons/streak_on.png`, `streak_off.png`

### 4.3 Energy bolt
```
a glossy green lightning bolt icon, rounded, energetic, brand green #36e27a, <STYLE_DNA>
```
→ `assets/icons/energy.png`

### 4.4 Lesson nodes (3 states — key path element)
| State | Prompt addition |
|---|---|
| Current | `glossy rounded button-orb, brand green, soft 3D, glowing rim, play triangle on top` |
| Done | `green orb with a gold check/crown on top, completed look` |
| Locked | `grey muted orb with a small padlock, dim` |

→ `assets/nodes/node_current.png`, `node_done.png`, `node_locked.png`

### 4.5 Treasure chest
**Closed:** `a closed treasure chest, green-and-gold, glossy clay style, slight glow, <STYLE_DNA>`
**Open:** `open chest with light burst, green-and-gold, glossy clay, <STYLE_DNA>`
→ `assets/icons/chest_closed.png`, `chest_open.png`

### 4.6 Gem/crystal
```
a faceted glossy gem/crystal, teal-green, sparkling, <STYLE_DNA>
```
→ `assets/icons/gem.png`

### 4.7 XP star
```
a chunky glossy star, gold #ffce4d, rounded points, <STYLE_DNA>
```
→ `assets/icons/xp_star.png`

### 4.8 Achievement — gold glasses
```
exclusive golden sunglasses, glossy, premium, on a small pedestal of light, <STYLE_DNA>
```
→ `assets/icons/ach_gold_glasses.png`

### 4.9 Navigation icons (4 icons, same style)
```
a set of 4 matching 3D app nav icons: open book (lessons), shopping bag (shop),
trophy (rating), person bust (profile), green accent #36e27a, glossy clay,
3D rendered, soft studio lighting, top key light, isolated on plain dark background,
mobile game UI, crisp, high detail --ar 1:1 --v 6 --sref <coin_ref_url>
```
Generate together (crop after) or one-by-one with `--sref`.
→ `assets/nav/nav_lessons.png`, `nav_shop.png`, `nav_rating.png`, `nav_profile.png`

---

## 5. TECHNICAL REQUIREMENTS

- **Format:** PNG with transparency (Lottie JSON for animated — later)
- **Source size:** 1024×1024 (icons), character 1024×1024+
- **Composition:** single object, centered, ~10% padding on all sides
- **Lighting:** top key light on ALL assets — inconsistent light breaks the set
- **Shadows:** do NOT bake shadows into the image (added in code for any background)
- **Background removal:** remove.bg → Photoshop Remove Background → Photoroom

---

## 6. FOLDER STRUCTURE

```
app-mvp/assets/
  character/   grindyk_<stage>_<mood>.png
  icons/       coin, streak_on, streak_off, energy, gem, xp_star,
               chest_closed, chest_open, ach_gold_glasses
  nodes/       node_current, node_done, node_locked
  nav/         nav_lessons, nav_shop, nav_rating, nav_profile
```

---

## 7. PROMPT GENERATION INSTRUCTIONS FOR CLAUDE

When the user asks for a prompt for any asset:

1. Identify the asset from section 3 or 4.
2. Take the object description for that asset.
3. Replace `<STYLE_DNA>` with the full Style DNA block from section 1.
4. Add `--sref <url>` placeholder if coin reference exists; remind user to fill it.
5. Add `--cref <url>` placeholder for character poses.
6. Output the **complete ready-to-paste prompt** — no placeholders left unfilled except reference URLs.
7. State the target filename from section 6.
8. Remind: generate coin first if this is the first asset.
