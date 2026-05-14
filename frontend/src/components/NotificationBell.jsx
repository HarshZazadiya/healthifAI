import { useState, useEffect } from 'react';
import api from '../services/api';

const NotificationBell = () => {
  const [notifications, setNotifications] = useState([]);
  const [show, setShow] = useState(false);

  const fetchNotifications = async () => {
    try {
      const res = await api.get('/default/notifications');
      setNotifications(res.data.notifications);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, []);

  const markAsRead = async (id) => {
    try {
      await api.put('/default/notification', null, { params: { notification_id: id } });
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
    <div className="relative">
      <button onClick={() => setShow(!show)} className="relative">
        🔔
        {unreadCount > 0 && <span className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full text-xs w-5 h-5 flex items-center justify-center">{unreadCount}</span>}
      </button>
      {show && (
        <div className="absolute right-0 mt-2 w-80 bg-white border rounded shadow-lg z-50 max-h-96 overflow-auto">
          {notifications.length === 0 ? (
            <div className="p-2 text-gray-500">No notifications</div>
          ) : (
            notifications.map(notif => (
              <div key={notif.id} className={`p-2 border-b ${!notif.is_read ? 'bg-blue-50' : ''}`}>
                <p className="text-sm">{notif.message}</p>
                <p className="text-xs text-gray-500">{new Date(notif.created_at).toLocaleString()}</p>
                <div className="flex space-x-2 mt-1">
                  {!notif.is_read && <button onClick={() => markAsRead(notif.id)} className="text-xs text-blue-600">Mark read</button>}
                  <button onClick={() => deleteNotif(notif.id)} className="text-xs text-red-600">Delete</button>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};

export default NotificationBell;