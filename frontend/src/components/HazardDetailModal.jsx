import React, { useState, useEffect } from 'react';
import { AlertCircle, CheckCircle2, Clock, ShieldAlert, ThumbsUp, Wrench, X } from 'lucide-react';
import { api } from '../utils/api';
import { APP_CONFIG } from '../config';

export default function HazardDetailModal({ hazard, onClose, onVoteCast }) {
  const [isVoting, setIsVoting] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [error, setError] = useState(null);

  // Clear old messages whenever a different hazard is opened
  useEffect(() => {
    setFeedback(null);
    setError(null);
  }, [hazard]);

  if (!hazard) return null;

  const handleVote = async (voteType) => {
    setIsVoting(true);
    setError(null);
    setFeedback(null);
    const res = await api.voteHazard(hazard.SK || hazard.id, voteType, hazard.city || APP_CONFIG.DEFAULT_CITY);
    setIsVoting(false);

    if (!res.success) {
      setError(res.error || 'Your vote was not saved. Please try again.');
      return;
    }

    setFeedback(
      voteType === 'fixed'
        ? 'Vote saved: marked as fixed. Two different devices must say "fixed" before it is removed.'
        : 'Vote saved: still there. Last-verified date refreshed.'
    );
    setTimeout(() => {
      onVoteCast();
      onClose();
    }, 1400);
  };

  const formattedDate = hazard.reportedAt
    ? new Date(hazard.reportedAt * 1000).toLocaleDateString()
    : 'Recent';

  const lastVerifiedDate = hazard.lastConfirmedAt
    ? new Date(hazard.lastConfirmedAt * 1000).toLocaleDateString()
    : formattedDate;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-md w-full p-5 sm:p-6 shadow-2xl border border-wmd-border space-y-4">
        <div className="flex items-center justify-between border-b pb-3">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-amber-500 text-neutral-950 flex items-center justify-center font-bold">
              <ShieldAlert className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-neutral-900 text-sm sm:text-base uppercase tracking-tight">
                {hazard.hazardType?.replace('_', ' ')}
              </h3>
              <p className="text-[10px] font-mono text-neutral-500">Long-lived hazard layer</p>
            </div>
          </div>
          <button onClick={onClose} className="text-neutral-400 hover:text-neutral-700">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-3 text-xs">
          {hazard.isSampleData && (
            <div className="p-2.5 bg-violet-50 border border-violet-300 text-violet-800 rounded-lg font-mono font-bold text-[11px]">
              SAMPLE DATA: this is not a real report.
            </div>
          )}

          <div className="p-3 bg-neutral-50 rounded-xl border border-neutral-200 space-y-1">
            <div className="font-bold text-neutral-800">NOTES:</div>
            <p className="text-neutral-600 leading-relaxed font-sans">
              {hazard.description || 'No notes added.'}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
            <div className="p-2.5 bg-neutral-50 rounded-lg border border-neutral-200">
              <div className="text-neutral-400">FIRST REPORTED:</div>
              <div className="font-bold text-neutral-800 mt-0.5">{formattedDate}</div>
            </div>
            <div className="p-2.5 bg-neutral-50 rounded-lg border border-neutral-200">
              <div className="text-neutral-400">LAST VERIFIED:</div>
              <div className="font-bold text-neutral-800 mt-0.5">{lastVerifiedDate}</div>
            </div>
          </div>

          {hazard.isOldUnverified && (
            <div className="p-2.5 bg-neutral-100 rounded-lg border border-neutral-300 text-neutral-600 text-[11px] flex items-center gap-2">
              <Clock className="w-4 h-4 shrink-0" />
              <span>Not re-verified for over 60 days. Shown in grey until someone confirms it.</span>
            </div>
          )}

          {feedback && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-semibold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
              <span>{feedback}</span>
            </div>
          )}

          {error && (
            <div className="p-3 bg-red-50 border border-red-300 text-red-800 rounded-xl text-xs font-semibold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
              <span>{error}</span>
            </div>
          )}
        </div>

        <div className="pt-2 border-t space-y-2">
          <div className="text-[11px] font-bold text-neutral-700 font-mono">
            IS THIS STILL THERE? (one vote per device)
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => handleVote('still_there')}
              disabled={isVoting}
              className="p-2.5 rounded-xl border border-neutral-300 hover:bg-neutral-100 disabled:opacity-50 font-medium text-xs text-neutral-800 flex items-center justify-center gap-1.5 transition-colors"
            >
              <ThumbsUp className="w-3.5 h-3.5 text-neutral-600" />
              <span>Still There</span>
            </button>
            <button
              onClick={() => handleVote('fixed')}
              disabled={isVoting}
              className="p-2.5 rounded-xl border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 disabled:opacity-50 font-semibold text-xs text-emerald-900 flex items-center justify-center gap-1.5 transition-colors"
            >
              <Wrench className="w-3.5 h-3.5 text-emerald-700" />
              <span>Mark Fixed ({hazard.fixedVotes || 0}/2)</span>
            </button>
          </div>
          <p className="text-[10px] text-neutral-400 text-center font-mono">
            A hazard leaves the map only after 2 different devices mark it fixed.
          </p>
        </div>
      </div>
    </div>
  );
}
