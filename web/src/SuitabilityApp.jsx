import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  MapContainer,
  TileLayer,
  FeatureGroup,
  Marker,
  Popup,
  GeoJSON,
  useMap,
} from "react-leaflet";
import { EditControl } from "react-leaflet-draw";
import L from "leaflet";

import "leaflet/dist/leaflet.css";
import "leaflet-draw/dist/leaflet.draw.css";

const DefaultIcon = L.icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});
L.Marker.prototype.options.icon = DefaultIcon;

function FitToAOI({ aoi }) {
  const map = useMap();
  useEffect(() => {
    if (!aoi) return;
    const gj = L.geoJSON(aoi);
    const b = gj.getBounds();
    if (b.isValid()) map.fitBounds(b.pad(0.25));
  }, [aoi, map]);
  return null;
}

export default function SuitabilityApp() {
  const [aoi, setAoi] = useState(null);
  const [p, setP] = useState(10);
  const [radiusMiles, setRadiusMiles] = useState(0.5);
  const [wheelchairMode, setWheelchairMode] = useState(true);
  const [candidateTypes, setCandidateTypes] = useState([
    "school",
    "community_centre",
    "library",
    "place_of_worship",
    "park",
  ]);
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState("");
  const [results, setResults] = useState(null);
  const [ageGroups, setAgeGroups] = useState([]);

  const featureGroupRef = useRef();

  const drawOptions = useMemo(
    () => ({
      draw: {
        rectangle: true,
        polygon: true,
        marker: false,
        circle: false,
        circlemarker: false,
        polyline: false,
      },
      edit: {
        edit: {
          selectedPathOptions: {
            maintainColor: false,
          },
        },
        remove: true,
      },
    }),
    []
  );

  function onCreated(e) {
    const layer = e.layer;
    const gj = layer.toGeoJSON();
    const aoiFeature = {
      type: "Feature",
      geometry:
        gj.geometry.type === "Polygon" || gj.geometry.type === "MultiPolygon"
          ? gj.geometry
          : null,
      properties: {},
    };
    if (!aoiFeature.geometry && gj.geometry.type === "GeometryCollection") {
      const poly = gj.geometry.geometries.find(
        (g) => g.type === "Polygon" || g.type === "MultiPolygon"
      );
      if (poly) aoiFeature.geometry = poly;
    }
    if (aoiFeature.geometry)
      setAoi({ type: "FeatureCollection", features: [aoiFeature] });
  }

  function onEdited() {
    const fg = featureGroupRef.current;
    if (!fg) return;
    const layers = fg.leafletElement || fg;
    const all = [];
    layers.eachLayer((l) => {
      if (l.toGeoJSON) all.push(l.toGeoJSON());
    });
    const polys = all
      .map((f) =>
        f.geometry.type === "Polygon" || f.geometry.type === "MultiPolygon"
          ? f.geometry
          : null
      )
      .filter(Boolean);
    if (polys.length) {
      setAoi({
        type: "FeatureCollection",
        features: polys.map((g) => ({ type: "Feature", geometry: g, properties: {} })),
      });
    }
  }

  async function runOptimization() {
    setIsRunning(true);
    setError("");
    setResults(null);
    try {
      if (!aoi) throw new Error("Please draw an area of interest on the map.");
      const res = await fetch("http://localhost:8000/optimize/mclp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          aoi,
          p: Number(p),
          radius_m: Number(radiusMiles) * 1609.34,
          wheelchair_mode: wheelchairMode,
          candidate_types: candidateTypes,
          age_groups: ageGroups,
          top_k: 20,
        }),
      });
      if (!res.ok) throw new Error(`Server error: ${res.status}`);
      const data = await res.json();

      setResults(data);
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setIsRunning(false);
    }
  }

  return (
    <div className="w-full h-screen" style={{ display: "flex" }}>
      {/* LEFT: MAP */}

      <div className="map-container">
        <MapContainer center={[33.749, -84.388]} zoom={12} scrollWheelZoom={true}
          className="h-full w-full">
          <TileLayer
            attribution='&copy; OpenStreetMap contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <FeatureGroup ref={featureGroupRef}>
            <EditControl
              position="topleft"
              onCreated={onCreated}
              onEdited={onEdited}
              {...drawOptions}
            />
          </FeatureGroup>

          {aoi && <GeoJSON data={aoi} style={{ color: "#2563eb", weight: 2, fillOpacity: 0.1 }} />}

          {results?.selected_sites?.features?.map((f, i) => (
            <Marker
              key={`sel-${i}`}
              position={[f.geometry.coordinates[1], f.geometry.coordinates[0]]}
            >
              <Popup>
                <strong>{f.properties.name || "Recommended site"}</strong>
              </Popup>
            </Marker>
          ))}

          {results?.candidates?.features?.map((f, i) => (
            <Marker
              key={`cand-${i}`}
              position={[f.geometry.coordinates[1], f.geometry.coordinates[0]]}
              icon={L.divIcon({
                className: "",
                html: '<div style="background:#10b981;width:10px;height:10px;border-radius:50%"></div>',
              })}
            >
              <Popup>
                <div>
                  <strong>{f.properties.name || "Candidate"}</strong>
                  <div>ID: {f.properties?.id}</div>
                </div>
              </Popup>
            </Marker>
          ))}

          <FitToAOI aoi={aoi} />
        </MapContainer>
      </div>


      {/* RIGHT: PANEL */}
      <div className="flex flex-col p-4 bg-white w-auto">
        <div className="block">
          <h2 className="text-3xl font-bold text-cyan-900">Emergency Siting Tool</h2>
          <p className="text-sm text-gray-600 mt-6">
            Draw an AOI on the map, choose preferences, and click optimize to find the best locations.
          </p>

          <div className="space-y-3 mt-6">
            <label className="block">
              <span className="text-sm font-medium">Number of sites:  </span>
              <input
                type="number"
                className="mt-2 block w-full border rounded px-2 py-1"
                min={1}
                value={p}
                onChange={(e) => setP(e.target.value)}
              />
            </label>

            <label className="block">
              <span className="text-sm font-medium">Coverage Radius (miles):  </span>
              <input
                type="number"
                className="mt-2 block w-full border rounded px-2 py-1"
                value={radiusMiles}
                step="0.1"
                onChange={(e) => setRadiusMiles(e.target.value)}
              />
            </label>

            <label className="inline-flex items-center gap-2">
              <input
                type="checkbox"
                className="accent-cyan-700"
                checked={wheelchairMode}
                onChange={(e) => setWheelchairMode(e.target.checked)}
              />
              <span className="text-sm">Wheelchair-aware routing</span>
            </label>


            <div className="mt-20">
              <span className="text-sm font-medium">Candidate Place Types</span>
              <div className="flex flex-wrap gap-6 mt-1">
                {["school", "community_centre", "library", "place_of_worship", "park"].map((t) => (
                  <label key={t} className="text-sm">
                    <input
                      type="checkbox"
                      className="accent-cyan-700 mr-1"
                      checked={candidateTypes.includes(t)}
                      onChange={(e) =>
                        setCandidateTypes((prev) =>
                          e.target.checked ? [...prev, t] : prev.filter((x) => x !== t)
                        )
                      }

                    />
                    {t.replaceAll("_", " ")}
                  </label>
                ))}
              </div>
            </div>

            <div className="mt-6">
              <span className="text-sm font-medium">Age groups</span>
              <div className="flex flex-wrap gap-6 mt-1">
                {[
                  "<15",
                  "15-35",
                  "35-60",
                  "60+",
                ].map((g) => (
                  <label key={g} className="text-sm">
                    <input
                      type="checkbox"
                      className="accent-cyan-700 mr-1"
                      checked={ageGroups.includes(g)}
                      onChange={(e) =>
                        setAgeGroups((prev) =>
                          e.target.checked ? [...prev, g] : prev.filter((x) => x !== g)
                        )
                      }
                    />
                    {g}
                  </label>
                ))}
              </div>
              <p className="text-xs text-gray-500 mt-2">
                If none selected, the model uses uniform weights for demand points.
              </p>
            </div>

            <div></div>
            <button
              onClick={runOptimization}
              disabled={isRunning}
              className="w-full bg-cyan-900 text-white font-medium py-2 rounded hover:bg-cyan-700"
            >
              {isRunning ? "Running...." : "Run Optimization"}
            </button>

            {error && <div className="text-red-600 text-sm">{error}</div>}
          </div>

          <div className="pt-4 border-t">
            <h3 className="font-semibold mb-2">Results</h3>
            {!results && <p className="text-sm text-gray-500">No results yet. Run optimization.</p>}
            {results && (
              <div className="space-y-2 text-sm">
                <p>Coverage rate: <strong>{(results.metrics.coverage_rate * 100).toFixed(1)}%</strong></p>
                <p>Total demand: {results.metrics.total_demand}</p>
                <p>Covered demand: {results.metrics.covered_demand}</p>
                <p>Suggested sites: {results.metrics.selected_count}</p>
                <details>
                  <summary className="cursor-pointer">View the suggested sites here</summary>
                  <ol className="list-decimal ml-5 mt-2 space-y-1">
                    {results.alternatives.map((a) => (
                      <li key={a.id}>
                        <strong>{a.name}</strong>
                      </li>
                    ))}
                  </ol>
                </details>
                <button
                  className="mt-3 px-3 py-2 bg-white border rounded hover:bg-gray-100"
                  onClick={() => {
                    const blob = new Blob([JSON.stringify(results, null, 2)], { type: "application/json" });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = "siting_results.geojson.json";
                    a.click();
                  }}
                >
                  Download GeoJSON
                </button>
              </div>
            )}
          </div>
        </div>
      </div>



    </div>
  );
}
