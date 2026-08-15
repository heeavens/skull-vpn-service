import type { IconName } from '$lib/components/ui';

export const sectionOrder = ['support', 'home', 'profile'] as const;

export type SectionId = (typeof sectionOrder)[number];

export interface NavigationItem {
  id: SectionId;
  label: string;
  icon: IconName;
}

export const navigationItems: readonly NavigationItem[] = [
  { id: 'support', label: 'Поддержка', icon: 'help' },
  { id: 'home', label: 'Главная', icon: 'home' },
  { id: 'profile', label: 'Профиль', icon: 'user' }
];

export function clampSectionIndex(index: number): number {
  return Math.max(0, Math.min(sectionOrder.length - 1, index));
}
