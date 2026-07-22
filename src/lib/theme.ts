export const THEMES = [
  { id: 'midnight', name: 'Midnight', swatch: '#7C3AED' },
  { id: 'blush', name: 'Blush', swatch: '#f43f5e' },
  { id: 'lavender', name: 'Lavender', swatch: '#8b5cf6' },
  { id: 'sunset', name: 'Sunset', swatch: '#f97316' },
  { id: 'ocean', name: 'Ocean', swatch: '#0ea5e9' },
  { id: 'classic', name: 'Classic Red', swatch: '#dc2626' },
] as const;

export type ThemeId = (typeof THEMES)[number]['id'];
const STORAGE_KEY = 'bond_theme';
const DEFAULT_THEME: ThemeId = 'midnight';

const THEME_COLORS: Record<ThemeId, string> = {
  midnight: '#0F172A',
  blush: '#fafaf9',
  lavender: '#fafaf9',
  sunset: '#fafaf9',
  ocean: '#fafaf9',
  classic: '#fafaf9',
};

export function applyTheme(id: ThemeId) {
  if (id === 'blush') {
    document.documentElement.removeAttribute('data-theme');
  } else {
    document.documentElement.setAttribute('data-theme', id);
  }
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', THEME_COLORS[id]);
  localStorage.setItem(STORAGE_KEY, id);
}

export function getSavedTheme(): ThemeId {
  const saved = localStorage.getItem(STORAGE_KEY);
  return (THEMES.find((t) => t.id === saved)?.id ?? DEFAULT_THEME) as ThemeId;
}

export function initTheme() {
  applyTheme(getSavedTheme());
}
