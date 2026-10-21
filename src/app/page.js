
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "./supabase";

const API_URL = "http://127.0.0.1:8000";

export default function Home() {
  const router = useRouter();

  // ── Auth session state ───────────────────────────────────────────────────
  const [authUser, setAuthUser] = useState(undefined); // undefined = loading
  const [authLoading, setAuthLoading] = useState(false);
  const [pickup, setPickup] = useState("");
  const [destination, setDestination] = useState("");
  const [cabType, setCabType] = useState("Go");

  const [estimate, setEstimate] = useState(null);
  const [estimateLoading, setEstimateLoading] = useState(false);
  const [estimateError, setEstimateError] = useState("");

  const [loading, setLoading] = useState(false);
  const [bookings, setBookings] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState("");

  // Review state
  const [reviewBookingId, setReviewBookingId] = useState(null);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState("");
  const [reviewLoading, setReviewLoading] = useState(false);
  const [reviewMessage, setReviewMessage] = useState("");

  // Promo code state (Day 10)
  const [promoCode, setPromoCode] = useState("");
  const [promoResult, setPromoResult] = useState(null);  // { discount_amount, final_fare, discount_percent }
  const [promoLoading, setPromoLoading] = useState(false);
  const [promoError, setPromoError] = useState("");

  // Wallet state (Day 10)
  const [walletBalance, setWalletBalance] = useState(null);
  const [walletLoading, setWalletLoading] = useState(false);
  const [topupAmount, setTopupAmount] = useState("");
  const [topupLoading, setTopupLoading] = useState(false);
  const [topupMessage, setTopupMessage] = useState("");

  function clearEstimate() {
    setEstimate(null);
    setEstimateError("");
    setPromoResult(null);
    setPromoError("");
    setPromoCode("");
  }

  async function loadBookings() {
    setHistoryLoading(true);
    setHistoryError("");

    try {
      const { data: sessionData, error: sessionError } =
        await supabase.auth.getSession();

      if (sessionError) throw sessionError;

      const accessToken = sessionData.session?.access_token;

      if (!accessToken) {
        setBookings([]);
        setHistoryError("Please log in to view your bookings.");
        return;
      }

      const response = await fetch(`${API_URL}/bookings`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          typeof data.detail === "string"
            ? data.detail
            : "Could not load booking history."
        );
      }

      setBookings(data);
    } catch (error) {
      console.error("Booking history error:", error);
      setHistoryError(error.message || "Could not load booking history.");
    } finally {
      setHistoryLoading(false);
    }
  }

  // Seed auth state on mount; safety timer prevents infinite "Loading…".
  useEffect(() => {
    // Safety: if Supabase hasn't replied in 2 s, treat as logged out
    const fallback = setTimeout(() => {
      setAuthUser((prev) => (prev === undefined ? null : prev));
    }, 2000);

    supabase.auth.getSession().then(({ data: { session } }) => {
      clearTimeout(fallback);
      setAuthUser(session?.user ?? null);
    }).catch(() => {
      clearTimeout(fallback);
      setAuthUser(null);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setAuthUser(session?.user ?? null);
      }
    );

    return () => {
      clearTimeout(fallback);
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    loadBookings();
    loadWallet();
  }, []);

  async function loadWallet() {
    setWalletLoading(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (!accessToken) return;
      const res = await fetch(`${API_URL}/wallet`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (res.ok) {
        const d = await res.json();
        setWalletBalance(d.balance_inr);
      }
    } catch (e) {
      console.error("Wallet load error:", e);
    } finally {
      setWalletLoading(false);
    }
  }

  async function handleValidatePromo() {
    setPromoLoading(true);
    setPromoError("");
    setPromoResult(null);
    const fareForPromo = estimate?.estimated_fare;
    if (!promoCode.trim()) {
      setPromoError("Enter a promo code first.");
      setPromoLoading(false);
      return;
    }
    if (!fareForPromo) {
      setPromoError("Get a fare estimate first to validate a promo.");
      setPromoLoading(false);
      return;
    }
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (!accessToken) {
        setPromoError("Please log in to use promo codes.");
        return;
      }
      const res = await fetch(`${API_URL}/promos/validate`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ code: promoCode.trim(), fare: fareForPromo }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(typeof d.detail === "string" ? d.detail : "Invalid promo.");
      setPromoResult(d);
    } catch (err) {
      setPromoError(err.message || "Could not validate promo.");
    } finally {
      setPromoLoading(false);
    }
  }

  async function handleTopup(event) {
    event.preventDefault();
    setTopupLoading(true);
    setTopupMessage("");
    const amount = parseFloat(topupAmount);
    if (!amount || amount <= 0 || amount > 10000) {
      setTopupMessage("Enter an amount between ₹1 and ₹10,000.");
      setTopupLoading(false);
      return;
    }
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (!accessToken) { setTopupMessage("Please log in."); return; }
      const res = await fetch(`${API_URL}/wallet/topup`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ amount_inr: amount }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(typeof d.detail === "string" ? d.detail : "Top-up failed.");
      setWalletBalance(d.new_balance_inr);
      setTopupMessage(`Wallet topped up! New balance: ₹${d.new_balance_inr.toFixed(2)}`);
      setTopupAmount("");
    } catch (err) {
      setTopupMessage(err.message || "Top-up failed.");
    } finally {
      setTopupLoading(false);
    }
  }

  async function handleEstimate() {
    if (!pickup.trim() || !destination.trim()) {
      setEstimateError("Please enter pickup and destination.");
      setEstimate(null);
      return;
    }

    if (pickup.trim().toLowerCase() === destination.trim().toLowerCase()) {
      setEstimateError("Pickup and destination must be different.");
      setEstimate(null);
      return;
    }

    setEstimateLoading(true);
    setEstimateError("");
    setEstimate(null);

    try {
      const response = await fetch(`${API_URL}/estimate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          pickup: pickup.trim(),
          destination: destination.trim(),
          cab_type: cabType,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          typeof data.detail === "string"
            ? data.detail
            : "Could not estimate fare."
        );
      }

      setEstimate(data);
    } catch (error) {
      console.error("Fare estimation error:", error);
      setEstimateError(
        error.message || "Could not estimate fare. Check your backend."
      );
    } finally {
      setEstimateLoading(false);
    }
  }

  async function handleBooking(event) {
    event.preventDefault();

    if (!pickup.trim() || !destination.trim()) {
      alert("Please enter both pickup and destination.");
      return;
    }

    if (pickup.trim().toLowerCase() === destination.trim().toLowerCase()) {
      alert("Pickup and destination must be different.");
      return;
    }

    setLoading(true);

    try {
      const { data: sessionData, error: sessionError } =
        await supabase.auth.getSession();

      if (sessionError) {
        throw new Error("Could not check your login. Please log in again.");
      }

      const accessToken = sessionData.session?.access_token;

      if (!accessToken) {
        window.location.href = "/auth";
        return;
      }

      const response = await fetch(`${API_URL}/bookings`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          pickup: pickup.trim(),
          destination: destination.trim(),
          cab_type: cabType,
          ...(promoCode.trim() ? { promo_code: promoCode.trim() } : {}),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          typeof data.detail === "string"
            ? data.detail
            : "Booking request failed."
        );
      }

      const fareText = data.fare_estimate
        ? `\nEstimated Fare: ₹${Number(data.fare_estimate).toFixed(2)}` +
          (data.discount_amount ? `\nPromo discount: -₹${Number(data.discount_amount).toFixed(2)} (${data.promo_code})` : "")
        : "\nFare estimate unavailable (Google Maps key not set).";

      alert(
        `Booking submitted!\n\n` +
          `Booking ID: ${data.booking_id}\n` +
          `Pickup: ${data.pickup}\n` +
          `Destination: ${data.destination}\n` +
          `Cab: ${data.cab_type}\n` +
          `Status: ${data.status}` +
          fareText
      );

      await loadBookings();
      clearEstimate();
      setPickup("");
      setDestination("");
    } catch (error) {
      console.error("Booking error:", error);
      alert(error.message || "Could not submit booking. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleReviewSubmit(event) {
    event.preventDefault();
    if (!reviewBookingId) return;

    setReviewLoading(true);
    setReviewMessage("");

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;

      if (!accessToken) {
        setReviewMessage("Please log in to submit a review.");
        return;
      }

      const response = await fetch(`${API_URL}/reviews`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          booking_id: reviewBookingId,
          rating: reviewRating,
          comment: reviewComment.trim() || null,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          typeof data.detail === "string" ? data.detail : "Review failed."
        );
      }

      setReviewMessage(`Review submitted! Rating: ${data.rating}/5`);
      setReviewBookingId(null);
      setReviewComment("");
      setReviewRating(5);
    } catch (error) {
      setReviewMessage(error.message || "Could not submit review.");
    } finally {
      setReviewLoading(false);
    }
  }

  const inputClass =
    "w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100";

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <nav className="flex items-center justify-between bg-white px-6 py-4 shadow-sm md:px-12">
        <h1 className="text-2xl font-bold text-blue-700">
          RideEase<span className="text-slate-900">.</span>
        </h1>

        {/* Desktop nav links — hidden below md breakpoint */}
        <div className="hidden gap-8 font-medium md:flex items-center">
          <a href="#book" className="hover:text-blue-700">
            Book a ride
          </a>
          <a href="#booking-history" className="hover:text-blue-700">
            Booking history
          </a>
          <a href="#how-it-works" className="hover:text-blue-700">
            How it works
          </a>
        </div>

        {/*
          ── Auth control — ALWAYS VISIBLE ──────────────────────────────────
          Placed outside the hidden-md div so it shows on every screen size.
          Three states:
            undefined → resolving (shows faint "…" for up to 2 s)
            authUser  → logged in  (email + Log out button)
            null      → logged out (Register + Log in buttons)
        */}
        <div className="flex items-center gap-2">
          {authUser === undefined ? (
            /* Briefly resolving — tiny spinner placeholder */
            <span className="text-sm text-slate-400 px-2">…</span>
          ) : authUser ? (
            /* ── Signed in ── */
            <span className="flex items-center gap-3">
              <span
                title={authUser.email}
                className="hidden sm:inline max-w-[180px] truncate text-sm text-slate-600"
              >
                {authUser.email}
              </span>
              <button
                id="nav-logout-btn"
                type="button"
                disabled={authLoading}
                onClick={async () => {
                  setAuthLoading(true);
                  await supabase.auth.signOut();
                  setAuthLoading(false);
                }}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:border-red-400 hover:text-red-600 disabled:opacity-50"
              >
                {authLoading ? "Signing out…" : "Log out"}
              </button>
            </span>
          ) : (
            /* ── Signed out — Register + Log in ── */
            <span className="flex items-center gap-2">
              <a
                id="nav-register-btn"
                href="/auth?tab=signup"
                className="rounded-lg border border-blue-600 px-4 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-50"
              >
                Register
              </a>
              <a
                id="nav-login-btn"
                href="/auth?tab=login"
                className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800"
              >
                Log in
              </a>
            </span>
          )}

          {/* Book now — always visible */}
          <button
            type="button"
            onClick={() =>
              document.getElementById("book")?.scrollIntoView({
                behavior: "smooth",
              })
            }
            className="hidden md:inline-flex rounded-lg bg-blue-700 px-5 py-2.5 font-semibold text-white hover:bg-blue-800"
          >
            Book now
          </button>
        </div>
      </nav>

      <section className="grid items-center gap-12 px-6 py-16 md:grid-cols-2 md:px-12 md:py-24">
        <div>
          <p className="mb-4 font-semibold uppercase tracking-widest text-blue-700">
            Your journey, made simple
          </p>

          <h2 className="max-w-xl text-4xl font-extrabold leading-tight md:text-6xl">
            Your ride is just a few clicks away.
          </h2>

          <p className="mt-6 max-w-lg text-lg leading-8 text-slate-600">
            Book a cab, choose your ride, and plan your journey from one simple
            place. Safe, convenient, and easy to use.
          </p>

          <button
            type="button"
            onClick={() =>
              document.getElementById("book")?.scrollIntoView({
                behavior: "smooth",
              })
            }
            className="mt-8 rounded-xl bg-blue-700 px-7 py-4 font-bold text-white shadow-lg hover:bg-blue-800"
          >
            Book your ride →
          </button>

          <div className="mt-10 flex flex-wrap gap-8">
            <div>
              <p className="text-2xl font-bold">24/7</p>
              <p className="text-sm text-slate-500">Ride booking</p>
            </div>
            <div>
              <p className="text-2xl font-bold">Easy</p>
              <p className="text-sm text-slate-500">Booking process</p>
            </div>
            <div>
              <p className="text-2xl font-bold">Secure</p>
              <p className="text-sm text-slate-500">Login protected</p>
            </div>
          </div>
        </div>

        <div className="rounded-3xl bg-blue-100 p-5 md:p-8">
          <div className="rounded-2xl bg-white p-6 shadow-xl md:p-8">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Plan your trip</p>
                <h3 className="text-2xl font-bold">Where to?</h3>
              </div>
              <span className="text-4xl" aria-hidden="true">
                🚕
              </span>
            </div>

            <form id="book" onSubmit={handleBooking} className="space-y-5">
              <div>
                <label htmlFor="pickup" className="mb-2 block font-semibold">
                  Pickup location
                </label>
                <input
                  id="pickup"
                  value={pickup}
                  onChange={(event) => {
                    setPickup(event.target.value);
                    clearEstimate();
                  }}
                  placeholder="Enter your pickup location"
                  className={inputClass}
                  required
                />
              </div>

              <div>
                <label
                  htmlFor="destination"
                  className="mb-2 block font-semibold"
                >
                  Destination
                </label>
                <input
                  id="destination"
                  value={destination}
                  onChange={(event) => {
                    setDestination(event.target.value);
                    clearEstimate();
                  }}
                  placeholder="Where would you like to go?"
                  className={inputClass}
                  required
                />
              </div>

              <div>
                <label htmlFor="cabType" className="mb-2 block font-semibold">
                  Choose your cab
                </label>
                <select
                  id="cabType"
                  value={cabType}
                  onChange={(event) => {
                    setCabType(event.target.value);
                    clearEstimate();
                  }}
                  className={`${inputClass} bg-white`}
                >
                  <option value="Go">RideEase Go — Economy (₹30 + ₹12/km)</option>
                  <option value="Sedan">RideEase Sedan — Comfort (₹50 + ₹16/km)</option>
                  <option value="SUV">RideEase SUV — More space (₹80 + ₹20/km)</option>
                </select>
              </div>

              <button
                type="button"
                onClick={handleEstimate}
                disabled={estimateLoading}
                className="w-full rounded-xl border border-blue-700 py-3 font-bold text-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {estimateLoading ? "Calculating..." : "Estimate Fare"}
              </button>

              {estimateError && (
                <p role="alert" className="text-sm text-red-600">
                  {estimateError}
                </p>
              )}

              {estimate && (
                <div className="rounded-xl bg-blue-50 p-4">
                  <p className="font-bold text-blue-800">Fare Estimate</p>
                  <p className="mt-2">Pickup: {estimate.pickup}</p>
                  <p>Destination: {estimate.destination}</p>
                  <p>Cab: {estimate.cab_type}</p>
                  {estimate.distance_km ? (
                    <>
                      <p>Distance: {estimate.distance_km} km</p>
                      <p>Duration: ~{estimate.estimated_duration_minutes} min</p>
                      <p className="mt-2 text-2xl font-bold">
                        ₹{Number(estimate.estimated_fare).toFixed(2)}
                      </p>
                      <p className="mt-1 text-xs text-slate-600">
                        {estimate.note}
                      </p>
                    </>
                  ) : (
                    <p className="mt-2 text-sm text-amber-700">
                      {estimate.note}
                    </p>
                  )}

                  {/* Day 10: Promo code input — shown only after a fare is estimated */}
                  {estimate.distance_km && (
                    <div className="mt-4 border-t border-blue-200 pt-4">
                      <p className="mb-2 text-sm font-semibold text-blue-700">Have a promo code?</p>
                      <div className="flex gap-2">
                        <input
                          id="promoCode"
                          value={promoCode}
                          onChange={(e) => { setPromoCode(e.target.value); setPromoResult(null); setPromoError(""); }}
                          placeholder="Enter code (e.g. SAVE10)"
                          className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-600"
                        />
                        <button
                          type="button"
                          onClick={handleValidatePromo}
                          disabled={promoLoading}
                          className="rounded-lg bg-slate-700 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
                        >
                          {promoLoading ? "..." : "Apply"}
                        </button>
                      </div>
                      {promoError && <p className="mt-1 text-xs text-red-600">{promoError}</p>}
                      {promoResult && (
                        <div className="mt-2 rounded-lg bg-green-50 p-3 text-sm text-green-800">
                          <p className="font-bold">🎉 Promo applied — {promoResult.discount_percent}% off</p>
                          <p>Discount: −₹{promoResult.discount_amount.toFixed(2)}</p>
                          <p className="text-lg font-extrabold">Final fare: ₹{promoResult.final_fare.toFixed(2)}</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-xl bg-blue-700 py-4 font-bold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? "Submitting..." : "Request a ride"}
              </button>
            </form>

            <p className="mt-4 text-center text-xs text-slate-500">
              Booking requests are saved to the database.
            </p>
          </div>
        </div>
      </section>

      {/* ── Booking History ─────────────────────────────────────────────── */}
      <section
        id="booking-history"
        className="bg-slate-50 px-6 py-16 md:px-12"
      >
        <div className="mx-auto max-w-5xl">
          <h2 className="text-3xl font-bold">My Booking History</h2>
          <p className="mt-2 text-slate-600">
            View your previous cab booking requests.
          </p>

          <button
            type="button"
            onClick={loadBookings}
            disabled={historyLoading}
            className="mt-4 rounded-lg bg-blue-700 px-4 py-2 font-semibold text-white disabled:opacity-60"
          >
            {historyLoading ? "Loading..." : "Refresh bookings"}
          </button>

          {historyError && (
            <p role="alert" className="mt-4 text-red-600">
              {historyError}
            </p>
          )}

          {!historyLoading && !historyError && bookings.length === 0 && (
            <p className="mt-4 text-slate-600">No bookings found yet.</p>
          )}

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {bookings.map((booking) => (
              <div
                key={booking.booking_id}
                className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
              >
                <div className="flex items-center justify-between gap-3">
                  <h3 className="font-bold">Booking #{booking.booking_id}</h3>
                  <span className="rounded-full bg-blue-100 px-3 py-1 text-sm text-blue-800">
                    {booking.status}
                  </span>
                </div>

                <p className="mt-3">
                  <strong>Pickup:</strong> {booking.pickup}
                </p>
                <p className="mt-2">
                  <strong>Destination:</strong> {booking.destination}
                </p>
                <p className="mt-2">
                  <strong>Cab:</strong> {booking.cab_type}
                </p>
                {booking.distance_km && (
                  <p className="mt-2">
                    <strong>Distance:</strong> {booking.distance_km} km
                  </p>
                )}
                {booking.fare_estimate && (
                  <p className="mt-2">
                    <strong>Fare estimate:</strong> ₹
                    {Number(booking.fare_estimate).toFixed(2)}
                  </p>
                )}
                {booking.fare_actual && (
                  <p className="mt-2">
                    <strong>Fare paid:</strong> ₹
                    {Number(booking.fare_actual).toFixed(2)}
                  </p>
                )}
                <p className="mt-2 text-sm text-slate-500">
                  {booking.created_at
                    ? new Date(booking.created_at).toLocaleString()
                    : ""}
                </p>

                {/* Rate this ride button */}
                <button
                  type="button"
                  onClick={() => {
                    setReviewBookingId(booking.booking_id);
                    setReviewMessage("");
                    document
                      .getElementById("review-form")
                      ?.scrollIntoView({ behavior: "smooth" });
                  }}
                  className="mt-3 rounded-lg border border-blue-600 px-3 py-1.5 text-sm font-medium text-blue-700 hover:bg-blue-50"
                >
                  Rate this ride ★
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Wallet (Day 10) ───────────────────────────────────────────── */}
      <section id="wallet" className="bg-white px-6 py-12 md:px-12 border-t border-slate-100">
        <div className="mx-auto max-w-xl">
          <h2 className="text-2xl font-bold">My Wallet</h2>

          {/* Balance display */}
          <div className="mt-4 flex items-center gap-4 rounded-2xl bg-blue-700 px-6 py-5 text-white shadow-lg">
            <span className="text-3xl">💰</span>
            <div>
              <p className="text-sm opacity-80">Available balance</p>
              {walletLoading ? (
                <p className="text-2xl font-bold">Loading…</p>
              ) : walletBalance !== null ? (
                <p className="text-3xl font-extrabold">₹{Number(walletBalance).toFixed(2)}</p>
              ) : (
                <p className="text-lg opacity-70">Log in to view balance</p>
              )}
            </div>
            <button
              type="button"
              onClick={loadWallet}
              disabled={walletLoading}
              className="ml-auto rounded-lg bg-white/20 px-3 py-1.5 text-sm font-semibold hover:bg-white/30 disabled:opacity-50"
            >
              Refresh
            </button>
          </div>

          {/* Top-up form */}
          <form onSubmit={handleTopup} className="mt-6 space-y-3">
            <p className="font-semibold">Top up wallet</p>
            <div className="flex gap-2">
              <input
                id="topupAmount"
                type="number"
                min="1"
                max="10000"
                step="1"
                value={topupAmount}
                onChange={(e) => { setTopupAmount(e.target.value); setTopupMessage(""); }}
                placeholder="Amount in ₹ (max 10,000)"
                className="flex-1 rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
              />
              <button
                type="submit"
                disabled={topupLoading}
                className="rounded-xl bg-blue-700 px-5 py-3 font-bold text-white hover:bg-blue-800 disabled:opacity-60"
              >
                {topupLoading ? "…" : "Add"}
              </button>
            </div>
            {topupMessage && (
              <p role="status" className="rounded-lg bg-slate-100 p-3 text-sm">
                {topupMessage}
              </p>
            )}
            <p className="text-xs text-slate-500">
              In production, top-up is processed via Stripe. Dev mode credits instantly.
            </p>
          </form>
        </div>
      </section>

      {/* ── Review Form ─────────────────────────────────────────────────── */}
      <section id="review-form" className="bg-white px-6 py-12 md:px-12">
        <div className="mx-auto max-w-xl">
          <h2 className="text-2xl font-bold">Leave a Review</h2>
          {reviewBookingId ? (
            <form
              onSubmit={handleReviewSubmit}
              className="mt-6 space-y-4"
            >
              <p className="text-slate-600">
                Rating for Booking #{reviewBookingId}
              </p>
              <div>
                <label className="mb-2 block font-semibold">
                  Rating (1 – 5)
                </label>
                <select
                  value={reviewRating}
                  onChange={(e) => setReviewRating(Number(e.target.value))}
                  className={`${inputClass} bg-white`}
                >
                  {[5, 4, 3, 2, 1].map((n) => (
                    <option key={n} value={n}>
                      {"★".repeat(n)}{"☆".repeat(5 - n)} ({n}/5)
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-2 block font-semibold">
                  Comment (optional)
                </label>
                <textarea
                  value={reviewComment}
                  onChange={(e) => setReviewComment(e.target.value)}
                  rows={3}
                  placeholder="How was your ride?"
                  className={`${inputClass} resize-none`}
                />
              </div>
              <button
                type="submit"
                disabled={reviewLoading}
                className="w-full rounded-xl bg-blue-700 py-3 font-bold text-white hover:bg-blue-800 disabled:opacity-60"
              >
                {reviewLoading ? "Submitting..." : "Submit Review"}
              </button>
              <button
                type="button"
                onClick={() => setReviewBookingId(null)}
                className="w-full text-sm text-slate-500 hover:underline"
              >
                Cancel
              </button>
            </form>
          ) : (
            <p className="mt-4 text-slate-600">
              Click <strong>&quot;Rate this ride ★&quot;</strong> on any booking
              above to leave a review.
            </p>
          )}

          {reviewMessage && (
            <p
              role="status"
              className="mt-4 rounded-lg bg-slate-100 p-3 text-sm"
            >
              {reviewMessage}
            </p>
          )}
        </div>
      </section>

      {/* ── How it works ────────────────────────────────────────────────── */}
      <section id="how-it-works" className="bg-slate-50 px-6 py-16 md:px-12">
        <div className="mx-auto max-w-5xl text-center">
          <p className="font-semibold text-blue-700">SIMPLE AND CONVENIENT</p>
          <h2 className="mt-3 text-3xl font-bold">How it works</h2>

          <div className="mt-10 grid gap-8 text-left md:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 p-6">
              <span className="text-3xl">📍</span>
              <h3 className="mt-4 text-xl font-bold">1. Enter locations</h3>
              <p className="mt-2 leading-7 text-slate-600">
                Enter your pickup and destination.
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 p-6">
              <span className="text-3xl">🚘</span>
              <h3 className="mt-4 text-xl font-bold">2. Get a fare estimate</h3>
              <p className="mt-2 leading-7 text-slate-600">
                Click &quot;Estimate Fare&quot; to get a real route-based price.
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 p-6">
              <span className="text-3xl">🛣️</span>
              <h3 className="mt-4 text-xl font-bold">3. Request &amp; ride</h3>
              <p className="mt-2 leading-7 text-slate-600">
                Submit your booking and rate your ride when complete.
              </p>
            </div>
          </div>
        </div>
      </section>

      <footer className="bg-slate-900 px-6 py-6 text-center text-sm text-white">
        © 2026 RideEase — Cab Booking Platform
      </footer>
    </main>
  );
}
