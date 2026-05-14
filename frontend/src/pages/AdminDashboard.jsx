import { useState, useEffect } from 'react';
import api from '../services/api';
import NotificationBell from '../components/NotificationBell';
import MapComponent from '../components/MapComponent';
import { useAuth } from '../context/AuthContext';

const AdminDashboard = () => {
  const { logout } = useAuth();
  const [activeTab, setActiveTab] = useState('users');
  const [users, setUsers] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [hospitals, setHospitals] = useState([]);
  const [cases, setCases] = useState([]);
  const [transactions, setTransactions] = useState({ user_transactions: [], doctor_transactions: [] });
  const [wallets, setWallets] = useState([]);
  const [notification, setNotification] = useState({ recipient_id: '', recipient_role: 'user', message: '' });
  const [page, setPage] = useState(1);

  const loadData = async () => {
    try {
      if (activeTab === 'users') {
        const res = await api.get('/admin/users', { params: { page, limit: 10 } });
        setUsers(res.data || []);
      } else if (activeTab === 'doctors') {
        const res = await api.get('/admin/doctors', { params: { page, limit: 5 } });
        setDoctors(res.data.data || []);
      } else if (activeTab === 'hospitals') {
        const res = await api.get('/admin/hospitals', { params: { page, limit: 10 } });
        setHospitals(res.data || []);
      } else if (activeTab === 'cases') {
        const res = await api.get('/admin/cases', { params: { page, limit: 5 } });
        setCases(res.data.data || []);
      } else if (activeTab === 'transactions') {
        const res = await api.get('/admin/transactions', { params: { page, limit: 10, usertype: 'all' } });
        setTransactions(res.data.data || { user_transactions: [], doctor_transactions: [] });
      } else if (activeTab === 'wallets') {
        const res = await api.get('/admin/wallets', { params: { page, limit: 10 } });
        setWallets(res.data || []);
      }
    } catch (err) { console.error('Load error:', err); }
  };

  useEffect(() => { loadData(); }, [activeTab, page]);

  const deleteEntity = async (type, id) => {
    await api.delete(`/admin/${type}/${id}`);
    alert(`${type} deactivated`);
    loadData();
  };

  const reactiveEntity = async (type, id) => {
    await api.put(`/admin/reactive/${type}/${id}`);
    alert(`${type} reactivated`);
    loadData();
  };

  const sendNotification = async () => {
    await api.post('/admin/notification', notification);
    alert('Notification sent');
    setNotification({ recipient_id: '', recipient_role: 'user', message: '' });
  };

  const connectGoogle = () => {
    window.location.href = 'http://localhost:8000/auth/google';
  };

  const userMarkers = users.filter(u => u.lat && u.lon).map(u => ({ lat: parseFloat(u.lat), lon: parseFloat(u.lon), label: u.username }));
  const hospitalMarkers = hospitals.filter(h => h.lat && h.lon).map(h => ({ lat: parseFloat(h.lat), lon: parseFloat(h.lon), label: h.name }));

  const renderUsers = () => (
    <div><h2 className="text-2xl font-bold mb-4">Users</h2>
      {userMarkers.length > 0 && <MapComponent markers={userMarkers} />}
      <div className="grid md:grid-cols-2 gap-4 mt-4">
        {users.map(u => (
          <div key={u.id} className="border p-3 rounded shadow">
            <span className="font-bold">{u.username}</span><br/>
            Email: {u.email}<br/>
            Phone: {u.phone_number}<br/>
            Account Type: {u.account_type}<br/>
            Location: {u.lat ? `${u.lat}, ${u.lon}` : 'Not set'}<br/>
            <button onClick={() => deleteEntity('users', u.id)} className="bg-red-500 text-white px-2 py-1 rounded mr-2">Deactivate</button>
            <button onClick={() => reactiveEntity('user', u.id)} className="bg-green-500 text-white px-2 py-1 rounded">Reactivate</button>
          </div>
        ))}
      </div>
    </div>
  );

  const renderDoctors = () => (
    <div><h2 className="text-2xl font-bold mb-4">Doctors</h2>
      {doctors.map(h => (
        <div key={h.hospital_id} className="mb-6">
          <h3 className="text-xl font-semibold">{h.hospital_name}</h3>
          <div className="grid md:grid-cols-2 gap-3">
            {h.doctors.map(d => (
              <div key={d.id} className="border p-3 rounded">
                <span className="font-bold">{d.name}</span><br/>
                Email: {d.email}<br/>
                Specialty: {d.specialty}<br/>
                Fees: ₹{d.fees}<br/>
                Appt Fee: ₹{d.appointment_fees}<br/>
                Rating: {d.rating}<br/>
                Availability: {d.availability ? 'Yes' : 'No'}<br/>
                <button onClick={() => deleteEntity('doctors', d.id)} className="bg-red-500 text-white px-2 py-1 rounded mr-2">Deactivate</button>
                <button onClick={() => reactiveEntity('doctor', d.id)} className="bg-green-500 text-white px-2 py-1 rounded">Reactivate</button>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );

  const renderHospitals = () => (
    <div><h2 className="text-2xl font-bold mb-4">Hospitals</h2>
      {hospitalMarkers.length > 0 && <MapComponent markers={hospitalMarkers} />}
      <div className="grid md:grid-cols-2 gap-4 mt-4">
        {hospitals.map(h => (
          <div key={h.id} className="border p-3 rounded shadow">
            <span className="font-bold">{h.name}</span><br/>
            Email: {h.email}<br/>
            Phone: {h.phone_number}<br/>
            Address: {h.address}, {h.city}, {h.state} {h.zip}<br/>
            Rating: {h.rating}<br/>
            Cases: {h.cases}<br/>
            Location: {h.lat ? `${h.lat}, ${h.lon}` : 'Not set'}<br/>
            <button onClick={() => deleteEntity('hospital', h.id)} className="bg-red-500 text-white px-2 py-1 rounded mr-2">Deactivate</button>
            <button onClick={() => reactiveEntity('hospital', h.id)} className="bg-green-500 text-white px-2 py-1 rounded">Reactivate</button>
          </div>
        ))}
      </div>
    </div>
  );

  const renderCases = () => (
    <div><h2 className="text-2xl font-bold mb-4">Cases</h2>
      {cases.map(c => (
        <div key={c.id} className="border p-3 mb-2 rounded">
          <span className="font-bold">Case {c.case_id}</span> - {c.diesease}<br/>
          User: {c.user?.name}<br/>
          Doctor: {c.doctor?.name}<br/>
          Status: {c.status}<br/>
          Cost: ₹{c.cost}<br/>
          Date: {new Date(c.date).toLocaleString()}
        </div>
      ))}
    </div>
  );

  const renderTransactions = () => (
    <div><h2 className="text-2xl font-bold mb-4">Transactions</h2>
      <div className="space-y-4">
        {transactions.user_transactions?.length > 0 && (
          <div><h3 className="font-bold text-lg">User Transactions</h3>
            <ul>{transactions.user_transactions.map(t => <li key={t.id} className="border p-2 mb-1 rounded">User {t.user_id}: ₹{t.amount} - {t.type} - {t.note}<br/>{new Date(t.date).toLocaleString()}</li>)}</ul>
          </div>
        )}
        {transactions.doctor_transactions?.length > 0 && (
          <div><h3 className="font-bold text-lg mt-4">Doctor Transactions</h3>
            <ul>{transactions.doctor_transactions.map(t => <li key={t.id} className="border p-2 mb-1 rounded">Doctor {t.doctor_id}: ₹{t.amount} - {t.type} - {t.note}<br/>{new Date(t.date).toLocaleString()}</li>)}</ul>
          </div>
        )}
      </div>
    </div>
  );

  const renderWallets = () => (
    <div><h2 className="text-2xl font-bold mb-4">Wallets</h2>
      <div className="grid md:grid-cols-2 gap-3">
        {wallets.map(w => (
          <div key={w.id} className="border p-3 rounded">
            <span className="font-bold">{w.role.toUpperCase()}</span> ID: {w.user_id}<br/>
            Balance: ₹{w.balance}
          </div>
        ))}
      </div>
    </div>
  );

  const renderNotifications = () => (
    <div className="bg-white p-6 rounded shadow max-w-md">
      <h2 className="text-2xl font-bold mb-4">Send Notification</h2>
      <div className="space-y-3">
        <input placeholder="Recipient ID" value={notification.recipient_id} onChange={e => setNotification({...notification, recipient_id: e.target.value})} className="border p-2 w-full rounded" />
        <select value={notification.recipient_role} onChange={e => setNotification({...notification, recipient_role: e.target.value})} className="border p-2 w-full rounded">
          <option value="user">User</option>
          <option value="doctor">Doctor</option>
          <option value="hospital">Hospital</option>
        </select>
        <textarea placeholder="Message" value={notification.message} onChange={e => setNotification({...notification, message: e.target.value})} className="border p-2 w-full rounded" rows="3" />
        <button onClick={sendNotification} className="bg-blue-600 text-white px-4 py-2 rounded">Send</button>
      </div>
    </div>
  );

  const tabs = ['users', 'doctors', 'hospitals', 'cases', 'transactions', 'wallets', 'notifications'];
  const tabNames = ['Users', 'Doctors', 'Hospitals', 'Cases', 'Transactions', 'Wallets', 'Notifications'];

  return (
    <div>
      <div className="flex justify-between items-center bg-blue-600 text-white p-4">
        <h1 className="text-xl">HealthifAI - Admin Dashboard</h1>
        <div className="flex items-center space-x-4">
          <NotificationBell />
          <button onClick={logout} className="bg-red-500 px-3 py-1 rounded">Logout</button>
        </div>
      </div>
      <div className="flex">
        <div className="w-64 bg-gray-800 text-white min-h-screen p-4">
          {tabs.map((tab, idx) => <button key={tab} onClick={() => setActiveTab(tab)} className={`block w-full text-left p-2 rounded mb-1 ${activeTab === tab ? 'bg-blue-600' : 'hover:bg-gray-700'}`}>{tabNames[idx]}</button>)}
        </div>
        <div className="flex-1 p-6 bg-gray-100">
          {activeTab === 'users' && renderUsers()}
          {activeTab === 'doctors' && renderDoctors()}
          {activeTab === 'hospitals' && renderHospitals()}
          {activeTab === 'cases' && renderCases()}
          {activeTab === 'transactions' && renderTransactions()}
          {activeTab === 'wallets' && renderWallets()}
          {activeTab === 'notifications' && renderNotifications()}
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;