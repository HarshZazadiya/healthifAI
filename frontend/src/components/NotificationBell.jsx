import { useState, useEffect, useRef } from 'react';
import api from '../services/api';
import { Bell, Check, CheckCheck, Trash2, MessageCircle } from 'lucide-react';

const NotificationBell = () => {
  const [notifications, setNotifications] = useState([]);
  const [show, setShow] = useState(false);
  const dropdownRef = useRef(null);

  const fetchNotifications = async () => {
    try {
      const res = await api.get('/default/notifications');
      // Backend returns 'read' field, not 'is_read'
      setNotifications(res.data.notifications || []);
    } catch (err) {
      console.error('Failed to fetch notifications:', err);
    }
  };

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShow(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const markAsRead = async (id) => {
    try {
      await api.put('/default/notification', null, { params: { notification_id: id } });
      // Refresh to get latest 'read' status from server
      await fetchNotifications();
    } catch (err) {
      console.error('Failed to mark as read:', err);
      // Refresh anyway to sync state if error occurred (e.g., 404)
      await fetchNotifications();
    }
  };

  const markAllAsRead = async () => {
    try {
      await api.put('/default/notification');
      await fetchNotifications();
    } catch (err) {
      console.error('Failed to mark all as read:', err);
      await fetchNotifications();
    }
  };

  const deleteNotif = async (id) => {
    try {
      await api.delete(`/default/notification/${id}`);
      await fetchNotifications();
    } catch (err) {
      console.error('Failed to delete notification:', err);
      await fetchNotifications();
    }
  };

  // Use 'read' field instead of 'is_read'
  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <div className="flex items-center gap-3">
      {/* Chatbot trigger button */}
      <button
        onClick={() => window.dispatchEvent(new Event('toggle-chatbot'))}
        className="relative group overflow-hidden px-4 py-2 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-650 hover:from-blue-500 hover:to-purple-700 text-white rounded-full transition-all duration-300 shadow-md hover:shadow-indigo-500/25 hover:scale-105 active:scale-95 flex items-center gap-2 border border-indigo-400/20"
        title="Ask HealthifAI Assistant"
      >
        <span className="absolute inset-0 w-full h-full bg-gradient-to-r from-purple-650 via-indigo-650 to-blue-650 opacity-0 group-hover:opacity-100 transition-opacity duration-300 ease-out" />
        <MessageCircle size={15} className="relative z-10 animate-pulse text-white" />
        <span className="relative z-10 font-bold text-xs tracking-wider select-none">AI Assistant</span>
        <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-rose-500 border border-white rounded-full animate-ping" />
        <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-rose-500 border border-white rounded-full" />
      </button>

      {/* Notification Bell Dropdown */}
      <div className="relative" ref={dropdownRef}>
        <button
          onClick={() => setShow(!show)}
          className="relative p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-full transition-colors"
        >
          <Bell size={24} />
          {unreadCount > 0 && (
            <span className="absolute top-1 right-1 bg-rose-500 text-white font-bold rounded-full text-[10px] w-4 h-4 flex items-center justify-center shadow-sm">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>
      {show && (
        <div className="absolute right-0 mt-2 w-80 bg-white border border-slate-200 rounded-2xl shadow-xl z-50 overflow-hidden animate-fade-in flex flex-col">
          <div className="px-4 py-3 border-b border-slate-100 flex justify-between items-center bg-slate-50">
            <h3 className="font-bold text-slate-800">Notifications</h3>
            {unreadCount > 0 && (
              <button onClick={markAllAsRead} className="text-xs text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1 transition-colors">
                <CheckCheck size={14} /> Mark all read
              </button>
            )}
          </div>
          <div className="max-h-96 overflow-y-auto custom-scrollbar">
            {notifications.length === 0 ? (
              <div className="p-8 text-center text-slate-500 text-sm">No notifications yet.</div>
            ) : (
              notifications.map(notif => (
                <div
                  key={notif.id}
                  className={`p-4 border-b border-slate-50 last:border-0 relative group flex gap-3 transition-colors ${
                    !notif.read
                      ? 'bg-blue-50/70 hover:bg-blue-100/80'
                      : 'bg-gray-50/50 hover:bg-gray-100/70'
                  }`}
                >
                  <div className="flex-1">
                    <p className={`text-sm ${!notif.read ? 'font-medium text-slate-800' : 'text-slate-600'}`}>
                      {notif.message}
                    </p>
                    <p className="text-xs text-slate-400 mt-1">
                      {new Date(notif.created_at).toLocaleString()}
                    </p>
                  </div>
                  <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {!notif.read && (
                      <button onClick={() => markAsRead(notif.id)} title="Mark as read" className="p-1.5 text-blue-500 hover:bg-blue-100 rounded-lg transition-colors">
                        <Check size={14} />
                      </button>
                    )}
                    <button onClick={() => deleteNotif(notif.id)} title="Delete" className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  </div>
  );
};

export default NotificationBell;