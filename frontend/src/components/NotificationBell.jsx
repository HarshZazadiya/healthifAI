import { useState, useEffect, useRef } from 'react';
import api from '../services/api';
import { Bell, Check, CheckCheck, Trash2, X } from 'lucide-react';

const NotificationBell = () => {
  const [notifications, setNotifications] = useState([]);
  const [show, setShow] = useState(false);
  const dropdownRef = useRef(null);

  const fetchNotifications = async () => {
    try {
      const res = await api.get('/default/notifications');
      setNotifications(res.data.notifications || []);
    } catch (err) {
      console.error(err);
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
      fetchNotifications();
    } catch (err) {}
  };

  const markAllAsRead = async () => {
    try {
      await api.put('/default/notification');
      fetchNotifications();
    } catch (err) {}
  };

  const deleteNotif = async (id) => {
    try {
      await api.delete(`/default/notification/${id}`);
      fetchNotifications();
    } catch (err) {}
  };

  const unreadCount = notifications.filter(n => !n.is_read).length;

  return (
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
                <div key={notif.id} className={`p-4 border-b border-slate-50 last:border-0 relative group flex gap-3 ${!notif.is_read ? 'bg-blue-50/50' : 'bg-white hover:bg-slate-50 transition-colors'}`}>
                  <div className="flex-1">
                    <p className={`text-sm ${!notif.is_read ? 'font-medium text-slate-800' : 'text-slate-600'}`}>{notif.message}</p>
                    <p className="text-xs text-slate-400 mt-1">{new Date(notif.created_at).toLocaleString()}</p>
                  </div>
                  <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {!notif.is_read && (
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
  );
};

export default NotificationBell;