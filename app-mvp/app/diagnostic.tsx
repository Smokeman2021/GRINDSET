// Старий курс (модулі 01–10) прибрано з інтерфейсу (ТЗ 004, C1.0): цей маршрут лишився лише для старих посилань і веде до вибору вертикалі.
import { Redirect } from 'expo-router';

export default function LegacyRedirect() {
  return <Redirect href="/home" />;
}
