import { Platform, Share } from 'react-native';

// Віддає користувачу файл: у вебі скачування, на телефоні системне меню «Поділитися» (текст CSV)
export async function saveCsv(filename: string, csv: string): Promise<void> {
  if (Platform.OS === 'web' && typeof document !== 'undefined') {
    // BOM, щоб Excel правильно відкрив кирилицю
    const blob = new Blob(['﻿', csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return;
  }
  await Share.share({ title: filename, message: csv });
}

// Копіювання в буфер (веб). Повертає false, якщо недоступно: тоді код можна виділити й скопіювати вручну
export async function copyText(text: string): Promise<boolean> {
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // нижче
  }
  return false;
}
