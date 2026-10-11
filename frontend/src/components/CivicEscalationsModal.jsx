import React, { useState, useEffect } from 'react';
import {
  Landmark,
  X,
  AlertTriangle,
  CheckCircle2,
  ThumbsUp,
  FileText,
  PlusCircle,
  Loader2,
  Clock,
  MapPin
} from 'lucide-react';
import { api } from '../utils/api';
import { APP_CONFIG } from '../config';

export default function CivicEscalationsModal({
  isOpen,
  onClose,
  city = APP_CONFIG.DEFAULT_CITY,
  onTicketUpdated
}) {
  const [escalations, setEscalations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('list'); // 'list' | 'create'

  // New escalation form
  const [routeName, setRouteName] = useState('');
  const [potholeCount, setPotholeCount] = useState(3);
  const [citizenNotes, setCitizenNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState(null);
  const [formSuccess, setFormSuccess] = useState(null);

  // Upvoting state
  const [upvotingTicketId, setUpvotingTicketId] = useState(null);

  const fetchEscalations = async () => {
    setLoading(true);
    try {
      const data = await api.getEscalations(city);
      setEscalations(data);
    } catch (err) {
      console.warn("Failed to fetch civic escalations:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchEscalations();
      setFormError(null);
      setFormSuccess(null);
    }
  }, [isOpen, city]);

  const handleUpvote = async (ticketId) => {
    setUpvotingTicketId(ticketId);
    try {
      const res = await api.escalateRoute({
        city,
        action: 'upvote',
        ticketId
      });
      // Refresh escalations
      await fetchEscalations();
      if (onTicketUpdated) onTicketUpdated();
    } catch (err) {
      alert(err.message || 'Could not register upvote.');
    } finally {
      setUpvotingTicketId(null);
    }
  };

  const handleCreateEscalation = async (e) => {
    e.preventDefault();
    if (!routeName.trim()) {
      setFormError('Please specify the road or corridor name.');
      return;
    }

    setIsSubmitting(true);
    setFormError(null);
    setFormSuccess(null);

    try {
      const res = await api.escalateRoute({
        city,
        routeName: routeName.trim(),
        potholeCount: parseInt(potholeCount, 10) || 1,
        citizenNotes: citizenNotes.trim(),
        action: 'escalate'
      });

      setFormSuccess(res.message || 'Grievance ticket successfully registered with PWD!');
      setRouteName('');
      setCitizenNotes('');
      await fetchEscalations();
      if (onTicketUpdated) onTicketUpdated();
      setTimeout(() => {
        setActiveTab('list');
      }, 1500);
    } catch (err) {
      setFormError(err.message || 'Failed to submit grievance.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const totalComplaints = escalations.reduce((sum, e) => sum + (e.complaintCount || 1), 0);
  const totalPotholes = escalations.reduce((sum, e) => sum + (e.potholeCount || 0), 0);

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-neutral-200 overflow-hidden">
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-neutral-900 to-indigo-950 text-white p-4 sm:p-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-inner">
              <Landmark className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold leading-tight flex items-center gap-2">
                <span>Civic Redressal &amp; PWD Road Action Portal</span>
                <span className="bg-amber-400 text-neutral-950 text-[10px] font-mono px-2 py-0.5 rounded-full font-bold uppercase">
                  {city}
                </span>
              </h2>
              <p className="text-xs text-indigo-200 mt-0.5">
                Automated Municipal Corporation Grievance Dispatch (Powered by AWS)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-neutral-300 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Civic Metrics Bar */}
        <div className="bg-neutral-50 border-b border-neutral-200 px-4 sm:px-6 py-2.5 grid grid-cols-3 gap-2 text-center text-xs font-mono">
          <div className="p-1">
            <span className="text-neutral-500 block text-[10px]">ACTIVE TICKETS</span>
            <strong className="text-base text-indigo-950 font-bold">{escalations.length}</strong>
          </div>
          <div className="p-1 border-x border-neutral-200">
            <span className="text-neutral-500 block text-[10px]">POTHOLES FLAGGED</span>
            <strong className="text-base text-rose-700 font-bold">{totalPotholes}</strong>
          </div>
          <div className="p-1">
            <span className="text-neutral-500 block text-[10px]">CITIZEN UPVOTES</span>
            <strong className="text-base text-emerald-700 font-bold">{totalComplaints}</strong>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-neutral-200 text-xs font-medium bg-white">
          <button
            onClick={() => setActiveTab('list')}
            className={`flex-1 py-2.5 px-4 text-center border-b-2 transition-colors flex items-center justify-center gap-1.5 ${
              activeTab === 'list'
                ? 'border-indigo-600 text-indigo-700 font-bold'
                : 'border-transparent text-neutral-500 hover:text-neutral-800'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>Active Road Escalations ({escalations.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('create')}
            className={`flex-1 py-2.5 px-4 text-center border-b-2 transition-colors flex items-center justify-center gap-1.5 ${
              activeTab === 'create'
                ? 'border-indigo-600 text-indigo-700 font-bold'
                : 'border-transparent text-neutral-500 hover:text-neutral-800'
            }`}
          >
            <PlusCircle className="w-4 h-4" />
            <span>File New Route Grievance</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-4">
          {activeTab === 'list' ? (
            <div>
              {loading ? (
                <div className="py-12 text-center text-xs text-neutral-500 flex flex-col items-center gap-2">
                  <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
                  <span>Loading Municipal Grievance Records from AWS DynamoDB...</span>
                </div>
              ) : escalations.length === 0 ? (
                <div className="py-12 text-center text-xs text-neutral-500 space-y-2">
                  <Landmark className="w-8 h-8 text-neutral-300 mx-auto" />
                  <p>No active government escalations recorded yet for this city.</p>
                  <p className="text-[11px] text-neutral-400">
                    Run a route check or file a grievance to notify the Public Works Department.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {escalations.map((item) => (
                    <div
                      key={item.ticketId || item.SK}
                      className="border border-neutral-200 hover:border-indigo-300 rounded-xl p-3.5 sm:p-4 bg-white shadow-xs space-y-2.5 transition-all"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs font-bold bg-indigo-100 text-indigo-900 px-2 py-0.5 rounded">
                              {item.ticketId}
                            </span>
                            <span className="bg-amber-100 text-amber-900 text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full">
                              {item.status === 'escalated_to_pwd' ? 'Escalated to PWD' : item.status}
                            </span>
                            {item.isSampleData && (
                              <span className="border border-purple-300 text-purple-700 text-[9px] font-mono px-1.5 py-0.2 rounded">
                                DEMO SAMPLE
                              </span>
                            )}
                          </div>
                          <h4 className="font-bold text-neutral-900 text-sm mt-1.5 flex items-center gap-1.5">
                            <MapPin className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                            <span>{item.routeName}</span>
                          </h4>
                        </div>

                        {/* Upvote button */}
                        <button
                          onClick={() => handleUpvote(item.ticketId)}
                          disabled={upvotingTicketId === item.ticketId}
                          className="shrink-0 text-xs px-2.5 py-1 rounded-lg border border-neutral-300 hover:bg-neutral-50 font-medium text-neutral-700 flex items-center gap-1.5 transition-colors"
                          title="Support this complaint to increase priority for PWD action"
                        >
                          {upvotingTicketId === item.ticketId ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <ThumbsUp className="w-3.5 h-3.5 text-indigo-600" />
                          )}
                          <span>Upvote ({item.complaintCount || 1})</span>
                        </button>
                      </div>

                      {item.citizenNotes && (
                        <p className="text-xs text-neutral-600 bg-neutral-50 p-2 rounded-lg border border-neutral-100 italic">
                          "{item.citizenNotes}"
                        </p>
                      )}

                      <div className="flex flex-wrap items-center justify-between text-[11px] font-mono text-neutral-500 pt-1 border-t border-neutral-100 gap-2">
                        <div className="flex items-center gap-3">
                          <span className="text-rose-700 font-semibold">
                            ⚠️ {item.potholeCount} Potholes Flagged
                          </span>
                          <span>Dept: {item.department ? item.department.split('-')[0].trim() : 'PWD'}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          <span>
                            {item.escalatedAt
                              ? new Date(item.escalatedAt * 1000).toLocaleDateString()
                              : 'Recently'}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            /* Tab 2: File New Route Grievance */
            <form onSubmit={handleCreateEscalation} className="space-y-4">
              <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-xl text-xs text-indigo-900 space-y-1">
                <div className="font-bold flex items-center gap-1.5">
                  <Landmark className="w-4 h-4 text-indigo-700" />
                  <span>Direct Citizen Grievance Portal</span>
                </div>
                <p className="text-[11px] leading-relaxed">
                  When a route or road segment has multiple dangerous potholes, submit a civic complaint here.
                  The report will be automatically bundled and dispatched to the Municipal Public Works Department (PWD).
                </p>
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-bold text-neutral-800">
                  Road / Corridor Name <span className="text-rose-600">*</span>
                </label>
                <input
                  type="text"
                  value={routeName}
                  onChange={(e) => setRouteName(e.target.value)}
                  placeholder="e.g. Ring Road from GTB Nagar to Model Town..."
                  className="w-full text-xs p-2.5 rounded-lg border border-neutral-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block text-xs font-bold text-neutral-800">
                    Estimated Pothole Count
                  </label>
                  <select
                    value={potholeCount}
                    onChange={(e) => setPotholeCount(e.target.value)}
                    className="w-full text-xs p-2.5 rounded-lg border border-neutral-300 bg-white"
                  >
                    <option value="1">1 Pothole (Isolated)</option>
                    <option value="2">2 Potholes (Developing Cluster)</option>
                    <option value="3">3 - 5 Potholes (High Distress)</option>
                    <option value="6">6+ Potholes (Severe Hazardous Road)</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="block text-xs font-bold text-neutral-800">
                    Target Municipal Department
                  </label>
                  <input
                    type="text"
                    disabled
                    value="Public Works Department (PWD) / Municipal Corp"
                    className="w-full text-xs p-2.5 rounded-lg border border-neutral-200 bg-neutral-100 text-neutral-600 font-mono"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-bold text-neutral-800">
                  Citizen Observations &amp; Danger Description
                </label>
                <textarea
                  rows="3"
                  value={citizenNotes}
                  onChange={(e) => setCitizenNotes(e.target.value)}
                  placeholder="Describe impact on daily commute (e.g. deep crater submerged under water, two-wheelers losing balance)..."
                  className="w-full text-xs p-2.5 rounded-lg border border-neutral-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                ></textarea>
              </div>

              {formError && (
                <div className="p-2.5 bg-red-50 border border-red-300 rounded-lg text-xs text-red-800">
                  {formError}
                </div>
              )}

              {formSuccess && (
                <div className="p-2.5 bg-emerald-50 border border-emerald-300 rounded-lg text-xs text-emerald-800 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{formSuccess}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-neutral-300 text-white font-semibold py-2.5 rounded-lg text-xs flex items-center justify-center gap-2 transition-colors shadow-sm"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Dispatching via AWS SNS Topic...</span>
                  </>
                ) : (
                  <>
                    <Landmark className="w-4 h-4" />
                    <span>Submit &amp; Dispatch Formal Notice to PWD</span>
                  </>
                )}
              </button>
            </form>
          )}
        </div>

        {/* Modal Footer */}
        <div className="bg-neutral-50 border-t border-neutral-200 px-4 sm:px-6 py-3 flex items-center justify-between text-xs">
          <span className="text-[11px] font-mono text-neutral-500">
            Dispatches via Amazon SNS · Archived in Amazon DynamoDB
          </span>
          <button
            onClick={onClose}
            className="px-3.5 py-1.5 border border-neutral-300 hover:bg-neutral-100 rounded-lg text-neutral-700 font-medium"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
