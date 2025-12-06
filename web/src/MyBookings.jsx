import React, { useState, useEffect } from "react";
import { apiFetch } from "./api";

export default function MyBookings({ isOpen, onClose, user }) {
    const [bookings, setBookings] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [unbookingId, setUnbookingId] = useState(null);

    const fetchBookings = async () => {
        if (!isOpen || !user) return;

        setLoading(true);
        setError("");

        try {
            const res = await apiFetch("/bookings");
            console.log("API response for bookings:", res);

            if (!res.ok) {
                throw new Error(`Failed to fetch bookings: ${res.status}`);
            }

            const data = await res.json();
            console.log("Bookings from API:", data);
            setBookings(data || []);

        } catch (err) {
            console.error("Error fetching bookings:", err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (isOpen) {
            fetchBookings();
        }
    }, [isOpen, user]);

    const handleUnbook = async (bookingId) => {
        try {
            setUnbookingId(bookingId);
            setError("");

            const res = await apiFetch(`/bookings/${bookingId}`, {
                method: "DELETE"
            });

            if (!res.ok) {
                throw new Error(`Failed to cancel booking: ${res.status}`);
            }

            // Remove the booking from the list
            setBookings(prev => prev.filter(booking => booking.id !== bookingId));

            // Show success message
            alert("Booking cancelled successfully!");
        } catch (err) {
            console.error("Error cancelling booking:", err);
            setError(err.message);
        } finally {
            setUnbookingId(null);
        }
    };

    const formatDateTime = (isoString) => {
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
            return isoString;
        }
    };

    const getBookingStatus = (startTime, endTime) => {
        const now = new Date();
        const start = new Date(startTime);
        const end = new Date(endTime);

        if (now < start) {
            return { status: "Upcoming", className: "bg-blue-100 text-blue-800" };
        } else if (now >= start && now <= end) {
            return { status: "Active", className: "bg-green-100 text-green-800" };
        } else {
            return { status: "Past", className: "bg-gray-100 text-gray-800" };
        }
    };

    const getDuration = (startTime, endTime) => {
        try {
            const start = new Date(startTime);
            const end = new Date(endTime);
            const diffMs = end - start;
            const diffHours = Math.round(diffMs / (1000 * 60 * 60));

            if (diffHours < 24) {
                return `${diffHours} hour${diffHours === 1 ? '' : 's'}`;
            } else {
                const diffDays = Math.round(diffHours / 24);
                return `${diffDays} day${diffDays === 1 ? '' : 's'}`;
            }
        } catch (e) {
            return "Unknown duration";
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
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        <h2 className="text-xl font-semibold text-gray-900">My Bookings</h2>
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

                {/* Content */}
                <div className="flex-1 p-6 overflow-y-auto">
                    {/* Loading State */}
                    {loading && (
                        <div className="flex items-center justify-center py-12">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-700"></div>
                            <span className="ml-3 text-gray-600">Loading bookings...</span>
                        </div>
                    )}

                    {/* Error State */}
                    {error && (
                        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4">
                            {error}
                        </div>
                    )}

                    {/* Empty State */}
                    {!loading && !error && bookings.length === 0 && (
                        <div className="text-center py-12">
                            <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                            <h3 className="text-lg font-medium text-gray-900 mb-2">No bookings</h3>
                            <p className="text-gray-500">
                                You haven't made any bookings yet. Save a location and book a time slot to get started!
                            </p>
                        </div>
                    )}

                    {/* Bookings List */}
                    {!loading && !error && bookings.length > 0 && (
                        <div className="space-y-4">
                            {bookings.map((booking) => {
                                const { status, className } = getBookingStatus(booking.start_time, booking.end_time);

                                return (
                                    <div
                                        key={booking.id}
                                        className="border border-gray-200 rounded-lg p-4 bg-white hover:bg-gray-50 transition-colors"
                                    >
                                        <div className="flex items-start justify-between">
                                            <div className="flex-1">
                                                {/* Location Name & Status */}
                                                <div className="flex items-center gap-2 mb-2">
                                                    <svg className="w-4 h-4 text-cyan-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                                    </svg>
                                                    <span className="font-medium text-gray-900">
                                                        {booking.location_name || "Unknown Location"}
                                                    </span>
                                                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${className}`}>
                                                        {status}
                                                    </span>
                                                </div>

                                                {/* Time Details */}
                                                <div className="space-y-1 mb-2">
                                                    <div className="flex items-center gap-2">
                                                        <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                        </svg>
                                                        <span className="text-sm text-gray-600">
                                                            <span className="font-medium">Start:</span> {formatDateTime(booking.start_time)} EST
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                        </svg>
                                                        <span className="text-sm text-gray-600">
                                                            <span className="font-medium">End:</span> {formatDateTime(booking.end_time)} EST
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                                                        </svg>
                                                        <span className="text-sm text-gray-600">
                                                            <span className="font-medium">Duration:</span> {getDuration(booking.start_time, booking.end_time)}
                                                        </span>
                                                    </div>
                                                </div>

                                                {/* Booking ID */}
                                                <div className="flex items-center gap-2">
                                                    <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" />
                                                    </svg>
                                                    <span className="text-gray-500 text-xs font-mono">
                                                        Booking ID: {booking.id}
                                                    </span>
                                                </div>
                                            </div>

                                            {/* Unbook Button */}
                                            <button
                                                onClick={() => handleUnbook(booking.id)}
                                                disabled={unbookingId === booking.id || status === "Past"}
                                                className="ml-4 px-3 py-1.5 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                                            >
                                                {unbookingId === booking.id ? (
                                                    <>
                                                        <div className="animate-spin rounded-full h-3 w-3 border-b border-red-700"></div>
                                                        Cancelling...
                                                    </>
                                                ) : (
                                                    <>
                                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                        </svg>
                                                        {status === "Past" ? "Past" : "Unbook"}
                                                    </>
                                                )}
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between p-6 border-t border-gray-200 bg-gray-50">
                    <div className="text-sm text-gray-600">
                        {bookings.length > 0 && `${bookings.length} booking${bookings.length === 1 ? '' : 's'} found`}
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={fetchBookings}
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