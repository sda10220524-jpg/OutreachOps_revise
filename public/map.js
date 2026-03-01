import { chooseGridZ, polygonFromGridId } from "./grid.js";

export function createMap(onCellTap) {
  const map = new maplibregl.Map({
    container: "map",
    style: {
      version: 8,
      sources: {
        osm: {
          type: "raster",
          tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
          tileSize: 256,
          attribution: "© OpenStreetMap contributors"
        }
      },
      layers: [{ id: "osm", type: "raster", source: "osm" }]
    },
    center: [127.0, 37.56],
    zoom: 9
  });

  map.on("load", () => {
    map.addSource("grid", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
    map.addLayer({
      id: "grid-fill",
      type: "fill",
      source: "grid",
      paint: {
        "fill-color": ["match", ["get", "class"], "HIGH", "#ef4444", "MED", "#f59e0b", "LOW", "#22c55e", "INSUFFICIENT", "#94a3b8", "#cbd5e1"],
        "fill-opacity": ["case", ["==", ["get", "class"], "INSUFFICIENT"], 0.25, 0.35]
      }
    });
    map.addLayer({ id: "grid-line", type: "line", source: "grid", paint: { "line-color": "#334155", "line-width": 1 } });
    map.addLayer({
      id: "grid-label",
      type: "symbol",
      source: "grid",
      layout: { "text-field": ["get", "label"], "text-size": 11 }
    });
  });

  map.on("click", (e) => {
    const z = chooseGridZ(map.getZoom());
    onCellTap({ lat: e.lngLat.lat, lng: e.lngLat.lng, gridZ: z });
  });

  return map;
}

export function renderGrid(map, rows) {
  if (!map.getSource("grid")) return;
  const features = rows.map((r) => ({
    type: "Feature",
    geometry: { type: "Polygon", coordinates: polygonFromGridId(r.grid_id) },
    properties: { grid_id: r.grid_id, class: r.classification, label: r.label }
  }));
  map.getSource("grid").setData({ type: "FeatureCollection", features });
}
