# GRINDSET — Технічний статус та налаштування

---

## ЗАРЕЄСТРОВАНІ СЕРВІСИ

| Сервіс | Статус | Примітка |
|--------|--------|---------|
| Supabase | ✅ Готово | Проект створено |
| Replit | ✅ Готово | Акаунт створено |
| Claude API (Anthropic) | ⚠️ Зареєстровано | Потрібна оплата |
| Node.js | ✅ Встановлено | На локальному ПК |

---

## SUPABASE

**URL:** `https://twthqfymszknudrslafu.supabase.co`

### Таблиці (створені):

**`agent_tasks`** — задачі між агентами
```sql
id uuid PRIMARY KEY
from_agent text
to_agent text  
task text
status text DEFAULT 'pending'
result text
created_at timestamp
```

**`agent_logs`** — лог дій агентів
```sql
id uuid PRIMARY KEY
agent text
action text
details text
created_at timestamp
```

**`shared_context`** — спільна база знань
```sql
id uuid PRIMARY KEY
category text
key text
value text
updated_at timestamp
```

**RLS:** вимкнено на всіх трьох таблицях.

---

## АГЕНТНА СИСТЕМА — ПЛАН

### Архітектура:
```
Ioan → задача/корективи
         ↓
Агент-менеджер
  - Читає Supabase
  - Визначає тип задачі (контент / розробка / стратегія)
  - Записує задачу в agent_tasks
         ↓
Агент-контент    Агент-розробка    Агент-стратегія
         ↓
Результати → agent_tasks (status: completed, result: ...)
```

### Логіка маршрутизації менеджера:
- "контент" або "урок" → `to_agent: 'content'`
- "розробка" або "код" → `to_agent: 'dev'`
- все інше → `to_agent: 'strategy'`

### Базовий код менеджера (Node.js):
```javascript
const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  'https://twthqfymszknudrslafu.supabase.co',
  '[SUPABASE_ANON_KEY]'  // НЕ зберігати в коді - використовувати env variables
)

async function managerAgent(userTask) {
  let targetAgent = ''
  if (userTask.includes('контент') || userTask.includes('урок')) {
    targetAgent = 'content'
  } else if (userTask.includes('розробка') || userTask.includes('код')) {
    targetAgent = 'dev'
  } else {
    targetAgent = 'strategy'
  }

  const { error } = await supabase.from('agent_tasks').insert({
    from_agent: 'manager',
    to_agent: targetAgent,
    task: userTask,
    status: 'pending'
  })

  if (error) {
    console.log('Помилка:', error.message)
  } else {
    console.log(`Задачу передано агенту: ${targetAgent}`)
  }
}
```

---

## NEXT STEPS (технічна частина)

### Пріоритет 1: Claude API
- [ ] Поповнити баланс на console.anthropic.com (мінімум $5)
- [ ] Зберегти API ключ як environment variable (ANTHROPIC_API_KEY)

### Пріоритет 2: Перший агент з AI
- [ ] Написати агент-контент який приймає задачу і генерує контент через Claude API
- [ ] Написати агент-розробка

### Пріоритет 3: Next.js скелет
- [ ] Ініціалізувати Next.js проект з i18n (UA/RU/EN)
- [ ] Базовий роутинг
- [ ] Tailwind CSS
- [ ] Підключити Supabase

### Пріоритет 4: Перший екран
- [ ] Екран онбордингу (квіз)
- [ ] Логіка маршрутизації по результатах

---

## БЕЗПЕКА

⚠️ **ВАЖЛИВО:**
- `service_role` ключ Supabase — нікому не давати НІКОЛИ
- `anon public` ключ — можна у фронтенді
- API ключі зберігати тільки в environment variables, не в коді
- Supabase URL та публічні ключі не є секретними, але краще не публікувати в відкритих чатах

---

## МОНЕТИЗАЦІЯ — ТЕХНІЧНІ КОМПОНЕНТИ

| Функція | Інструмент |
|---------|-----------|
| Підписки iOS/Android | RevenueCat |
| Rewarded реклама | Google AdMob |
| Auth | Supabase Auth (Google/FB/Telegram) |
