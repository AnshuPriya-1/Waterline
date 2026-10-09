import React, { useState } from 'react';
import { Check, Droplets, Loader2, MapPin, Upload, X, AlertCircle } from 'lucide-react';
import { resizeImage } from '../utils/imageResizer';
import { api } from '../utils/api';
import { APP_CONFIG } from '../config';

const LEVEL_OPTIONS = [
  { id: 'ankle', label: 'Ankle Level', depth: '< 6 inches', color: 'border-sky-300 bg-sky-50 text-sky-900' },
  { id: 'knee', label: 'Knee Level', depth: '~1.5 feet', color: 'border-blue-400 bg-blue-50 text-blue-900' },
  { id: 'waist', label: 'Waist Level', depth: '~3.0 feet', color: 'border-amber-400 bg-amber-50 text-amber-950' },
  { id: 'stalled', label: 'Vehicle Stall', depth: '> Exhaust pipe', color: 'border-red-400 bg-red-50 text-red-950' }
];

export default function ReportFloodModal({ isOpen, onClose, defaultCoords, onReportCreated }) {
  const [photoPreview, setPhotoPreview] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiSuggestion, setAiSuggestion] = useState(null);
  const [userConfirmedLevel, setUserConfirmedLevel] = useState('knee');
  const [coords, setCoords] = useState(defaultCoords || { lat: APP_CONFIG.DEFAULT_MAP_CENTER[0], lng: APP_CONFIG.DEFAULT_MAP_CENTER[1] });
  const [isLocating, setIsLocating] = useState(false);
  const [locatingError, setLocatingError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) {
      setLocatingError("Geolocation is not supported by your browser.");
      return;
    }
    setIsLocating(true);
    setLocatingError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setIsLocating(false);
      },
      (err) => {
        setLocatingError(`Unable to retrieve GPS: ${err.message}`);
        setIsLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
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
      console.error("Image processing error:", err);
      alert("Failed to read image. Please choose depth manually.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
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
      alert("Failed to submit report. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

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
              <p className="text-[11px] font-mono text-neutral-500">Short-lived pin · Decays after 45m strictly</p>
            </div>
          </div>
          <button onClick={onClose} className="text-neutral-400 hover:text-neutral-700">
            <X className="w-5 h-5" />
          </button>
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
              <span>{isLocating ? 'Acquiring GPS...' : 'Use My Current Location'}</span>
            </button>
          </div>
          <div className="font-mono text-neutral-600">
            Coordinates: {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}
          </div>
          {locatingError && (
            <div className="text-[11px] text-amber-700 flex items-center gap-1">
              <AlertCircle className="w-3 h-3 shrink-0" />
              <span>{locatingError}</span>
            </div>
          )}
        </div>

        <div className="space-y-2">
          <label className="block text-xs font-bold text-neutral-700 uppercase tracking-wide">
            Step 1: Street Photo (Compressed &lt;200KB in browser)
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
                <p className="text-xs font-semibold text-neutral-800">Select real street water photo</p>
                <p className="text-[11px] text-neutral-500">
                  Resized to max 1000px before transmission. Photos are processed ephemerally and discarded.
                </p>
              </div>
              <div className="pt-1">
                <label className="bg-neutral-900 hover:bg-neutral-800 text-white px-4 py-2 rounded-lg text-xs font-medium cursor-pointer shadow-sm inline-block">
                  Choose Photo from Device
                  <input type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
                </label>
              </div>
            </div>
          )}
        </div>

        {isAnalyzing && (
          <div className="p-3 bg-sky-50 border border-sky-200 rounded-xl flex items-center gap-3 text-xs text-sky-900">
            <Loader2 className="w-4 h-4 animate-spin text-aws-blue shrink-0" />
            <span>Analyzing image anchors via Amazon Bedrock Vision...</span>
          </div>
        )}

        {aiSuggestion && (
          <div className={`p-3.5 rounded-xl border text-xs space-y-2 ${
            aiSuggestion.isOffline
              ? 'bg-amber-50 border-amber-300 text-amber-950'
              : 'bg-sky-50/80 border-sky-200 text-neutral-900'
          }`}>
            <div className="flex items-center justify-between font-mono">
              <span className="font-bold flex items-center gap-1.5">
                AI HINT: {aiSuggestion.suggestedLevel?.toUpperCase()}
              </span>
              <span className="px-2 py-0.5 rounded bg-white font-bold border uppercase text-[10px]">
                Confidence: {aiSuggestion.confidence}
              </span>
            </div>
            <p className="leading-relaxed">
              <strong>Observation:</strong> {aiSuggestion.reasoning}
            </p>
            <div className="pt-1 text-[11px] font-mono border-t border-black/10 font-semibold opacity-80">
              ⚠️ {aiSuggestion.notice}
            </div>
          </div>
        )}

        <div className="space-y-2">
          <label className="block text-xs font-bold text-neutral-700 uppercase tracking-wide">
            Step 2: Confirm Observed Water Level (Required)
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
                </button>
              );
            })}
          </div>
        </div>

        <div className="pt-2 flex items-center justify-between border-t">
          <span className="text-[11px] text-neutral-500 font-mono">
            Valid: Next 45 minutes
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
              disabled={isSubmitting}
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