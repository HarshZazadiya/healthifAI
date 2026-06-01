import React, { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';

export default function Chatbot({ onOpenSettings }) {
  const { user } = useAuth();

  // Widget visibility states
  const [isOpen, setIsOpen] = useState(false);
  const [isBubbleVisible, setIsBubbleVisible] = useState(true);

  // Modal state for link preview
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [linkModalUrl, setLinkModalUrl] = useState('');

  // Pane navigation: 'chat' or 'settings'
  const [showSettings, setShowSettings] = useState(false);

  // Threads & messages states
  const [threads, setThreads] = useState([]);
  const [activeThreadId, setActiveThreadId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);

  // Inline rename states
  const [editingThreadId, setEditingThreadId] = useState(null);
  const [editNameText, setEditNameText] = useState('');

  // Settings & tools states
  const [availableTools, setAvailableTools] = useState([]);
  const [hitlTools, setHitlTools] = useState([]);
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [saveStatus, setSaveStatus] = useState('');

  // Resizable box state (starts at 760px width, 560px height)
  const [boxWidth, setBoxWidth] = useState(760);
  const [boxHeight, setBoxHeight] = useState(560);
  const isResizingRef = useRef(false);
  const resizeDirRef = useRef('');
  const startDimensionsRef = useRef({ width: 0, height: 0 });
  const startMouseCoordsRef = useRef({ x: 0, y: 0 });

  // HITL interruption state
  const [hitlRequired, setHitlRequired] = useState(false);
  const [hitlToolsList, setHitlToolsList] = useState([]);

  // Ref to scroll to bottom of chat
  const chatBottomRef = useRef(null);

  // Fetch threads on load
  useEffect(() => {
    if (user) {
      fetchThreads();
    }
  }, [user]);

  // Scroll to bottom on new messages
  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading, hitlRequired]);

  // Fetch available tools and HITL list when settings pane is shown
  useEffect(() => {
    if (showSettings) {
      loadHitlSettings();
    }
  }, [showSettings]);

  const fetchThreads = async () => {
    try {
      const response = await api.get('/chatbot/threads');
      setThreads(response.data);
    } catch (error) {
      console.error('Error fetching chat threads:', error);
    }
  };

  const loadHitlSettings = async () => {
    setSettingsLoading(true);
    setSaveStatus('');
    try {
      const toolsRes = await api.get('/chatbot/tools');
      setAvailableTools(toolsRes.data.tools || []);

      const hitlRes = await api.get('/chatbot/settings/hitl');
      setHitlTools(hitlRes.data.sensitive_tools || []);
    } catch (error) {
      console.error('Error loading HITL settings:', error);
    } finally {
      setSettingsLoading(false);
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
    setSavingSettings(true);
    setSaveStatus('');
    try {
      await api.post('/chatbot/settings/hitl', { tools: hitlTools });
      setSaveStatus('success');
      setTimeout(() => setSaveStatus(''), 3000);
    } catch (error) {
      console.error('Error saving settings:', error);
      setSaveStatus('error');
    } finally {
      setSavingSettings(false);
    }
  };

  const startNewChat = () => {
    setActiveThreadId(null);
    setMessages([]);
    setHitlRequired(false);
    setHitlToolsList([]);
  };

  const selectThread = async (threadId) => {
    setActiveThreadId(threadId);
    setLoading(true);
    setHitlRequired(false);
    setHitlToolsList([]);
    try {
      const response = await api.get(`/chatbot/threads/${threadId}/messages`);
      const loadedMessages = response.data.map(m => ({
        id: m.id,
        role: m.role === 'requester' ? 'user' : 'assistant',
        content: m.content,
        tools_used: null
      }));
      setMessages(loadedMessages);
    } catch (error) {
      console.error('Error loading thread messages:', error);
    } finally {
      setLoading(false);
    }
  };

  const deleteThread = async (e, threadId) => {
    e.stopPropagation();
    if (!window.confirm('Delete this chat history?')) return;
    try {
      await api.delete(`/chatbot/threads/${threadId}`);
      if (activeThreadId === threadId) {
        startNewChat();
      }
      fetchThreads();
    } catch (error) {
      console.error('Error deleting thread:', error);
    }
  };

  const startRenaming = (e, thread) => {
    e.stopPropagation();
    setEditingThreadId(thread.id);
    setEditNameText(thread.thread_name || 'New Chat');
  };

  const saveRename = async (threadId) => {
    if (!editNameText.trim()) return;
    try {
      await api.patch(`/chatbot/threads/${threadId}/rename`, { thread_name: editNameText.trim() });
      setEditingThreadId(null);
      fetchThreads();
    } catch (error) {
      console.error('Error renaming thread:', error);
    }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!inputText.trim() || loading) return;

    const userMessage = inputText.trim();
    setInputText('');

    // Optimistically push user message
    const tempUserMsg = { id: Date.now(), role: 'user', content: userMessage };
    setMessages(prev => [...prev, tempUserMsg]);
    setLoading(true);

    try {
      const response = await api.post('/chatbot/ask', {
        message: userMessage,
        thread_id: activeThreadId
      });

      const { response: reply, thread_id, hitl_required, hitl_tools, tools_used } = response.data;

      if (!activeThreadId) {
        setActiveThreadId(thread_id);
        fetchThreads();
      }

      if (hitl_required) {
        setHitlRequired(true);
        setHitlToolsList(hitl_tools || []);
      }

      setMessages(prev => [...prev, {
        id: Date.now() + 1,
        role: 'assistant',
        content: reply,
        tools_used: tools_used
      }]);
    } catch (error) {
      console.error('Error sending message:', error);
      setMessages(prev => [...prev, {
        id: Date.now() + 1,
        role: 'assistant',
        content: 'Sorry, I encountered an issue processing your request. Please try again.'
      }]);
    } finally {
      setLoading(false);
    }
  };

  const handleHitlApproval = async (approve) => {
    setLoading(true);
    setHitlRequired(false);
    const decision = approve ? 'yes' : 'no';

    setMessages(prev => [...prev, {
      id: Date.now(),
      role: 'user',
      content: `[Approval: ${decision}] Resuming sensitive tools execution...`
    }]);

    try {
      const response = await api.post('/chatbot/ask', {
        message: decision,
        thread_id: activeThreadId,
        human_approval: decision
      });

      const { response: reply, hitl_required, hitl_tools, tools_used } = response.data;

      if (hitl_required) {
        setHitlRequired(true);
        setHitlToolsList(hitl_tools || []);
      }

      setMessages(prev => [...prev, {
        id: Date.now() + 1,
        role: 'assistant',
        content: reply,
        tools_used: tools_used
      }]);
    } catch (error) {
      console.error('Error handling human approval:', error);
      setMessages(prev => [...prev, {
        id: Date.now() + 1,
        role: 'assistant',
        content: 'Error processing approval reply. Resuming standard chat...'
      }]);
    } finally {
      setLoading(false);
    }
  };

  // --- Resizing Code ---
  const handleResizeStart = (e, direction) => {
    e.preventDefault();
    isResizingRef.current = true;
    resizeDirRef.current = direction;
    startDimensionsRef.current = { width: boxWidth, height: boxHeight };
    startMouseCoordsRef.current = { x: e.clientX, y: e.clientY };

    document.addEventListener('mousemove', handleResizeMove);
    document.addEventListener('mouseup', handleResizeEnd);
  };

  const handleResizeMove = (e) => {
    if (!isResizingRef.current) return;
    const deltaX = startMouseCoordsRef.current.x - e.clientX;
    const deltaY = startMouseCoordsRef.current.y - e.clientY;

    let newWidth = startDimensionsRef.current.width;
    let newHeight = startDimensionsRef.current.height;

    if (resizeDirRef.current.includes('left')) {
      newWidth = startDimensionsRef.current.width + deltaX;
    }
    if (resizeDirRef.current.includes('top')) {
      newHeight = startDimensionsRef.current.height + deltaY;
    }

    const minW = 540;
    const minH = 440;
    const maxW = window.innerWidth - 60;
    const maxH = window.innerHeight - 60;

    if (newWidth >= minW && newWidth <= maxW) setBoxWidth(newWidth);
    if (newHeight >= minH && newHeight <= maxH) setBoxHeight(newHeight);
  };

  const handleResizeEnd = () => {
    isResizingRef.current = false;
    document.removeEventListener('mousemove', handleResizeMove);
    document.removeEventListener('mouseup', handleResizeEnd);
  };

  if (!user) return null;

  return (
    <>
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes orb-breathe-1 {
          0%, 100% { transform: translate(0px, 0px) scale(1); filter: blur(40px); }
          50% { transform: translate(40px, -30px) scale(1.2); filter: blur(60px); }
        }
        @keyframes orb-breathe-2 {
          0%, 100% { transform: translate(0px, 0px) scale(1); filter: blur(50px); }
          50% { transform: translate(-30px, 40px) scale(0.8); filter: blur(35px); }
        }
        .bg-orb-1 {
          animation: orb-breathe-1 12s infinite ease-in-out;
        }
        .bg-orb-2 {
          animation: orb-breathe-2 15s infinite ease-in-out;
        }
      `}} />

      {/* Floating bubble trigger */}
      {isBubbleVisible && (
        <div className="fixed bottom-6 right-6 z-[9999] flex items-center space-x-2">
          <button 
            onClick={(e) => {
              e.stopPropagation();
              setIsBubbleVisible(false);
            }}
            className="w-6 h-6 flex items-center justify-center bg-gradient-to-r from-pink-500 to-rose-500 border border-pink-300 rounded-full text-white hover:scale-110 shadow-lg transition-all"
            title="Hide chat bubble"
          >
            ✕
          </button>
          
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="flex items-center space-x-2 px-5 py-3 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white rounded-full shadow-xl hover:scale-105 active:scale-95 transition-all duration-300 font-semibold text-sm border border-emerald-300"
          >
            <span className="text-xl animate-pulse">💬</span>
            <span>Ask HealthifAI</span>
          </button>
        </div>
      )}

      {/* Minimal corner trigger when bubble is hidden */}
      {!isBubbleVisible && !isOpen && (
        <button
          onClick={() => {
            setIsBubbleVisible(true);
            setIsOpen(true);
          }}
          className="fixed bottom-3 right-3 z-[9999] bg-indigo-650/30 hover:bg-indigo-650/80 text-white text-xs px-2.5 py-1.5 rounded-md shadow-lg opacity-40 hover:opacity-100 transition-all animate-pulse"
        >
          💬 Ask AI
        </button>
      )}

      {/* Primary Adjustable Widget Box */}
      {isOpen && (
        <div 
          style={{ width: `${boxWidth}px`, height: `${boxHeight}px` }}
          className="fixed bottom-24 right-6 z-[9998] bg-slate-900/95 border border-slate-700/80 rounded-2xl shadow-2xl flex overflow-hidden backdrop-blur-xl transition-all font-sans text-slate-100"
        >
          {/* Custom Resizer Borders */}
          <div onMouseDown={(e) => handleResizeStart(e, 'left')} className="absolute left-0 top-0 bottom-0 w-1.5 hover:bg-indigo-500/60 cursor-ew-resize z-50 transition-all" />
          <div onMouseDown={(e) => handleResizeStart(e, 'top')} className="absolute top-0 left-0 right-0 h-1.5 hover:bg-indigo-500/60 cursor-ns-resize z-50 transition-all" />
          <div onMouseDown={(e) => handleResizeStart(e, 'top-left')} className="absolute top-0 left-0 w-3 h-3 hover:bg-indigo-500/80 cursor-nwse-resize z-[60] transition-all" />

          {/* SIDEBAR: Older Chats History */}
          <div className="w-64 bg-slate-950/70 border-r border-slate-800 flex flex-col flex-shrink-0 select-none">
            <div className="p-4 border-b border-slate-800">
              <button
                onClick={startNewChat}
                className="w-full py-2 px-3 bg-slate-800/80 hover:bg-slate-800 hover:border-indigo-500/50 border border-slate-700/80 rounded-xl text-xs font-semibold flex items-center justify-center space-x-2 text-indigo-400 hover:text-white transition-all shadow-md group"
              >
                <span className="text-sm font-bold group-hover:scale-110 transition-transform">+</span>
                <span>New Chat Session</span>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-2 space-y-1.5 scrollbar-thin">
              {threads.length === 0 ? (
                <div className="p-4 text-center text-xs text-slate-500 italic">No chat history</div>
              ) : (
                threads.map(t => {
                  const isActive = activeThreadId === t.id;
                  const isEditing = editingThreadId === t.id;
                  return (
                    <div
                      key={t.id}
                      onClick={() => !isEditing && selectThread(t.id)}
                      className={`relative group p-3 rounded-xl cursor-pointer flex flex-col space-y-1 transition-all ${
                        isActive 
                          ? 'bg-gradient-to-r from-indigo-950/40 to-slate-800 border-l-2 border-indigo-500 text-white' 
                          : 'hover:bg-slate-800/50 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {isEditing ? (
                        <input
                          type="text"
                          value={editNameText}
                          onChange={(e) => setEditNameText(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') saveRename(t.id);
                            if (e.key === 'Escape') setEditingThreadId(null);
                          }}
                          onBlur={() => saveRename(t.id)}
                          onClick={(e) => e.stopPropagation()}
                          className="w-full bg-slate-900 border border-indigo-500 rounded px-1.5 py-0.5 text-xs text-white focus:outline-none"
                          maxLength={30}
                          autoFocus
                        />
                      ) : (
                        <span className="text-xs font-medium truncate pr-12">
                          {t.thread_name || 'New Chat'}
                        </span>
                      )}

                      {t.last_message && !isEditing && (
                        <span className="text-[10px] text-slate-500 truncate line-clamp-1 pr-6 italic">
                          {t.last_message}
                        </span>
                      )}

                      {!isEditing && (
                        <div className="absolute right-2 top-3 opacity-0 group-hover:opacity-100 flex items-center space-x-1 transition-opacity">
                          <button
                            onClick={(e) => startRenaming(e, t)}
                            className="p-1 hover:text-indigo-400 hover:bg-slate-700/60 rounded text-[10px]"
                            title="Rename chat"
                          >
                            ✏️
                          </button>
                          <button
                            onClick={(e) => deleteThread(e, t.id)}
                            className="p-1 hover:text-red-400 hover:bg-slate-700/60 rounded text-[10px]"
                            title="Delete history"
                          >
                            🗑️
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* MAIN CONTAINER PANEL */}
          <div className="flex-1 flex flex-col min-w-0 bg-slate-900 relative">
            
            {/* PANEL 1: INLINE SETTINGS VIEW */}
            {showSettings ? (
              <div className="flex-1 flex flex-col bg-slate-950 overflow-hidden relative">
                {/* Settings Header */}
                <div className="h-16 border-b border-slate-800 flex items-center justify-between px-6 flex-shrink-0 bg-slate-950">
                  <div className="flex items-center space-x-2">
                    <button 
                      onClick={() => {
                        setShowSettings(false);
                        setSaveStatus('');
                      }} 
                      className="px-3 py-1.5 bg-slate-900 hover:bg-slate-850 border border-slate-800 rounded-lg text-slate-400 hover:text-white text-[10px] font-semibold transition-all"
                    >
                      ← Back to Chat
                    </button>
                    <span className="text-sm font-semibold text-white">HITL Agent Settings</span>
                  </div>
                  
                  <button
                    onClick={handleSaveSettings}
                    disabled={savingSettings}
                    className="px-4 py-1.5 bg-indigo-650 hover:bg-indigo-600 text-white rounded-lg text-xs font-semibold shadow transition-all disabled:opacity-40"
                  >
                    {savingSettings ? 'Saving...' : 'Save Configuration'}
                  </button>
                </div>

                {/* Settings Content scrollable body */}
                <div className="flex-1 overflow-y-auto p-6 space-y-4 scrollbar-thin">
                  {saveStatus === 'success' && (
                    <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400 text-xs font-medium">
                      ✅ Configuration saved successfully!
                    </div>
                  )}
                  {saveStatus === 'error' && (
                    <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-xs font-medium">
                      ❌ Failed to save configuration. Please try again.
                    </div>
                  )}

                  <div className="p-4 bg-slate-900/50 border border-slate-800 rounded-xl">
                    <p className="text-[11px] text-slate-400 leading-relaxed">
                      Toggle switches below to require <strong>Human-in-the-loop (HITL) approval</strong> before the HealthifAI agent runs that specific tool.
                    </p>
                  </div>

                  {settingsLoading ? (
                    <div className="flex flex-col items-center justify-center py-10 text-slate-500 text-xs">
                      <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mb-2" />
                      <span>Loading available tools...</span>
                    </div>
                  ) : availableTools.length === 0 ? (
                    <div className="p-8 text-center text-xs text-slate-650 italic">No tools available for your user role</div>
                  ) : (
                    <div className="space-y-3">
                      {availableTools.map(t => {
                        const isHitl = hitlTools.includes(t.name);
                        return (
                          <div 
                            key={t.name}
                            className={`p-3 border rounded-xl flex items-center justify-between space-x-4 transition-all duration-200 ${
                              isHitl ? 'bg-slate-900/60 border-indigo-500/30' : 'bg-slate-900/25 border-slate-850 hover:border-slate-800'
                            }`}
                          >
                            <div className="flex-1 min-w-0 pr-2">
                              <span className="font-mono text-xs font-semibold text-white block truncate">{t.name}</span>
                              <span className="text-[10px] text-slate-500 block truncate line-clamp-1 mt-0.5">{t.description || 'No description provided.'}</span>
                            </div>

                            <button
                              onClick={() => handleToggleTool(t.name)}
                              className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                                isHitl ? 'bg-indigo-600' : 'bg-slate-800'
                              }`}
                            >
                              <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                                isHitl ? 'translate-x-4' : 'translate-x-0'
                              }`} />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              
              /* PANEL 2: STANDARD CHAT DIALOGUE VIEW */
              <>
                {/* Chat Header */}
                <div className="h-16 border-b border-slate-800 flex items-center justify-between px-6 flex-shrink-0 select-none bg-slate-950/20">
                  <div className="flex flex-col">
                    <span className="text-sm font-semibold flex items-center space-x-1.5 text-white">
                      <span className="inline-block w-2.5 h-2.5 bg-green-500 rounded-full animate-pulse" />
                      <span>HealthifAI Co-pilot</span>
                    </span>
                    <span className="text-[10px] text-indigo-400">Powered by LangGraph Agent</span>
                  </div>

                  <div className="flex items-center space-x-3">
                    <button
                      onClick={() => {
                        if (onOpenSettings) {
                          onOpenSettings();
                          setIsOpen(false);
                        } else {
                          setShowSettings(true);
                        }
                      }}
                      className="px-3 py-1.5 hover:bg-slate-800 border border-slate-850 rounded-xl text-slate-400 hover:text-white text-xs font-semibold transition-all flex items-center space-x-1.5 shadow-sm"
                      title="Configure HITL Tools Settings"
                    >
                      <span>⚙️</span>
                      <span>Settings</span>
                    </button>
                    
                    <button
                      onClick={() => setIsOpen(false)}
                      className="p-2 hover:bg-slate-800 border border-slate-850 rounded-xl text-slate-400 hover:text-white transition-all text-xs"
                      title="Minimize chat"
                    >
                      ✕
                    </button>
                  </div>
                </div>

                {/* Chat dialogue body scroll region */}
                <div className="flex-1 overflow-y-auto p-6 space-y-4 scrollbar-thin relative bg-slate-900">
                  {messages.length === 0 && (
                    <div className="absolute inset-0 overflow-hidden flex items-center justify-center pointer-events-none z-0">
                      <div className="absolute w-52 h-52 bg-indigo-650/15 rounded-full bg-orb-1 top-1/4 left-1/4" />
                      <div className="absolute w-60 h-60 bg-violet-650/15 rounded-full bg-orb-2 bottom-1/4 right-1/4" />

                      <div className="text-center max-w-sm px-6 relative z-10 flex flex-col items-center">
                        <div className="w-14 h-14 rounded-3xl bg-indigo-650/20 border border-indigo-500/20 flex items-center justify-center text-2xl mb-4 animate-bounce">
                          🩺
                        </div>
                        <h3 className="text-sm font-semibold mb-2 text-white">Healthcare System Agent</h3>
                        <p className="text-[11px] text-slate-450 leading-relaxed font-normal">
                          I can help you review patient profiles, locate nearby doctors, query logs, consult hospital policies, manage appointments, and log symptoms natively.
                        </p>
                      </div>
                    </div>
                  )}

                  {messages.map((m) => {
                    const isUser = m.role === 'user';
                    return (
                      <div 
                        key={m.id}
                        className={`flex flex-col max-w-[85%] relative z-10 ${
                          isUser ? 'ml-auto items-end' : 'mr-auto items-start'
                        }`}
                      >
                         <div className={`px-5 py-4 rounded-2xl shadow-md text-sm leading-relaxed ${
                           isUser 
                             ? 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white border border-indigo-300 font-medium' 
                             : 'bg-slate-800 text-slate-100 border border-slate-700 rounded-tl-none font-normal'
                         }`}
                         >
                           {isUser ? (
                             m.content
                           ) : (
                             <ReactMarkdown
                               remarkPlugins={[remarkGfm]}
                               components={{
                                 a: ({ href, children }) => (
                                   <a
                                     href="#"
                                     onClick={(e) => {
                                       e.preventDefault();
                                       setLinkModalUrl(href);
                                       setShowLinkModal(true);
                                     }}
                                     className="underline text-indigo-300 hover:text-indigo-100"
                                   >
                                     {children}
                                   </a>
                                 ),
                                 table: ({ children }) => (
                                   <div className="overflow-x-auto my-2">
                                     <table className="min-w-full border-collapse border border-slate-500 text-xs">
                                       {children}
                                     </table>
                                   </div>
                                 ),
                                 th: ({ children }) => (
                                   <th className="border border-slate-500 px-2 py-1 bg-slate-700 text-slate-200 font-semibold">
                                     {children}
                                   </th>
                                 ),
                                 td: ({ children }) => (
                                   <td className="border border-slate-500 px-2 py-1 text-slate-300">
                                     {children}
                                   </td>
                                 ),
                                 p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                               }}
                             >
                               {m.content}
                             </ReactMarkdown>
                           )}
                         </div>

                        {!isUser && m.tools_used && m.tools_used.length > 0 && (
                          <ToolLogAccordion tools={m.tools_used} />
                        )}
                      </div>
                    );
                  })}

                  {loading && (
                    <div className="flex items-center space-x-2 mr-auto bg-slate-855 border border-slate-800 px-4 py-3 rounded-2xl rounded-tl-none max-w-[85%] text-slate-400 text-xs">
                      <div className="flex space-x-1">
                        <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                        <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                        <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                      </div>
                      <span>Thinking...</span>
                    </div>
                  )}

                  {hitlRequired && (
                    <div className="mr-auto bg-slate-900 border border-amber-500/40 rounded-2xl p-5 max-w-[90%] shadow-xl shadow-amber-950/20 relative overflow-hidden animate-pulse">
                      <div className="absolute top-0 left-0 w-2.5 bottom-0 bg-amber-500" />
                      <div className="pl-3 flex flex-col space-y-3">
                        <div className="flex items-center space-x-2">
                          <span className="text-lg">⚠️</span>
                          <h4 className="text-sm font-semibold text-amber-400">Approval Required</h4>
                        </div>
                        <p className="text-xs text-slate-300">
                          The Assistant is requesting permission to execute sensitive tool(s):
                          <span className="block mt-1 font-mono text-amber-300 bg-slate-950 py-1 px-2.5 rounded border border-slate-800 font-bold">
                            {hitlToolsList.join(', ')}
                          </span>
                        </p>
                        <div className="flex items-center space-x-3 pt-1">
                          <button
                            onClick={() => handleHitlApproval(true)}
                            className="px-4 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-lg text-xs font-semibold transition-all shadow"
                          >
                            Approve (Yes)
                          </button>
                          <button
                            onClick={() => handleHitlApproval(false)}
                            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs border border-slate-700 transition-all"
                          >
                            Deny (No)
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  <div ref={chatBottomRef} />
                </div>

                {/* Input text form */}
                <form 
                  onSubmit={handleSendMessage}
                  className="p-4 border-t border-slate-800/80 bg-slate-950/40 flex items-center space-x-3 relative z-10"
                >
                  <input
                    type="text"
                    disabled={loading || hitlRequired}
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    placeholder={
                      hitlRequired 
                        ? "Respond to tool approval request above..." 
                        : "Ask HealthifAI anything..."
                    }
                    className="flex-1 bg-slate-900 border border-slate-700/80 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500/80 disabled:opacity-50 transition-all"
                  />
                  <button
                    type="submit"
                    disabled={loading || hitlRequired || !inputText.trim()}
                    className="px-5 py-3 bg-indigo-650 hover:bg-indigo-550 disabled:opacity-40 disabled:hover:bg-indigo-650 text-white rounded-xl shadow font-semibold text-sm transition-all"
                  >
                    Send
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
      )}
      {showLinkModal && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black bg-opacity-70">
          <div className="bg-slate-900 rounded-lg shadow-xl max-w-3xl w-full h-5/6 relative">
            <button onClick={() => setShowLinkModal(false)} className="absolute top-2 right-2 text-white hover:text-gray-300 text-xl">
              ✕
            </button>
            <iframe src={linkModalUrl} className="w-full h-full rounded-lg" />
          </div>
        </div>
      )}
    </>
  );
}

function ToolLogAccordion({ tools }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="mt-1.5 text-xs select-none">
      <div 
        onClick={() => setExpanded(!expanded)}
        className="flex items-center space-x-1.5 text-indigo-400 hover:text-indigo-300 cursor-pointer transition-colors"
      >
        <span>🛠️</span>
        <span className="underline decoration-dotted">{expanded ? 'Hide tool execution logs' : `Called ${tools.length} tool(s)`}</span>
        <span className="text-[9px] transform transition-transform" style={{ transform: expanded ? 'rotate(90deg)' : 'rotate(0)' }}>▶</span>
      </div>

      {expanded && (
        <div className="mt-2 p-3 bg-slate-950 border border-slate-800 rounded-xl max-w-full overflow-x-auto space-y-2.5 font-mono text-[10px] text-indigo-350 shadow-inner">
          {tools.map((t, idx) => (
            <div key={idx} className="border-b border-slate-900 last:border-0 pb-2 last:pb-0">
              <span className="text-indigo-400 font-bold">Tool: </span>
              <span className="text-white font-bold">{t.name}</span>
              <div className="mt-1">
                <span className="text-slate-500">Arguments:</span>
                <pre className="mt-1 bg-slate-900 p-2 rounded text-slate-300 whitespace-pre-wrap leading-relaxed border border-slate-950">
                  {JSON.stringify(t.args, null, 2)}
                </pre>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}