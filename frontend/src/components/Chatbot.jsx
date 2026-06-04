import React, { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';

const formatMessageLinks = (content) => {
  if (!content) return '';
  const htmlLinkRegex = /<a\s+href=["']([^"']+)["'][^>]*>(.*?)<\/a>/gi;
  return content.replace(htmlLinkRegex, '[$2]($1)');
};

export default function Chatbot({ onOpenSettings }) {
  const { user } = useAuth();

  // Widget visibility states
  const [isOpen, setIsOpen] = useState(false);

  // Modal state for link preview
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [linkModalUrl, setLinkModalUrl] = useState('');

  // Threads & messages states
  const [threads, setThreads] = useState([]);
  const [activeThreadId, setActiveThreadId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);

  // Inline rename states
  const [editingThreadId, setEditingThreadId] = useState(null);
  const [editNameText, setEditNameText] = useState('');

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

  // Listen to global event to toggle chatbot visibility
  useEffect(() => {
    const handleToggle = () => {
      setIsOpen(prev => !prev);
    };
    window.addEventListener('toggle-chatbot', handleToggle);
    return () => {
      window.removeEventListener('toggle-chatbot', handleToggle);
    };
  }, []);

  const fetchThreads = async () => {
    try {
      const response = await api.get('/chatbot/threads');
      setThreads(response.data);
    } catch (error) {
      console.error('Error fetching chat threads:', error);
    }
  };

  const startNewChat = () => {
    setActiveThreadId(null);
    setMessages([]);
    setHitlRequired(false);
    setHitlToolsList([]);
  };

  const handleToolsExecution = (toolsUsed) => {
    if (toolsUsed && toolsUsed.length > 0) {
      toolsUsed.forEach(tool => {
        if (tool.name === 'switch_dashboard_tab' && tool.args && tool.args.tab_name) {
          window.dispatchEvent(new CustomEvent('navigate-to-tab', { 
            detail: { tab: tool.args.tab_name } 
          }));
        }
      });
    }
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

  const [threadToDelete, setThreadToDelete] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const deleteThread = async (threadId) => {
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

  const confirmDeleteThread = (e, thread) => {
    e.stopPropagation();
    setThreadToDelete(thread);
    setShowDeleteConfirm(true);
  };

  const handleConfirmDelete = async () => {
    if (!threadToDelete) return;
    await deleteThread(threadToDelete.id);
    setShowDeleteConfirm(false);
    setThreadToDelete(null);
  };

  const handleCancelDelete = () => {
    setShowDeleteConfirm(false);
    setThreadToDelete(null);
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
      handleToolsExecution(tools_used);

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
      handleToolsExecution(tools_used);

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
                            onClick={(e) => confirmDeleteThread(e, t)}
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
                    window.open('/chatbot-settings', '_blank');
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
                    className={`flex flex-col max-w-[85%] min-w-0 relative z-10 ${
                      isUser ? 'ml-auto items-end' : 'mr-auto items-start'
                    }`}
                  >
                     <div className={`px-5 py-4 rounded-2xl shadow-md text-sm leading-relaxed break-words whitespace-pre-wrap max-w-full overflow-hidden ${
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
                               <div className="overflow-x-auto my-2 max-w-full">
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
                             pre: ({ children }) => (
                               <div className="overflow-x-auto max-w-full my-2 rounded-xl">
                                 <pre className="bg-slate-950 p-3 text-xs font-mono whitespace-pre-wrap break-all text-indigo-300">
                                   {children}
                                 </pre>
                               </div>
                             ),
                             code: ({ inline, className, children, ...props }) => {
                               const isInline = inline || (!className && typeof children === 'string' && !children.includes('\n'));
                               return isInline ? (
                                 <code className="bg-slate-900/80 px-1.5 py-0.5 rounded text-xs font-mono text-pink-400 break-all" {...props}>
                                   {children}
                                 </code>
                               ) : (
                                 <code className="text-xs font-mono whitespace-pre-wrap break-all text-indigo-300" {...props}>
                                   {children}
                                 </code>
                               );
                             },
                             p: ({ children }) => <p className="mb-2 last:mb-0 break-words">{children}</p>,
                           }}
                         >
                           {formatMessageLinks(m.content)}
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
          </div>
        </div>
      )}
      {showLinkModal && (
        <div
          onClick={(e) => { if (e.target === e.currentTarget) setShowLinkModal(false); }}
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex justify-center items-center z-[10000] p-4 animate-fade-in cursor-pointer"
        >
          <div className="bg-white rounded-3xl w-full max-w-6xl h-[85vh] flex flex-col shadow-2xl relative cursor-default overflow-hidden">
            <div className="flex justify-between items-center p-4 border-b border-slate-200 bg-slate-50">
              <div className="min-w-0">
                <h3 className="font-bold text-slate-800 truncate">Link Preview</h3>
                <p className="text-xs text-slate-500 truncate">{linkModalUrl}</p>
              </div>
              <div className="flex items-center gap-2">
                <a
                  href={linkModalUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-slate-600 hover:text-slate-900 bg-slate-100 px-3 py-2 rounded-2xl border border-slate-200 transition-colors"
                >
                  Open in new tab
                </a>
                <button onClick={() => setShowLinkModal(false)} className="p-2 text-slate-400 hover:text-slate-600 bg-slate-100 rounded-full transition-colors">
                  ✕
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-hidden bg-slate-950">
              <iframe src={linkModalUrl} className="w-full h-full" title="Chatbot link preview" />
            </div>
          </div>
        </div>
      )}

      {showDeleteConfirm && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black bg-opacity-70 px-4 py-6">
          <div className="bg-slate-900 rounded-3xl shadow-2xl border border-slate-700 max-w-lg w-full overflow-hidden">
            <div className="p-6 border-b border-slate-800">
              <h2 className="text-lg font-semibold text-white">Delete chat thread?</h2>
              <p className="mt-2 text-sm text-slate-400">
                Are you sure you want to delete <span className="font-semibold text-white">{threadToDelete?.thread_name || 'this chat'}</span>? This action cannot be undone.
              </p>
            </div>
            <div className="p-6 flex flex-col gap-3">
              <button
                onClick={handleConfirmDelete}
                className="w-full px-4 py-3 bg-rose-500 hover:bg-rose-600 text-white rounded-2xl text-sm font-semibold transition-all"
              >
                Delete thread
              </button>
              <button
                onClick={handleCancelDelete}
                className="w-full px-4 py-3 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-2xl text-sm font-semibold transition-all"
              >
                Cancel
              </button>
            </div>
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