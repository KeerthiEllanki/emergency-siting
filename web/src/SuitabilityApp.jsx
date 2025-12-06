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
import { apiFetch } from "./api";

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
  const [savedIdsByKey, setSavedIdsByKey] = useState({});
  const [timeRange, setTimeRange] = useState({});

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
    // reset per-run save/booking state
    setSavedIdsByKey({});
    setTimeRange({});
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

  function siteKeyForFeature(f, idx) {
    // Prefer a stable id if available
    return (
      f?.properties?.id ??
      (Array.isArray(f?.geometry?.coordinates)
        ? `${f.geometry.coordinates[0]},${f.geometry.coordinates[1]}`
        : `site-${idx}`)
    );
  }


  async function saveFeatureLocation(f, idx) {
    try {
      const siteKey = siteKeyForFeature(f, idx);
      const prettyName = f?.properties?.name || `Recommended site #${idx + 1}`;

      // Build a clean GeoJSON Feature from the result
      const featureToSave = {
        type: "Feature",
        properties: { source: "opt-selected" },
        geometry: f.geometry,
      };

      console.log("[saveFeatureLocation] Sending:", {
        name: prettyName,
        geometry_json: featureToSave,
      });

      const res = await apiFetch("/locations", {
        method: "POST",
        body: {
          name: prettyName,
          geometry_json: featureToSave,  // Pass as object, apiFetch will stringify
        },
      });

      if (res.status === 401) {
        const errorData = await res.json().catch(() => ({ detail: "Unauthorized" }));
        alert("Please sign in first (401): " + errorData.detail);
        console.error("Unauthorized:", errorData);
        return;
      }

      if (!res.ok) {
        const errorData = await res.json().catch(async () => {
          const text = await res.text().catch(() => "Unknown error");
          return { detail: text };
        });
        const errorMsg = errorData.detail || JSON.stringify(errorData);
        alert(`Failed to save location (${res.status}): ${errorMsg}`);
        console.error("Save error:", errorData);
        return;
      }

      const data = await res.json();
      console.log("[saveFeatureLocation] Success:", data);
      setSavedIdsByKey((prev) => ({ ...prev, [siteKey]: data.id }));
      alert("Location saved successfully!");
    } catch (err) {
      console.error("[saveFeatureLocation] Error:", err);
      alert("Error saving location: " + err.message);
    }
  }


  function updateTR(siteKey, field, value) {
    setTimeRange(prev => ({
      ...prev,
      [siteKey]: {
        ...prev[siteKey],
        [field]: value || ""  // Ensure string value
      }
    }));
  }

  // async function bookTimeForFeature(f, idx) {
  //   try {
  //     const siteKey = siteKeyForFeature(f, idx);
  //     const savedId = savedIdsByKey[siteKey];
  //     if (!savedId) {
  //       alert("Save this location first.");
  //       return;
  //     }
  //     const tr = timeRange[siteKey] || {};
  //     if (!tr.start || !tr.end) {
  //       alert("Pick start and end time.");
  //       return;
  //     }

  //     const res = await apiFetch("/bookings", {
  //       method: "POST",
  //       body: JSON.stringify({
  //         location_id: savedId,
  //         start_time: tr.start,
  //         end_time: tr.end,
  //       }),
  //     });

  //     if (res.status === 409) {
  //       alert("That time is already booked for this location.");
  //       return;
  //     }
  //     if (!res.ok) {
  //       alert(`Failed to book (${res.status})`);
  //       return;
  //     }
  //     // success
  //     // alert("Booked!");
  //   } catch (err) {
  //     console.error(err);
  //     alert("Error booking time");
  //   }
  // }

  // Fixed bookTimeForFeature function for SuitabilityApp.jsx

  async function bookTimeForFeature(f, idx) {
    try {
      const siteKey = siteKeyForFeature(f, idx);
      const savedId = savedIdsByKey[siteKey];
      if (!savedId) {
        alert("Save this location first.");
        return;
      }
      const tr = timeRange[siteKey] || {};
      if (!tr.start || !tr.end) {
        alert("Pick start and end time.");
        return;
      }

      console.log("[bookTimeForFeature] Booking data:", {
        location_id: savedId,
        start_time: tr.start,
        end_time: tr.end,
      });

      const res = await apiFetch("/bookings", {
        method: "POST",
        body: {  // Remove JSON.stringify - apiFetch handles this
          location_id: savedId,
          start_time: tr.start,
          end_time: tr.end,
        },
      });

      if (res.status === 409) {
        alert("That time is already booked for this location.");
        return;
      }
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ detail: "Unknown error" }));
        console.error("Booking error:", errorData);
        alert(`Failed to book (${res.status}): ${errorData.detail || "Unknown error"}`);
        return;
      }

      const result = await res.json();
      console.log("[bookTimeForFeature] Success:", result);
      alert("Time slot booked successfully!");

    } catch (err) {
      console.error("Booking error:", err);
      alert("Error booking time: " + err.message);
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
          <h2 className="text-3xl font-bold text-cyan-900">Rescue Spot</h2>
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
                {["<15", "15-35", "35-60", "60+"].map((g) => (
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
              <div className="space-y-3 text-sm">
                <p>Coverage rate: <strong>{(results.metrics.coverage_rate * 100).toFixed(1)}%</strong></p>
                <p>Total demand: {results.metrics.total_demand}</p>
                <p>Covered demand: {results.metrics.covered_demand}</p>
                <p>Suggested sites: {results.metrics.selected_count}</p>

                {/* Existing alternatives list */}
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

                {/* NEW: Per-site Save + Book controls for selected sites */}
                <div className="mt-4">
                  <h4 className="font-medium mb-2">Save & Book each selected site</h4>
                  <ul className="space-y-3">
                    {results?.selected_sites?.features?.map((f, idx) => {
                      const siteKey = siteKeyForFeature(f, idx);
                      const savedId = savedIdsByKey[siteKey];
                      const tr = timeRange[siteKey] || { start: "", end: "" };
                      const label = f?.properties?.name || `Recommended site #${idx + 1}`;
                      const coords =
                        Array.isArray(f?.geometry?.coordinates)
                          ? `(${f.geometry.coordinates[1].toFixed(5)}, ${f.geometry.coordinates[0].toFixed(5)})`
                          : "";

                      return (
                        <li key={siteKey} className="border rounded p-3">
                          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                            <div>
                              <div className="font-medium">{label}</div>
                              <div className="text-xs text-gray-600">{coords}</div>
                            </div>

                            {!savedId ? (
                              <button
                                className="border bg-blue-100 hover:bg-blue-200 px-3 py-1 rounded self-start"
                                onClick={() => saveFeatureLocation(f, idx)}
                              >
                                Save location
                              </button>
                            ) : (
                              <span className="text-green-700 text-sm self-start">Saved ✓</span>
                            )}
                          </div>

                          {savedId && (
                            <div className="mt-3 flex flex-col sm:flex-row gap-2 sm:items-center">
                              <input
                                type="datetime-local"
                                className="border p-2 rounded"
                                value={tr.start || ""}
                                onChange={(e) => updateTR(siteKey, "start", e.target.value)}
                                placeholder="Start time"
                              />
                              <input
                                type="datetime-local"
                                className="border p-2 rounded"
                                value={tr.end || ""}
                                onChange={(e) => updateTR(siteKey, "end", e.target.value)}
                                placeholder="End time"
                              />
                              <button
                                className="border bg-green-100 hover:bg-green-200 px-3 py-1 rounded"
                                onClick={() => bookTimeForFeature(f, idx)}
                              >
                                Book this time
                              </button>
                            </div>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </div>

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

