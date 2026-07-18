export const AVATAR_EMOJIS = [
  '👩‍❤️‍👨', '💕', '✨', '🔥', '🌙', '☀️', '🌈', '🍕',
  '🐱', '🐶', '🌸', '🌊', '🌿', '☕', '🎵', '🚀',
] as const;

export const MOOD_EMOJIS = [
  '😊', '🥰', '😌', '🤩', '😴', '😢', '😠', '🤒',
] as const;

export const MOOD_LABELS: Record<string, string> = {
  '😊': 'happy',
  '🥰': 'love',
  '😌': 'calm',
  '🤩': 'excited',
  '😴': 'tired',
  '😢': 'sad',
  '😠': 'angry',
  '🤒': 'sick',
};

export function avatarEmoji(value: string | null | undefined): string {
  if (!value) return '👩‍❤️‍👨';
  if (AVATAR_EMOJIS.includes(value as never)) return value;
  const map: Record<string, string> = {
    couple: '👩‍❤️‍👨', heart: '💕', star: '✨', fire: '🔥', moon: '🌙', sun: '☀️',
    rainbow: '🌈', pizza: '🍕', cat: '🐱', dog: '🐶', flower: '🌸', wave: '🌊',
    leaf: '🌿', coffee: '☕', music: '🎵', rocket: '🚀',
  };
  return map[value] ?? value;
}

export function moodEmoji(value: string | null | undefined): string {
  if (!value) return '—';
  if (MOOD_EMOJIS.includes(value as never)) return value;
  const map: Record<string, string> = {
    happy: '😊', love: '🥰', calm: '😌', excited: '🤩',
    tired: '😴', sad: '😢', angry: '😠', sick: '🤒',
  };
  return map[value] ?? value;
}
