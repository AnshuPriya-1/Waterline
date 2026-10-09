import React, { useState } from 'react';
import { AlertTriangle, CheckCircle, Navigation, ShieldAlert, Sparkles, X, Loader2 } from 'lucide-react';
import { evaluateRoute } from '../utils/routeChecker';
import { fetchRoadRoute } from '../utils/fetchRoute';
import { APP_CONFIG } from '../config';

export default function RouteChecker({
  pins,
  startPoint,
  endPoint,
  onSetStart,
  onSetEnd,
  onClearRoute,
  onLoadPresetRoute,
  routeCoordinates,
  setRouteCoordinates
}) {
  const [evalResult, setEvalResult] = useState(null);
  const [isCalculating, setIsCalculating] = useState(false);
  const [routeError, setRouteError] = useState(null);
  const [routeStats, setRouteStats] = useState(null);

  const handleCheckRoute = async () => {
    if (!startPoint || !endPoint) {
      alert("Please select both a Start Point (A) and End Point (B) on the map or click 'Load Demo Route'.");
      return;
    }

    setIsCalculating(true);
    setRouteError(null);

    try {
      const routeResult = await fetchRoadRoute(startPoint, endPoint);

      if (!routeResult.success || routeResult.waypoints.length === 0) {
        setRouteError(routeResult.error || "Could not retrieve real road geometry.");
        setRouteCoordinates([]);
        setEvalResult(null);
        setIsCalculating(false);
        return;
      }

      setRouteCoordinates(routeResult.waypoints);
      setRouteStats({
        distanceKm: (routeResult.distanceMeters / 1000).toFixed(2),
        durationMins: Math.ceil(routeResult.durationSeconds / 60)
      });

      const result = evaluateRoute(routeResult.waypoints, pins, APP_CONFIG.CORRIDOR_THRESHOLD_METERS);
      setEvalResult(result);
    } catch (err) {
      setRouteError(`Routing error: ${err.message}`);
    } finally {
      setIsCalculating(false);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-wmd-border p-4 sm:p-5 shadow-sm space-y-4">
      <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
        <div>
          <div className="flex items-center gap-2">
            <Navigation className="w-5 h-5 text-aws-blue" />
            <h3 className="font-bold text-neutral-900 text-sm sm:text-base">Check My Route</h3>
          </div>
          <p className="text-[10px] font-mono text-neutral-500 mt-0.5">
            Real OSRM road geometry · 40m hazard corridor scan
          </p>
        </div>
        <button
          onClick={onLoadPresetRoute}
          className="text-xs bg-sky-50 text-aws-blue hover:bg-sky-100 border border-sky-200 px-2.5 py-1 rounded font-medium flex items-center gap-1 transition-colors"
        >
          <Sparkles className="w-3 h-3 text-amber-600" />
          <span>Load Preset Route</span>
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs font-mono">
        <div className="p-2.5 rounded-lg border border-neutral-200 bg-neutral-50 flex items-center justify-between">
          <div>
            <span className="font-bold text-emerald-700">POINT A (START):</span>
            <div className="text-neutral-600 truncate mt-0.5">
              {startPoint ? `${startPoint.lat.toFixed(4)}, ${startPoint.lng.toFixed(4)}` : 'Tap map to set'}
            </div>
          </div>
          {startPoint && (
            <button onClick={() => onSetStart(null)} className="text-neutral-400 hover:text-neutral-600">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="p-2.5 rounded-lg border border-neutral-200 bg-neutral-50 flex items-center justify-between">
          <div>
            <span className="font-bold text-rose-700">POINT B (END):</span>
            <div className="text-neutral-600 truncate mt-0.5">
              {endPoint ? `${endPoint.lat.toFixed(4)}, ${endPoint.lng.toFixed(4)}` : 'Tap map to set'}
            </div>
          </div>
          {endPoint && (
            <button onClick={() => onSetEnd(null)} className="text-neutral-400 hover:text-neutral-600">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={handleCheckRoute}
          disabled={!startPoint || !endPoint || isCalculating}
          className="flex-1 bg-aws-blue hover:bg-aws-blue-dark disabled:bg-neutral-300 text-white font-medium py-2 px-4 rounded-lg text-xs sm:text-sm transition-colors shadow-sm flex items-center justify-center gap-2"
        >
          {isCalculating ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Fetching Real Road Path & Scanning...</span>
            </>
          ) : (
            <>
              <Navigation className="w-4 h-4" />
              <span>Scan Road Corridor for Hazards</span>
            </>
          )}
        </button>
        {(startPoint || endPoint || evalResult || routeError) && (
          <button
            onClick={() => {
              onClearRoute();
              setEvalResult(null);
              setRouteError(null);
              setRouteStats(null);
            }}
            className="px-3 py-2 border border-neutral-300 hover:bg-neutral-100 rounded-lg text-xs text-neutral-600 transition-colors"
          >
            Clear
          </button>
        )}
      </div>

      {routeError && (
        <div className="p-3 bg-red-50 border border-red-300 rounded-xl text-xs text-red-900 space-y-1">
          <div className="font-bold flex items-center gap-1.5 text-red-800">
            <AlertTriangle className="w-4 h-4" />
            <span>Route Geometry Unavailable</span>
          </div>
          <p className="text-[11px] leading-relaxed">{routeError}</p>
        </div>
      )}

      {routeStats && !routeError && (
        <div className="text-[11px] font-mono text-neutral-500 flex items-center justify-between px-1">
          <span>Road Distance: {routeStats.distanceKm} km</span>
          <span>Approx Drive: ~{routeStats.durationMins} min</span>
        </div>
      )}

      {evalResult && (
        <div className="space-y-3 pt-1">
          {evalResult.overallStatus === 'critical_risk' ? (
            <div className="bg-red-50 border-2 border-red-500 rounded-xl p-3 sm:p-4 text-red-900 space-y-1">
              <div className="flex items-center gap-2 font-black text-sm sm:text-base text-red-700">
                <AlertTriangle className="w-5 h-5 shrink-0 text-red-600" />
                <span>HIGHER RISK: Submerged Hazard on Route</span>
              </div>
              <p className="text-xs text-red-800 leading-relaxed font-sans">
                Waterlogging was reported within 50m of a known open drain or missing cover along this road corridor. 
                Water may be hiding deep drops. Avoid this street.
              </p>
            </div>
          ) : evalResult.overallStatus === 'moderate_risk' ? (
            <div className="bg-amber-50 border-2 border-amber-400 rounded-xl p-3 sm:p-4 text-amber-950 space-y-1">
              <div className="flex items-center gap-2 font-bold text-sm text-amber-800">
                <ShieldAlert className="w-5 h-5 shrink-0 text-amber-600" />
                <span>MODERATE RISK: Street Hazards Near Road Path</span>
              </div>
              <p className="text-xs text-amber-900 leading-relaxed">
                Known drain or pothole spots are within 40m of this road. Proceed with caution.
              </p>
            </div>
          ) : evalResult.overallStatus === 'advisory' ? (
            <div className="bg-sky-50 border border-sky-300 rounded-xl p-3 text-sky-950 space-y-1">
              <div className="flex items-center gap-2 font-bold text-sm text-sky-800">
                <ShieldAlert className="w-4 h-4 shrink-0 text-sky-600" />
                <span>ADVISORY: Active Waterlogging Reported</span>
              </div>
              <p className="text-xs text-sky-900 leading-relaxed">
                Water accumulation reported recently along this road path.
              </p>
            </div>
          ) : (
            <div className="bg-emerald-50 border border-emerald-300 rounded-xl p-3 text-emerald-950 space-y-1">
              <div className="flex items-center gap-2 font-bold text-sm text-emerald-800">
                <CheckCircle className="w-4 h-4 shrink-0 text-emerald-600" />
                <span>LOWER RISK: No Active Hazards Flagged</span>
              </div>
              <p className="text-xs text-emerald-900 leading-relaxed">
                No active flood pins or known drains mapped along this exact road corridor in the past 45 minutes.
              </p>
            </div>
          )}

          {evalResult.warnings.length > 0 && (
            <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
              <div className="text-[11px] font-mono font-bold text-neutral-500 uppercase tracking-wider">
                Corridor Telemetry Log ({evalResult.warnings.length} items flagged)
              </div>
              {evalResult.warnings.map((w, idx) => (
                <div
                  key={idx}
                  className={`p-2.5 rounded-lg border text-xs space-y-1 ${
                    w.level === 'CRITICAL'
                      ? 'bg-red-50/80 border-red-300 text-red-950'
                      : w.level === 'CAUTION'
                      ? 'bg-amber-50/80 border-amber-300 text-amber-950'
                      : 'bg-sky-50/80 border-sky-200 text-sky-950'
                  }`}
                >
                  <div className="flex items-center justify-between font-bold text-[11px]">
                    <span className="uppercase tracking-wide">{w.title}</span>
                    <span className="font-mono text-[10px] opacity-80">
                      {w.distanceToRoute}m from road
                    </span>
                  </div>
                  <p className="text-[11px] leading-relaxed opacity-90">{w.message}</p>
                </div>
              ))}
            </div>
          )}

          <div className="bg-neutral-100 p-2.5 rounded-lg border border-neutral-200 text-[11px] text-neutral-600 font-mono space-y-0.5">
            <div className="font-bold text-neutral-800">MANDATORY NOTICE:</div>
            <div>Water can hide open drains. This is an estimate, not a guarantee.</div>
          </div>
        </div>
      )}
    </div>
  );
}