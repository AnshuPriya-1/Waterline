import React, { useState } from 'react';
import { Camera, Check, Droplets, Loader2, Sparkles, Upload, X } from 'lucide-react';
import { resizeImage } from '../utils/imageResizer';
import { api } from '../utils/api';

const LEVEL_OPTIONS = [
  { id: 'ankle', label: 'Ankle Level', depth: '< 6 inches', color: 'border-sky-300 bg-sky-50 text-sky-900' },
  { id: 'knee', label: 'Knee Level', depth: '~1.5 feet', color: 'border-blue-400 bg-blue-50 text-blue-900' },
  { id: 'waist', label: 'Waist Level', depth: '~3.0 feet', color: 'border-amber-400 bg-amber-50 text-amber-950' },
  { id: 'stalled', label: 'Vehicle Stall', depth: '> Exhaust pipe', color: 'border-red-400 bg-red-50 text-red-950' }
];

export default function ReportFloodModal({ isOpen, onClose, defaultCoords, onReportCreated }) {
  const [photoPreview, setPhotoPreview] = useState(null);
  const [base64Data, setBase64Data] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiSuggestion, setAiSuggestion] = useState(null);
  const [userConfirmedLevel, setUserConfirmedLevel] = useState('knee');
  const [coords, setCoords] = useState(defaultCoords || { lat: 28.7510, lng: 77.1185 });
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsAnalyzing(true);
      const resized = await resizeImage(file, 1000, 0.75);
      setPhotoPreview(resized.previewUrl);
      setBase64Data(resized.base64);

      // Call AI endpoint (or local fallback)
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

  const loadSamplePhoto = async () => {
    // Generate a quick demo canvas image
    const canvas = document.createElement('canvas');
    canvas.width = 600;
    canvas.height = 400;
    const ctx = canvas.getContext('2d');
    
    // Draw street water scene
    ctx.fillStyle = '#64748b'; // Road
    ctx.fillRect(0, 0, 600, 400);
    ctx.fillStyle = '#0284c7'; // Flood water
    ctx.fillRect(0, 220, 600, 180);
    // Draw car wheel
    ctx.fillStyle = '#1e293b';
    ctx.beginPath();
    ctx.arc(300, 220, 80, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#94a3b8';
    ctx.beginPath();
    ctx.arc(300, 220, 40, 0, Math.PI * 2);
    ctx.fill();

    const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
    const b64 = dataUrl.split(',')[1];
    setPhotoPreview(dataUrl);
    setBase64Data(b64);

    setIsAnalyzing(true);
    const analysis = await api.analyzeFloodPhoto(b64);
    setAiSuggestion(analysis);
    if (analysis.suggestedLevel && analysis.suggestedLevel !== 'unknown') {
      setUserConfirmedLevel(analysis.suggestedLevel);
    }
    setIsAnalyzing(false);
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      const created = await api.submitReport({
        city: 'delhi',
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
        {/* Header */}
        <div className="flex items-center justify-between border-b pb-3">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-aws-blue text-white flex items-center justify-center">
              <Droplets className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-neutral-900 text-base">Report Waterlogging</h3>
              <p className="text-[11px] font-mono text-neutral-500">Short-lived pin · Automatically decays in 45m</p>
            </div>
          </div>
          <button onClick={onClose} className="text-neutral-400 hover:text-neutral-700">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Photo Upload Area */}
        <div className="space-y-2">
          <label className="block text-xs font-bold text-neutral-700 uppercase tracking-wide">
            Step 1: Street Photo (Resized to &lt;200KB in browser)
          </label>

          {photoPreview ? (
            <div className="relative rounded-xl overflow-hidden border border-neutral-200 h-44 bg-neutral-900 flex items-center justify-center">
              <img src={photoPreview} alt="Flood preview" className="w-full h-full object-cover" />
              <button
                onClick={() => {
                  setPhotoPreview(null);
                  setBase64Data(null);
                  setAiSuggestion(null);
                }}
                className="absolute top-2 right-2 bg-black/70 hover:bg-black text-white p-1.5 rounded-full text-xs"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="border-2 border-dashed border-neutral-300 rounded-xl p-6 text-center space-y-3 bg-neutral-50/50 hover:bg-neutral-50 transition-colors">
              <div className="w-10 h-10 rounded-full bg-blue-100 text-aws-blue mx-auto flex items-center justify-center">
                <Upload className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <p className="text-xs font-semibold text-neutral-800">Upload street water photo</p>
                <p className="text-[11px] text-neutral-500">
                  Client canvas scales down image to avoid payload timeouts
                </p>
              </div>
              <div className="flex items-center justify-center gap-2 pt-1">
                <label className="bg-neutral-900 hover:bg-neutral-800 text-white px-3.5 py-1.5 rounded-lg text-xs font-medium cursor-pointer shadow-sm">
                  Choose Photo
                  <input type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
                </label>
                <button
                  type="button"
                  onClick={loadSamplePhoto}
                  className="bg-neutral-200 hover:bg-neutral-300 text-neutral-800 px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1"
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                  <span>Use Sample Demo</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* AI Hint Analysis Card */}
        {isAnalyzing && (
          <div className="p-3 bg-sky-50 border border-sky-200 rounded-xl flex items-center gap-3 text-xs text-sky-900">
            <Loader2 className="w-4 h-4 animate-spin text-aws-blue shrink-0" />
            <span>Analyzing visual depth references via Amazon Bedrock Vision...</span>
          </div>
        )}

        {aiSuggestion && (
          <div className="bg-sky-50/80 border border-sky-200 rounded-xl p-3.5 space-y-2 text-xs">
            <div className="flex items-center justify-between font-mono">
              <span className="font-bold text-sky-900 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-sky-600" />
                AI DEPTH HINT: {aiSuggestion.suggestedLevel?.toUpperCase()}
              </span>
              <span className="px-2 py-0.5 rounded bg-white text-sky-800 font-bold border border-sky-200 uppercase text-[10px]">
                Confidence: {aiSuggestion.confidence}
              </span>
            </div>
            <p className="text-neutral-700 leading-relaxed">
              <strong className="text-neutral-900">Reference:</strong> {aiSuggestion.referenceObject}. {aiSuggestion.reasoning}
            </p>
            <div className="pt-1 text-[11px] font-mono text-neutral-600 border-t border-sky-200/60 font-semibold">
              ⚠️ {aiSuggestion.notice}
            </div>
          </div>
        )}

        {/* Step 2: Human Confirmation Buttons */}
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

        {/* Footer & Submit */}
        <div className="pt-2 flex items-center justify-between border-t">
          <span className="text-[11px] text-neutral-500 font-mono">
            Location: {coords.lat.toFixed(4)}, {coords.lng.toFixed(4)}
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
