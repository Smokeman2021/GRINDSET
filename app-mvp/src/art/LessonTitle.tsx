// Заголовок уроку/локації: гібрид голосних коміксних вигуків (Marvel/DC) і графіті: яскравий, широкий, з БІЛОЮ обводкою (ТЗ, Додаток А).
// ОДИН компонент на весь застосунок; трактування обирається автоматично: довга назва або шумний фон → PANEL, коротка геройська на чистому фоні → POP,
// решта → CAPS. Обводка біла завжди; заливка інвертується під фон. Малюється через react-native-svg (в RN нема text-stroke): шари
// «тінь → чорний кант → біла обводка → заливка» працюють однаково у вебі, iOS і Android.
import React from 'react';
import { View } from 'react-native';
import Svg, { Circle, Defs, G, Pattern, Rect, Text as SvgText, TSpan } from 'react-native-svg';
import { useFonts } from 'expo-font';
import { Oswald_700Bold } from '@expo-google-fonts/oswald';
import { RussoOne_400Regular } from '@expo-google-fonts/russo-one';

export type TitleVariant = 'pop' | 'caps' | 'panel';

const GREEN = '#36e27a';
// плити з «шумним» фото-фоном (багато деталей): заголовок на них завжди на плашці
const NOISY = new Set(['street_night', 'mall', 'shelter', 'tck', 'nightclub', 'gym', 'grocery', 'metro', 'lobby']);

export function pickVariant(text: string, plateName?: string): TitleVariant {
  const noisy = plateName ? NOISY.has(plateName) : false;
  if (text.length > 24 || noisy) return 'panel';
  if (text.length <= 14) return 'pop';
  return 'caps';
}

function wrap(text: string, maxChars: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    if (cur && (cur + ' ' + w).length > maxChars) {
      lines.push(cur);
      cur = w;
    } else cur = cur ? cur + ' ' + w : w;
  }
  if (cur) lines.push(cur);
  return lines.slice(0, 3);
}

export function LessonTitle({ text, plateName, maxWidth, variant, accent = '#ffce4d' }: { text: string; plateName?: string; maxWidth: number; variant?: TitleVariant; accent?: string }) {
  const [fontsReady] = useFonts({ Oswald_700Bold, RussoOne_400Regular });
  const v = variant ?? pickVariant(text, plateName);
  const pop = v === 'pop';
  const family = pop ? 'RussoOne_400Regular' : 'Oswald_700Bold';
  const fs = Math.round(Math.min(pop ? 44 : v === 'caps' ? 40 : 30, Math.max(pop ? 30 : 26, maxWidth * (pop ? 0.115 : 0.095))));
  const label = pop ? text : text.toUpperCase();
  const cw = pop ? 0.64 : 0.56; // середня ширина літери в em
  const padX = v === 'panel' ? 18 : 12;
  const maxChars = Math.max(6, Math.floor((maxWidth - padX * 2 - 10) / (fs * cw)));
  const lines = wrap(label, maxChars);
  const lineH = fs * 1.08;
  const textW = Math.min(maxWidth - 6, Math.max(...lines.map((l) => l.length)) * fs * cw + padX * 2);
  const W = Math.ceil(textW + 18);
  const H = Math.ceil(lines.length * lineH + (v === 'panel' ? 26 : 22));
  const x0 = v === 'panel' ? 9 + padX : 9 + padX * 0.5;
  const base = (i: number) => (v === 'panel' ? 13 : 11) + fs * 0.86 + i * lineH;

  const T = ({ dx = 0, dy = 0, ...p }: { dx?: number; dy?: number; fill?: string; stroke?: string; strokeWidth?: number; opacity?: number }) => (
    <SvgText x={x0 + dx} fontFamily={family} fontSize={fs} fontWeight={pop ? '400' : '700'} letterSpacing={pop ? 0.5 : 0.6} strokeLinejoin="round" {...p}>
      {lines.map((l, i) => (
        <TSpan key={i} x={x0 + dx} y={base(i) + dy}>
          {l}
        </TSpan>
      ))}
    </SvgText>
  );

  let body: React.ReactNode;
  let rotate = '-2deg';
  let skew = '0deg';
  if (v === 'pop') {
    // T-POP: жовте тіло, біла обводка 6px, чорний кант 2px, 3D-зсув тіні
    rotate = '-3deg';
    body = (
      <>
        <T dx={5} dy={7} fill="rgba(0,0,0,0.5)" stroke="rgba(0,0,0,0.5)" strokeWidth={16} />
        <T fill="#000" stroke="#000" strokeWidth={16} />
        <T fill="#fff" stroke="#fff" strokeWidth={12} />
        <T fill={accent} stroke={accent} strokeWidth={0.5} />
      </>
    );
  } else if (v === 'caps') {
    // T-CAPS: біле тіло, зелена обводка, зелене світіння, нахил
    skew = '-6deg';
    body = (
      <>
        <T dx={3} dy={4} fill="rgba(0,0,0,0.5)" stroke="rgba(0,0,0,0.5)" strokeWidth={10} />
        <T fill={GREEN} stroke={GREEN} strokeWidth={22} opacity={0.14} />
        <T fill={GREEN} stroke={GREEN} strokeWidth={15} opacity={0.24} />
        <T fill="#fff" stroke="#fff" strokeWidth={13} />
        <T fill="#fff" stroke={GREEN} strokeWidth={8} />
        <T fill="#fff" stroke="#fff" strokeWidth={0.5} />
      </>
    );
  } else {
    // T-PANEL: чорна плашка з білою рамкою, хафтон, текст із зеленою обводкою (найчитабельніше на шумному фоні)
    skew = '-6deg';
    body = (
      <>
        <Defs>
          <Pattern id="halftone" patternUnits="userSpaceOnUse" width={8} height={8}>
            <Circle cx={4} cy={4} r={1.3} fill="rgba(54,226,122,0.9)" />
          </Pattern>
        </Defs>
        <Rect x={9 + 6} y={6 + 7} width={W - 18} height={H - 12} rx={3} fill="rgba(0,0,0,0.45)" />
        <Rect x={6} y={3} width={W - 12 + 6} height={H - 6 + 4} rx={4} fill="#000" />
        <Rect x={9} y={6} width={W - 18 + 6} height={H - 12 + 4} rx={2} fill="#fff" />
        <Rect x={12} y={9} width={W - 24 + 6} height={H - 18 + 4} fill="#111" />
        <Rect x={12} y={9} width={W - 24 + 6} height={H - 18 + 4} fill="url(#halftone)" opacity={0.5} />
        <G>
          <T fill={GREEN} stroke={GREEN} strokeWidth={14} opacity={0.2} />
          <T fill="#fff" stroke={GREEN} strokeWidth={5} />
          <T fill="#fff" stroke="#fff" strokeWidth={0.5} />
        </G>
      </>
    );
  }

  return (
    <View style={{ width: W + 6, height: H + 4, opacity: fontsReady ? 1 : 0, transform: [{ rotate }, { skewX: skew }] }} pointerEvents="none">
      <Svg width={W + 6} height={H + 4}>
        {body}
      </Svg>
    </View>
  );
}
