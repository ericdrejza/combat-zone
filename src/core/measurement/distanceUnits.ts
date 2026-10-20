const abbreviations: Record<string, string> = {
  millimeter: 'mm', millimeters: 'mm', millimetre: 'mm', millimetres: 'mm',
  centimeter: 'cm', centimeters: 'cm', centimetre: 'cm', centimetres: 'cm',
  decimeter: 'dm', decimeters: 'dm', decimetre: 'dm', decimetres: 'dm',
  meter: 'm', meters: 'm', metre: 'm', metres: 'm',
  decameter: 'dam', decameters: 'dam', decametre: 'dam', decametres: 'dam',
  dekameter: 'dam', dekameters: 'dam',
  hectometer: 'hm', hectometers: 'hm', hectometre: 'hm', hectometres: 'hm',
  kilometer: 'km', kilometers: 'km', kilometre: 'km', kilometres: 'km',
  inch: 'in', inches: 'in', foot: 'ft', feet: 'ft', yard: 'yd', yards: 'yd', mile: 'mi', miles: 'mi'
};
/** Known legacy/custom unit names use standard symbols without expanding the unit picker. */
export function abbreviateDistanceUnit(unit: string): string {
  return abbreviations[unit.trim().toLowerCase()] ?? unit.trim();
}
export function formatDistance(distance: number, unit: string): string {
  return `${Number(distance.toFixed(2))} ${abbreviateDistanceUnit(unit)}`;
}
