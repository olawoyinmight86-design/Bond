export const THEMES = [
  { id: 'blush', name: 'Blush', swatch: '#f43f5e' },
  { id: 'lavender', name: 'Lavender', swatch: '#8b5cf6' },
  { id: 'sunset', name: 'Sunset', swatch: '#f97316' },
  { id: 'ocean', name: 'Ocean', swatch: '#0ea5e9' },
  { id: 'classic', name: 'Classic Red', swatch: '#dc2626' },
] as const;

export type ThemeId = (typeof THEMES)[number]['id'];
const STORAGE_KEY = 'bond_theme';

export function applyTheme(id: ThemeId) {
  if (id === 'blush') {
    document.documentElement.removeAttribute('data-theme');
  } else {
    document.documentElement.setAttribute('data-theme', id);
  }
  localStorage.setItem(STORAGE_KEY, id);
}

export function getSavedTheme(): ThemeId {
  const saved = localStorage.getItem(STORAGE_KEY);
  return (THEMES.find((t) => t.id === saved)?.id ?? 'blush') as ThemeId;
}

export function initTheme() {
  applyTheme(getSavedTheme());
}
