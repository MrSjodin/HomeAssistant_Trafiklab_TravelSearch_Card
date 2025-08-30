/*
  Trafiklab Travel Card
  Home Assistant Lovelace custom card that displays end-to-end trips from the Trafiklab integration (Resrobot Travel search).
*/

import { css, html, LitElement, nothing } from 'lit';

// Import editor for HA UI config (bundled together by Vite)
import './trafiklab-travel-card-editor';
import en from './translations/en.json';
import sv from './translations/sv.json';

type HassEntity = {
  entity_id: string;
  state: string;
  attributes: Record<string, any>;
};

type HomeAssistant = {
  states: Record<string, HassEntity>;
  formatEntityState?(entity: HassEntity): string;
  locale?: any;
  language?: string;
};

export interface TravelCardConfig {
  type: string;
  entity: string; // sensor entity id
  show_details?: boolean; // show extra details under each leg
  show_map_links?: boolean; // show map links for start/end coordinates when coords are available
  max_legs?: number; // per-trip leg cap to avoid overflow, default 12
  max_items?: number; // number of trips to show, default 3
}

declare global {
  interface Window {
    customCards?: Array<any>;
  }
  interface HTMLElementTagNameMap {
    'trafiklab-travel-card': TrafiklabTravelCard;
  }
}

const CARD_TYPE = 'trafiklab-travel-card';

export class TrafiklabTravelCard extends LitElement {
  private _hass!: HomeAssistant;
  set hass(hass: HomeAssistant) {
    this._hass = hass;
    this.requestUpdate();
  }
  get hass(): HomeAssistant {
    return this._hass;
  }

  private _config?: TravelCardConfig;

  static getStubConfig(): Partial<TravelCardConfig> {
  return { show_details: false, show_map_links: true, max_legs: 12, max_items: 3 };
  }

  static getConfigElement(): HTMLElement {
    return document.createElement('trafiklab-travel-card-editor');
  }

  setConfig(config: TravelCardConfig): void {
    if (!config || !config.entity) {
      throw new Error('Required property missing: entity');
    }
    this._config = {
      show_details: false,
      show_map_links: true,
      max_legs: 12,
      max_items: 3,
      ...config,
      type: CARD_TYPE,
    };
  }

  getCardSize(): number {
    const trips = this._getTrips();
    const shown = Math.min(trips.length || 1, this._config?.max_items ?? 3);
    // Each trip is roughly 2 rows (pills + details) + header/footer
    return Math.max(3, shown * (this._config?.show_details ? 2 : 1) + 1);
  }

  private _getEntity(): HassEntity | undefined {
    const entityId = this._config?.entity;
    if (!entityId) return undefined;
    return this.hass?.states?.[entityId];
  }

  private _t(path: string, vars?: Record<string, any>): string {
    const lang = this.hass?.locale?.language || this.hass?.language || 'en';
    const dict = String(lang).toLowerCase().startsWith('sv') ? (sv as any) : (en as any);
    const value = path.split('.').reduce((acc: any, key: string) => (acc ? acc[key] : undefined), dict) || path;
    if (!vars) return value;
    return Object.entries(vars).reduce((str, [k, v]) => str.replaceAll(`{${k}}`, String(v)), value);
  }

  // Data mapping
  private _getTrips(): any[] {
    const entity = this._getEntity();
    if (!entity) return [];
    const a = entity.attributes || {};
    // Prefer normalized trips array from integration
    if (Array.isArray(a.trips)) return a.trips.filter(Boolean);
    // Fallbacks: try to build a single pseudo-trip from legs
    let legs: any[] | undefined = a.legs;
    if (!Array.isArray(legs)) legs = a.trip?.legs;
    if (!Array.isArray(legs) && Array.isArray(a.trips)) legs = a.trips[0]?.legs;
    if (Array.isArray(legs)) return [{ legs: legs.filter(Boolean) }];
    return [];
  }

  private _legType(leg: any): string | undefined {
    // For Resrobot normalized legs: category is transport (Bus/Train/Metro/Tram/Ferry), type can be Walk/Transfer/Public Transport
    const t = (leg?.category || leg?.type || leg?.mode || leg?.transport_mode || leg?.product?.category || leg?.product?.mode || '').toString();
    return t ? t.toLowerCase() : undefined;
  }

  private _legLine(leg: any): string | undefined {
    // Resrobot normalized legs use line_number
    const l = leg?.line ?? leg?.line_number ?? leg?.number ?? leg?.product?.line;
    return l !== undefined && l !== null && l !== '' ? String(l) : undefined;
  }

  private _stopFrom(obj: any): { name?: string; lat?: number; lon?: number } | undefined {
    if (!obj) return undefined;
    const s = obj.from ?? obj.origin ?? obj;
    if (!s || typeof s !== 'object') return undefined;
    return {
      name: s.name ?? s.stop_name ?? s.stop ?? s.id,
      lat: s.lat ?? s.latitude,
      lon: s.lon ?? s.lng ?? s.longitude,
    };
  }

  private _stopTo(obj: any): { name?: string; lat?: number; lon?: number } | undefined {
    if (!obj) return undefined;
    const s = obj.to ?? obj.destination ?? obj;
    if (!s || typeof s !== 'object') return undefined;
    return {
      name: s.name ?? s.stop_name ?? s.stop ?? s.id,
      lat: s.lat ?? s.latitude,
      lon: s.lon ?? s.lng ?? s.longitude,
    };
  }

  private _firstCoordForTrip(trip: any): { name?: string; lat?: number; lon?: number } | undefined {
    const legs = Array.isArray(trip?.legs) ? trip.legs : [];
    if (legs.length === 0) return undefined;
    const s = this._stopFrom(legs[0]);
    if (s?.lat != null && s?.lon != null) return s;
    // Try entity-level fallbacks
    const a = this._getEntity()?.attributes || {};
    const lat = a.start_lat ?? a.origin_lat ?? a.lat;
    const lon = a.start_lon ?? a.origin_lon ?? a.lon ?? a.lng;
    if (lat != null && lon != null) return { name: a.start_name ?? a.origin_name, lat, lon };
    return undefined;
  }

  private _lastCoordForTrip(trip: any): { name?: string; lat?: number; lon?: number } | undefined {
    const legs = Array.isArray(trip?.legs) ? trip.legs : [];
    if (legs.length === 0) return undefined;
    const s = this._stopTo(legs[legs.length - 1]);
    if (s?.lat != null && s?.lon != null) return s;
    const a = this._getEntity()?.attributes || {};
    const lat = a.end_lat ?? a.destination_lat;
    const lon = a.end_lon ?? a.destination_lon;
    if (lat != null && lon != null) return { name: a.end_name ?? a.destination_name, lat, lon };
    return undefined;
  }

  private _mapLink(s?: { lat?: number; lon?: number }): string | undefined {
    if (!s || s.lat == null || s.lon == null) return undefined;
    const lat = Number(s.lat).toFixed(6);
    const lon = Number(s.lon).toFixed(6);
    return `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lon}#map=16/${lat}/${lon}`;
    }

  private _modeLabel(mode: string | undefined): string | undefined {
    if (!mode) return undefined;
    const key = `label.mode_${String(mode).toLowerCase()}`;
    const translated = this._t(key);
    return translated === key ? mode : translated;
  }

  private _iconForType(type: string | undefined): string | undefined {
    if (!type) return undefined;
    const t = String(type).toLowerCase();
    if (/(walk|foot|gång)/.test(t)) return 'mdi:walk';
    if (/(bus|buss|express\s*bus|expressbuss)/.test(t)) return 'mdi:bus';
    if (/(train|tåg|rail)/.test(t)) return 'mdi:train';
    if (/(metro|subway|tunnelbana)/.test(t)) return 'mdi:subway-variant';
    if (/(tram|spårvagn)/.test(t)) return 'mdi:tram';
    if (/(ferry|boat|båt)/.test(t)) return 'mdi:ferry';
    if (/(car|bil|taxi)/.test(t)) return 'mdi:taxi';
    return 'mdi:map-marker-path';
  }

  private _iconForEndpoint(isCoord: boolean, legType: string | undefined): string {
    if (isCoord) return 'mdi:map-marker';
    const t = (legType || '').toLowerCase();
    if (/(train|tåg|rail)/.test(t)) return 'mdi:train-bus';
    return 'mdi:bus-stop-uncovered';
  }

  private _isWalk(leg: any): boolean {
    const c = (leg?.category || leg?.type || '').toString().toLowerCase();
    return /(walk|gång)/.test(c);
  }

  private _metersLabel(m?: any): string | undefined {
    if (m == null) return undefined;
    const n = Number(m);
    if (!isFinite(n) || n <= 0) return undefined;
    return `${Math.round(n)} m`;
  }

  private _openMoreInfo(): void {
    const entityId = this._config?.entity;
    if (!entityId) return;
    this.dispatchEvent(
      new CustomEvent('hass-more-info', {
        bubbles: true,
        composed: true,
        detail: { entityId },
      })
    );
  }

  private _onKeyActivate(e: KeyboardEvent): void {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      this._openMoreInfo();
    }
  }

  protected render() {
    if (!this._config) return nothing;
    const entity = this._getEntity();
    if (!entity) {
      return html`<ha-card header=${this._t('card.title')}>
        <div class="content error">${this._t('error.entity_not_found', { entity: this._config.entity })}</div>
      </ha-card>`;
    }

    const showHeader = true;
    const header = entity.attributes?.friendly_name || entity.entity_id;
    const trips = this._getTrips().slice(0, this._config.max_items ?? 3);
  return html`
      <ha-card .header=${showHeader ? (header ?? this._t('card.title')) : undefined}>
        <div class="card-body">
          ${showHeader
            ? html`<div class="header-overlay" role="button" tabindex="0"
                       @click=${() => this._openMoreInfo()}
                       @keydown=${(e: KeyboardEvent) => this._onKeyActivate(e)}></div>`
            : nothing}

          ${trips.length === 0
            ? html`<div class="content empty">${this._t('empty.no_trip')}</div>`
            : trips.map((trip) => this._renderTripRow(trip))}

          <div class="footer">
            ${entity.attributes?.attribution ? html`<span class="attr">${entity.attributes.attribution}</span>` : nothing}
            ${entity.attributes?.last_update ? html`<span class="updated">${this._t('label.updated', { time: this._formatUpdated(entity.attributes.last_update) })}</span>` : nothing}
          </div>
        </div>
      </ha-card>
    `;
  }

  private _renderTripRow(trip: any) {
    const legsAll: any[] = Array.isArray(trip?.legs) ? trip.legs : [];
    const maxLegsRaw = this._config?.max_legs ?? 12;
    const maxLegs = Math.max(1, Number(maxLegsRaw));
    const legs = legsAll.length > maxLegs ? legsAll : legsAll.slice(0, maxLegs);
    const firstLegType = this._legType(legs[0]);
    const lastLegType = this._legType(legs[legs.length - 1]);
    const startCoord = this._firstCoordForTrip(trip);
    const endCoord = this._lastCoordForTrip(trip);
    const startHasCoord = this._startIsCoordinate(trip, startCoord);
    const endHasCoord = this._endIsCoordinate(trip, endCoord);
    const startIcon = this._iconForEndpoint(startHasCoord, firstLegType);
    const endIcon = this._iconForEndpoint(endHasCoord, lastLegType);
    const startHref = this._config?.show_map_links && startHasCoord ? this._mapLink(startCoord) : undefined;
    const endHref = this._config?.show_map_links && endHasCoord ? this._mapLink(endCoord) : undefined;
    const depTime = legsAll[0] ? (legsAll[0].origin_time || legsAll[0].departure) : undefined;
    const arrTime = legsAll.length > 0 ? (legsAll[legsAll.length - 1].dest_time || legsAll[legsAll.length - 1].arrival) : undefined;

    return html`
      <div class="trip-row" role="list">
  <div class="endpoint-col">
          ${startHref
            ? html`<a class="endpoint-pill start-pill" title="${startCoord?.name ?? ''}" href=${startHref} target="_blank" rel="noreferrer"><ha-icon class="icon" .icon=${startIcon}></ha-icon>${depTime ? html`<span class="time">${this._formatTime(depTime)}</span>` : nothing}</a>`
            : html`<span class="endpoint-pill start-pill" title="${startCoord?.name ?? ''}"><ha-icon class="icon" .icon=${startIcon}></ha-icon>${depTime ? html`<span class="time">${this._formatTime(depTime)}</span>` : nothing}</span>`}
        </div>

        ${legsAll.length <= maxLegs
          ? legs.map((leg, i) => this._renderLegColumn(leg, i < legs.length - 1))
          : (() => {
              const total = legsAll.length;
              const displayMax = Math.max(2, maxLegs);
              const extra = displayMax - 2; // reserve first & last leg
              const leftExtra = Math.floor(extra / 2);
              const rightExtra = extra - leftExtra;
              const leftEndIndex = 0 + leftExtra; // inclusive
              const rightStartIndex = total - 1 - rightExtra; // inclusive

              const leftLegs = legsAll.slice(0, leftEndIndex + 1);
              const rightLegs = legsAll.slice(rightStartIndex);

              return html`
                ${leftLegs.map((leg) => this._renderLegColumn(leg, true))}
                <span class="dots">…</span>
                <span class="arrow"><ha-icon .icon=${'mdi:chevron-right'}></ha-icon></span>
                <span class="dots">…</span>
                <span class="arrow"><ha-icon .icon=${'mdi:chevron-right'}></ha-icon></span>
                ${rightLegs.map((leg, idx) => this._renderLegColumn(leg, idx < rightLegs.length - 1))}
              `;
            })()}

  <div class="endpoint-col">
          ${endHref
            ? html`<a class="endpoint-pill end-pill" title="${endCoord?.name ?? ''}" href=${endHref} target="_blank" rel="noreferrer"><ha-icon class="icon" .icon=${endIcon}></ha-icon>${arrTime ? html`<span class="time">${this._formatTime(arrTime)}</span>` : nothing}</a>`
            : html`<span class="endpoint-pill end-pill" title="${endCoord?.name ?? ''}"><ha-icon class="icon" .icon=${endIcon}></ha-icon>${arrTime ? html`<span class="time">${this._formatTime(arrTime)}</span>` : nothing}</span>`}
        </div>
      </div>
    `;
  }

  private _renderLegColumn(leg: any, hasNext: boolean) {
    const type = this._legType(leg);
    const icon = this._iconForType(type);
    const isWalk = this._isWalk(leg);
    const line = this._legLine(leg);
    const meters = isWalk ? this._metersLabel(leg?.distance) : undefined;
    const isTransfer = typeof type === 'string' && type.includes('transfer');
    const label = isTransfer ? 'Transfer' : (isWalk ? meters : line);
    const from = leg?.origin_name ?? this._stopFrom(leg)?.name;
    const to = leg?.dest_name ?? this._stopTo(leg)?.name;
    const dep = (leg?.origin_time || leg?.departure) ? this._formatTime(leg?.origin_time || leg?.departure) : undefined;
    const arr = (leg?.dest_time || leg?.arrival) ? this._formatTime(leg?.dest_time || leg?.arrival) : undefined;
    const durMin = typeof leg?.duration === 'number' ? leg.duration : undefined;

    return html`
      <div class="leg-col" role="listitem">
        <div class="leg-pill">
          ${icon ? html`<ha-icon class="icon" .icon=${icon}></ha-icon>` : nothing}
          ${label ? html`<span class="line">${label}</span>` : nothing}
        </div>
        ${this._config?.show_details
          ? html`<div class="leg-details">
              <div class="detail-line">${from ?? '—'}</div>
              <div class="detail-line">${to ?? '—'}</div>
              <div class="detail-line">
                ${dep ? html`<span class="time">${dep}</span>` : nothing}
                ${dep && arr ? html`<span class="arrow"><ha-icon .icon=${'mdi:chevron-right'}></ha-icon></span>` : nothing}
                ${arr ? html`<span class="time">${arr}</span>` : nothing}
                ${durMin != null ? html`<span class="sep"> • </span><span class="time">${this._formatDurationHM(durMin)}</span>` : nothing}
              </div>
            </div>`
          : nothing}
      </div>
      ${hasNext ? html`<span class="arrow"><ha-icon .icon=${'mdi:chevron-right'}></ha-icon></span>` : nothing}
    `;
  }

  private _sumDurationMinutes(legs: any[]): number | undefined {
    if (!Array.isArray(legs) || legs.length === 0) return undefined;
    let sum = 0;
    let any = false;
    for (const l of legs) {
      if (typeof l?.duration === 'number' && isFinite(l.duration)) {
        sum += l.duration;
        any = true;
      }
    }
    return any ? sum : undefined;
  }

  private _formatDurationHM(min: number): string {
    const m = Math.max(0, Math.floor(min));
    const h = Math.floor(m / 60);
    const r = m % 60;
    return `${h}:${r.toString().padStart(2, '0')}`;
  }

  private _formatTime(s: string): string {
    try {
      const d = new Date(s);
      if (!isNaN(d.getTime())) {
        const h = d.getHours().toString().padStart(2, '0');
        const m = d.getMinutes().toString().padStart(2, '0');
        return `${h}:${m}`;
      }
    } catch {}
    // Fallback for 'YYYY-MM-DD HH:MM' format
    if (typeof s === 'string' && s.includes(' ')) {
      const t = s.split(' ')[1] || '';
      return t.slice(0, 5) || s;
    }
    return s;
  }

  private _startIsCoordinate(trip: any, coord?: {lat?: number; lon?: number}): boolean {
    if (coord && coord.lat != null && coord.lon != null) return true;
    const a = this._getEntity()?.attributes || {};
    const originType = String(a.origin_type || a.start_type || '').toLowerCase();
    if (originType.includes('coord')) return true;
    const legs = Array.isArray(trip?.legs) ? trip.legs : [];
    const first = legs[0];
    const legacy = first?.origin || first?.from;
    if (legacy && (legacy.lat != null && legacy.lon != null)) return true;
    return false;
  }

  private _endIsCoordinate(trip: any, coord?: {lat?: number; lon?: number}): boolean {
    if (coord && coord.lat != null && coord.lon != null) return true;
    const a = this._getEntity()?.attributes || {};
    const destType = String(a.destination_type || a.end_type || '').toLowerCase();
    if (destType.includes('coord')) return true;
    const legs = Array.isArray(trip?.legs) ? trip.legs : [];
    const last = legs[legs.length - 1];
    const legacy = last?.destination || last?.to;
    if (legacy && (legacy.lat != null && legacy.lon != null)) return true;
    return false;
  }

  private _formatUpdated(dt: string): string {
    try {
      const d = new Date(dt);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return dt;
    }
  }

  static styles = css`
    /*
      Theming variables (defaults match current visual design)
      Override any of these on the card element or parent to adjust the look:
      --tl-trip-gap, --tl-pill-padding-y, --tl-pill-padding-x, --tl-pill-radius,
      --tl-start-pill-bg, --tl-pill-border-color, --tl-icon-size,
      --tl-end-pill-bg, --tl-pill-border-color, --tl-icon-size,
      --tl-leg-pill-bg, --tl-pill-border-color, --tl-icon-size,
      --tl-font-size-leg, --tl-font-size-details, --tl-font-size-footer,
      --tl-arrow-color, --tl-dots-color, --tl-empty-color,
      --tl-header-overlay-height, --tl-content-padding
    */
    :host {
      --tl-trip-gap: 8px;
      --tl-pill-padding-y: 6px;
      --tl-pill-padding-x: 10px;
      --tl-pill-radius: 999px;
      /* Base pill styling */
      --tl-pill-bg: var(--ha-card-background, rgba(0,0,0,0.04));
      --tl-pill-border-color: var(--divider-color, rgba(0,0,0,0.1));
      /* Per-pill defaults inherit base; override as needed in theme */
      --tl-start-pill-bg: var(--success-color, #0b8457);
      --tl-start-pill-border-color: var(--tl-pill-border-color);
      --tl-end-pill-bg: var(--success-color, #0b8457);
      --tl-end-pill-border-color: var(--tl-pill-border-color);
      --tl-leg-pill-bg: var(--primary-color);
      --tl-leg-pill-border-color: var(--tl-pill-border-color);
      --tl-icon-size: 1.1em;
      --tl-font-size-leg: 1em;
      --tl-font-size-details: 0.8em;
      --tl-font-size-footer: 0.8em;
      --tl-arrow-color: var(--secondary-text-color);
      --tl-dots-color: var(--secondary-text-color);
      --tl-empty-color: var(--secondary-text-color);
      --tl-header-overlay-height: 42px;
      --tl-content-padding: 12px 16px;
    }

    .card-body { position: relative; }
    .header-overlay { position: absolute; left: 0; right: 0; background: transparent; z-index: 2; top: 0; height: var(--tl-header-overlay-height); }
    .content { padding: var(--tl-content-padding); }
    .error { color: var(--error-color); }
    .empty { color: var(--tl-empty-color); padding: 8px 16px; }

    .trip-row { display: flex; align-items: flex-start; gap: var(--tl-trip-gap); padding: 6px 8px; }
    .endpoint-col { display: inline-flex; flex-direction: column; align-items: center; gap: 4px; }
    .endpoint-pill { display: inline-flex; align-items: center; gap: 6px; padding: var(--tl-pill-padding-y) var(--tl-pill-padding-x); border-radius: var(--tl-pill-radius); background: var(--tl-pill-bg); box-shadow: inset 0 0 0 1px var(--tl-pill-border-color); text-decoration: none; color: inherit; }
    .start-pill { background: var(--tl-start-pill-bg); box-shadow: inset 0 0 0 1px var(--tl-start-pill-border-color); }
    .end-pill { background: var(--tl-end-pill-bg); box-shadow: inset 0 0 0 1px var(--tl-end-pill-border-color); }
    .leg-col { display: inline-flex; flex-direction: column; align-items: center; gap: 4px; }
    .leg-pill { display: inline-flex; align-items: center; gap: 6px; padding: var(--tl-pill-padding-y) var(--tl-pill-padding-x); border-radius: var(--tl-pill-radius); background: var(--tl-leg-pill-bg); box-shadow: inset 0 0 0 1px var(--tl-leg-pill-border-color); }
    .icon { --mdc-icon-size: var(--tl-icon-size); width: var(--tl-icon-size); height: var(--tl-icon-size); display: inline-flex; align-items: center; justify-content: center; }
    .line { font-weight: 600; font-size: var(--tl-font-size-leg); }
    .time { font-weight: 600; font-variant-numeric: tabular-nums; font-size: var(--tl-font-size-leg); }
    .arrow { color: var(--tl-arrow-color); display: inline-flex; align-items: center; padding: 0 2px; }
    .dots { color: var(--tl-dots-color); padding: 0 2px; }
    .leg-details { font-size: var(--tl-font-size-details); color: var(--secondary-text-color); padding-left: 8px; }
    .endpoint-details { font-size: var(--tl-font-size-details); color: var(--secondary-text-color); text-align: center; }
    .detail-line { line-height: 1.2; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .footer { display: flex; justify-content: space-between; padding: 6px 16px 10px; color: var(--secondary-text-color); font-size: var(--tl-font-size-footer); }
  `;
}

customElements.define(CARD_TYPE, TrafiklabTravelCard);

window.customCards = window.customCards || [];
window.customCards.push({
  type: CARD_TYPE,
  name: 'Trafiklab Travel',
  description: 'Shows end-to-end trips from a Trafiklab Resrobot Travel sensor',
  preview: true,
});
