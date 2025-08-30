export interface TravelCardConfig {
  type: string; // 'custom:trafiklab-travel-card'
  entity: string;
  title?: string;
  show_details?: boolean;
  show_map_links?: boolean;
  max_legs?: number;
}

export interface Hass {
  states: Record<string, HassEntity>;
}

export interface HassEntity {
  entity_id: string;
  state: string;
  attributes: Record<string, any>;
  last_changed?: string;
  last_updated?: string;
}

export type Leg = {
  type?: string; // walk, bus, train, metro, tram, ferry, car
  mode?: string; // alias
  line?: string | number;
  number?: string | number;
  product?: {
    line?: string | number;
    category?: string;
    mode?: string;
  };
  from?: StopLike;
  origin?: StopLike;
  to?: StopLike;
  destination?: StopLike;
  departure?: string;
  arrival?: string;
};

export type StopLike = {
  name?: string;
  id?: string | number;
  lat?: number;
  lon?: number;
  lng?: number;
};

export interface TripLike {
  legs?: Leg[];
}
