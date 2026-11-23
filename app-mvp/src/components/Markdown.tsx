import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, TextStyle, ScrollView, Modal, Pressable, Image, Linking } from 'react-native';
import { Asset } from 'expo-asset';
import { useRouter } from 'expo-router';
import { handbookReferences } from '../data/academy/handbookData';
import { handbookImages } from '../data/academy/handbookImages';
import { Theme, useStyles } from '../theme';
import { findTerm, Term, TERM_RE } from '../data/glossary';

type Block =
  | { t: 'p'; text: string }
  | { t: 'h'; level: 1 | 2 | 3; text: string }
  | { t: 'ul'; items: string[] }
  | { t: 'ol'; items: string[] }
  | { t: 'code'; text: string }
  | { t: 'diagram'; alt: string; name: string }
  | { t: 'table'; rows: string[][] };

const isSeparatorRow = (cells: string[]) => cells.every((c) => /^:?-{2,}:?$/.test(c.trim()));

const normalizeTerm = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim();
const handbookTerms = new Map<string, Term>();
for (const { id, title, body } of handbookReferences) {
  if (!id.startsWith('HB-TERM-')) continue;
  const [def, alternatives] = body.split('\n\n');
  const synonyms = alternatives?.match(/^\*\*Також:\*\*\s*(.+)$/)?.[1].split(/\s*[,;]\s*/) ?? [];
  for (const alias of [title, ...synonyms]) {
    const key = normalizeTerm(alias);
    if (key.length >= 2 && !handbookTerms.has(key)) handbookTerms.set(key, { id, title, match: key, def, article: id });
  }
}
const termPatterns = Array.from(handbookTerms.keys())
  .sort((a, b) => b.length - a.length)
  .map((term) => term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/ /g, '\\s+'));
const handbookTermRe = termPatterns.length
  ? new RegExp(`(?<![\\p{L}\\p{N}_])(?:${termPatterns.join('|')})(?![\\p{L}\\p{N}_])`, 'iu')
  : null;

function parse(src: string): Block[] {
  const lines = src.replace(/\r\n/g, '\n').split('\n');
  const blocks: Block[] = [];
  let para: string[] = [];
  const flush = () => {
    if (para.length) blocks.push({ t: 'p', text: para.join('\n') });
    para = [];
  };
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    const heading = /^(#{1,6})\s+(.*)$/.exec(trimmed);
    const diagram = /^!\[([^\]]*)\]\(handbook:([\w.-]+\.png)\)$/.exec(trimmed);
    if (heading) {
      flush();
      blocks.push({ t: 'h', level: Math.min(heading[1].length, 3) as 1 | 2 | 3, text: heading[2] });
    } else if (diagram) {
      flush();
      blocks.push({ t: 'diagram', alt: diagram[1], name: diagram[2] });
    } else if (trimmed.startsWith('```')) {
      flush();
      const code: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith('```')) code.push(lines[i++]);
      blocks.push({ t: 'code', text: code.join('\n') });
    } else if (trimmed.startsWith('|')) {
      flush();
      const rows: string[][] = [];
      while (i < lines.length && lines[i].trim().startsWith('|')) {
        const cells = lines[i].trim().split('|').slice(1, -1).map((c) => c.trim());
        if (!isSeparatorRow(cells)) rows.push(cells);
        i++;
      }
      i--;
      if (rows.length) blocks.push({ t: 'table', rows });
    } else if (/^[-*] /.test(trimmed)) {
      flush();
      const items: string[] = [];
      while (i < lines.length && /^[-*] /.test(lines[i].trim())) items.push(lines[i++].trim().slice(2));
      i--;
      blocks.push({ t: 'ul', items });
    } else if (/^\d+\.\s/.test(trimmed)) {
      flush();
      const items: string[] = [];
      while (i < lines.length && /^\d+\.\s/.test(lines[i].trim())) items.push(lines[i++].trim().replace(/^\d+\.\s/, ''));
      i--;
      blocks.push({ t: 'ol', items });
    } else if (trimmed === '' || trimmed === '---') {
      flush();
    } else {
      para.push(line.trimEnd());
    }
  }
  flush();
  return blocks;
}

// **жирний**, *курсив*, `код`, [→ Бібліотека: X]
type Ctx = { onRef?: (label: string) => void; onArticle: (id: string) => void; onTerm?: (t: Term) => void; handbook: boolean; seen: Set<string>; styles: ReturnType<typeof makeStyles> };

// Звичайний текст: перше згадування терміна з глосарію підсвічується і відкриває пояснення
function plain(text: string, base: TextStyle, ctx: Ctx, keyPrefix: string): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  let rest = text;
  let n = 0;
  while (rest) {
    const m = ctx.handbook ? handbookTermRe?.exec(rest) : TERM_RE.exec(rest);
    if (!m) {
      out.push(rest);
      break;
    }
    const term = ctx.handbook ? handbookTerms.get(normalizeTerm(m[0])) : findTerm(m[0]);
    const end = m.index + m[0].length;
    if (!term || ctx.seen.has(term.id)) {
      out.push(rest.slice(0, end));
      rest = rest.slice(end);
      continue;
    }
    ctx.seen.add(term.id);
    if (m.index > 0) out.push(rest.slice(0, m.index));
    out.push(
      <Text key={`${keyPrefix}-${n++}`} style={[base, ctx.styles.term]} onPress={() => ctx.onTerm?.(term)}>
        {m[0]}
      </Text>
    );
    rest = rest.slice(end);
  }
  return out;
}

function inline(text: string, base: TextStyle, ctx: Ctx) {
  const parts = text.split(/(\[[^\]\n]+\]\((?:https:\/\/[^\s)]+|handbook:HB-[\p{L}\p{N}_.-]+)\)|\*\*[^*]+\*\*|\*[^*\n]+\*|`[^`]+`|\[→[^\]]+\])/gu);
  return parts.map((part, i) => {
    if (!part) return null;
    const link = /^\[([^\]\n]+)\]\((https:\/\/[^\s)]+|handbook:HB-[\p{L}\p{N}_.-]+)\)$/u.exec(part);
    if (link) {
      const [, label, url] = link;
      const open = () => {
        if (url.startsWith('handbook:')) ctx.onArticle(url.slice('handbook:'.length));
        else void Linking.openURL(url).catch(() => undefined);
      };
      return <Text key={i} style={[base, ctx.styles.ref]} accessibilityRole="link" onPress={open}>{label}</Text>;
    }
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4)
      return (
        <Text key={i} style={[base, ctx.styles.bold]}>
          {ctx.handbook ? plain(part.slice(2, -2), { ...base, ...ctx.styles.bold }, ctx, `bold-${i}`) : part.slice(2, -2)}
        </Text>
      );
    if (part.startsWith('`') && part.endsWith('`'))
      return (
        <Text key={i} style={[base, ctx.styles.mono]}>
          {part.slice(1, -1)}
        </Text>
      );
    if (part.startsWith('[→'))
      return (
        <Text key={i} style={[base, ctx.styles.ref]} onPress={() => ctx.onRef?.(part.slice(2, -1).replace(/^\s*Бібліотека:\s*/i, '').trim())}>
          {'📚 ' + part.slice(2, -1).trim()}
        </Text>
      );
    if (part.startsWith('*') && part.endsWith('*') && part.length > 2)
      return (
        <Text key={i} style={[base, ctx.styles.italic]}>
          {part.slice(1, -1)}
        </Text>
      );
    return <React.Fragment key={i}>{plain(part, base, ctx, String(i))}</React.Fragment>;
  });
}

export function Markdown({ text, small, handbook = false }: { text: string; small?: boolean; handbook?: boolean }) {
  const styles = useStyles(makeStyles);
  const router = useRouter();
  const goRef = (label: string) => router.navigate({ pathname: '/library', params: { cat: label } });
  const goArticle = (id: string) => router.push({ pathname: '/kb/[id]', params: { id } });
  const [popup, setPopup] = useState<Term | null>(null);
  const ctx: Ctx = { onRef: goRef, onArticle: goArticle, onTerm: setPopup, handbook, seen: new Set(), styles };
  const blocks = useMemo(() => parse(text), [text]);
  const pStyle = small ? [styles.p, styles.pSm] : styles.p;
  const liStyle = small ? [styles.liTxt, styles.liSm] : styles.liTxt;
  return (
    <View>
      {blocks.map((b, i) => {
        if (b.t === 'p') return <Text key={i} style={pStyle}>{inline(b.text, styles.p, ctx)}</Text>;
        if (b.t === 'h')
          return (
            <Text key={i} style={[styles.h, b.level === 1 && styles.h1, b.level === 3 && styles.h3]}>
              {b.text}
            </Text>
          );
        if (b.t === 'code')
          return (
            <View key={i} style={styles.codeBox}>
              <Text style={styles.code}>{b.text}</Text>
            </View>
          );
        if (b.t === 'diagram') {
          const source = handbookImages[b.name];
          if (!source) return b.alt ? <Text key={i} style={pStyle}>{b.alt}</Text> : null;
          const { width, height } = Asset.fromModule(source);
          return (
            <Image key={i} source={source} resizeMode="contain" accessible accessibilityLabel={b.alt || 'Схема з посібника'} style={[styles.diagram, { aspectRatio: width && height ? width / height : 1.5 }]} />
          );
        }
        if (b.t === 'table') {
          const cols = Math.max(...b.rows.map((r) => r.length));
          // 4+ колонок: ширина за змістом і горизонтальна прокрутка, щоб слова не рвались по літерах
          const wide = cols >= 4;
          const widths = Array.from({ length: cols }, (_, c) =>
            Math.min(180, Math.max(62, Math.max(...b.rows.map((r) => (r[c] ?? '').length)) * 7 + 20))
          );
          const table = (
            <View style={[styles.table, wide && { marginBottom: 0 }]}>
              {b.rows.map((row, ri) => (
                <View key={ri} style={[styles.tr, ri === 0 && styles.trHead, ri === b.rows.length - 1 && { borderBottomWidth: 0 }]}>
                  {row.map((cell, ci) => (
                    <View
                      key={ci}
                      style={[
                        styles.td,
                        wide && { flexGrow: 0, flexShrink: 0, flexBasis: widths[ci], width: widths[ci] },
                        ci === row.length - 1 && { borderRightWidth: 0 },
                      ]}
                    >
                      <Text style={[styles.tdTxt, ri === 0 && styles.bold]}>{inline(cell, styles.tdTxt, ctx)}</Text>
                    </View>
                  ))}
                </View>
              ))}
            </View>
          );
          return wide ? (
            <ScrollView key={i} horizontal showsHorizontalScrollIndicator style={{ marginBottom: 14 }}>
              {table}
            </ScrollView>
          ) : (
            <View key={i}>{table}</View>
          );
        }
        const items = b.items;
        return (
          <View key={i} style={styles.list}>
            {items.map((it, ii) => (
              <View key={ii} style={styles.li}>
                <Text style={styles.bullet}>{b.t === 'ol' ? `${ii + 1}.` : '•'}</Text>
                <Text style={liStyle}>{inline(it, styles.liTxt, ctx)}</Text>
              </View>
            ))}
          </View>
        );
      })}
      <Modal transparent animationType="fade" visible={!!popup} onRequestClose={() => setPopup(null)}>
        <Pressable style={styles.backdrop} onPress={() => setPopup(null)}>
          <View style={styles.sheet}>
            <Text style={styles.sheetTag}>ТЕРМІН</Text>
            <Text style={styles.sheetTitle}>{popup?.title}</Text>
            <Text style={styles.sheetDef}>{popup?.def}</Text>
            {/* термін → стаття «Бази» за спільним ID; «Назад» зі статті повертає в той самий крок уроку з відповіддю (урок лишається в стеку) */}
            {popup?.article && (
              <Pressable
                onPress={() => {
                  const id = popup.article!;
                  setPopup(null);
                  router.push({ pathname: '/kb/[id]', params: { id } });
                }}
                style={styles.sheetBtn}
                accessibilityRole="button"
              >
                <Text style={styles.sheetBtnTxt}>Відкрити статтю →</Text>
              </Pressable>
            )}
            <Text style={styles.sheetHint}>Торкнись будь-де, щоб закрити</Text>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const makeStyles = (C: Theme) => StyleSheet.create({
  p: { color: C.txt, fontSize: 16, lineHeight: 25, marginBottom: 12 },
  h: { color: C.txt, fontWeight: '900', fontSize: 17, marginTop: 14, marginBottom: 8 },
  h1: { fontSize: 20 },
  h3: { fontSize: 15, color: C.accentTxt, letterSpacing: 0.4 },
  pSm: { fontSize: 14, lineHeight: 21, marginBottom: 8 },
  liSm: { fontSize: 14, lineHeight: 21 },
  term: { color: C.goldTxt, textDecorationLine: 'underline', textDecorationStyle: 'dotted', textDecorationColor: C.gold },
  backdrop: { flex: 1, backgroundColor: C.overlay, justifyContent: 'flex-end' },
  sheet: { backgroundColor: C.panel, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 22, paddingBottom: 34, borderTopWidth: 3, borderTopColor: C.gold },
  sheetTag: { color: C.goldTxt, fontWeight: '900', fontSize: 11, letterSpacing: 1 },
  sheetTitle: { color: C.txt, fontWeight: '900', fontSize: 22, marginTop: 4 },
  sheetDef: { color: C.txt, fontSize: 16, lineHeight: 24, marginTop: 10 },
  sheetHint: { color: C.muted, fontSize: 12, marginTop: 14 },
  sheetBtn: { marginTop: 14, alignSelf: 'flex-start', paddingVertical: 10, paddingHorizontal: 16, borderRadius: 12, borderWidth: 2, borderBottomWidth: 4, borderColor: C.gold, backgroundColor: C.panel2 },
  sheetBtnTxt: { color: C.goldTxt, fontWeight: '900', fontSize: 14 },
  bold: { fontWeight: '800' },
  italic: { fontStyle: 'italic', color: C.muted },
  mono: { fontFamily: 'monospace', backgroundColor: C.panel2 },
  ref: { color: C.blueTxt, fontWeight: '700' },
  diagram: { width: '100%', marginBottom: 14 },
  list: { marginBottom: 10 },
  li: { flexDirection: 'row', gap: 8, marginBottom: 6, paddingRight: 8 },
  bullet: { color: C.accentTxt, fontSize: 16, lineHeight: 24, minWidth: 18, fontWeight: '800' },
  liTxt: { color: C.txt, fontSize: 16, lineHeight: 24, flex: 1 },
  codeBox: {
    backgroundColor: C.panel2,
    borderLeftColor: C.accent,
    borderLeftWidth: 3,
    borderRadius: 10,
    padding: 14,
    marginBottom: 14,
  },
  code: { color: C.txt, fontFamily: 'monospace', fontSize: 13, lineHeight: 20 },
  table: {
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 14,
  },
  tr: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: C.line },
  trHead: { backgroundColor: C.panel2 },
  td: { flex: 1, padding: 8, borderRightWidth: 1, borderRightColor: C.line, justifyContent: 'center' },
  tdTxt: { color: C.txt, fontSize: 13, lineHeight: 18 },
});
