// Каркас системи вбрання (як у Героях 3: слот на кожну частину тіла).
// Поки без самого спорядження — фіксовані картинки з avatars.ts лишаються основним візуалом.
// Коли з'являться шар-по-шару рендери за архетипом+слотом, EQUIPMENT наповнюється, а
// CharacterAvatar перемикається на композицію шарів замість однієї картинки на стадію.

export type EquipSlot = 'head' | 'top' | 'bottom' | 'shoes' | 'accessory';

export const SLOTS: { id: EquipSlot; label: string; icon: string }[] = [
  { id: 'head', label: 'Голова', icon: '🧢' },
  { id: 'top', label: 'Верх', icon: '👕' },
  { id: 'bottom', label: 'Низ', icon: '👖' },
  { id: 'shoes', label: 'Взуття', icon: '👟' },
  { id: 'accessory', label: 'Аксесуар', icon: '⌚' },
];

export type EquipItem = {
  id: string;
  slot: EquipSlot;
  label: string;
  price?: number; // коїни в магазині; відсутнє = не продається окремо
  unlockedBy?: string; // id досягнення/рівня, якщо дається безкоштовно
};

// Порожньо навмисно: спорядження додається пізніше, коли буде арт для шарів.
export const EQUIPMENT: EquipItem[] = [];

export function itemsForSlot(slot: EquipSlot): EquipItem[] {
  return EQUIPMENT.filter((i) => i.slot === slot);
}
