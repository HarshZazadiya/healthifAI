import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';

export default function ChatbotSettings({ inline = false, onBack }) {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [tools, setTools] = useState([]);
  const [hitlTools, setHitlTools] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState('');

  useEffect(() => {
    if (user) {
      loadSettings();
    }
  }, [user]);

  const loadSettings = async () => {
    setLoading(true);
    try {
      // 1. Fetch all tools available for current role
      const toolsResponse = await api.get('/chatbot/tools');
      setTools(toolsResponse.data.tools || []);

      // 2. Fetch current HITL tools settings
      const hitlResponse = await api.get('/chatbot/settings/hitl');
      setHitlTools(hitlResponse.data.sensitive_tools || []);
    } catch (error) {
      console.error('Error loading chatbot settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleTool = (toolName) => {
    setHitlTools(prev => {
      if (prev.includes(toolName)) {
        return prev.filter(t => t !== toolName);
      } else {
        return [...prev, toolName];
      }
    });
    setSaveStatus('');
  };

  const handleSaveSettings = async () => {
    setSaving(true);
    setSaveStatus('');
    try {
      await api.post('/chatbot/settings/hitl', { tools: hitlTools });
      setSaveStatus('success');
      setTimeout(() => setSaveStatus(''), 3000);
    } catch (error) {
      console.error('Error saving HITL settings:', error);
      setSaveStatus('error');
    } finally {
      setSaving(false);
    }
  };

  const handleBackToDashboard = () => {
    if (onBack) {
      onBack();
      return;
    }
    if (!user) {
      navigate('/login');
      return;
    }
    // Route back based on their dashboard role
    if (user.role === 'admin') navigate('/admin');
    else if (user.role === 'doctor') navigate('/doctor');
    else if (user.role === 'hospital') navigate('/hospital');
    else navigate('/user');
  };

  if (loading) {
    return (
      <div className={`text-slate-100 flex flex-col items-center justify-center font-sans ${inline ? 'w-full py-20 bg-slate-950 rounded-3xl min-h-[50vh]' : 'min-h-screen bg-slate-950'}`}>
        <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mb-4" />
        <span className="text-sm text-slate-400 font-medium">Loading Agent Tools...</span>
      </div>
    );
  }

  return (
    <div className={`text-slate-100 font-sans relative overflow-hidden flex flex-col ${inline ? 'w-full rounded-3xl bg-slate-950 p-6 md:p-8 shadow-2xl min-h-[80vh]' : 'min-h-screen bg-slate-950'}`}>
      {/* Background glowing blurred radial meshes */}
      <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-indigo-900/10 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-[600px] h-[600px] bg-violet-900/10 rounded-full blur-[120px] pointer-events-none" />

      {/* Primary Container */}
      <div className={`flex-1 w-full mx-auto relative z-10 flex flex-col ${inline ? '' : 'max-w-5xl px-6 py-10'}`}>
        {/* Header navigation bar */}
        <div className="flex items-center justify-between mb-10 pb-6 border-b border-slate-800/80">
          <div className="flex items-center space-x-4">
            <button
              onClick={handleBackToDashboard}
              className="px-4 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-xl text-slate-300 hover:text-white transition-all text-xs font-semibold"
            >
              ← Back
            </button>
            <h1 className="text-2xl font-bold tracking-tight text-white flex items-center space-x-2">
              <span>🛠️</span>
              <span>AI Tools & Approval Settings</span>
            </h1>
          </div>
          <div className="text-right">
            <span className="text-[10px] uppercase tracking-wider text-slate-500 block">Logged in as</span>
            <span className="text-xs font-bold text-indigo-400 capitalize">{user?.name} ({user?.role})</span>
          </div>
        </div>

        {/* Introduction Panel */}
        <div className="bg-slate-900/40 border border-slate-800/60 rounded-2xl p-6 mb-8 backdrop-blur-md">
          <h2 className="text-sm font-semibold mb-2 text-white flex items-center space-x-2">
            <span>🛡️</span>
            <span>What is Human-in-the-Loop (HITL)?</span>
          </h2>
          <p className="text-xs text-slate-400 leading-relaxed max-w-3xl">
            When enabled for a tool, the HealthifAI agent will **pause** and request your explicit approval before performing that action. 
            Enable HITL for highly sensitive tools (like scheduling charges, assigning doctors, or deleting logs) to maintain perfect oversight and control.
          </p>
        </div>

        {/* Tools Grid List */}
        <div className="flex-1 flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-semibold text-slate-400">AVAILABLE TOOLS FOR YOUR ROLE ({tools.length})</span>
            <button
              onClick={handleSaveSettings}
              disabled={saving}
              className="px-6 py-2.5 bg-gradient-to-r from-indigo-650 to-violet-650 hover:from-indigo-650 hover:to-violet-600 disabled:opacity-40 text-white rounded-xl shadow-lg hover:shadow-indigo-500/20 text-xs font-semibold transition-all flex items-center space-x-2"
            >
              {saving ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <span>Save Configuration</span>
              )}
            </button>
          </div>

          {/* Success / Error messages */}
          {saveStatus === 'success' && (
            <div className="mb-4 p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-400 text-xs font-medium flex items-center space-x-2 animate-fade-in">
              <span>✅</span>
              <span>Configuration saved successfully! The AI will now respect these settings.</span>
            </div>
          )}
          {saveStatus === 'error' && (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-xs font-medium flex items-center space-x-2 animate-fade-in">
              <span>❌</span>
              <span>Failed to save configuration. Please try again.</span>
            </div>
          )}

          {tools.length === 0 ? (
            <div className="flex-1 border border-dashed border-slate-800 rounded-2xl flex items-center justify-center p-12 text-slate-500 text-sm">
              No custom tools are registered for your user role.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {tools.map(t => {
                const isHitl = hitlTools.includes(t.name);
                return (
                  <div
                    key={t.name}
                    className={`p-4 border rounded-2xl transition-all duration-300 flex items-start justify-between space-x-4 ${
                      isHitl 
                        ? 'bg-slate-900/60 border-indigo-500/40 shadow-md shadow-indigo-950/10' 
                        : 'bg-slate-900/20 border-slate-850 hover:border-slate-800'
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-2 mb-1.5">
                        <span className="font-mono text-sm font-bold text-white truncate">{t.name}</span>
                        {isHitl && (
                          <span className="text-[9px] bg-indigo-500/15 border border-indigo-500/30 text-indigo-400 rounded-full px-2 py-0.5 font-bold uppercase tracking-wider">
                            Approval Mode
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-400 leading-relaxed font-normal">
                        {t.description || 'No description provided.'}
                      </p>
                    </div>

                    {/* Toggle Switch */}
                    <button
                      onClick={() => handleToggleTool(t.name)}
                      className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                        isHitl ? 'bg-indigo-600' : 'bg-slate-800'
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                          isHitl ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
