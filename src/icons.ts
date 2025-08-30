export function modeIcon(typeRaw?: string): string {
  const type = (typeRaw || '').toLowerCase();
  if (/(walk|foot|gå)/.test(type)) return 'mdi:walk';
  if (/(bus|buss)/.test(type)) return 'mdi:bus';
  if (/(train|tå|rail)/.test(type)) return 'mdi:train';
  if (/(metro|subway|tunnelbana)/.test(type)) return 'mdi:subway';
  if (/(tram|spårvagn)/.test(type)) return 'mdi:tram';
  if (/(ferry|boat|båt)/.test(type)) return 'mdi:ferry';
  if (/(car|bil|taxi)/.test(type)) return 'mdi:car';
  return 'mdi:map-marker-path';
}

export const arrowRight = 'mdi:chevron-right';
export const mapMarker = 'mdi:map-marker';

// Minimal MDI renderer for HA's built-in icon element if present
export function haIcon(name: string) {
  const el = document.createElement('ha-icon');
  el.setAttribute('icon', name);
  return el;
}
