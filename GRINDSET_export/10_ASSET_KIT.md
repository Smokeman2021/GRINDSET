# GRINDSET — AI Asset Kit
> Як згенерувати персонажа й усі об'єкти як ЄДИНИЙ набір. Дата: 03.06.2026.
> Промпти — англійською (нейромережі так дають кращий результат). Копіюй як є.

---

## 0. ГОЛОВНЕ ПРАВИЛО
Краса набору = **консистентність**. Не генеруй кожен об'єкт «з нуля». Спочатку зроби ОДИН еталонний об'єкт, зафіксуй його стиль як референс, і генеруй усе решта проти цього референсу. Інакше іконки будуть з різних світів.

---

## 1. СТИЛЬ-ДНК (додавай до КОЖНОГО промпту)
Це «хвіст», який клеїться в кінець будь-якого промпту нижче:

```
3D rendered game asset, soft glossy clay/plastic material, smooth rounded forms,
soft studio lighting, gentle top key light, subtle ambient occlusion, tactile and
chunky, vibrant slightly desaturated palette, brand green #36e27a as accent,
gold #ffce4d for rewards, single centered object, isolated on plain dark background,
mobile game UI icon, crisp, high detail, octane/redshift render look --ar 1:1 --v 6
```

Палітра проекту (тримай у всіх ассетах):
- Зелений акцент `#36e27a`, темно-зелений `#1f9b50`
- Золото (нагороди) `#ffce4d`, вогонь/азарт `#ff7a3c`
- Фон застосунку `#0d0f14`, панелі `#161a22`

---

## 2. РОБОЧИЙ ПРОЦЕС (Midjourney як еталон; у інших — аналоги)
1. Згенеруй **еталон** — лінзу стилю. Візьми монету (п.4.1). Вибери найкращий кадр.
2. Признач його стиль-референсом: додавай `--sref <посилання_на_картинку>` (або `--sref <код>`) у ВСІ наступні промпти. Це переносить світло/матеріал/палітру.
3. Для персонажа додатково використовуй `--cref <посилання_на_картинку_персонажа>` — тримає одне обличчя/одяг у всіх позах.
4. Для серій варіацій фіксуй `--seed <число>`.
5. Прибери фон: remove.bg, Photoshop (Remove Background) або Photoroom → PNG з прозорістю.
6. Скинь файли в `app-mvp/assets/...` за неймингом нижче — далі я підключу.

> Якщо твоя нейронка не Midjourney — флаги `--sref/--cref/--seed` ігноруй, але принцип той самий: завантажуй еталон як «style reference» / «character reference».

---

## 3. ПЕРСОНАЖ — ГРІНДІК
Базовий опис (ядро, не міняй між позами):
```
"Grindyk", a friendly stylized 3D mascot: young guy in a green hoodie, cool round
sunglasses, confident but warm, clean Pixar-like proportions, big readable silhouette
```

### 3.1 Стадії еволюції (для MVP досить 1 — sapiens; решта пізніше)
- Неандерталець: `...messy hair, tired, no hoodie zipper, caveman vibe, clueless beginner`
- Гомо Сапієнс (база MVP): `...tidy, neutral confident, basic clean look`
- Цивілізатор: `...sharp, well-groomed, small headphones, looks like a pro`

### 3.2 Емоції (це замінить заглушки в коді — потрібні 5)
Для кожної: базовий опис + стан + СТИЛЬ-ДНК + `--cref`:
- neutral: `standing relaxed, slight smirk, wearing sunglasses, arms crossed`
- happy: `big genuine smile, thumbs up, eyes happy, no sunglasses`
- fire (комбо): `hyped, excited, fist pump, small flame accent, sunglasses, energy`
- think: `thoughtful, hand on chin, looking up, curious (teaching moment)`
- oops: `mild surprised wince, supportive not mocking, small shrug` ⚠ НЕ глузливий

Експорт: `assets/character/grindyk_<stage>_<mood>.png` (напр. `grindyk_sapiens_happy.png`), прозорий фон, 1024×1024.

---

## 4. ОБ'ЄКТИ ТА ІКОНКИ (топ-бар, шлях, нагороди)

### 4.1 Монета (ЗРОБИ ПЕРШОЮ — це еталон стилю)
```
a single shiny gold coin with a subtle "G" emboss, thick rounded edge, glossy
```
→ `assets/icons/coin.png`

### 4.2 Стрік-вогник
Активний: `a cute chunky flame icon, warm orange-yellow, glossy, energetic`
Згаслий: `the same flame icon but grey, dim, "inactive" state`
→ `assets/icons/streak_on.png`, `streak_off.png`

### 4.3 Енергія
```
a glossy green lightning bolt icon, rounded, energetic, brand green #36e27a
```
→ `assets/icons/energy.png`

### 4.4 Ноди уроку (3 стани — головний елемент шляху)
- Доступний/поточний: `a glossy rounded button-orb, brand green, soft 3D, glowing rim, play triangle on top`
- Пройдений: `a green orb with a gold check/crown on top, completed look`
- Заблокований: `a grey muted orb with a small padlock, dim`
→ `assets/nodes/node_current.png`, `node_done.png`, `node_locked.png`

### 4.5 Скриня нагороди
```
a closed treasure chest, green-and-gold, glossy clay style, slight glow
```
+ варіант `open chest with light burst` → `assets/icons/chest_closed.png`, `chest_open.png`

### 4.6 Гем/кристал (якщо лишаємо валюту-преміум)
```
a faceted glossy gem/crystal, teal-green, sparkling
```
→ `assets/icons/gem.png`

### 4.7 XP-зірка
```
a chunky glossy star, gold, rounded points
```
→ `assets/icons/xp_star.png`

### 4.8 Нагорода-ачівка: золоті окуляри
```
exclusive golden sunglasses, glossy, premium, on a small pedestal of light
```
→ `assets/icons/ach_gold_glasses.png`

### 4.9 Навігація (4 іконки, той самий стиль)
```
a set of 4 matching 3D app nav icons: open book (lessons), shopping bag (shop),
trophy (rating), person bust (profile), green accent, glossy clay
```
Генеруй або разом (потім поріж), або по одній з `--sref`.
→ `assets/nav/nav_lessons.png`, `nav_shop.png`, `nav_rating.png`, `nav_profile.png`

---

## 5. ТЕХНІЧНІ ВИМОГИ (важливо для якості в застосунку)
- Формат: **PNG з прозорістю** (або Lottie JSON для анімованих — пізніше).
- Розмір вихідних: 1024×1024 (іконки), персонаж 1024×1024+. Я зменшу під @1x/@2x/@3x.
- Один об'єкт у кадрі, по центру, з невеликими полями (≈10%).
- Однакове джерело світла (зверху) на ВСІХ — інакше набір «розсиплеться».
- Тіні під об'єктом краще НЕ запікати (я додам м'яку тінь у коді, щоб лягало на будь-який фон).

---

## 6. СТРУКТУРА ПАПКИ (куди класти)
```
app-mvp/assets/
  character/   grindyk_<stage>_<mood>.png
  icons/       coin, streak_on, streak_off, energy, gem, xp_star, chest_*, ach_gold_glasses
  nodes/       node_current, node_done, node_locked
  nav/         nav_lessons, nav_shop, nav_rating, nav_profile
```

## 7. ЯК Я ІНТЕГРУЮ (твій крок → мій крок)
1. Ти кидаєш PNG у відповідні папки за неймингом вище.
2. Я роблю `assets.ts` (мапа ключ → файл), підмінюю заглушки: Гріндік-емодзі → твій персонаж, Tabler-іконки → твої об'єкти.
3. Додаю в код «крафтовість», яку дає код: об'ємні кнопки зі станом натиску, виважені відступи, м'які тіні, мікроанімації появи/натиску.
4. Ти дивишся на вебі/телефоні, корегуємо.

> Порада: почни з 3 ассетів — монета (еталон), вогник, один нод уроку. Покажи мені — звіримо стиль, і лише потім жени решту. Так не спалиш генерації на наборі, що не зійдеться.
