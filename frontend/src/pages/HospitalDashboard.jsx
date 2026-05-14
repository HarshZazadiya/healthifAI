import { useState, useEffect } from 'react';
import api from '../services/api';
import NotificationBell from '../components/NotificationBell';
import DocumentUploader from '../components/DocumentUploader';
import MapComponent from '../components/MapComponent';
import { useAuth } from '../context/AuthContext';

const HospitalDashboard = () => {
  const { logout } = useAuth();
  const [activeTab, setActiveTab] = useState('overview');
  const [profile, setProfile] = useState({});
  const [editProfile, setEditProfile] = useState({});
  const [doctors, setDoctors] = useState([]);
  const [users, setUsers] = useState([]);
  const [cases, setCases] = useState([]);
  const [wallet, setWallet] = useState({ balance: 0 });
  const [topUpAmount, setTopUpAmount] = useState(0);
  const [policyUrl, setPolicyUrl] = useState('');
  const [newDoctor, setNewDoctor] = useState({ name: '', email: '', password: '', phone_number: '' });
  const [page, setPage] = useState(1);

  const loadData = async () => {
    try {
      if (activeTab === 'overview') {
        const docs = await api.get('/hospital/doctors');
        const casesRes = await api.get('/hospital/cases');
        const walletRes = await api.get('/default/myWallet');
        setDoctors(docs.data || []);
        setCases(casesRes.data.data || []);
        setWallet(walletRes.data);
      } else if (activeTab === 'profile') {
        const res = await api.get('/hospital/profile');
        setProfile(res.data);
        setEditProfile(res.data);
      } else if (activeTab === 'doctors') {
        const res = await api.get('/hospital/doctors', { params: { page, limit: 10 } });
        setDoctors(res.data || []);
      } else if (activeTab === 'users') {
        const res = await api.get('/hospital/users', { params: { page, limit: 10 } });
        setUsers(res.data.data || []);
      } else if (activeTab === 'cases') {
        const res = await api.get('/hospital/cases', { params: { page, limit: 5 } });
        setCases(res.data.data || []);
      } else if (activeTab === 'wallet') {
        const w = await api.get('/default/myWallet');
        setWallet(w.data);
      } else if (activeTab === 'policy') {
        try {
          const res = await api.get('/hospital/policy');
          setPolicyUrl(res.data.url);
        } catch (err) { setPolicyUrl(''); }
      }
    } catch (err) { console.error('Load error:', err); }
  };

  useEffect(() => { loadData(); }, [activeTab, page]);

  const updateProfile = async () => {
    await api.put('/hospital/profile', editProfile);
    alert('Profile updated');
    loadData();
  };

  const createDoctor = async (e) => {
    e.preventDefault();
    await api.post('/hospital/doctor', newDoctor);
    alert('Doctor created');
    setNewDoctor({ name: '', email: '', password: '', phone_number: '' });
    loadData();
  };

  const updateAvailability = async (doctorId, avail) => {
    await api.put(`/hospital/availibility/${doctorId}`, null, { params: { availibility: avail } });
    alert('Availability updated');
    loadData();
  };

  const updateCaseLimit = async (doctorId, limit) => {
    await api.put(`/hospital/limit/${doctorId}`, null, { params: { limit } });
    alert('Case limit updated');
    loadData();
  };

  const deleteDoctor = async (doctorId) => {
    await api.delete(`/hospital/doctor/${doctorId}`);
    alert('Doctor removed');
    loadData();
  };

  const handleTopUp = async () => {
    if (topUpAmount <= 0) return alert('Enter amount > 0');
    await api.put('/default/topUp', { amount: topUpAmount });
    alert('Wallet topped up');
    loadData();
  };

  const connectGoogle = () => {
    window.location.href = 'http://localhost:8000/auth/google';
  };

  const mapMarkers = [];
  if (profile.lat && profile.lon) mapMarkers.push({ lat: parseFloat(profile.lat), lon: parseFloat(profile.lon), label: profile.name });
  users.forEach(u => { if (u.lat && u.lon) mapMarkers.push({ lat: parseFloat(u.lat), lon: parseFloat(u.lon), label: u.user_name }); });

  const renderOverview = () => (
    <div className="grid md:grid-cols-3 gap-6">
      <div className="bg-white p-6 rounded shadow"><h3>Total Doctors</h3><p className="text-3xl text-blue-600">{doctors.length}</p></div>
      <div className="bg-white p-6 rounded shadow"><h3>Total Cases</h3><p className="text-3xl text-green-600">{cases.length}</p></div>
      <div className="bg-white p-6 rounded shadow"><h3>Wallet Balance</h3><p className="text-3xl text-purple-600">₹{wallet.balance}</p></div>
    </div>
  );

  const renderProfile = () => (
    <div className="bg-white p-6 rounded shadow max-w-md">
      <h2 className="text-2xl font-bold mb-4">Hospital Profile</h2>
      <div className="space-y-3">
        <input value={editProfile.username || ''} onChange={e => setEditProfile({...editProfile, username: e.target.value})} placeholder="Name" className="border p-2 w-full rounded" />
        <input value={editProfile.email || ''} onChange={e => setEditProfile({...editProfile, email: e.target.value})} placeholder="Email" className="border p-2 w-full rounded" />
        <input value={editProfile.address || ''} onChange={e => setEditProfile({...editProfile, address: e.target.value})} placeholder="Address" className="border p-2 w-full rounded" />
        <input value={editProfile.city || ''} onChange={e => setEditProfile({...editProfile, city: e.target.value})} placeholder="City" className="border p-2 w-full rounded" />
        <input value={editProfile.state || ''} onChange={e => setEditProfile({...editProfile, state: e.target.value})} placeholder="State" className="border p-2 w-full rounded" />
        <input value={editProfile.zip || ''} onChange={e => setEditProfile({...editProfile, zip: e.target.value})} placeholder="ZIP" className="border p-2 w-full rounded" />
        <input value={editProfile.phone_number || ''} onChange={e => setEditProfile({...editProfile, phone_number: e.target.value})} placeholder="Phone" className="border p-2 w-full rounded" />
        <button onClick={updateProfile} className="bg-blue-600 text-white px-4 py-2 rounded mr-2">Update Profile</button>
        <button onClick={connectGoogle} className="bg-red-600 text-white px-4 py-2 rounded">Connect Google</button>
      </div>
    </div>
  );

  const renderDoctors = () => (
    <div>
      <h2 className="text-2xl font-bold mb-4">Doctors</h2>
      <form onSubmit={createDoctor} className="bg-gray-50 p-4 rounded mb-6">
        <div className="grid md:grid-cols-2 gap-2">
          <input placeholder="Name" value={newDoctor.name} onChange={e => setNewDoctor({...newDoctor, name: e.target.value})} className="border p-2 rounded" required />
          <input placeholder="Email" type="email" value={newDoctor.email} onChange={e => setNewDoctor({...newDoctor, email: e.target.value})} className="border p-2 rounded" required />
          <input placeholder="Password" type="password" value={newDoctor.password} onChange={e => setNewDoctor({...newDoctor, password: e.target.value})} className="border p-2 rounded" required />
          <input placeholder="Phone" value={newDoctor.phone_number} onChange={e => setNewDoctor({...newDoctor, phone_number: e.target.value})} className="border p-2 rounded" required />
        </div>
        <button type="submit" className="mt-2 bg-green-600 text-white px-4 py-2 rounded">Add Doctor</button>
      </form>
      <div className="grid md:grid-cols-2 gap-4">
        {doctors.map(d => (
          <div key={d.id} className="border p-4 rounded shadow">
            <h3 className="font-bold">Dr. {d.name}</h3>
            <p>Email: {d.registered_email}</p>
            <p>Specialty: {d.specialty}</p>
            <p>Availability: {d.availability ? 'Yes' : 'No'}</p>
            <div className="flex gap-2 mt-2">
              <button onClick={() => updateAvailability(d.id, !d.availability)} className="bg-yellow-500 text-white px-2 py-1 rounded text-sm">Toggle Availability</button>
              <input type="number" placeholder="Case Limit" className="border p-1 w-24" onBlur={(e) => updateCaseLimit(d.id, parseInt(e.target.value))} />
              <button onClick={() => deleteDoctor(d.id)} className="bg-red-500 text-white px-2 py-1 rounded text-sm">Remove</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const renderUsers = () => (
    <div>
      {mapMarkers.length > 0 && <MapComponent markers={mapMarkers} />}
      <div className="grid md:grid-cols-2 gap-4 mt-4">
        {users.map(u => (
          <div key={u.user_id} className="border p-3 rounded shadow">
            <span className="font-bold">{u.user_name}</span><br/>
            Email: {u.user_email}<br/>
            Case Status: {u.case_status}<br/>
            Doctor: {u.doctor_name || 'Not assigned'}
          </div>
        ))}
      </div>
    </div>
  );

  const renderCases = () => (
    <div>
      {cases.map(c => (
        <div key={c.id} className="border p-4 mb-3 rounded shadow">
          <h3 className="font-bold">Case #{c.id} - {c.disease || 'No disease'}</h3>
          <p>User: {c.user_name}<br/>Doctor: {c.doctor_name || 'Not assigned'}<br/>Status: {c.status}<br/>Symptoms: {c.symptoms?.map(s => s.symptom).join(', ')}</p>
          <details><summary>Documents</summary><div>User: {c.user_documents?.map(d => d.type).join(', ')}<br/>Doctor: {c.doctor_documents?.map(d => d.type).join(', ')}</div></details>
        </div>
      ))}
    </div>
  );

  const renderWallet = () => (
    <div className="bg-white p-6 rounded shadow max-w-md">
      <h2 className="text-2xl font-bold mb-4">Wallet</h2>
      <div className="text-center mb-4"><span className="text-4xl font-bold text-green-600">₹{wallet.balance}</span></div>
      <div className="flex gap-2"><input type="number" placeholder="Amount" value={topUpAmount} onChange={e => setTopUpAmount(parseInt(e.target.value))} className="border p-2 flex-1 rounded" /><button onClick={handleTopUp} className="bg-blue-600 text-white px-4 py-2 rounded">Top Up</button></div>
    </div>
  );

  const renderPolicy = () => (
    <div><h2 className="text-2xl font-bold mb-4">Hospital Policy</h2><DocumentUploader onUploadComplete={loadData} /><div className="mt-4">{policyUrl && <a href={policyUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600">View Current Policy</a>}</div></div>
  );

  const tabs = ['overview', 'profile', 'doctors', 'users', 'cases', 'wallet', 'policy'];
  const tabNames = ['Overview', 'Profile', 'Doctors', 'Users', 'Cases', 'Wallet', 'Policy'];

  return (
    <div>
      <div className="flex justify-between items-center bg-blue-600 text-white p-4">
        <h1 className="text-xl">HealthifAI - Hospital Dashboard</h1>
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
          {activeTab === 'overview' && renderOverview()}
          {activeTab === 'profile' && renderProfile()}
          {activeTab === 'doctors' && renderDoctors()}
          {activeTab === 'users' && renderUsers()}
          {activeTab === 'cases' && renderCases()}
          {activeTab === 'wallet' && renderWallet()}
          {activeTab === 'policy' && renderPolicy()}
        </div>
      </div>
    </div>
  );
};

export default HospitalDashboard;