# assets/ — куди класти згенеровані об'єкти

Нейминг і структура (детальні промпти — у `10_ASSET_KIT.md`):

```
character/   grindyk_<stage>_<mood>.png   напр. grindyk_sapiens_happy.png
icons/       coin.png streak_on.png streak_off.png energy.png gem.png
             xp_star.png chest_closed.png chest_open.png ach_gold_glasses.png
nodes/       node_current.png node_done.png node_locked.png
nav/         nav_lessons.png nav_shop.png nav_rating.png nav_profile.png
```

Формат: PNG з прозорістю, 1024×1024, один об'єкт по центру, світло зверху.

Почни з 3 файлів для звірки стилю: `icons/coin.png`, `icons/streak_on.png`, `nodes/node_current.png`.
Коли покладеш — я підключу їх у код (assets.ts) і заміню заглушки.
