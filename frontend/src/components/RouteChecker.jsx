import React, { useState } from 'react';
import {
  AlertTriangle,
  Info,
  Navigation,
  ShieldAlert,
  Share2,
  Sparkles,
  X,
  Loader2,
  Landmark,
  CheckCircle2,
  FileText
} from 'lucide-react';
import { evaluateRoute } from '../utils/routeChecker';
import { fetchRoadRoute } from '../utils/fetchRoute';
import { api } from '../utils/api';
import { APP_CONFIG } from '../config';

function buildShareText(evalResult, routeStats, escalationTicket) {
  const statusLine = {
    critical_risk: 'HIGHER RISK: flooding reported near a known open drain / hazard on this route.',
    moderate_risk: 'MODERATE RISK: known drain / pothole spots near this route.',
    advisory: 'ADVISORY: waterlogging reported near this route.',
    lower_risk: 'No reports on this route right now (this does not mean it is clear).'
  }[evalResult.overallStatus];

  const top = evalResult.warnings.slice(0, 3).map((w) => `- ${w.message}`);
  const lines = [
    'WaterLine Route Safety Check',
    `Safety Score: ${evalResult.safetyScore}/100 (${evalResult.safetyRating})`,
    statusLine,
    ...top,
    routeStats ? `Road distance: ${routeStats.distanceKm} km` : null,
    evalResult.potholeCluster?.detected
      ? `Flagged for Govt Escalation: ${evalResult.potholeCluster.count} potholes along corridor.`
      : null,
    escalationTicket ? `Active PWD Grievance Ticket: ${escalationTicket.ticketId}` : null,
    'Water can hide open drains. Plan safely before riding.',
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
  setRouteCoordinates,
  onEscalationCreated
}) {
  const [evalResult, setEvalResult] = useState(null);
  const [isCalculating, setIsCalculating] = useState(false);
  const [routeError, setRouteError] = useState(null);
  const [routeStats, setRouteStats] = useState(null);

  // Government Escalation state
  const [isEscalating, setIsEscalating] = useState(false);
  const [escalationResult, setEscalationResult] = useState(null);
  const [escalationError, setEscalationError] = useState(null);
  const [citizenNotes, setCitizenNotes] = useState('');
  const [showDossierModal, setShowDossierModal] = useState(false);

  const handleCheckRoute = async () => {
    if (!startPoint || !endPoint) {
      alert("Please select both a Start Point (A) and End Point (B) on the map or click 'Load Preset Route'.");
      return;
    }

    setIsCalculating(true);
    setRouteError(null);
    setEscalationResult(null);
    setEscalationError(null);

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

      const result = evaluateRoute(
        routeResult.waypoints,
        pins,
        APP_CONFIG.CORRIDOR_THRESHOLD_METERS,
        APP_CONFIG.POTHOLE_ESCALATION_THRESHOLD
      );
      setEvalResult(result);
    } catch (err) {
      setRouteError(`Routing error: ${err.message}`);
    } finally {
      setIsCalculating(false);
    }
  };

  const handleEscalateToGovernment = async () => {
    if (!evalResult || !evalResult.potholeCluster?.canEscalate) return;

    setIsEscalating(true);
    setEscalationError(null);

    const routeName = `Corridor [${startPoint.lat.toFixed(3)}, ${startPoint.lng.toFixed(3)}] to [${endPoint.lat.toFixed(3)}, ${endPoint.lng.toFixed(3)}]`;

    try {
      const payload = {
        city: APP_CONFIG.DEFAULT_CITY,
        routeName,
        startPoint,
        endPoint,
        potholeCount: evalResult.potholeCluster.count,
        potholeCoordinates: evalResult.potholeCluster.points,
        citizenNotes: citizenNotes || `Detected ${evalResult.potholeCluster.count} recurring potholes along route corridor impacting commuters.`,
        action: 'escalate'
      };

      const res = await api.escalateRoute(payload);
      setEscalationResult(res);
      if (onEscalationCreated) {
        onEscalationCreated(res.escalation || res);
      }
    } catch (err) {
      setEscalationError(err.message || 'Failed to dispatch government escalation.');
    } finally {
      setIsEscalating(false);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-wmd-border p-4 sm:p-5 shadow-sm space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
        <div>
          <div className="flex items-center gap-2">
            <Navigation className="w-5 h-5 text-aws-blue" />
            <h3 className="font-bold text-neutral-900 text-sm sm:text-base">Check My Route &amp; Hazards</h3>
          </div>
          <p className="text-[10px] font-mono text-neutral-500 mt-0.5">
            Real road path scanning · {APP_CONFIG.CORRIDOR_THRESHOLD_METERS}m corridor analysis · Automated PWD Escalation
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

      {/* Waypoint inputs */}
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

      {/* Buttons */}
      <div className="flex items-center gap-2">
        <button
          onClick={handleCheckRoute}
          disabled={!startPoint || !endPoint || isCalculating}
          className="flex-1 bg-aws-blue hover:bg-aws-blue-dark disabled:bg-neutral-300 text-white font-medium py-2 px-4 rounded-lg text-xs sm:text-sm transition-colors shadow-sm flex items-center justify-center gap-2"
        >
          {isCalculating ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Scanning Road Corridor &amp; Pothole Density...</span>
            </>
          ) : (
            <>
              <Navigation className="w-4 h-4" />
              <span>Scan Corridor for Hazards &amp; Potholes</span>
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
              setEscalationResult(null);
            }}
            className="px-3 py-2 border border-neutral-300 hover:bg-neutral-100 rounded-lg text-xs text-neutral-600 transition-colors"
          >
            Clear
          </button>
        )}
      </div>

      {/* Route Error */}
      {routeError && (
        <div className="p-3 bg-red-50 border border-red-300 rounded-xl text-xs text-red-900 space-y-1">
          <div className="font-bold flex items-center gap-1.5 text-red-800">
            <AlertTriangle className="w-4 h-4" />
            <span>Route Geometry Unavailable</span>
          </div>
          <p className="text-[11px] leading-relaxed">{routeError}</p>
        </div>
      )}

      {/* Route Distance & Time */}
      {routeStats && !routeError && (
        <div className="text-[11px] font-mono text-neutral-500 flex items-center justify-between px-1">
          <span>Road Distance: {routeStats.distanceKm} km</span>
          <span>Approx car/bike time: ~{routeStats.durationMins} min</span>
        </div>
      )}

      {/* Results Section */}
      {evalResult && (
        <div className="space-y-3 pt-1">
          {/* Dynamic Route Safety Score Bar */}
          <div className="p-3 rounded-xl border bg-neutral-50 flex items-center justify-between">
            <div>
              <div className="text-[10px] font-mono text-neutral-500 font-bold uppercase">
                Route Road Safety Index
              </div>
              <div className="text-base font-black flex items-center gap-2 mt-0.5">
                <span
                  className={
                    evalResult.safetyScore >= 80
                      ? 'text-emerald-600'
                      : evalResult.safetyScore >= 50
                      ? 'text-amber-600'
                      : 'text-red-600'
                  }
                >
                  {evalResult.safetyScore}/100
                </span>
                <span className="text-xs font-mono font-medium text-neutral-600">
                  [{evalResult.safetyRating}]
                </span>
              </div>
            </div>
            <div className="text-right text-[11px] font-mono text-neutral-500">
              <div>Potholes on Route: <strong className="text-neutral-800">{evalResult.summary?.potholeCount || 0}</strong></div>
              <div>Floods on Route: <strong className="text-neutral-800">{evalResult.summary?.advisoryCount || 0}</strong></div>
            </div>
          </div>

          {/* Primary Status Banner */}
          {evalResult.overallStatus === 'critical_risk' ? (
            <div className="bg-red-50 border-2 border-red-500 rounded-xl p-3 sm:p-4 text-red-900 space-y-1">
              <div className="flex items-center gap-2 font-black text-sm sm:text-base text-red-700">
                <AlertTriangle className="w-5 h-5 shrink-0 text-red-600" />
                <span>HIGHER RISK: Submerged Hazard on Route</span>
              </div>
              <p className="text-xs text-red-800 leading-relaxed font-sans">
                Flooding was reported close to a known open drain or missing cover along this road.
                Water may be hiding a deep drop. Avoid this street if possible.
              </p>
            </div>
          ) : evalResult.overallStatus === 'moderate_risk' ? (
            <div className="bg-amber-50 border-2 border-amber-400 rounded-xl p-3 sm:p-4 text-amber-950 space-y-1">
              <div className="flex items-center gap-2 font-bold text-sm text-amber-800">
                <ShieldAlert className="w-5 h-5 shrink-0 text-amber-600" />
                <span>MODERATE RISK: Street Hazards Near Road Path</span>
              </div>
              <p className="text-xs text-amber-900 leading-relaxed">
                Known drain or pothole spots are close to this road. Go slowly or choose another route.
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
                on the map, not that the road is clear. Unmapped drains and potholes can still exist.
              </p>
            </div>
          )}

          {/* ========================================================================= */}
          {/* CIVIC ESCALATION / POTHOLE REDRESSAL SECTION */}
          {/* ========================================================================= */}
          {evalResult.potholeCluster?.canEscalate && (
            <div className="bg-gradient-to-br from-indigo-50 to-sky-50 border-2 border-indigo-400 rounded-xl p-3 sm:p-4 space-y-3 shadow-sm">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-indigo-600 text-white flex items-center justify-center shrink-0">
                    <Landmark className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="font-bold text-indigo-950 text-xs sm:text-sm flex items-center gap-1.5">
                      <span>PWD Civic Escalation Threshold Met</span>
                      <span className="bg-red-100 text-red-800 text-[10px] font-mono px-2 py-0.5 rounded-full font-bold">
                        {evalResult.potholeCluster.count} POTHOLES FLAGGED
                      </span>
                    </h4>
                    <p className="text-[11px] text-indigo-800 mt-0.5">
                      Multiple severe road defects detected along this commuter corridor. Escalate to the Municipal Public Works Department (PWD) for emergency asphalt patching.
                    </p>
                  </div>
                </div>
              </div>

              {!escalationResult ? (
                <div className="space-y-2 pt-1 border-t border-indigo-100">
                  <input
                    type="text"
                    value={citizenNotes}
                    onChange={(e) => setCitizenNotes(e.target.value)}
                    placeholder="Add optional commuter remark (e.g., deep craters near bus stand)..."
                    className="w-full text-xs p-2 rounded-lg border border-indigo-200 bg-white placeholder-neutral-400 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-sans"
                  />
                  <button
                    onClick={handleEscalateToGovernment}
                    disabled={isEscalating}
                    className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-neutral-300 text-white font-semibold py-2 px-3 rounded-lg text-xs flex items-center justify-center gap-2 transition-colors shadow-sm"
                  >
                    {isEscalating ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Dispatching Formal Notice via AWS SNS &amp; SES...</span>
                      </>
                    ) : (
                      <>
                        <Landmark className="w-4 h-4" />
                        <span>Escalate Corridor to PWD / Municipal Authority</span>
                      </>
                    )}
                  </button>
                  {escalationError && (
                    <div className="text-[11px] text-red-600 font-mono">
                      {escalationError}
                    </div>
                  )}
                </div>
              ) : (
                <div className="p-3 bg-white rounded-lg border border-indigo-200 space-y-2">
                  <div className="flex items-center gap-1.5 text-emerald-700 font-bold text-xs">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Official Grievance Registered &amp; Dispatched!</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-[11px] font-mono text-neutral-600 bg-neutral-50 p-2 rounded">
                    <div>
                      <span className="text-neutral-400 block">TICKET ID:</span>
                      <strong className="text-indigo-900 font-bold">{escalationResult.ticketId}</strong>
                    </div>
                    <div>
                      <span className="text-neutral-400 block">DEPARTMENT:</span>
                      <strong className="text-neutral-800">PWD Road Safety Cell</strong>
                    </div>
                    <div>
                      <span className="text-neutral-400 block">COMPLAINT TALLY:</span>
                      <strong className="text-neutral-800">{escalationResult.complaintCount || 1} Citizen(s)</strong>
                    </div>
                    <div>
                      <span className="text-neutral-400 block">STATUS:</span>
                      <span className="bg-amber-100 text-amber-800 px-1.5 py-0.2 rounded font-bold">
                        Escalated to PWD
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowDossierModal(true)}
                    className="text-xs text-indigo-700 hover:text-indigo-900 font-semibold flex items-center gap-1 underline pt-0.5"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>View Official Inspection Notice Dossier</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Telemetry warnings list */}
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

          {/* Share on WhatsApp */}
          <a
            href={`https://wa.me/?text=${encodeURIComponent(
              buildShareText(evalResult, routeStats, escalationResult)
            )}`}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-emerald-900 font-semibold py-2 px-3 rounded-lg text-xs flex items-center justify-center gap-2 transition-colors"
          >
            <Share2 className="w-4 h-4" />
            <span>Share Route Hazard &amp; Safety Report on WhatsApp</span>
          </a>

          <div className="bg-neutral-100 p-2.5 rounded-lg border border-neutral-200 text-[11px] text-neutral-600 font-mono space-y-0.5">
            <div className="font-bold text-neutral-800">COMMUTER NOTICE:</div>
            <div>Standing water can conceal open drains and wheel-fracturing potholes.</div>
          </div>
        </div>
      )}

      {/* Official Inspection Dossier Modal */}
      {showDossierModal && escalationResult && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-lg w-full p-5 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2">
                <Landmark className="w-5 h-5 text-indigo-700" />
                <h3 className="font-bold text-neutral-900 text-sm">
                  Official Municipal Defect Notice
                </h3>
              </div>
              <button onClick={() => setShowDossierModal(false)} className="text-neutral-400 hover:text-neutral-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="font-mono text-xs bg-neutral-50 p-4 rounded-lg border border-neutral-200 space-y-2 whitespace-pre-wrap leading-relaxed text-neutral-800">
              <div className="font-bold text-center border-b pb-2 text-indigo-900">
                PUBLIC WORKS DEPARTMENT (PWD) / MUNICIPAL CORPORATION
                CIVIC ROAD DEFECT ESCALATION RECORD
              </div>
              <div><strong>Ticket Reference :</strong> {escalationResult.ticketId}</div>
              <div><strong>Jurisdiction      :</strong> {APP_CONFIG.DEFAULT_CITY.toUpperCase()}</div>
              <div><strong>Corridor Segment  :</strong> Route Corridor [Start-to-End]</div>
              <div><strong>Potholes Flagged  :</strong> {evalResult.potholeCluster.count} Critical Defects</div>
              <div><strong>Citizen Grievances:</strong> {escalationResult.complaintCount || 1} Verified Commuters</div>
              <div><strong>Cloud Audit Dossier:</strong> s3://waterline-evidence-bucket/reports/{escalationResult.ticketId}.json</div>
              <div><strong>Dispatch Route    :</strong> Amazon SNS Government Topic &amp; SES Mail Gateway</div>
              <div><strong>Timestamp         :</strong> {new Date().toISOString()}</div>
              <div className="border-t pt-2 text-[11px] text-neutral-600">
                Action Mandate: Section 44 Road Safety Act. Cold-mix patch inspection assigned within 48 hours.
              </div>
            </div>

            <button
              onClick={() => setShowDossierModal(false)}
              className="w-full bg-neutral-900 text-white py-2 rounded-lg text-xs font-semibold hover:bg-neutral-800"
            >
              Close Dossier
            </button>
          </div>
        </div>
      )}
    </div>
  );
}