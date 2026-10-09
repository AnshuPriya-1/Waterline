import React, { useState, useEffect } from 'react';
import { AlertCircle, AlertOctagon, Loader2, MapPin, ShieldAlert, X } from 'lucide-react';
import { api } from '../utils/api';
import { APP_CONFIG } from '../config';
import { getCurrentPosition } from '../utils/location';

const HAZARD_TYPES = [
  { id: 'open_drain', label: 'Open Roadside Drain', desc: 'Uncovered concrete storm drain or trench' },
  { id: 'missing_manhole', label: 'Missing Manhole Cover', desc: 'Broken or removed circular sewer lid' },
  { id: 'deep_pothole', label: 'Deep Pothole', desc: 'Dangerous road dip, more than 6 inches deep' }
];

export default function ReportHazardModal({ isOpen, onClose, defaultCoords, onHazardCreated }) {
  const [hazardType, setHazardType] = useState('open_drain');
  const [description, setDescription] = useState('');
  const [coords, setCoords] = useState(defaultCoords);
  const [accuracy, setAccuracy] = useState(null);
  const [isLocating, setIsLocating] = useState(false);
  const [locatingError, setLocatingError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);

  // Reset the form and take the latest map tap every time the modal opens
  useEffect(() => {
    if (isOpen) {
      setCoords(defaultCoords);
      setAccuracy(null);
      setHazardType('open_drain');
      setDescription('');
      setLocatingError(null);
      setSubmitError(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

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

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      const created = await api.submitReport({
        city: APP_CONFIG.DEFAULT_CITY,
        type: 'hazard',
        hazardType,
        description,
        lat: coords.lat,
        lng: coords.lng
      });
      onHazardCreated(created);
      onClose();
    } catch (err) {
      setSubmitError(err.message || 'Could not save the hazard.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-lg w-full p-5 sm:p-6 shadow-2xl border border-wmd-border space-y-4">
        <div className="flex items-center justify-between border-b pb-3">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-amber-500 text-white flex items-center justify-center">
              <ShieldAlert className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-neutral-900 text-base">Report a Dry-Day Hazard</h3>
              <p className="text-[11px] font-mono text-neutral-500">Stays on the map until 2 devices mark it fixed</p>
            </div>
          </div>
          <button onClick={onClose} className="text-neutral-400 hover:text-neutral-700">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="p-3 bg-neutral-50 border border-neutral-200 rounded-xl space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-bold font-mono text-neutral-700">HAZARD LOCATION:</span>
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
            <div className="text-[11px] text-neutral-500">
              Stand next to the hazard and use your location, or tap the hazard on the map first.
            </div>
            {accuracy !== null && accuracy > 50 && (
              <div className="text-[11px] text-amber-700 flex items-center gap-1">
                <AlertCircle className="w-3 h-3 shrink-0" />
                <span>GPS is weak here. Move to an open spot and try again for a better position.</span>
              </div>
            )}
            {locatingError && (
              <div className="text-[11px] text-amber-700 flex items-center gap-1">
                <AlertCircle className="w-3 h-3 shrink-0" />
                <span>{locatingError}</span>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <label className="block text-xs font-bold text-neutral-700 uppercase tracking-wide">
              Hazard type
            </label>
            <div className="space-y-2">
              {HAZARD_TYPES.map((h) => {
                const isSelected = hazardType === h.id;
                return (
                  <button
                    key={h.id}
                    type="button"
                    onClick={() => setHazardType(h.id)}
                    className={`w-full p-3 rounded-xl border-2 text-left transition-all ${
                      isSelected
                        ? 'border-amber-500 bg-amber-50/70 ring-1 ring-amber-500 text-amber-950'
                        : 'border-neutral-200 hover:border-neutral-300 bg-white text-neutral-700'
                    }`}
                  >
                    <div className="font-bold text-xs">{h.label}</div>
                    <div className="text-[11px] text-neutral-500 mt-0.5">{h.desc}</div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-neutral-700 uppercase tracking-wide">
              Landmark / notes
            </label>
            <textarea
              rows={2}
              maxLength={300}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Beside the tea stall, drain slab missing on the left edge."
              className="w-full text-xs p-3 rounded-xl border border-neutral-300 focus:outline-none focus:ring-2 focus:ring-amber-500 font-sans"
            />
          </div>

          <div className="bg-amber-50/60 p-3 rounded-xl border border-amber-200 text-xs text-amber-900 leading-relaxed">
            <strong>Why report on a dry day:</strong> in heavy rain, muddy water hides this spot.
            WaterLine remembers where it is and warns riders when flooding is reported nearby.
          </div>

          {submitError && (
            <div className="p-3 bg-red-50 border border-red-300 text-red-800 rounded-xl text-xs font-semibold flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-600 mt-0.5" />
              <span>{submitError}</span>
            </div>
          )}

          <div className="pt-2 flex items-center justify-end gap-2 border-t">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 text-xs text-neutral-600 hover:bg-neutral-100 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="bg-amber-600 hover:bg-amber-700 disabled:bg-neutral-300 text-white font-bold px-4 py-2 rounded-lg text-xs shadow-sm transition-colors flex items-center gap-1.5"
            >
              {isSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <AlertOctagon className="w-3.5 h-3.5" />}
              <span>Save Hazard</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
