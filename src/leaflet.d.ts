declare module 'leaflet' {
  export function map(el: HTMLElement, options?: Record<string, unknown>): any;
  export function tileLayer(url: string, options?: Record<string, unknown>): any;
  export function marker(latlng: [number, number] | any, options?: Record<string, unknown>): any;
  export function divIcon(options?: Record<string, unknown>): any;
  export default { map, tileLayer, marker, divIcon };
}