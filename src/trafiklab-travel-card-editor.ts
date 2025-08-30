import { LitElement, html, css } from 'lit';
import type { TravelCardConfig } from './trafiklab-travel-card';
import { localize } from './localize';

type HomeAssistant = any;

export class TrafiklabTravelCardEditor extends LitElement {
  public hass?: HomeAssistant;
  private _config?: TravelCardConfig;

  setConfig(config: TravelCardConfig) {
  const base: any = { type: 'trafiklab-travel-card', entity: '', show_details: false, show_map_links: true, max_legs: 12, max_items: 3 };
  this._config = { ...base, ...(config as any) } as any;
  }

  private _valueChanged(ev: Event) {
    if (!this._config) this._config = { type: 'trafiklab-travel-card', entity: '' } as any;
    const target = ev.currentTarget as any;
    const detail = (ev as CustomEvent).detail;
    const newConfig = { ...this._config } as any;
    const key = target?.configValue ?? target?.dataset?.configValue;
    if (key) {
      let value = detail?.value ?? target.value ?? target.checked;
      if (key === 'max_legs') {
        const n = Number(value);
        if (!Number.isNaN(n)) value = n;
      }
      if (target?.type === 'checkbox') newConfig[key] = target.checked;
      else if (value !== undefined) newConfig[key] = value;
    }
    if (JSON.stringify(newConfig) !== JSON.stringify(this._config)) {
      this._config = newConfig;
      this.dispatchEvent(new CustomEvent('config-changed', { detail: { config: newConfig } }));
    }
  }

  render() {
    const t = (p: string, v?: Record<string, any>) => localize(this.hass, p, v);
    const hasEntityPicker = !!customElements.get('ha-entity-picker') && !!this.hass;
    const hasSwitch = !!customElements.get('ha-switch');
    const hasTextfield = !!customElements.get('ha-textfield');
    const hasHaForm = !!customElements.get('ha-form');
    const cfg = {
      entity: this._config?.entity ?? '',
      show_details: this._config?.show_details ?? false,
      show_map_links: this._config?.show_map_links ?? true,
      max_legs: this._config?.max_legs ?? 12,
      max_items: this._config?.max_items ?? 3,
    };

    if (hasHaForm) {
      const schema = [
        { name: 'entity', selector: { entity: { domain: 'sensor' } } },
        { name: 'show_details', selector: { boolean: {} } },
        { name: 'show_map_links', selector: { boolean: {} } },
        { name: 'max_legs', selector: { number: { min: 1, max: 20, mode: 'box' } } },
        { name: 'max_items', selector: { number: { min: 1, max: 5, mode: 'box' } } },
      ] as any;
      const data = { entity: cfg.entity, show_details: cfg.show_details, show_map_links: cfg.show_map_links, max_legs: cfg.max_legs, max_items: cfg.max_items } as any;
      return html`
        <ha-form
          .hass=${this.hass}
          .data=${data}
          .schema=${schema}
          .computeLabel=${(s: any) => {
            switch (s.name) {
              case 'entity': return t('editor.sensor_entity');
              case 'show_details': return t('editor.show_details');
              case 'show_map_links': return t('editor.show_map_links');
              case 'max_legs': return t('editor.max_legs');
              case 'max_items': return t('editor.max_items');
              default: return String(s.name);
            }
          }}
          .computeHelper=${(s: any) => {
            switch (s.name) {
              case 'entity': return t('editor.help_sensor');
              case 'show_details': return t('editor.show_details');
              case 'show_map_links': return t('editor.show_map_links');
              case 'max_legs': return t('editor.help_max_legs');
              case 'max_items': return t('editor.help_max_items');
              default: return undefined;
            }
          }}
          @value-changed=${(e: CustomEvent) => {
            const value = (e.detail as any)?.value || {};
            const next = {
              ...(this._config || { type: 'trafiklab-travel-card' }),
              entity: value.entity ?? '',
              show_details: !!value.show_details,
              show_map_links: value.show_map_links !== false,
              max_legs: typeof value.max_legs === 'number' ? value.max_legs : Number(value.max_legs) || 12,
              max_items: typeof value.max_items === 'number' ? value.max_items : Number(value.max_items) || 3,
            } as TravelCardConfig as any;
            if (JSON.stringify(next) !== JSON.stringify(this._config)) {
              this._config = next;
              this.dispatchEvent(new CustomEvent('config-changed', { detail: { config: next } }));
            }
          }}
        ></ha-form>
      `;
    }

    return html`
      <div class="card-config">
        <div class="field">
          ${hasEntityPicker
            ? html`<ha-entity-picker
                  .hass=${this.hass}
                  .value=${cfg.entity}
                  .label=${t('editor.sensor_entity')}
                  .configValue=${'entity'}
                  .includeDomains=${['sensor']}
                  allow-custom-entity
                  @value-changed=${this._valueChanged}
                ></ha-entity-picker>`
            : html`<label class="lbl">${t('editor.sensor_entity')}<input type="text" .value=${cfg.entity} data-config-value="entity" @input=${(e: Event) => this._valueChanged(e)} /></label>`}
        </div>
        <div class="field">
          ${hasSwitch
            ? html`<ha-formfield .label=${t('editor.show_details')}>
                  <ha-switch .checked=${cfg.show_details} .configValue=${'show_details'} @change=${this._valueChanged}></ha-switch>
                </ha-formfield>`
            : html`<label class="lbl"><input type="checkbox" .checked=${cfg.show_details} data-config-value="show_details" @change=${(e: Event) => this._valueChanged(e)} /> ${t('editor.show_details')}</label>`}
        </div>
        <div class="field">
          ${hasSwitch
            ? html`<ha-formfield .label=${t('editor.show_map_links')}>
                  <ha-switch .checked=${cfg.show_map_links} .configValue=${'show_map_links'} @change=${this._valueChanged}></ha-switch>
                </ha-formfield>`
            : html`<label class="lbl"><input type="checkbox" .checked=${cfg.show_map_links} data-config-value="show_map_links" @change=${(e: Event) => this._valueChanged(e)} /> ${t('editor.show_map_links')}</label>`}
        </div>
        <div class="field">
          ${hasTextfield
            ? html`<ha-textfield .label=${t('editor.max_legs')} .value=${String(cfg.max_legs)} .configValue=${'max_legs'} type="number" min="1" max="20" @value-changed=${this._valueChanged} @input=${this._valueChanged} @change=${this._valueChanged}></ha-textfield>`
            : html`<label class="lbl">${t('editor.max_legs')}<input type="number" min="1" max="20" .value=${String(cfg.max_legs)} data-config-value="max_legs" @input=${(e: Event) => this._valueChanged(e)} /></label>`}
        </div>
        <div class="field">
          ${hasTextfield
            ? html`<ha-textfield .label=${t('editor.max_items')} .value=${String(cfg.max_items)} .configValue=${'max_items'} type="number" min="1" max="5" @value-changed=${this._valueChanged} @input=${this._valueChanged} @change=${this._valueChanged}></ha-textfield>`
            : html`<label class="lbl">${t('editor.max_items')}<input type="number" min="1" max="5" .value=${String(cfg.max_items)} data-config-value="max_items" @input=${(e: Event) => this._valueChanged(e)} /></label>`}
        </div>
      </div>
    `;
  }

  static styles = css`
    .card-config { display: grid; gap: 16px; }
    .lbl { display: grid; gap: 6px; font: inherit; color: var(--primary-text-color); }
    input[type="text"], input[type="number"] { padding: 8px; border-radius: 6px; border: 1px solid var(--divider-color); width: 100%; background: var(--card-background-color); color: var(--primary-text-color); }
  `;
}

customElements.define('trafiklab-travel-card-editor', TrafiklabTravelCardEditor);
