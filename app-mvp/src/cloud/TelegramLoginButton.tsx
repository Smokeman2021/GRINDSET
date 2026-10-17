import React from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import type { TelegramPayload } from './shared/telegramAuth';
import { Theme, useStyles } from '../theme';

// Офіційний Telegram Login Widget (лише веб). Бот має бути привʼязаний до домену сайту командою /setdomain у @BotFather.
// Віджет повертає підписані дані (id, імʼя, @username, час, hash) у функцію з data-onauth; перевірка підпису відбувається на сервері.
export function TelegramLoginButton({ bot, onAuth }: { bot: string; onAuth: (p: TelegramPayload) => void }) {
  const styles = useStyles(makeStyles);

  React.useEffect(() => {
    if (Platform.OS !== 'web' || !bot) return;
    const w = window as unknown as Record<string, unknown>;
    w.grindsetTelegramAuth = (u: TelegramPayload) => onAuth(u);
    const slot = document.getElementById('tg-login-slot');
    if (!slot) return;
    slot.innerHTML = '';
    const s = document.createElement('script');
    s.async = true;
    s.src = 'https://telegram.org/js/telegram-widget.js?22';
    s.setAttribute('data-telegram-login', bot);
    s.setAttribute('data-size', 'large');
    s.setAttribute('data-radius', '14');
    s.setAttribute('data-userpic', 'false');
    s.setAttribute('data-onauth', 'grindsetTelegramAuth(user)');
    slot.appendChild(s);
    return () => {
      slot.innerHTML = '';
      delete w.grindsetTelegramAuth;
    };
  }, [bot, onAuth]);

  if (Platform.OS !== 'web') return <Text style={styles.note}>Вхід через Telegram доступний у веб-версії застосунку.</Text>;
  if (!bot) return <Text style={styles.note}>Не задано імʼя бота (EXPO_PUBLIC_TELEGRAM_BOT).</Text>;
  return <View nativeID="tg-login-slot" style={styles.slot} />;
}

const makeStyles = (C: Theme) =>
  StyleSheet.create({
    slot: { minHeight: 48, alignItems: 'center', justifyContent: 'center' },
    note: { color: C.muted, fontSize: 13, textAlign: 'center' },
  });
