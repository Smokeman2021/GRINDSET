// Сцена подорожі перед одиницею гілки (ТЗ 006, 3.1): повноекранний заклад Києва, Гріндік на підлозі, одна ціль, картка завдання.
// Перший раз відкривається перед уроком / практикою / фіналом; повторно гілка веде одразу в завдання (сцену можна пропустити).
import React, { useMemo } from 'react';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { StopScene } from '../../src/art/StopScene';
import { branchStop } from '../../src/art/branchStop';
import { branchScene, sceneKey } from '../../src/data/branchScenes';
import { unitById } from '../../src/data/branches';
import { useStore } from '../../src/store';

export default function BranchSceneScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const ref = unitById(String(id ?? ''));
  const code = ref?.branch.code ?? '';
  const stop = useMemo(() => (ref ? branchStop(code, ref.unit.id, ref.unit.title) : null), [ref, code]);
  const sc = ref ? branchScene(code, ref.unit.id) : null;
  if (!ref || !stop || !sc) return <Redirect href={{ pathname: '/unavailable', params: { why: 'lesson' } }} />;
  const go = () => {
    useStore.getState().markSeen(sceneKey(ref.unit.id));
    if (ref.unit.sim === 'leads') router.replace('/leads');
    else router.replace(`/lesson/${ref.unit.id}`);
  };
  const say = sc.stage === 'final' ? `${stop.loc.title}. Фінал гілки: тут вирішуєш сам, я тільки дивлюсь.` : sc.stage === 'practice' ? `${stop.loc.title}. Практика: без підказок, тільки цифри.` : `${stop.loc.title}. Тут розбираємо: ${ref.unit.title}.`;
  return (
    <StopScene
      stop={stop}
      allDone={false}
      quizzes={[]}
      talk={{ text: say, pose: stop.loc.pose ?? 'point' }}
      onTalk={() => undefined}
      onStart={go}
      onQuiz={() => undefined}
      onMap={() => router.replace({ pathname: '/map/[code]', params: { code } })}
      goal={{ xp: 0, target: 1, label: '' }}
      claimable={0}
      dueCount={0}
      offerAdapt={false}
      onDismissAdapt={() => undefined}
      completedCount={0}
      kicker={`${ref.branch.emoji} ${ref.branch.title.toUpperCase()} · ${sc.label.toUpperCase()}`}
      minimal
      enterTitle={sc.stage === 'final' ? 'До фіналу' : 'Увійти'}
    />
  );
}

