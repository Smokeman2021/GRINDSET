// «Уроки» = подорож Києвом (docs/grindset-claude-code-TASK.md). Вертикального ланцюга вузлів тут немає: вид-сцена в поточній зупинці,
// вид-карта Києва з пінами й маршрутом, переїзд між зупинками. Уся логіка екрана в src/art/Journey.tsx.
import React, { useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useRouter, useFocusEffect } from 'expo-router';
import { Journey } from '../../src/art/Journey';
import { GOAL_XP, GOAL_LABEL, ENERGY_PER_LESSON, useStore } from '../../src/store';
import { Quests, todayStr } from '../../src/components/Quests';
import { questsForDay } from '../../src/data/quests';
import { homeSay, say } from '../../src/data/phrases';
import { dueKeys } from '../../src/data/srs';

void Quests; // компонент завдань відкривається всередині сцени

export default function Home() {
  const router = useRouter();
  const { energy, xpToday, dailyGoal, completed, daysAway, strictEnergy, refreshEnergy, srs, adaptDone, adaptDismissed, dismissAdapt, quiz: quizAnswers } = useStore();
  // Після першого уроку пропонуємо підлаштувати курс (решта питань); хто вже відповідав на старе опитування, не турбуємо
  const offerAdapt = completed.length >= 1 && !adaptDone && !adaptDismissed && !quizAnswers.income;
  const dueCount = dueKeys(srs).length;

  useFocusEffect(
    React.useCallback(() => {
      refreshEnergy();
    }, [refreshEnergy])
  );

  const goalTarget = GOAL_XP[dailyGoal];
  const [talk, setTalk] = useState(() => homeSay({ daysAway, energy, goalDone: xpToday >= GOAL_XP[dailyGoal], fresh: true }));
  const { questsDate, questProgress, questsClaimed } = useStore(useShallow((s) => ({ questsDate: s.questsDate, questProgress: s.questProgress, questsClaimed: s.questsClaimed })));
  const claimable = (() => {
    const today = todayStr();
    const fresh = questsDate === today;
    return questsForDay(today).filter((q) => (fresh ? (questProgress[q.metric] ?? 0) >= q.target && !questsClaimed.includes(q.id) : false)).length;
  })();

  // Жорстка енергія: без 10 одиниць нові уроки закриті, повтор пройденого доступний
  const open = (id: string) => {
    if (strictEnergy && energy < ENERGY_PER_LESSON && !completed.includes(id)) {
      setTalk(say('lowEnergy'));
      router.navigate('/shop');
      return;
    }
    router.push(`/lesson/${id}`);
  };

  return (
    <Journey
      completed={completed}
      onOpen={open}
      talk={talk}
      onTalk={() => setTalk(homeSay({ daysAway: 0, energy, goalDone: xpToday >= goalTarget, fresh: false }))}
      goal={{ xp: xpToday, target: goalTarget, label: GOAL_LABEL[dailyGoal] }}
      claimable={claimable}
      dueCount={dueCount}
      offerAdapt={offerAdapt}
      onDismissAdapt={dismissAdapt}
    />
  );
}
