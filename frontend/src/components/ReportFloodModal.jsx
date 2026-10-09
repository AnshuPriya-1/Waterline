import React, { useState, useEffect, useMemo } from 'react';
import { Check, Droplets, Loader2, MapPin, Upload, X, AlertCircle, AlertTriangle } from 'lucide-react';
import { resizeImage } from '../utils/imageResizer';
import { api } from '../utils/api';
import { APP_CONFIG } from '../config';
import { getCurrentPosition } from '../utils/location';
import { haversineDistanceMeters } from '../utils/routeChecker';

const LEVEL_OPTIONS = [
  { id: 'ankle', label: 'Ankle Level', depth: 'less than 6 inches', color: 'border-sky-300 bg-sky-50 text-sky-900' },
  { id: 'knee', label: 'Knee Level', depth: 'about 1.5 feet', color: 'border-blue-400 bg-blue-50 text-blue-900' },
  { id: 'waist', label: 'Waist Level', depth: 'about 3 feet', color: 'border-amber-400 bg-amber-50 text-amber-950' },
  { id: 'stalled', label: 'Vehicle Stalls', depth: 'above the exhaust pipe', color: 'border-red-400 bg-red-50 text-red-950' }
];

export default function ReportFloodModal({ isOpen, onClose, defaultCoords, pins = [], onReportCreated }) {
  const [photoPreview, setPhotoPreview] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiSuggestion, setAiSuggestion] = useState(null);
  const [userConfirmedLevel, setUserConfirmedLevel] = useState(null);
  const [coords, setCoords] = useState(defaultCoords);
  const [accuracy, setAccuracy] = useState(null);
  const [isLocating, setIsLocating] = useState(false);
  const [locatingError, setLocatingError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);

  // Fresh form and the latest map tap every time the modal opens
  useEffect(() => {
    if (isOpen) {
      setPhotoPreview(null);
      setAiSuggestion(null);
      setUserConfirmedLevel(null);
      setCoords(defaultCoords);
      setAccuracy(null);
      setLocatingError(null);
      setSubmitError(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // NEW FEATURE: warn BEFORE publishing if a known hazard sits near this spot
  const nearbyHazards = useMemo(() => {
    if (!coords) return [];
    return pins
      .filter((p) => p.type === 'hazard' && p.status !== 'fixed')
      .map((p) => ({ ...p, distance: Math.round(haversineDistanceMeters(coords.lat, coords.lng, p.lat, p.lng)) }))
      .filter((p) => p.distance <= APP_CONFIG.COMPOUND_DANGER_RADIUS_METERS)
      .sort((a, b) => a.distance - b.distance);
  }, [pins, coords]);

  if (!isOpen) return null;

  const handleUseCurrentLocation = async () => {
    setIsLocating(true);
    setLocatingError(null);
    try {
      const pos = await getCurrentPosition();
      setCoords({ lat: pos.lat, lng: pos.lng });
      setAccuracy(pos.accuracy);
    } catch (err) {
      setLocatingError(err.message);
    } finally {
      setIsLocating(false);
    }
  };

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsAnalyzing(true);
      const resized = await resizeImage(file, 1000, 0.75);
      setPhotoPreview(resized.previewUrl);

      const analysis = await api.analyzeFloodPhoto(resized.base64);
      setAiSuggestion(analysis);

      if (analysis.suggestedLevel && analysis.suggestedLevel !== 'unknown') {
        setUserConfirmedLevel(analysis.suggestedLevel);
      }
    } catch (err) {
      console.error('Image processing error:', err);
      setSubmitError('Could not read that image. Please choose the water level yourself.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleSubmit = async () => {
    if (!userConfirmedLevel) return;
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      const created = await api.submitReport({
        city: APP_CONFIG.DEFAULT_CITY,
        type: 'flood',
        lat: coords.lat,
        lng: coords.lng,
        level: userConfirmedLevel
      });
      onReportCreated(created);
      onClose();
    } catch (err) {
      setSubmitError(err.message || 'Could not save the report.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const aiLevelLabel = aiSuggestion?.suggestedLevel && aiSuggestion.suggestedLevel !== 'unknown'
    ? aiSuggestion.suggestedLevel
    : null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-lg w-full p-5 sm:p-6 shadow-2xl border border-wmd-border space-y-4">
        <div className="flex items-center justify-between border-b pb-3">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-aws-blue text-white flex items-center justify-center">
              <Droplets className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-neutral-900 text-base">Report Waterlogging</h3>
              <p className="text-[11px] font-mono text-neutral-500">
                Shown on the map for {APP_CONFIG.FLOOD_PIN_LIFETIME_MINUTES} minutes
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-neutral-400 hover:text-neutral-700">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="text-[11px] text-neutral-500 font-mono">
          Do not use your phone while riding. Stop in a safe place first.
        </div>

        <div className="p-3 bg-neutral-50 border border-neutral-200 rounded-xl space-y-2 text-xs">
          <div className="flex items-center justify-between">
            <span className="font-bold font-mono text-neutral-700">REPORT LOCATION:</span>
            <button
              type="button"
              onClick={handleUseCurrentLocation}
              disabled={isLocating}
              className="text-aws-blue hover:underline font-semibold flex items-center gap-1 font-mono text-[11px]"
            >
              {isLocating ? <Loader2 className="w-3 h-3 animate-spin" /> : <MapPin className="w-3 h-3" />}
              <span>{isLocating ? 'Getting GPS...' : 'Use My Current Location'}</span>
            </button>
          </div>
          <div className="font-mono text-neutral-600">
            {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}
            {accuracy !== null && <span className="text-neutral-400"> (GPS ±{accuracy} m)</span>}
          </div>
          {accuracy !== null && accuracy > 50 && (
            <div className="text-[11px] text-amber-700 flex items-center gap-1">
              <AlertCircle className="w-3 h-3 shrink-0" />
              <span>GPS is weak here, so the pin may be off by about {accuracy} m.</span>
            </div>
          )}
          {locatingError && (
            <div className="text-[11px] text-amber-700 flex items-center gap-1">
              <AlertCircle className="w-3 h-3 shrink-0" />
              <span>{locatingError}</span>
            </div>
          )}
        </div>

        {nearbyHazards.length > 0 && (
          <div className="p-3 bg-red-50 border-2 border-red-400 rounded-xl text-xs text-red-900 space-y-1">
            <div className="flex items-center gap-1.5 font-black text-red-700">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>HIGHER RISK: KNOWN HAZARD NEARBY</span>
            </div>
            {nearbyHazards.slice(0, 3).map((h) => (
              <p key={h.id || h.SK} className="leading-relaxed">
                A {h.hazardType?.replace('_', ' ')} was reported about {h.distance} m from here
                {h.isSampleData ? ' (sample data)' : ''}. Floodwater may be hiding it. Keep away from this spot.
              </p>
            ))}
          </div>
        )}

        <div className="space-y-2">
          <label className="block text-xs font-bold text-neutral-700 uppercase tracking-wide">
            Step 1 (optional): Street photo for an AI hint
          </label>

          {photoPreview ? (
            <div className="relative rounded-xl overflow-hidden border border-neutral-200 h-44 bg-neutral-900 flex items-center justify-center">
              <img src={photoPreview} alt="Flood preview" className="w-full h-full object-cover" />
              <button
                onClick={() => {
                  setPhotoPreview(null);
                  setAiSuggestion(null);
                }}
                className="absolute top-2 right-2 bg-black/70 hover:bg-black text-white p-1.5 rounded-full text-xs"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="border-2 border-dashed border-neutral-300 rounded-xl p-6 text-center space-y-2 bg-neutral-50/50 hover:bg-neutral-50 transition-colors">
              <div className="w-10 h-10 rounded-full bg-blue-100 text-aws-blue mx-auto flex items-center justify-center">
                <Upload className="w-5 h-5" />
              </div>
              <div className="space-y-0.5">
                <p className="text-xs font-semibold text-neutral-800">Choose a photo of the water</p>
                <p className="text-[11px] text-neutral-500">
                  The photo is shrunk on your phone, analysed once and not stored.
                </p>
              </div>
              <div className="pt-1">
                <label className="bg-neutral-900 hover:bg-neutral-800 text-white px-4 py-2 rounded-lg text-xs font-medium cursor-pointer shadow-sm inline-block">
                  Choose Photo
                  <input type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
                </label>
              </div>
            </div>
          )}
        </div>

        {isAnalyzing && (
          <div className="p-3 bg-sky-50 border border-sky-200 rounded-xl flex items-center gap-3 text-xs text-sky-900">
            <Loader2 className="w-4 h-4 animate-spin text-aws-blue shrink-0" />
            <span>Getting an AI hint for the water level...</span>
          </div>
        )}

        {aiSuggestion && (
          <div className={`p-3.5 rounded-xl border text-xs space-y-2 ${
            aiSuggestion.isOffline
              ? 'bg-amber-50 border-amber-300 text-amber-950'
              : 'bg-sky-50/80 border-sky-200 text-neutral-900'
          }`}>
            <div className="flex items-center justify-between font-mono">
              <span className="font-bold">
                AI HINT: {aiSuggestion.suggestedLevel?.toUpperCase()}
              </span>
              <span className="px-2 py-0.5 rounded bg-white font-bold border uppercase text-[10px]">
                Confidence: {aiSuggestion.confidence}
              </span>
            </div>
            <p className="leading-relaxed">{aiSuggestion.reasoning}</p>
            <div className="pt-1 text-[11px] font-mono border-t border-black/10 font-semibold opacity-80">
              ⚠️ {aiSuggestion.notice}
            </div>
          </div>
        )}

        <div className="space-y-2">
          <label className="block text-xs font-bold text-neutral-700 uppercase tracking-wide">
            Step 2 (required): Tap the water level you see
          </label>
          <div className="grid grid-cols-2 gap-2">
            {LEVEL_OPTIONS.map((opt) => {
              const isSelected = userConfirmedLevel === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setUserConfirmedLevel(opt.id)}
                  className={`p-3 rounded-xl border-2 text-left transition-all ${
                    isSelected
                      ? `${opt.color} ring-2 ring-neutral-900 shadow-md`
                      : 'border-neutral-200 hover:border-neutral-300 bg-white text-neutral-700'
                  }`}
                >
                  <div className="flex items-center justify-between font-bold text-xs">
                    <span>{opt.label}</span>
                    {isSelected && <Check className="w-4 h-4" />}
                  </div>
                  <div className="text-[11px] font-mono opacity-80 mt-0.5">{opt.depth}</div>
                  {aiLevelLabel === opt.id && (
                    <div className="text-[10px] font-mono mt-1 text-sky-700 font-bold">AI suggested</div>
                  )}
                </button>
              );
            })}
          </div>
          <p className="text-[11px] text-neutral-500 font-mono">
            Water can hide open drains. This is an estimate, not a guarantee.
          </p>
        </div>

        {submitError && (
          <div className="p-3 bg-red-50 border border-red-300 text-red-800 rounded-xl text-xs font-semibold flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-600 mt-0.5" />
            <span>{submitError}</span>
          </div>
        )}

        <div className="pt-2 flex items-center justify-between border-t">
          <span className="text-[11px] text-neutral-500 font-mono">
            {userConfirmedLevel ? 'Ready to publish' : 'Pick a level to publish'}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-3 py-1.5 text-xs text-neutral-600 hover:bg-neutral-100 rounded-lg"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={isSubmitting || !userConfirmedLevel}
              className="bg-aws-blue hover:bg-aws-blue-dark disabled:bg-neutral-300 text-white px-4 py-2 rounded-lg text-xs font-bold shadow-sm transition-colors flex items-center gap-1.5"
            >
              {isSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Droplets className="w-3.5 h-3.5" />}
              <span>Publish Flood Pin</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
