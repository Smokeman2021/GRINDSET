import React from 'react';
import { View, Text, StyleSheet, TextStyle, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { C } from '../theme';

type Block =
  | { t: 'p'; text: string }
  | { t: 'ul'; items: string[] }
  | { t: 'ol'; items: string[] }
  | { t: 'code'; text: string }
  | { t: 'table'; rows: string[][] };

const isSeparatorRow = (cells: string[]) => cells.every((c) => /^:?-{2,}:?$/.test(c.trim()));

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
    if (trimmed.startsWith('```')) {
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
      blocks.push({ t: 'table', rows });
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
function inline(text: string, base: TextStyle, onRef?: (label: string) => void) {
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*\n]+\*|`[^`]+`|\[→[^\]]+\])/g);
  return parts.map((part, i) => {
    if (!part) return null;
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4)
      return (
        <Text key={i} style={[base, styles.bold]}>
          {part.slice(2, -2)}
        </Text>
      );
    if (part.startsWith('`') && part.endsWith('`'))
      return (
        <Text key={i} style={[base, styles.mono]}>
          {part.slice(1, -1)}
        </Text>
      );
    if (part.startsWith('[→'))
      return (
        <Text key={i} style={[base, styles.ref]} onPress={() => onRef?.(part.slice(2, -1).replace(/^\s*Бібліотека:\s*/i, '').trim())}>
          {'📚 ' + part.slice(2, -1).trim()}
        </Text>
      );
    if (part.startsWith('*') && part.endsWith('*') && part.length > 2)
      return (
        <Text key={i} style={[base, styles.italic]}>
          {part.slice(1, -1)}
        </Text>
      );
    return part;
  });
}

export function Markdown({ text, small }: { text: string; small?: boolean }) {
  const router = useRouter();
  const goRef = (label: string) => router.navigate({ pathname: '/library', params: { cat: label } });
  const blocks = parse(text);
  const pStyle = small ? [styles.p, styles.pSm] : styles.p;
  const liStyle = small ? [styles.liTxt, styles.liSm] : styles.liTxt;
  return (
    <View>
      {blocks.map((b, i) => {
        if (b.t === 'p') return <Text key={i} style={pStyle}>{inline(b.text, styles.p, goRef)}</Text>;
        if (b.t === 'code')
          return (
            <View key={i} style={styles.codeBox}>
              <Text style={styles.code}>{b.text}</Text>
            </View>
          );
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
                      <Text style={[styles.tdTxt, ri === 0 && styles.bold]}>{inline(cell, styles.tdTxt, goRef)}</Text>
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
                <Text style={liStyle}>{inline(it, styles.liTxt, goRef)}</Text>
              </View>
            ))}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  p: { color: C.txt, fontSize: 16, lineHeight: 25, marginBottom: 12 },
  pSm: { fontSize: 14, lineHeight: 21, marginBottom: 8 },
  liSm: { fontSize: 14, lineHeight: 21 },
  bold: { fontWeight: '800' },
  italic: { fontStyle: 'italic', color: C.muted },
  mono: { fontFamily: 'monospace', backgroundColor: C.panel2 },
  ref: { color: C.blue, fontWeight: '700' },
  list: { marginBottom: 10 },
  li: { flexDirection: 'row', gap: 8, marginBottom: 6, paddingRight: 8 },
  bullet: { color: C.accent, fontSize: 16, lineHeight: 24, minWidth: 18, fontWeight: '800' },
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
