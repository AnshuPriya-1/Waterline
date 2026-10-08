import React, { useState } from 'react';
import { AlertOctagon, Loader2, ShieldAlert, X } from 'lucide-react';
import { api } from '../utils/api';

const HAZARD_TYPES = [
  { id: 'open_drain', label: 'Open Roadside Drain', desc: 'Uncovered concrete storm drain or trench' },
  { id: 'missing_manhole', label: 'Missing Manhole Cover', desc: 'Broken or removed circular sewer iron lid' },
  { id: 'deep_pothole', label: 'Deep Pothole Crater', desc: 'Dangerous road indentation > 6 inches deep' }
];

export default function ReportHazardModal({ isOpen, onClose, defaultCoords, onHazardCreated }) {
  const [hazardType, setHazardType] = useState('open_drain');
  const [description, setDescription] = useState('');
  const [coords, setCoords] = useState(defaultCoords || { lat: 28.7520, lng: 77.1170 });
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const created = await api.submitReport({
        city: 'delhi',
        type: 'hazard',
        hazardType,
        description,
        lat: coords.lat,
        lng: coords.lng
      });
      onHazardCreated(created);
      onClose();
    } catch (err) {
      alert("Failed to save hazard. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-lg w-full p-5 sm:p-6 shadow-2xl border border-wmd-border space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between border-b pb-3">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-amber-500 text-white flex items-center justify-center">
              <ShieldAlert className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-neutral-900 text-base">Report Dry-Day Street Hazard</h3>
              <p className="text-[11px] font-mono text-neutral-500">Persistent hazard layer · Never deleted automatically</p>
            </div>
          </div>
          <button onClick={onClose} className="text-neutral-400 hover:text-neutral-700">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Hazard Selection */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-neutral-700 uppercase tracking-wide">
              Hazard Classification
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

          {/* Description */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-neutral-700 uppercase tracking-wide">
              Landmark / Location Notes
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Beside the tea stall curb, concrete slab missing on left edge."
              className="w-full text-xs p-3 rounded-xl border border-neutral-300 focus:outline-none focus:ring-2 focus:ring-amber-500 font-sans"
            />
          </div>

          {/* Notice Box */}
          <div className="bg-amber-50/60 p-3 rounded-xl border border-amber-200 text-xs text-amber-900 leading-relaxed">
            <strong>Why dry-day reports matter:</strong> During heavy rain, muddy floodwater hides this exact drain. 
            WaterLine remembers its location to issue compound collision warnings to delivery riders.
          </div>

          {/* Footer */}
          <div className="pt-2 flex items-center justify-between border-t">
            <span className="text-[11px] text-neutral-500 font-mono">
              Coords: {coords.lat.toFixed(4)}, {coords.lng.toFixed(4)}
            </span>
            <div className="flex items-center gap-2">
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
                className="bg-amber-600 hover:bg-amber-700 text-white font-bold px-4 py-2 rounded-lg text-xs shadow-sm transition-colors flex items-center gap-1.5"
              >
                {isSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <AlertOctagon className="w-3.5 h-3.5" />}
                <span>Save Hazard Pin</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
