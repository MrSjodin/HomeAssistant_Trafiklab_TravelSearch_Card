import { css } from 'lit';

export const cardStyles = css`
  :host {
    display: block;
  }
  ha-card {
    padding: 12px 12px 8px 12px;
  }
  .header {
    font-weight: 600;
    margin-bottom: 8px;
  }
  .trip {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 6px;
  }
  .leg {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 6px 8px;
    border-radius: 8px;
    background: var(--ha-card-background, rgba(0,0,0,0.04));
    box-shadow: inset 0 0 0 1px var(--divider-color, rgba(0,0,0,0.1));
  }
  .leg .line {
    font-weight: 600;
    font-size: 0.9em;
  }
  .muted {
    opacity: 0.7;
  }
  .arrow {
    color: var(--secondary-text-color);
  }
  .meta {
    margin-top: 8px;
    font-size: 0.9em;
    color: var(--secondary-text-color);
  }
  .map-link a {
    color: var(--primary-color);
    text-decoration: none;
  }
`;
