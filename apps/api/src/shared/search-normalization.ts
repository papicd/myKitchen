const ACCENT_CHAR_CLASS: Record<string, string> = {
  c: '[cčć]',
  č: '[cčć]',
  ć: '[cčć]',
  s: '[sš]',
  š: '[sš]',
  z: '[zž]',
  ž: '[zž]',
};

export function normalizeSearchText(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'dj');
}

export function buildAccentInsensitivePattern(value: string) {
  const normalized = value.trim().toLowerCase();
  let pattern = '';

  for (let index = 0; index < normalized.length; index += 1) {
    const current = normalized[index];
    const next = normalized[index + 1];

    if (current === 'd' && next === 'j') {
      pattern += '(?:dj|đ)';
      index += 1;
      continue;
    }

    if (current === 'đ') {
      pattern += '(?:đ|dj)';
      continue;
    }

    pattern += ACCENT_CHAR_CLASS[current] ?? escapeRegExp(current);
  }

  return pattern;
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
