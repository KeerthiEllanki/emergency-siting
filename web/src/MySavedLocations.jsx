import React, { useState, useEffect } from "react";
import { apiFetch } from "./api";

export default function MySavedLocations({ isOpen, onClose, user }) {
    const [locations, setLocations] = useState([]);
    const [allLocations, setAllLocations] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [unsavingId, setUnsavingId] = useState(null);

    const fetchSavedLocations = async () => {
        if (!isOpen || !user) return;

        setLoading(true);
        setError("");

        try {
            const res = await apiFetch("/locations");

            if (!res.ok) {
                throw new Error(`Failed to fetch locations: ${res.status}`);
            }

            const data = await res.json();
            console.log("All locations from API:", data);
            console.log("Current user UID:", user.uid);

            setAllLocations(data || []);

            // Filter to show only locations created by this user
            const userLocations = data.filter(loc => {
                // Check for user match using the fields returned by backend
                const createdByUid = loc.created_by_uid || loc.created_by;
                const isUserLocation = createdByUid === user.uid;

                if (isUserLocation) {
                    console.log(`✅ User location found: ${loc.name} (ID: ${loc.id})`);
                }

                return isUserLocation;
            });

            console.log(`Filtered to ${userLocations.length} user locations out of ${data.length} total`);

            setLocations(userLocations || []);

        } catch (err) {
            console.error("Error fetching locations:", err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (isOpen) {
            fetchSavedLocations();
        }
    }, [isOpen, user]);

    const handleUnsave = async (locationId) => {
        try {
            setUnsavingId(locationId);
            setError("");

            const res = await apiFetch(`/locations/${locationId}`, {
                method: "DELETE"
            });

            if (!res.ok) {
                throw new Error(`Failed to unsave location: ${res.status}`);
            }

            // Remove the location from both lists
            setLocations(prev => prev.filter(location => location.id !== locationId));
            setAllLocations(prev => prev.filter(location => location.id !== locationId));

            // Show success message
            alert("Location removed successfully!");
        } catch (err) {
            console.error("Error unsaving location:", err);
            setError(err.message);
        } finally {
            setUnsavingId(null);
        }
    };

    const parseGeometry = (geometryJson) => {
        try {
            const parsed = typeof geometryJson === 'string' ? JSON.parse(geometryJson) : geometryJson;

            if (parsed.type === 'Feature') {
                return parsed.geometry;
            } else if (parsed.type === 'Point' || parsed.type === 'Polygon') {
                return parsed;
            } else if (parsed.geometry) {
                return parsed.geometry;
            }

            return parsed;
        } catch (e) {
            console.error("Error parsing geometry:", e);
            return null;
        }
    };

    const getLocationCoordinates = (location) => {
        const geometry = parseGeometry(location.geometry_json);
        if (!geometry || !geometry.coordinates) return "Unknown";

        try {
            if (geometry.type === 'Point') {
                const [lon, lat] = geometry.coordinates;
                return `${lat.toFixed(4)}, ${lon.toFixed(4)}`;
            } else if (geometry.type === 'Polygon') {
                const coordinates = geometry.coordinates[0];
                const latSum = coordinates.reduce((sum, coord) => sum + coord[1], 0);
                const lonSum = coordinates.reduce((sum, coord) => sum + coord[0], 0);
                const lat = latSum / coordinates.length;
                const lon = lonSum / coordinates.length;
                return `${lat.toFixed(4)}, ${lon.toFixed(4)} (area)`;
            }
            return "Complex geometry";
        } catch (e) {
            return "Invalid coordinates";
        }
    };

    const formatCreatedDate = (isoString) => {
        try {
            const date = new Date(isoString);
            return date.toLocaleString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
                hour: 'numeric',
                minute: '2-digit',
                hour12: true,
                timeZone: 'America/New_York'
            });
        } catch (e) {
            return isoString || "Unknown date";
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999]">
            <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[80vh] flex flex-col relative z-[10000]">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-gray-200">
                    <div className="flex items-center gap-3">
                        <svg className="w-6 h-6 text-cyan-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 616 0z" />
                        </svg>
                        <h2 className="text-xl font-semibold text-gray-900">My Saved Locations</h2>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-600 transition-colors"
                    >
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Info Banner */}
                <div className="px-6 py-3 bg-green-50 border-b border-green-200">
                    <div className="flex items-start gap-2">
                        <svg className="w-5 h-5 text-green-600 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <div>
                            <p className="text-sm font-medium text-green-800">
                                Showing only your saved locations
                            </p>
                            <p className="text-xs text-green-600 mt-1">
                                Found {locations.length} of your locations out of {allLocations.length} total locations in the system.
                            </p>
                        </div>
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 p-6 overflow-y-auto">
                    {/* Loading State */}
                    {loading && (
                        <div className="flex items-center justify-center py-12">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-700"></div>
                            <span className="ml-3 text-gray-600">Loading saved locations...</span>
                        </div>
                    )}

                    {/* Error State */}
                    {error && (
                        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4">
                            {error}
                        </div>
                    )}

                    {/* Empty State */}
                    {!loading && !error && locations.length === 0 && (
                        <div className="text-center py-12">
                            <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                            <h3 className="text-lg font-medium text-gray-900 mb-2">No saved locations</h3>
                            <p className="text-gray-500 mb-4">
                                You haven't saved any locations yet. Run an optimization and save some locations to get started!
                            </p>
                            {allLocations.length > 0 && (
                                <p className="text-sm text-gray-400">
                                    There are {allLocations.length} total locations in the system, but none belong to your account.
                                </p>
                            )}
                        </div>
                    )}

                    {/* Locations List */}
                    {!loading && !error && locations.length > 0 && (
                        <div className="space-y-4">
                            {locations.map((location) => (
                                <div
                                    key={location.id}
                                    className="border border-gray-200 rounded-lg p-4 bg-white hover:bg-gray-50 transition-colors"
                                >
                                    <div className="flex items-start justify-between">
                                        <div className="flex-1">
                                            {/* Location Name */}
                                            <div className="flex items-center gap-2 mb-2">
                                                <svg className="w-4 h-4 text-cyan-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                                                </svg>
                                                <span className="font-medium text-gray-900">
                                                    {location.name || "Unnamed Location"}
                                                </span>
                                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                                    Mine
                                                </span>
                                            </div>

                                            {/* Location Coordinates */}
                                            <div className="flex items-center gap-2 mb-2">
                                                <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 616 0z" />
                                                </svg>
                                                <span className="text-gray-600 text-sm">
                                                    {getLocationCoordinates(location)}
                                                </span>
                                            </div>

                                            {/* Creation Date */}
                                            {location.created_at && (
                                                <div className="flex items-center gap-2 mb-2">
                                                    <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                                    </svg>
                                                    <span className="text-gray-600 text-sm">
                                                        Saved: {formatCreatedDate(location.created_at)}
                                                    </span>
                                                </div>
                                            )}

                                            {/* Location ID */}
                                            <div className="flex items-center gap-2">
                                                <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" />
                                                </svg>
                                                <span className="text-gray-500 text-xs font-mono">
                                                    ID: {location.id}
                                                </span>
                                            </div>
                                        </div>

                                        {/* Unsave Button */}
                                        <button
                                            onClick={() => handleUnsave(location.id)}
                                            disabled={unsavingId === location.id}
                                            className="ml-4 px-3 py-1.5 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                                        >
                                            {unsavingId === location.id ? (
                                                <>
                                                    <div className="animate-spin rounded-full h-3 w-3 border-b border-red-700"></div>
                                                    Removing...
                                                </>
                                            ) : (
                                                <>
                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                    </svg>
                                                    Unsave
                                                </>
                                            )}
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between p-6 border-t border-gray-200 bg-gray-50">
                    <div className="text-sm text-gray-600">
                        {locations.length > 0
                            ? `${locations.length} of your saved location${locations.length === 1 ? '' : 's'}`
                            : `0 of your saved locations (${allLocations.length} total in system)`
                        }
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={fetchSavedLocations}
                            disabled={loading}
                            className="px-3 py-1.5 text-sm text-cyan-700 bg-cyan-50 border border-cyan-200 rounded-lg hover:bg-cyan-100 transition-colors disabled:opacity-50"
                        >
                            Refresh
                        </button>
                        <button
                            onClick={onClose}
                            className="px-4 py-1.5 text-sm text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                        >
                            Close
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}