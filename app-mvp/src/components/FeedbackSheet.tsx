import React, { useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { getBackend } from '../cloud/backend';
import { useCloud } from '../cloud/cloudStore';
import type { FeedbackKind } from '../cloud/types';
import { Theme, useStyles, useTheme } from '../theme';

const MAX = 2000;

// Форма «Повідомити про помилку / запропонувати». Пише у таблицю feedback (автора й нік додає сервер).
// context — де саме тестер: екран, id уроку, номер кроку; адмін бачить це в списку відгуків.
export function FeedbackSheet({ visible, onClose, context }: { visible: boolean; onClose: () => void; context: { screen: string; lessonId?: string; stepIdx?: number } }) {
  const C = useTheme();
  const styles = useStyles(makeStyles);
  const [kind, setKind] = useState<FeedbackKind>('bug');
  const [body, setBody] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');

  const close = () => {
    setState('idle');
    setBody('');
    onClose();
  };

  const send = async () => {
    const backend = getBackend();
    const text = body.trim();
    if (!backend || !text) return;
    setState('sending');
    try {
      await backend.sendFeedback({ kind, body: text, ...context });
      setState('sent');
    } catch (e) {
      if (e instanceof Error && e.message === 'replaced') void useCloud.getState().verify();
      setState('error');
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={close}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          {state === 'sent' ? (
            <>
              <Text style={styles.title}>Дякуємо! 🙌</Text>
              <Text style={styles.sub}>Відгук дійшов до автора.</Text>
              <Pressable onPress={close} style={[styles.btn, styles.btnOn]}>
                <Text style={[styles.btnTxt, { color: C.onAccent }]}>Закрити</Text>
              </Pressable>
            </>
          ) : (
            <>
              <Text style={styles.title}>Повідомити про помилку / запропонувати</Text>
              <View style={styles.kinds}>
                <Pressable onPress={() => setKind('bug')} style={[styles.kind, kind === 'bug' && styles.kindOn]}>
                  <Text style={[styles.kindTxt, kind === 'bug' && { color: C.onAccent }]}>🐞 Помилка</Text>
                </Pressable>
                <Pressable onPress={() => setKind('idea')} style={[styles.kind, kind === 'idea' && styles.kindOn]}>
                  <Text style={[styles.kindTxt, kind === 'idea' && { color: C.onAccent }]}>💡 Ідея</Text>
                </Pressable>
              </View>
              <TextInput
                value={body}
                onChangeText={(t) => setBody(t.slice(0, MAX))}
                placeholder={kind === 'bug' ? 'Що пішло не так? Що ти очікував?' : 'Що б ти додав або змінив?'}
                placeholderTextColor={C.muted}
                multiline
                style={styles.input}
              />
              <Text style={styles.count}>
                {body.length}/{MAX}
                {context.lessonId ? ` · урок ${context.lessonId}` : ''}
              </Text>
              {state === 'error' && <Text style={styles.err}>Не вдалося надіслати. Перевір інтернет і спробуй ще раз.</Text>}
              <View style={styles.actions}>
                <Pressable onPress={close} style={styles.btn}>
                  <Text style={styles.btnTxt}>Скасувати</Text>
                </Pressable>
                <Pressable onPress={() => void send()} disabled={!body.trim() || state === 'sending'} style={[styles.btn, styles.btnOn, (!body.trim() || state === 'sending') && { opacity: 0.5 }]}>
                  {state === 'sending' ? <ActivityIndicator color={C.onAccent} /> : <Text style={[styles.btnTxt, { color: C.onAccent }]}>Надіслати</Text>}
                </Pressable>
              </View>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

const makeStyles = (C: Theme) =>
  StyleSheet.create({
    backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', padding: 16 },
    sheet: { backgroundColor: C.panel, borderRadius: 20, borderWidth: 2, borderBottomWidth: 5, borderColor: C.line, padding: 16, width: '100%', maxWidth: 460, alignSelf: 'center' },
    title: { color: C.txt, fontSize: 17, fontWeight: '900', marginBottom: 12 },
    sub: { color: C.muted, fontSize: 13, marginBottom: 14 },
    kinds: { flexDirection: 'row', gap: 8, marginBottom: 12 },
    kind: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 12, borderWidth: 2, borderColor: C.line, backgroundColor: C.panel2 },
    kindOn: { backgroundColor: C.accent, borderColor: C.accentEdge },
    kindTxt: { color: C.txt, fontWeight: '800', fontSize: 14 },
    input: { minHeight: 110, maxHeight: 220, textAlignVertical: 'top', color: C.txt, backgroundColor: C.panel2, borderRadius: 12, borderWidth: 2, borderColor: C.line, padding: 12, fontSize: 15 },
    count: { color: C.muted, fontSize: 11, marginTop: 6 },
    err: { color: C.redTxt, fontSize: 12, fontWeight: '700', marginTop: 8 },
    actions: { flexDirection: 'row', gap: 10, marginTop: 14 },
    btn: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 12, borderRadius: 12, borderWidth: 2, borderBottomWidth: 4, borderColor: C.line, backgroundColor: C.panel2 },
    btnOn: { backgroundColor: C.accent, borderColor: C.accentEdge },
    btnTxt: { color: C.txt, fontWeight: '800', fontSize: 14 },
  });
