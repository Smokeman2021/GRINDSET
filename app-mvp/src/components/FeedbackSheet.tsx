import React, { useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getBackend } from '../cloud/backend';
import { useCloud } from '../cloud/cloudStore';
import { CLOUD_MODE } from '../cloud/config';
import type { FeedbackKind } from '../cloud/types';
import { FB_KINDS, contextLine, feedbackContext, type FbContext } from '../cloud/shared/feedbackQueue';
import { UI_BUILD } from '../version';
import { Theme, useStyles, useTheme } from '../theme';

const MAX = 2000;

// Форма відгуку (ТЗ 004, E2): коментар, пропозиція, баг. Пише у таблицю feedback (автора й нік додає сервер).
// Контекст підставляється автоматично: збірка, екран, гілка, урок, крок, крок тренажера. Тестер нічого не вводить, лише бачить рядок контексту.
export function FeedbackSheet({ visible, onClose, context }: { visible: boolean; onClose: () => void; context: FbContext }) {
  const C = useTheme();
  const styles = useStyles(makeStyles);
  const [kind, setKind] = useState<FeedbackKind>('comment');
  const [body, setBody] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const ctx = feedbackContext(context, UI_BUILD);

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
      await backend.sendFeedback({ kind, body: text, ...ctx });
      setState('sent');
    } catch (e) {
      if (e instanceof Error && e.message === 'replaced') void useCloud.getState().verify();
      setState('error');
    }
  };

  const placeholder = kind === 'bug' ? 'Що пішло не так? Що ти очікував?' : kind === 'proposal' ? 'Що б ти додав або змінив?' : 'Що думаєш про цей екран?';

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
              <Text style={styles.title}>Відгук про цей екран</Text>
              <View style={styles.kinds}>
                {FB_KINDS.map((k) => (
                  <Pressable key={k.kind} onPress={() => setKind(k.kind)} style={[styles.kind, kind === k.kind && styles.kindOn]} accessibilityRole="button" accessibilityState={{ selected: kind === k.kind }}>
                    <Text style={[styles.kindTxt, kind === k.kind && { color: C.onAccent }]}>
                      {k.icon} {k.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
              <TextInput value={body} onChangeText={(t) => setBody(t.slice(0, MAX))} placeholder={placeholder} placeholderTextColor={C.muted} multiline style={styles.input} />
              <Text style={styles.count}>
                {body.length}/{MAX}
              </Text>
              <Text style={styles.ctx}>Додається автоматично: {contextLine(ctx)}</Text>
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

// Кнопка відгуку для екранів без власної шапки з 🐞: невелика плаваюча кнопка в правому верхньому куті
export function FeedbackFab({ context, top = 8 }: { context: FbContext; top?: number }) {
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  if (CLOUD_MODE === 'off') return null;
  return (
    <>
      <Pressable onPress={() => setOpen(true)} hitSlop={8} accessibilityRole="button" accessibilityLabel="Відгук про цей екран" style={[fab.btn, { top: insets.top + top }]}>
        <Text style={fab.txt}>🐞</Text>
      </Pressable>
      <FeedbackSheet visible={open} onClose={() => setOpen(false)} context={context} />
    </>
  );
}

const fab = StyleSheet.create({
  btn: { position: 'absolute', right: 10, width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(13,15,20,0.45)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)', zIndex: 50 },
  txt: { fontSize: 17 },
});

const makeStyles = (C: Theme) =>
  StyleSheet.create({
    backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', padding: 16 },
    sheet: { backgroundColor: C.panel, borderRadius: 20, borderWidth: 2, borderBottomWidth: 5, borderColor: C.line, padding: 16, width: '100%', maxWidth: 460, alignSelf: 'center' },
    title: { color: C.txt, fontSize: 17, fontWeight: '900', marginBottom: 12 },
    sub: { color: C.muted, fontSize: 13, marginBottom: 14 },
    kinds: { flexDirection: 'row', gap: 6, marginBottom: 12 },
    kind: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 12, borderWidth: 2, borderColor: C.line, backgroundColor: C.panel2 },
    kindOn: { backgroundColor: C.accent, borderColor: C.accentEdge },
    kindTxt: { color: C.txt, fontWeight: '800', fontSize: 13 },
    input: { minHeight: 110, maxHeight: 220, textAlignVertical: 'top', color: C.txt, backgroundColor: C.panel2, borderRadius: 12, borderWidth: 2, borderColor: C.line, padding: 12, fontSize: 15 },
    count: { color: C.muted, fontSize: 11, marginTop: 6 },
    ctx: { color: C.muted, fontSize: 11, marginTop: 4, fontStyle: 'italic' },
    err: { color: C.redTxt, fontSize: 12, fontWeight: '700', marginTop: 8 },
    actions: { flexDirection: 'row', gap: 10, marginTop: 14 },
    btn: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 12, borderRadius: 12, borderWidth: 2, borderBottomWidth: 4, borderColor: C.line, backgroundColor: C.panel2 },
    btnOn: { backgroundColor: C.accent, borderColor: C.accentEdge },
    btnTxt: { color: C.txt, fontWeight: '800', fontSize: 14 },
  });
