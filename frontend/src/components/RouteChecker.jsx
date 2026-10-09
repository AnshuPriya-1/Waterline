import React, { useState } from 'react';
import { AlertTriangle, Info, Navigation, ShieldAlert, Share2, Sparkles, X, Loader2 } from 'lucide-react';
import { evaluateRoute } from '../utils/routeChecker';
import { fetchRoadRoute } from '../utils/fetchRoute';
import { APP_CONFIG } from '../config';

function buildShareText(evalResult, routeStats) {
  const statusLine = {
    critical_risk: 'HIGHER RISK: flooding reported near a known open drain / hazard on this route.',
    moderate_risk: 'MODERATE RISK: known drain / hazard spots near this route.',
    advisory: 'ADVISORY: waterlogging reported near this route.',
    lower_risk: 'No reports on this route right now (this does not mean it is clear).'
  }[evalResult.overallStatus];

  const top = evalResult.warnings.slice(0, 3).map((w) => `- ${w.message}`);
  const lines = [
    'WaterLine route check',
    statusLine,
    ...top,
    routeStats ? `Road distance: ${routeStats.distanceKm} km` : null,
    'Water can hide open drains. This is an estimate, not a guarantee.',
    typeof window !== 'undefined' ? window.location.origin : ''
  ].filter(Boolean);
  return lines.join('\n');
}

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
            Real road path (OSRM, car routes) · {APP_CONFIG.CORRIDOR_THRESHOLD_METERS} m corridor check
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
          <span>Approx car time: ~{routeStats.durationMins} min</span>
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
                Flooding was reported close to a known open drain or missing cover along this road. 
                Water may be hiding a deep drop. Avoid this street if you can.
              </p>
            </div>
          ) : evalResult.overallStatus === 'moderate_risk' ? (
            <div className="bg-amber-50 border-2 border-amber-400 rounded-xl p-3 sm:p-4 text-amber-950 space-y-1">
              <div className="flex items-center gap-2 font-bold text-sm text-amber-800">
                <ShieldAlert className="w-5 h-5 shrink-0 text-amber-600" />
                <span>MODERATE RISK: Street Hazards Near Road Path</span>
              </div>
              <p className="text-xs text-amber-900 leading-relaxed">
                Known drain or pothole spots are close to this road. Go slowly or choose another street.
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
            <div className="bg-neutral-50 border border-neutral-300 rounded-xl p-3 text-neutral-900 space-y-1">
              <div className="flex items-center gap-2 font-bold text-sm text-neutral-800">
                <Info className="w-4 h-4 shrink-0 text-neutral-600" />
                <span>NO REPORTS ON THIS ROUTE</span>
              </div>
              <p className="text-xs text-neutral-700 leading-relaxed">
                Nobody has reported a flood or a known hazard along this road. That only means nothing is
                on the map, not that the road is clear. Unmapped drains and potholes can still be there.
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

          <a
            href={`https://wa.me/?text=${encodeURIComponent(buildShareText(evalResult, routeStats))}`}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-emerald-900 font-semibold py-2 px-3 rounded-lg text-xs flex items-center justify-center gap-2 transition-colors"
          >
            <Share2 className="w-4 h-4" />
            <span>Share this route check on WhatsApp</span>
          </a>

          <div className="bg-neutral-100 p-2.5 rounded-lg border border-neutral-200 text-[11px] text-neutral-600 font-mono space-y-0.5">
            <div className="font-bold text-neutral-800">MANDATORY NOTICE:</div>
            <div>Water can hide open drains. This is an estimate, not a guarantee.</div>
          </div>
        </div>
      )}
    </div>
  );
}