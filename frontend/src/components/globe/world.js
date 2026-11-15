// World geometry shared by the 3D globe, region thumbnails and the region map (bundled, no network needed).
import { feature, mesh } from 'topojson-client';
import countries from 'world-atlas/countries-110m.json';
import { geoGraticule10 } from 'd3-geo';

export const LAND = feature(countries, countries.objects.countries);
export const BORDERS = mesh(countries, countries.objects.countries, (a, b) => a !== b);
export const GRATICULE = geoGraticule10();
export const SPHERE = { type: 'Sphere' };
