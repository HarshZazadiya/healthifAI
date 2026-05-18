import { useState, useEffect } from 'react';
import api from '../services/api';
import NotificationBell from '../components/NotificationBell';
import MapComponent from '../components/MapComponent';
import { useAuth } from '../context/AuthContext';
import { 
  LayoutDashboard, Users, UserCheck, Building2, 
  FileText, Wallet, BellRing, LogOut, 
  MapPin, ShieldAlert, CheckCircle2, ChevronRight, Activity, DollarSign
} from 'lucide-react';

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
  const [totalPages, setTotalPages] = useState(1);

  const loadData = async () => {
    try {
      if (activeTab === 'users') {
        const res = await api.get('/admin/users', { params: { page, limit: 10 } });
        setUsers(res.data || []);
      } else if (activeTab === 'doctors') {
        const res = await api.get('/admin/doctors', { params: { page, limit: 10 } });
        setDoctors(res.data.data || []);
      } else if (activeTab === 'hospitals') {
        const res = await api.get('/admin/hospitals', { params: { page, limit: 10 } });
        setHospitals(res.data || []);
      } else if (activeTab === 'cases') {
        const res = await api.get('/admin/cases', { params: { page, limit: 10 } });
        setCases(res.data.data || []);
      } else if (activeTab === 'transactions') {
        const res = await api.get('/admin/transactions', { params: { page, limit: 20, usertype: 'all' } });
        setTransactions(res.data.data || { user_transactions: [], doctor_transactions: [] });
      } else if (activeTab === 'wallets') {
        const res = await api.get('/admin/wallets', { params: { page, limit: 20 } });
        setWallets(res.data || []);
      }
    } catch (err) { console.error('Load error:', err); }
  };

  useEffect(() => { loadData(); }, [activeTab, page]);

  const deleteEntity = async (type, id) => {
    if(window.confirm(`Are you sure you want to deactivate this ${type}?`)) {
      await api.delete(`/admin/${type}/${id}`);
      alert(`${type} deactivated`);
      loadData();
    }
  };

  const reactivateEntity = async (type, id) => {
    await api.put(`/admin/${type}/reactivate/${id}`);
    alert(`${type} reactivated`);
    loadData();
  };

  const sendNotification = async () => {
    if(!notification.recipient_id || !notification.message) return alert("Fill all fields");
    try {
      await api.post('/default/notification', {
        recipient_id: parseInt(notification.recipient_id),
        recipient_role: notification.recipient_role,
        message: notification.message
      });
      alert('Notification sent');
      setNotification({ recipient_id: '', recipient_role: 'user', message: '' });
    } catch(err) {
      alert("Failed to send: " + (err.response?.data?.detail || err.message));
    }
  };

  const userMarkers = users.filter(u => u.lat && u.lon).map(u => ({ lat: parseFloat(u.lat), lon: parseFloat(u.lon), label: u.username }));
  const hospitalMarkers = hospitals.filter(h => h.lat && h.lon).map(h => ({ lat: parseFloat(h.lat), lon: parseFloat(h.lon), label: h.name }));

  const Card = ({ children, className = '' }) => (
    <div className={`bg-white rounded-2xl border border-slate-100 shadow-sm p-6 transition-all duration-300 hover:shadow-md ${className}`}>
      {children}
    </div>
  );

  const renderUsers = () => (
    <div className="animate-fade-in">
      <h2 className="text-2xl font-bold text-slate-800 mb-6 flex items-center gap-2"><Users className="text-blue-500" /> Platform Users</h2>
      
      {userMarkers.length > 0 && (
        <Card className="mb-6 p-2 h-[300px]">
          <div className="h-full rounded-xl overflow-hidden">
            <MapComponent markers={userMarkers} />
          </div>
        </Card>
      )}

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {users.map(u => (
          <Card key={u.id} className="relative overflow-hidden group">
            <div className={`absolute top-0 left-0 w-1 h-full ${u.is_active !== false ? 'bg-emerald-400' : 'bg-rose-400'}`}></div>
            <div className="pl-2">
              <div className="flex justify-between items-start mb-2">
                <h3 className="font-bold text-lg text-slate-800 truncate">{u.username}</h3>
                <span className={`px-2 py-0.5 text-xs font-bold rounded ${u.is_active !== false ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                  {u.is_active !== false ? 'Active' : 'Inactive'}
                </span>
              </div>
              <div className="text-sm text-slate-600 mb-4 space-y-1">
                <p>ID: <span className="font-medium text-slate-800">{u.id}</span></p>
                <p className="truncate">Email: {u.email}</p>
                <p>Phone: {u.phone_number}</p>
              </div>
              <div className="flex gap-2">
                {u.is_active !== false ? (
                  <button onClick={() => deleteEntity('user', u.id)} className="flex-1 bg-rose-50 text-rose-600 font-medium py-1.5 rounded-lg hover:bg-rose-100 transition-colors text-sm">Deactivate</button>
                ) : (
                  <button onClick={() => reactivateEntity('user', u.id)} className="flex-1 bg-emerald-50 text-emerald-600 font-medium py-1.5 rounded-lg hover:bg-emerald-100 transition-colors text-sm">Reactivate</button>
                )}
              </div>
            </div>
          </Card>
        ))}
        {users.length === 0 && <p className="text-slate-500 col-span-full">No users found.</p>}
      </div>
    </div>
  );

  const renderDoctors = () => (
    <div className="animate-fade-in">
      <h2 className="text-2xl font-bold text-slate-800 mb-6 flex items-center gap-2"><UserCheck className="text-indigo-500" /> Platform Doctors</h2>
      
      {doctors.map(h => (
        <div key={h.hospital_id} className="mb-8">
          <h3 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2"><Building2 className="text-slate-400" size={20}/> {h.hospital_name}</h3>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {h.doctors.map(d => (
              <Card key={d.id} className="relative overflow-hidden border-t-4 border-t-indigo-400">
                <div className="flex justify-between items-start mb-2">
                  <h3 className="font-bold text-lg text-slate-800 truncate">Dr. {d.name}</h3>
                  <span className={`px-2 py-0.5 text-xs font-bold rounded ${d.is_active !== false ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                    {d.is_active !== false ? 'Active' : 'Inactive'}
                  </span>
                </div>
                <div className="text-sm text-slate-600 mb-4 space-y-1 flex-1">
                  <p>ID: <span className="font-medium text-slate-800">{d.id}</span></p>
                  <p className="truncate">Email: {d.email}</p>
                  <p className="text-indigo-600 font-medium">{d.specialty || 'General'}</p>
                </div>
                <div className="flex gap-2">
                  {d.is_active !== false ? (
                    <button onClick={() => deleteEntity('doctor', d.id)} className="flex-1 bg-rose-50 text-rose-600 font-medium py-1.5 rounded-lg hover:bg-rose-100 transition-colors text-sm">Deactivate</button>
                  ) : (
                    <button onClick={() => reactivateEntity('doctor', d.id)} className="flex-1 bg-emerald-50 text-emerald-600 font-medium py-1.5 rounded-lg hover:bg-emerald-100 transition-colors text-sm">Reactivate</button>
                  )}
                </div>
              </Card>
            ))}
          </div>
        </div>
      ))}
      {doctors.length === 0 && <p className="text-slate-500">No doctors found.</p>}
    </div>
  );

  const renderHospitals = () => (
    <div className="animate-fade-in">
      <h2 className="text-2xl font-bold text-slate-800 mb-6 flex items-center gap-2"><Building2 className="text-emerald-500" /> Platform Hospitals</h2>
      
      {hospitalMarkers.length > 0 && (
        <Card className="mb-6 p-2 h-[300px]">
          <div className="h-full rounded-xl overflow-hidden">
            <MapComponent markers={hospitalMarkers} />
          </div>
        </Card>
      )}

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {hospitals.map(h => (
          <Card key={h.id} className="relative overflow-hidden group">
            <div className={`absolute top-0 left-0 w-1 h-full ${h.is_active !== false ? 'bg-emerald-400' : 'bg-rose-400'}`}></div>
            <div className="pl-2">
              <div className="flex justify-between items-start mb-2">
                <h3 className="font-bold text-lg text-slate-800 truncate">{h.name}</h3>
                <span className={`px-2 py-0.5 text-xs font-bold rounded ${h.is_active !== false ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                  {h.is_active !== false ? 'Active' : 'Inactive'}
                </span>
              </div>
              <div className="text-sm text-slate-600 mb-4 space-y-1">
                <p>ID: <span className="font-medium text-slate-800">{h.id}</span></p>
                <p className="truncate">Email: {h.email}</p>
                <p className="truncate">City: {h.city}</p>
              </div>
              <div className="flex gap-2">
                {h.is_active !== false ? (
                  <button onClick={() => deleteEntity('hospital', h.id)} className="flex-1 bg-rose-50 text-rose-600 font-medium py-1.5 rounded-lg hover:bg-rose-100 transition-colors text-sm">Deactivate</button>
                ) : (
                  <button onClick={() => reactivateEntity('hospital', h.id)} className="flex-1 bg-emerald-50 text-emerald-600 font-medium py-1.5 rounded-lg hover:bg-emerald-100 transition-colors text-sm">Reactivate</button>
                )}
              </div>
            </div>
          </Card>
        ))}
        {hospitals.length === 0 && <p className="text-slate-500 col-span-full">No hospitals found.</p>}
      </div>
    </div>
  );

  const renderCases = () => (
    <div className="animate-fade-in">
      <h2 className="text-2xl font-bold text-slate-800 mb-6 flex items-center gap-2"><FileText className="text-blue-500" /> Platform Cases</h2>
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {cases.map(c => (
          <Card key={c.id} className="border-l-4 border-l-blue-400">
            <div className="flex justify-between items-center mb-2">
              <h3 className="font-bold text-lg text-slate-800">Case #{c.case_id}</h3>
              <span className={`px-2 py-0.5 text-xs font-bold rounded ${c.status === 'OPEN' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>{c.status}</span>
            </div>
            <div className="text-sm text-slate-600 space-y-1 mb-2">
              <p>User: <span className="font-medium text-slate-800">{c.user?.name || c.user_name || 'N/A'}</span></p>
              <p>Doctor: <span className="font-medium text-slate-800">{c.doctor?.name || c.doctor_name || 'N/A'}</span></p>
              {c.disease && <p>Disease: <span className="font-medium text-slate-800">{c.disease}</span></p>}
            </div>
            <p className="text-xs text-slate-400">{new Date(c.date || c.case_opened_on).toLocaleString()}</p>
          </Card>
        ))}
        {cases.length === 0 && <p className="text-slate-500 col-span-full">No cases found.</p>}
      </div>
    </div>
  );

  const renderTransactions = () => (
    <div className="animate-fade-in max-w-5xl">
      <h2 className="text-2xl font-bold text-slate-800 mb-6 flex items-center gap-2"><DollarSign className="text-emerald-500" /> Platform Transactions</h2>
      
      <div className="grid md:grid-cols-2 gap-6">
        <Card className="bg-slate-50 border-slate-200">
          <h3 className="font-bold text-lg text-slate-800 mb-4 flex items-center gap-2"><Users size={18}/> User Transactions</h3>
          <div className="space-y-3 overflow-y-auto max-h-[500px] pr-2 custom-scrollbar">
            {transactions.user_transactions?.map(t => (
              <div key={t.id} className="bg-white p-3 rounded-xl border border-slate-100 shadow-sm flex justify-between items-center">
                <div>
                  <p className="font-bold text-sm text-slate-800">User {t.user_id}</p>
                  <p className="text-xs text-slate-500">{t.note || t.type}</p>
                </div>
                <div className="text-right">
                  <span className={`font-bold text-sm ${t.type.toLowerCase().includes('credit') || t.type.toLowerCase().includes('topup') ? 'text-emerald-600' : 'text-slate-800'}`}>
                    ₹{t.amount}
                  </span>
                  <p className="text-[10px] text-slate-400">{new Date(t.date).toLocaleDateString()}</p>
                </div>
              </div>
            ))}
            {!transactions.user_transactions?.length && <p className="text-slate-500 text-sm">No user transactions.</p>}
          </div>
        </Card>

        <Card className="bg-slate-50 border-slate-200">
          <h3 className="font-bold text-lg text-slate-800 mb-4 flex items-center gap-2"><UserCheck size={18}/> Doctor Transactions</h3>
          <div className="space-y-3 overflow-y-auto max-h-[500px] pr-2 custom-scrollbar">
            {transactions.doctor_transactions?.map(t => (
              <div key={t.id} className="bg-white p-3 rounded-xl border border-slate-100 shadow-sm flex justify-between items-center">
                <div>
                  <p className="font-bold text-sm text-slate-800">Doctor {t.doctor_id}</p>
                  <p className="text-xs text-slate-500">{t.note || t.type}</p>
                </div>
                <div className="text-right">
                  <span className={`font-bold text-sm ${t.type.toLowerCase().includes('credit') ? 'text-emerald-600' : 'text-slate-800'}`}>
                    ₹{t.amount}
                  </span>
                  <p className="text-[10px] text-slate-400">{new Date(t.date).toLocaleDateString()}</p>
                </div>
              </div>
            ))}
            {!transactions.doctor_transactions?.length && <p className="text-slate-500 text-sm">No doctor transactions.</p>}
          </div>
        </Card>
      </div>
    </div>
  );

  const renderWallets = () => (
    <div className="animate-fade-in">
      <h2 className="text-2xl font-bold text-slate-800 mb-6 flex items-center gap-2"><Wallet className="text-violet-500" /> Platform Wallets</h2>
      <div className="grid md:grid-cols-3 lg:grid-cols-4 gap-4">
        {wallets.map(w => (
          <Card key={w.id} className="text-center py-6">
            <div className={`mx-auto w-12 h-12 rounded-full flex items-center justify-center mb-3 ${w.role === 'user' ? 'bg-blue-100 text-blue-600' : w.role === 'doctor' ? 'bg-indigo-100 text-indigo-600' : 'bg-emerald-100 text-emerald-600'}`}>
              {w.role === 'user' ? <Users size={20}/> : w.role === 'doctor' ? <UserCheck size={20}/> : <Building2 size={20}/>}
            </div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">{w.role} ID: {w.user_id}</p>
            <h3 className="text-2xl font-bold text-slate-800">₹{w.balance}</h3>
          </Card>
        ))}
        {wallets.length === 0 && <p className="text-slate-500 col-span-full">No wallets found.</p>}
      </div>
    </div>
  );

  const renderNotifications = () => (
    <div className="max-w-xl animate-fade-in">
      <Card>
        <h2 className="text-2xl font-bold text-slate-800 mb-6 flex items-center gap-2"><BellRing className="text-amber-500" /> Send System Notification</h2>
        <div className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Recipient ID</label>
            <input type="number" placeholder="Enter user/doctor/hospital ID" value={notification.recipient_id} onChange={e => setNotification({...notification, recipient_id: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-amber-500 transition-all outline-none" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Recipient Role</label>
            <select value={notification.recipient_role} onChange={e => setNotification({...notification, recipient_role: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-amber-500 transition-all outline-none">
              <option value="user">User</option>
              <option value="doctor">Doctor</option>
              <option value="hospital">Hospital</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Message Content</label>
            <textarea placeholder="Type notification message here..." value={notification.message} onChange={e => setNotification({...notification, message: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-amber-500 transition-all outline-none resize-none" rows="4" />
          </div>
          <div className="pt-2">
            <button onClick={sendNotification} className="w-full bg-amber-500 hover:bg-amber-600 text-white font-bold px-6 py-3 rounded-xl shadow-sm transition-all shadow-amber-200 flex items-center justify-center gap-2">
              <BellRing size={18}/> Push Notification
            </button>
          </div>
        </div>
      </Card>
    </div>
  );

  const tabs = [
    { id: 'users', name: 'Users', icon: Users },
    { id: 'doctors', name: 'Doctors', icon: UserCheck },
    { id: 'hospitals', name: 'Hospitals', icon: Building2 },
    { id: 'cases', name: 'All Cases', icon: FileText },
    { id: 'transactions', name: 'Transactions', icon: DollarSign },
    { id: 'wallets', name: 'Wallets', icon: Wallet },
    { id: 'notifications', name: 'Alerts', icon: BellRing },
  ];

  return (
    <div className="flex h-screen bg-slate-50 font-sans overflow-hidden">
      {/* Sidebar */}
      <div className="w-72 bg-slate-900 text-slate-300 flex flex-col border-r border-slate-800 hidden md:flex z-10 shadow-2xl">
        <div className="p-6 border-b border-slate-800 flex items-center gap-3">
          <div className="bg-rose-600 p-2 rounded-xl text-white"><ShieldAlert size={24}/></div>
          <h1 className="text-xl font-bold text-white tracking-tight">HealthifAI Admin</h1>
        </div>
        <div className="flex-1 overflow-y-auto py-6 px-4 space-y-1 custom-scrollbar">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button key={tab.id} onClick={() => { setActiveTab(tab.id); setPage(1); }} 
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 font-medium ${
                  isActive ? 'bg-rose-600 text-white shadow-lg shadow-rose-900/50' : 'hover:bg-slate-800 hover:text-white'
                }`}>
                <Icon size={20} className={isActive ? "text-white" : "text-slate-400"} />
                {tab.name}
              </button>
            )
          })}
        </div>
        <div className="p-4 border-t border-slate-800">
          <button onClick={logout} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-rose-500/10 text-rose-400 hover:text-rose-300 transition-colors font-medium">
            <LogOut size={20} /> Logout
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        {/* Header */}
        <header className="bg-white border-b border-slate-200 px-8 py-4 flex justify-between items-center z-10 shadow-sm">
          <h2 className="text-xl font-bold text-slate-800 hidden md:block">
            {tabs.find(t => t.id === activeTab)?.name} Control Panel
          </h2>
          <div className="flex items-center gap-6 ml-auto">
            <NotificationBell />
            <div className="flex items-center gap-3 pl-6 border-l border-slate-200">
              <div className="w-10 h-10 bg-slate-800 rounded-full flex items-center justify-center text-white font-bold border border-slate-700">
                A
              </div>
              <div className="hidden sm:block">
                <p className="text-sm font-bold text-slate-800">System Admin</p>
                <p className="text-xs text-rose-600 font-medium">SUPERUSER</p>
              </div>
            </div>
          </div>
        </header>

        {/* Scrollable Content */}
        <main className="flex-1 overflow-y-auto p-4 md:p-8 custom-scrollbar relative">
          <div className="max-w-7xl mx-auto">
            {activeTab === 'users' && renderUsers()}
            {activeTab === 'doctors' && renderDoctors()}
            {activeTab === 'hospitals' && renderHospitals()}
            {activeTab === 'cases' && renderCases()}
            {activeTab === 'transactions' && renderTransactions()}
            {activeTab === 'wallets' && renderWallets()}
            {activeTab === 'notifications' && renderNotifications()}
          </div>
        </main>
      </div>
    </div>
  );
};

export default AdminDashboard;