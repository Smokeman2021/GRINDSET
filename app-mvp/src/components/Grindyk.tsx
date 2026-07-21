import React from 'react';
import Svg, { Path, Circle, Line, Rect, G } from 'react-native-svg';
import type { CharStart } from '../store';

export type Mood = 'neutral' | 'happy' | 'fire' | 'think' | 'oops';

const COL = {
  skin: '#e7b48c',
  skinShade: '#d79e74',
  hair: '#2b2f3a',
  hoodie: '#36e27a',
  hoodieDark: '#1f9b50',
  glass: '#0e1116',
  mouth: '#7a3b3b',
  teeth: '#ffffff',
  flame: '#ff7a3c',
  flameIn: '#ffce4d',
};

function Hair({ stage }: { stage: CharStart }) {
  if (stage === 'caveman') {
    // розтріпані пасма
    return (
      <Path
        d="M37 45 Q33 22 46 23 Q47 13 57 20 Q63 11 71 20 Q87 17 83 45 Q79 31 71 35 Q67 26 60 33 Q53 26 49 35 Q42 30 37 45 Z"
        fill={COL.hair}
      />
    );
  }
  if (stage === 'early') {
    // акуратне волосся + кепка
    return (
      <G>
        <Path d="M38 46 Q36 30 60 29 Q84 30 82 46 Q79 34 60 34 Q41 34 38 46 Z" fill={COL.hair} />
        <Path d="M33 33 Q60 14 87 33 L87 37 Q60 27 33 37 Z" fill={COL.hoodie} />
        <Path d="M27 39 Q39 33 52 36 L50 43 Q37 43 28 41 Z" fill={COL.hoodieDark} />
      </G>
    );
  }
  // sapiens — охайна зачіска
  return (
    <Path d="M37 47 Q35 27 60 25 Q85 27 83 47 Q80 33 60 33 Q40 33 37 47 Z" fill={COL.hair} />
  );
}

function Face({ mood }: { mood: Mood }) {
  switch (mood) {
    case 'happy':
      return (
        <G>
          <Path d="M46 47 Q50 42 54 47" stroke={COL.hair} strokeWidth={2.6} fill="none" strokeLinecap="round" />
          <Path d="M66 47 Q70 42 74 47" stroke={COL.hair} strokeWidth={2.6} fill="none" strokeLinecap="round" />
          <Path d="M48 57 Q60 70 72 57 Q60 63 48 57 Z" fill={COL.mouth} />
          <Path d="M50 58 Q60 61 70 58 L70 60 Q60 62 50 60 Z" fill={COL.teeth} />
        </G>
      );
    case 'fire':
      return (
        <G>
          {/* окуляри */}
          <Path d="M44 45 H57 V50 Q50.5 53 44 50 Z" fill={COL.glass} />
          <Path d="M63 45 H76 V50 Q69.5 53 63 50 Z" fill={COL.glass} />
          <Line x1="57" y1="47" x2="63" y2="47" stroke={COL.glass} strokeWidth={2} />
          {/* грин */}
          <Path d="M50 58 Q60 70 70 58 Z" fill={COL.mouth} />
          <Path d="M52 58 H68 L66 61 Q60 62 54 61 Z" fill={COL.teeth} />
          {/* вогник */}
          <Path d="M86 26 Q91 19 88 11 Q96 17 95 28 Q92 33 86 26 Z" fill={COL.flame} />
          <Path d="M88 26 Q91 21 90 16 Q93 21 92 27 Q90 29 88 26 Z" fill={COL.flameIn} />
        </G>
      );
    case 'think':
      return (
        <G>
          <Line x1="46" y1="40" x2="56" y2="38" stroke={COL.hair} strokeWidth={2.4} strokeLinecap="round" />
          <Line x1="64" y1="37" x2="74" y2="41" stroke={COL.hair} strokeWidth={2.4} strokeLinecap="round" />
          <Circle cx="51" cy="46" r="2.6" fill={COL.hair} />
          <Circle cx="69" cy="46" r="2.6" fill={COL.hair} />
          <Path d="M54 61 Q60 60 65 62" stroke={COL.mouth} strokeWidth={2.4} fill="none" strokeLinecap="round" />
        </G>
      );
    case 'oops':
      return (
        <G>
          <Path d="M46 39 Q51 35 56 39" stroke={COL.hair} strokeWidth={2.4} fill="none" strokeLinecap="round" />
          <Path d="M64 39 Q69 35 74 39" stroke={COL.hair} strokeWidth={2.4} fill="none" strokeLinecap="round" />
          <Circle cx="51" cy="47" r="3.2" fill="#fff" />
          <Circle cx="69" cy="47" r="3.2" fill="#fff" />
          <Circle cx="51" cy="47" r="1.6" fill={COL.hair} />
          <Circle cx="69" cy="47" r="1.6" fill={COL.hair} />
          <Path d="M53 61 Q57 57 60 61 Q63 65 67 61" stroke={COL.mouth} strokeWidth={2.4} fill="none" strokeLinecap="round" />
        </G>
      );
    case 'neutral':
    default:
      return (
        <G>
          {/* окуляри */}
          <Path d="M44 45 H57 V50 Q50.5 53 44 50 Z" fill={COL.glass} />
          <Path d="M63 45 H76 V50 Q69.5 53 63 50 Z" fill={COL.glass} />
          <Line x1="57" y1="47" x2="63" y2="47" stroke={COL.glass} strokeWidth={2} />
          {/* смішок */}
          <Path d="M52 60 Q60 64 67 59" stroke={COL.mouth} strokeWidth={2.6} fill="none" strokeLinecap="round" />
        </G>
      );
  }
}

export function Grindyk({
  start,
  mood,
  size = 80,
}: {
  start?: CharStart;
  mood?: Mood;
  size?: number;
}) {
  const stage: CharStart = start ?? 'sapiens';
  const face: Mood = mood ?? 'neutral';
  return (
    <Svg width={size} height={size} viewBox="0 0 120 120">
      {/* худі */}
      <Path d="M22 120 C22 90 38 82 60 82 C82 82 98 90 98 120 Z" fill={COL.hoodie} />
      <Path d="M34 96 Q60 84 86 96 L83 104 Q60 96 37 104 Z" fill={COL.hoodieDark} />
      <Line x1="56" y1="92" x2="54" y2="112" stroke={COL.hoodieDark} strokeWidth={2.5} strokeLinecap="round" />
      <Line x1="64" y1="92" x2="66" y2="112" stroke={COL.hoodieDark} strokeWidth={2.5} strokeLinecap="round" />
      {/* шия */}
      <Rect x="52" y="68" width="16" height="20" rx="7" fill={COL.skinShade} />
      {/* вуха */}
      <Circle cx="36" cy="51" r="5" fill={COL.skin} />
      <Circle cx="84" cy="51" r="5" fill={COL.skin} />
      {/* голова */}
      <Path d="M38 47 Q38 25 60 25 Q82 25 82 47 Q82 71 60 73 Q38 71 38 47 Z" fill={COL.skin} />
      {/* волосся/стадія */}
      <Hair stage={stage} />
      {/* обличчя/настрій */}
      <Face mood={face} />
    </Svg>
  );
}
