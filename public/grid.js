const DEG2RAD = Math.PI / 180;

export function chooseGridZ(zoom) {
  if (zoom < 7) return 6;
  if (zoom < 11) return 9;
  return 12;
}

export function latLngToTile(lat, lng, z) {
  const scale = 2 ** z;
  const x = Math.floor(((lng + 180) / 360) * scale);
  const y = Math.floor((1 - Math.log(Math.tan(lat * DEG2RAD) + 1 / Math.cos(lat * DEG2RAD)) / Math.PI) / 2 * scale);
  return { x, y };
}

export function gridIdFromLatLng(lat, lng, z) {
  const { x, y } = latLngToTile(lat, lng, z);
  return `z${z}_x${x}_y${y}`;
}

export function parseGridId(gridId) {
  const m = /^z(\d+)_x(\d+)_y(\d+)$/.exec(gridId);
  if (!m) return null;
  return { z: Number(m[1]), x: Number(m[2]), y: Number(m[3]) };
}

function tileToLng(x, z) { return (x / (2 ** z)) * 360 - 180; }
function tileToLat(y, z) {
  const n = Math.PI - 2 * Math.PI * y / (2 ** z);
  return (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
}

export function polygonFromGridId(gridId) {
  const p = parseGridId(gridId);
  if (!p) return null;
  const minLng = tileToLng(p.x, p.z);
  const maxLng = tileToLng(p.x + 1, p.z);
  const minLat = tileToLat(p.y + 1, p.z);
  const maxLat = tileToLat(p.y, p.z);
  return [[
    [minLng, minLat], [maxLng, minLat], [maxLng, maxLat], [minLng, maxLat], [minLng, minLat]
  ]];
}

export function visibleGridIds(bounds, z) {
  const nw = latLngToTile(bounds.getNorth(), bounds.getWest(), z);
  const se = latLngToTile(bounds.getSouth(), bounds.getEast(), z);
  const ids = [];
  const xMin = Math.min(nw.x, se.x), xMax = Math.max(nw.x, se.x);
  const yMin = Math.min(nw.y, se.y), yMax = Math.max(nw.y, se.y);
  for (let x = xMin; x <= xMax; x++) {
    for (let y = yMin; y <= yMax; y++) ids.push(`z${z}_x${x}_y${y}`);
  }
  return ids;
}

export function classifyCells(publishableIds, demandByCell) {
  const sorted = [...publishableIds].sort((a, b) => (demandByCell[b] || 0) - (demandByCell[a] || 0));
  const classes = {};
  if (sorted.length === 1) { classes[sorted[0]] = "MED"; return classes; }
  if (sorted.length === 2) { classes[sorted[0]] = "HIGH"; classes[sorted[1]] = "LOW"; return classes; }
  const nHigh = Math.max(1, Math.floor(sorted.length * 0.3));
  const nLow = Math.max(1, Math.floor(sorted.length * 0.3));
  sorted.forEach((id, idx) => {
    if (idx < nHigh) classes[id] = "HIGH";
    else if (idx >= sorted.length - nLow) classes[id] = "LOW";
    else classes[id] = "MED";
  });
  return classes;
}
