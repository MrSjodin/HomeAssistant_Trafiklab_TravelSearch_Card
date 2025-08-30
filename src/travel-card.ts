import { LitElement, html, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { cardStyles } from './style';
import { arrowRight, haIcon, mapMarker, modeIcon } from './icons';
import type { Hass, HassEntity, Leg, StopLike, TravelCardConfig, TripLike } from './types';

const CARD_TYPE = 'trafiklab-travel-card';
const CARD_NAME = 'Trafiklab Travel Search';
const CARD_DESC = 'Shows end-to-end trips from Resrobot Travel sensor (Trafiklab Integration).';

@customElement(CARD_TYPE)
export class TrafiklabTravelCard extends LitElement {
  static styles = cardStyles;

  @property({ attribute: false }) public hass!: Hass;
  @state() private _config!: TravelCardConfig;

  setConfig(config: TravelCardConfig) {
    if (!config || !config.entity) throw new Error('entity is required');
    this._config = { show_details: false, show_map_links: true, max_legs: 12, ...config };
  }

  getCardSize() {
    return 3;
  }

  private get entity(): HassEntity | undefined {
    return this.hass?.states?.[this._config?.entity];
  }

  private get legs(): Leg[] {
    const entity = this.entity;
    if (!entity) return [];
    const a = entity.attributes || {};
    let legs: unknown = a.legs;
    if (!Array.isArray(legs)) legs = a.trip?.legs;
    if (!Array.isArray(legs)) legs = Array.isArray(a.trips) ? a.trips[0]?.legs : undefined;
    if (!Array.isArray(legs)) legs = [];
    return (legs as any[]).filter(Boolean);
  }

  private static stop(obj?: StopLike | Record<string, any>): StopLike | undefined {
    if (!obj || typeof obj !== 'object') return undefined;
    const s = obj as any;
    return {
      name: s.name ?? s.stop_name ?? s.stop ?? s.id ?? undefined,
      id: s.id ?? s.stop_id ?? undefined,
      lat: s.lat ?? s.latitude ?? undefined,
      lon: s.lon ?? s.lng ?? s.longitude ?? undefined,
    };
  }

  private static legType(leg: Leg): string {
    const t = (leg.type || leg.mode || leg.product?.category || leg.product?.mode || '').toString();
    return t.toLowerCase();
  }

  private static legLine(leg: Leg): string | undefined {
    const l = leg.line ?? leg.number ?? leg.product?.line;
    return l !== undefined && l !== null ? String(l) : undefined;
  }

  private static fromStop(leg: Leg): StopLike | undefined {
    return this.stop((leg as any).from || (leg as any).origin);
  }
  private static toStop(leg: Leg): StopLike | undefined {
    return this.stop((leg as any).to || (leg as any).destination);
  }

  private firstCoord(): StopLike | undefined {
    const ls = this.legs;
    if (ls.length === 0) return undefined;
    const s = TrafiklabTravelCard.fromStop(ls[0]);
    if (s?.lat != null && s?.lon != null) return s;
    // fallback to entity-level coords
    const a = this.entity?.attributes || {};
    const lat = a.start_lat ?? a.origin_lat ?? a.lat ?? undefined;
    const lon = a.start_lon ?? a.origin_lon ?? a.lon ?? a.lng ?? undefined;
    if (lat != null && lon != null) return { name: a.start_name ?? a.origin_name, lat, lon };
    return undefined;
  }

  private lastCoord(): StopLike | undefined {
    const ls = this.legs;
    if (ls.length === 0) return undefined;
    const s = TrafiklabTravelCard.toStop(ls[ls.length - 1]);
    if (s?.lat != null && s?.lon != null) return s;
    const a = this.entity?.attributes || {};
    const lat = a.end_lat ?? a.destination_lat ?? undefined;
    const lon = a.end_lon ?? a.destination_lon ?? undefined;
    if (lat != null && lon != null) return { name: a.end_name ?? a.destination_name, lat, lon };
    return undefined;
  }

  private mapLink(s?: StopLike): string | undefined {
    if (!s || s.lat == null || s.lon == null) return undefined;
    const lat = Number(s.lat).toFixed(6);
    const lon = Number(s.lon).toFixed(6);
    return `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lon}#map=16/${lat}/${lon}`;
  }

  protected render() {
    const entity = this.entity;
    if (!entity) return html`<ha-card><div class="header">${this._config?.title || CARD_NAME}</div><div class="muted">Entity not found: ${this._config?.entity}</div></ha-card>`;
    const legs = this.legs.slice(0, this._config.max_legs);
    const start = this.firstCoord();
    const end = this.lastCoord();

    return html`
      <ha-card>
        ${this._config.title ? html`<div class="header">${this._config.title}</div>` : nothing}

        <div class="trip">
          ${start && (start.lat != null && start.lon != null)
            ? html`<span class="leg map-link">${this.renderIcon(mapMarker)} ${this._config.show_map_links ? html`<a href="${this.mapLink(start)}" target="_blank" rel="noreferrer">${start.name || 'Start'}</a>` : (start.name || 'Start')}</span>`
            : nothing}

          ${legs.map((leg, i) => this.renderLeg(leg, i < legs.length - 1))}

          ${end && (end.lat != null && end.lon != null)
            ? html`${this.renderArrow()}<span class="leg map-link">${this.renderIcon(mapMarker)} ${this._config.show_map_links ? html`<a href="${this.mapLink(end)}" target="_blank" rel="noreferrer">${end.name || 'End'}</a>` : (end.name || 'End')}</span>`
            : nothing}
        </div>

        ${this._config.show_details ? this.renderDetails(legs) : nothing}
      </ha-card>
    `;
  }

  private renderLeg(leg: Leg, showArrow: boolean) {
    const type = TrafiklabTravelCard.legType(leg);
    const line = TrafiklabTravelCard.legLine(leg);
    const from = TrafiklabTravelCard.fromStop(leg);
    const to = TrafiklabTravelCard.toStop(leg);
    const label = [type ? this.prettyType(type) : undefined, line ? ` ${line}` : undefined]
      .filter(Boolean)
      .join('');

    return html`
      <span class="leg">
        ${this.renderIcon(modeIcon(type))}
        <span class="line">${label || 'Leg'}</span>
        ${from?.name ? html`<span class="muted">(${from.name}${to?.name ? ` → ${to.name}` : ''})</span>` : nothing}
      </span>
      ${showArrow ? this.renderArrow() : nothing}
    `;
  }

  private renderDetails(legs: Leg[]) {
    const rows = legs.map((l) => {
      const from = TrafiklabTravelCard.fromStop(l);
      const to = TrafiklabTravelCard.toStop(l);
      const dep = l.departure ? this.shortTime(l.departure) : undefined;
      const arr = l.arrival ? this.shortTime(l.arrival) : undefined;
      const type = this.prettyType(TrafiklabTravelCard.legType(l));
      const line = TrafiklabTravelCard.legLine(l);
      return html`<div>• ${type}${line ? ` ${line}` : ''}: ${from?.name || '—'} ${dep ? `(${dep})` : ''} → ${to?.name || '—'} ${arr ? `(${arr})` : ''}</div>`;
    });
    return html`<div class="meta">${rows}</div>`;
  }

  private prettyType(t?: string): string {
    if (!t) return '';
    const s = t.toLowerCase();
    if (/walk|foot|gå/.test(s)) return 'Walk';
    if (/bus|buss/.test(s)) return 'Bus';
    if (/train|tå|rail/.test(s)) return 'Train';
    if (/metro|subway|tunnelbana/.test(s)) return 'Metro';
    if (/tram|spårvagn/.test(s)) return 'Tram';
    if (/ferry|boat|båt/.test(s)) return 'Ferry';
    if (/car|bil|taxi/.test(s)) return 'Car';
    return t.charAt(0).toUpperCase() + t.slice(1);
  }

  private shortTime(s: string): string {
    try {
      const d = new Date(s);
      if (!isNaN(d.getTime())) {
        return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      }
    } catch (_) {}
    return s;
  }

  private renderIcon(name: string) {
    // Prefer ha-icon if available, otherwise simple fallback
    // @ts-ignore
    if (customElements?.get?.('ha-icon')) {
      return haIcon(name);
    }
    return html`<span class="icon">${name}</span>`;
  }

  private renderArrow() {
    return html`<span class="arrow">${this.renderIcon(arrowRight)}</span>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    [CARD_TYPE]: TrafiklabTravelCard;
  }
}

// Register with Lovelace UI as a custom card entry
// @ts-ignore
window.customCards = window.customCards || [];
// @ts-ignore
window.customCards.push({
  type: CARD_TYPE,
  name: CARD_NAME,
  description: CARD_DESC,
  preview: true,
});
