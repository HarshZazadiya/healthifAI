import { useState, useEffect } from 'react';
import api from '../services/api';
import NotificationBell from '../components/NotificationBell';
import DocumentUploader from '../components/DocumentUploader';
import MapComponent from '../components/MapComponent';
import { useAuth } from '../context/AuthContext';
import { 
  LayoutDashboard, Building2, Users, UserPlus, 
  FileText, Wallet, Shield, MapPin, 
  LogOut, Plus, Activity, Star, Mail, Phone
} from 'lucide-react';

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
  const [totalPages, setTotalPages] = useState(1);

  const loadData = async () => {
    try {
      if (activeTab === 'overview') {
        const docs = await api.get('/hospital/doctors');
        const casesRes = await api.get('/hospital/cases', { params: { page: 1, limit: 5 } });
        const walletRes = await api.get('/default/myWallet');
        setDoctors(docs.data || []);
        setCases(casesRes.data.data || []);
        setWallet(walletRes.data);
      } else if (activeTab === 'profile') {
        const res = await api.get('/hospital/profile');
        setProfile(res.data);
        setEditProfile(res.data);
      } else if (activeTab === 'doctors') {
        const res = await api.get('/hospital/doctors', { params: { page, limit: 20 } });
        setDoctors(res.data || []);
      } else if (activeTab === 'users') {
        const res = await api.get('/hospital/users', { params: { page, limit: 20 } });
        setUsers(res.data.data || []);
        setTotalPages(Math.ceil((res.data.total || 0) / 20));
      } else if (activeTab === 'cases') {
        const res = await api.get('/hospital/cases', { params: { page, limit: 10 } });
        setCases(res.data.data || []);
        setTotalPages(Math.ceil((res.data.total || 0) / 10));
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
    alert('Profile updated successfully');
    loadData();
  };

  const createDoctor = async (e) => {
    e.preventDefault();
    try {
      await api.post('/hospital/doctor', newDoctor);
      alert('Doctor created successfully');
      setNewDoctor({ name: '', email: '', password: '', phone_number: '' });
      loadData();
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to create doctor');
    }
  };

  const updateAvailability = async (doctorId, avail) => {
    await api.put(`/hospital/availibility/${doctorId}`, null, { params: { availibility: avail } });
    loadData();
  };

  const updateCaseLimit = async (doctorId, limit) => {
    await api.put(`/hospital/limit/${doctorId}`, null, { params: { limit } });
    alert('Case limit updated');
    loadData();
  };

  const deleteDoctor = async (doctorId) => {
    if(window.confirm('Are you sure you want to remove this doctor?')) {
      await api.delete(`/hospital/doctor/${doctorId}`);
      loadData();
    }
  };

  const handleTopUp = async () => {
    if (topUpAmount <= 0) return alert('Enter an amount > 0');
    // Bugfix: amount is a query parameter
    await api.put('/default/topUp', null, { params: { amount: topUpAmount } });
    alert('Wallet topped up successfully!');
    setTopUpAmount(0);
    loadData();
  };

  const connectGoogle = () => {
    window.location.href = 'http://localhost:8000/auth/google';
  };

  const mapMarkers = [];
  if (profile.lat && profile.lon) mapMarkers.push({ lat: parseFloat(profile.lat), lon: parseFloat(profile.lon), label: profile.name || 'Hospital' });
  users.forEach(u => { if (u.lat && u.lon) mapMarkers.push({ lat: parseFloat(u.lat), lon: parseFloat(u.lon), label: u.user_name }); });

  const Card = ({ children, className = '' }) => (
    <div className={`bg-white rounded-2xl border border-slate-100 shadow-sm p-6 transition-all duration-300 hover:shadow-md ${className}`}>
      {children}
    </div>
  );

  const StatusBadge = ({ status }) => {
    const colors = {
      OPEN: 'bg-emerald-100 text-emerald-700 border-emerald-200',
      CLOSED: 'bg-slate-100 text-slate-700 border-slate-200',
    };
    return (
      <span className={`px-2.5 py-1 text-xs font-semibold border rounded-full ${colors[status] || 'bg-gray-100 text-gray-700'}`}>
        {status}
      </span>
    );
  };

  const renderOverview = () => (
    <div className="space-y-6 animate-fade-in">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="bg-gradient-to-br from-indigo-50 to-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-indigo-600 mb-1">Total Doctors</p>
              <h3 className="text-4xl font-bold text-slate-800">{doctors.length}</h3>
            </div>
            <div className="p-3 bg-indigo-100 rounded-xl text-indigo-600"><UserPlus size={24} /></div>
          </div>
        </Card>
        <Card className="bg-gradient-to-br from-emerald-50 to-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-emerald-600 mb-1">Total Active Cases</p>
              <h3 className="text-4xl font-bold text-slate-800">{cases.filter(c => c.status === 'OPEN').length}</h3>
            </div>
            <div className="p-3 bg-emerald-100 rounded-xl text-emerald-600"><Activity size={24} /></div>
          </div>
        </Card>
        <Card className="bg-gradient-to-br from-violet-50 to-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-violet-600 mb-1">Hospital Wallet</p>
              <h3 className="text-4xl font-bold text-slate-800">₹{wallet.balance}</h3>
            </div>
            <div className="p-3 bg-violet-100 rounded-xl text-violet-600"><Wallet size={24} /></div>
          </div>
        </Card>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <h3 className="text-lg font-bold text-slate-800 mb-4">Recent Cases</h3>
          <div className="space-y-3">
            {cases.slice(0, 4).map(c => (
              <div key={c.id} className="flex justify-between items-center p-3 border border-slate-100 rounded-xl">
                <div>
                  <p className="font-semibold text-slate-800">Patient: {c.user_name}</p>
                  <p className="text-xs text-slate-500">Dr. {c.doctor_name || 'Unassigned'} • Case #{c.id}</p>
                </div>
                <StatusBadge status={c.status} />
              </div>
            ))}
            {cases.length === 0 && <p className="text-slate-500 text-sm">No cases reported yet.</p>}
          </div>
        </Card>
        
        <Card>
          <h3 className="text-lg font-bold text-slate-800 mb-4">Doctor Availability Overview</h3>
          <div className="space-y-3">
            {doctors.slice(0, 4).map(d => (
              <div key={d.id} className="flex justify-between items-center p-3 border border-slate-100 rounded-xl">
                <div>
                  <p className="font-semibold text-slate-800">Dr. {d.name}</p>
                  <p className="text-xs text-slate-500">{d.specialty || 'General'}</p>
                </div>
                <span className={`px-2 py-1 text-xs font-bold rounded ${d.availability ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                  {d.availability ? 'Available' : 'Unavailable'}
                </span>
              </div>
            ))}
            {doctors.length === 0 && <p className="text-slate-500 text-sm">No doctors added.</p>}
          </div>
        </Card>
      </div>
    </div>
  );

  const renderProfile = () => (
    <div className="max-w-3xl animate-fade-in">
      <Card>
        <h2 className="text-2xl font-bold text-slate-800 mb-6 flex items-center gap-2"><Building2 className="text-indigo-600" /> Hospital Profile</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-6">
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-slate-700 mb-1">Hospital Name</label>
            <input value={editProfile.username || ''} onChange={e => setEditProfile({...editProfile, username: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-indigo-500 transition-all outline-none" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
            <input value={editProfile.email || ''} onChange={e => setEditProfile({...editProfile, email: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-indigo-500 transition-all outline-none" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Phone</label>
            <input value={editProfile.phone_number || ''} onChange={e => setEditProfile({...editProfile, phone_number: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-indigo-500 transition-all outline-none" />
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-slate-700 mb-1">Address</label>
            <input value={editProfile.address || ''} onChange={e => setEditProfile({...editProfile, address: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-indigo-500 transition-all outline-none" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">City</label>
            <input value={editProfile.city || ''} onChange={e => setEditProfile({...editProfile, city: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-indigo-500 transition-all outline-none" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">State</label>
            <input value={editProfile.state || ''} onChange={e => setEditProfile({...editProfile, state: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-indigo-500 transition-all outline-none" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">ZIP Code</label>
            <input value={editProfile.zip || ''} onChange={e => setEditProfile({...editProfile, zip: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-indigo-500 transition-all outline-none" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Google Connection</label>
            <div className="flex gap-2">
              <input value={profile.google_email_id || 'Not connected'} disabled className="w-full bg-slate-100 border border-slate-200 rounded-xl px-4 py-2.5 text-slate-500" />
            </div>
          </div>
        </div>
        <div className="flex gap-3">
          <button onClick={updateProfile} className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium px-6 py-2.5 rounded-xl shadow-sm transition-all shadow-indigo-200">
            Save Changes
          </button>
          {!profile.google_email_id && (
            <button onClick={connectGoogle} className="bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 font-medium px-6 py-2.5 rounded-xl shadow-sm transition-all">
              Connect Google
            </button>
          )}
        </div>
      </Card>
    </div>
  );

  const renderDoctors = () => (
    <div className="animate-fade-in">
      <h2 className="text-2xl font-bold text-slate-800 mb-6 flex items-center gap-2"><UserPlus className="text-indigo-500" /> Manage Doctors</h2>
      
      <Card className="mb-8 border-indigo-100 bg-indigo-50/30">
        <h3 className="font-bold text-lg text-slate-800 mb-4">Add New Doctor</h3>
        <form onSubmit={createDoctor} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Name</label>
            <input placeholder="Dr. John Doe" value={newDoctor.name} onChange={e => setNewDoctor({...newDoctor, name: e.target.value})} className="w-full bg-white border border-slate-200 p-2.5 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
            <input type="email" placeholder="doctor@hospital.com" value={newDoctor.email} onChange={e => setNewDoctor({...newDoctor, email: e.target.value})} className="w-full bg-white border border-slate-200 p-2.5 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
            <input type="password" placeholder="Temporary password" value={newDoctor.password} onChange={e => setNewDoctor({...newDoctor, password: e.target.value})} className="w-full bg-white border border-slate-200 p-2.5 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Phone</label>
            <div className="flex gap-2">
              <input placeholder="+1234567890" value={newDoctor.phone_number} onChange={e => setNewDoctor({...newDoctor, phone_number: e.target.value})} className="w-full bg-white border border-slate-200 p-2.5 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none" required />
              <button type="submit" className="bg-indigo-600 text-white p-2.5 rounded-xl hover:bg-indigo-700 transition-colors shrink-0">
                <Plus size={20}/>
              </button>
            </div>
          </div>
        </form>
      </Card>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {doctors.map(d => (
          <Card key={d.id} className="flex flex-col border-t-4 border-t-indigo-400">
            <div className="flex justify-between items-start mb-3">
              <h3 className="font-bold text-lg text-slate-800">Dr. {d.name}</h3>
              <button onClick={() => updateAvailability(d.id, !d.availability)} 
                className={`px-2 py-1 text-xs font-bold rounded-md transition-colors ${d.availability ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                {d.availability ? 'Available' : 'Unavailable'}
              </button>
            </div>
            
            <div className="space-y-2 mb-4 text-sm flex-1">
              <p className="flex items-center gap-2 text-slate-600"><Mail size={14}/> {d.registered_email}</p>
              <p className="flex items-center gap-2 text-slate-600"><Star size={14}/> {d.specialty || 'General'}</p>
              {d.rating && <p className="flex items-center gap-2 text-slate-600"><Star className="fill-amber-400 text-amber-400" size={14}/> {d.rating} Rating</p>}
            </div>

            <div className="flex items-center justify-between border-t border-slate-100 pt-4 mt-2">
              <div className="flex items-center gap-2 w-1/2">
                <label className="text-xs font-medium text-slate-500">Case Limit:</label>
                <input type="number" defaultValue={d.case_limit || 0} onBlur={(e) => updateCaseLimit(d.id, parseInt(e.target.value))} className="w-16 p-1 text-sm bg-slate-50 border border-slate-200 rounded outline-none" />
              </div>
              <button onClick={() => deleteDoctor(d.id)} className="text-xs text-rose-500 hover:text-rose-700 font-bold">
                Remove
              </button>
            </div>
          </Card>
        ))}
        {doctors.length === 0 && <p className="text-slate-500 col-span-full text-center py-8">No doctors registered yet.</p>}
      </div>
    </div>
  );

  const renderUsers = () => (
    <div className="animate-fade-in">
      <h2 className="text-2xl font-bold text-slate-800 mb-6 flex items-center gap-2"><Users className="text-emerald-500" /> Patient Analytics</h2>
      
      {mapMarkers.length > 0 && (
        <Card className="mb-8 p-2 h-[400px]">
          <div className="h-full rounded-xl overflow-hidden">
            <MapComponent markers={mapMarkers} />
          </div>
        </Card>
      )}

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {users.map(u => (
          <Card key={u.user_id}>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center text-slate-600 font-bold border border-slate-200">
                {u.user_name.charAt(0).toUpperCase()}
              </div>
              <div>
                <h3 className="font-bold text-slate-800">{u.user_name}</h3>
                <p className="text-xs text-slate-500">{u.user_email}</p>
              </div>
            </div>
            <div className="pt-3 border-t border-slate-100 text-sm space-y-1">
              <p className="flex justify-between"><span className="text-slate-500">Status:</span> <span className="font-medium text-slate-800">{u.case_status || 'N/A'}</span></p>
              <p className="flex justify-between"><span className="text-slate-500">Assigned To:</span> <span className="font-medium text-slate-800 text-right">Dr. {u.doctor_name || 'None'}</span></p>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );

  const renderCases = () => (
    <div className="animate-fade-in">
      <h2 className="text-2xl font-bold text-slate-800 mb-6 flex items-center gap-2"><FileText className="text-blue-500" /> Hospital Cases</h2>
      
      <div className="space-y-4">
        {cases.map(c => (
          <Card key={c.id} className="border-l-4 border-l-blue-500">
            <div className="flex flex-col md:flex-row justify-between items-start gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <h3 className="text-lg font-bold text-slate-800">Case #{c.id}</h3>
                  <StatusBadge status={c.status} />
                  {c.disease && <span className="text-sm bg-purple-50 text-purple-700 px-2 py-0.5 rounded-md border border-purple-100 font-medium">{c.disease}</span>}
                </div>
                
                <div className="grid grid-cols-2 gap-4 text-sm mb-3">
                  <div>
                    <p className="text-slate-500">Patient</p>
                    <p className="font-medium text-slate-800">{c.user_name}</p>
                  </div>
                  <div>
                    <p className="text-slate-500">Attending Doctor</p>
                    <p className="font-medium text-slate-800">{c.doctor_name || 'Unassigned'}</p>
                  </div>
                </div>

                {c.symptoms?.length > 0 && (
                  <div className="mb-2">
                    <span className="text-xs text-slate-500">Recorded Symptoms: </span>
                    <span className="text-sm text-slate-700">{c.symptoms.map(s => s.symptom).join(', ')}</span>
                  </div>
                )}
              </div>
              
              <div className="bg-slate-50 rounded-xl p-3 text-sm w-full md:w-64 border border-slate-100">
                <p className="font-bold text-slate-700 mb-2">Attached Documents</p>
                <div className="space-y-1">
                  <p className="text-slate-600 flex justify-between"><span>Patient:</span> <span>{c.user_documents?.length || 0} files</span></p>
                  <p className="text-slate-600 flex justify-between"><span>Doctor:</span> <span>{c.doctor_documents?.length || 0} files</span></p>
                </div>
              </div>
            </div>
          </Card>
        ))}
        {cases.length === 0 && <p className="text-slate-500 text-center py-8">No cases recorded yet.</p>}
      </div>
      <div className="flex justify-center space-x-2 mt-6">
        {[...Array(totalPages)].map((_, i) => (
          <button key={i} onClick={() => setPage(i+1)} className={`w-10 h-10 rounded-xl font-medium transition-all ${page === i+1 ? 'bg-blue-600 text-white shadow-md shadow-blue-200' : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'}`}>{i+1}</button>
        ))}
      </div>
    </div>
  );

  const renderWallet = () => (
    <div className="max-w-4xl animate-fade-in">
      <h2 className="text-2xl font-bold text-slate-800 mb-6 flex items-center gap-2"><Wallet className="text-violet-500" /> Wallet Management</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <Card className="bg-gradient-to-br from-violet-600 to-indigo-700 text-white border-none shadow-lg shadow-violet-200">
          <p className="text-violet-100 font-medium mb-2">Hospital Balance</p>
          <h3 className="text-5xl font-bold mb-6">₹{wallet.balance}</h3>
          
          <div className="bg-white/10 p-4 rounded-xl backdrop-blur-md">
            <p className="text-sm text-violet-100 mb-2 font-medium">Add Funds</p>
            <div className="flex gap-2">
              <input type="number" value={topUpAmount || ''} onChange={e => setTopUpAmount(parseInt(e.target.value))} placeholder="Amount in ₹" className="w-full bg-white/20 border border-white/30 text-white placeholder-violet-200 p-2.5 rounded-lg outline-none focus:bg-white/30 transition-colors" />
              <button onClick={handleTopUp} className="bg-white text-violet-700 font-bold px-6 rounded-lg hover:bg-violet-50 transition-colors">Top Up</button>
            </div>
          </div>
        </Card>
        
        <Card className="flex flex-col justify-center items-center text-center p-8 bg-slate-50 border-dashed border-2">
          <Wallet className="text-slate-300 w-16 h-16 mb-4" />
          <h3 className="text-lg font-bold text-slate-800 mb-2">Transaction History</h3>
          <p className="text-sm text-slate-500 mb-4">View your recent deposits and withdrawals from the admin panel.</p>
          <button disabled className="bg-slate-200 text-slate-500 px-4 py-2 rounded-lg font-medium cursor-not-allowed">Coming Soon</button>
        </Card>
      </div>
    </div>
  );

  const renderPolicy = () => (
    <div className="max-w-3xl animate-fade-in">
      <h2 className="text-2xl font-bold text-slate-800 mb-6 flex items-center gap-2"><Shield className="text-emerald-500" /> Hospital Policy</h2>
      
      <Card className="mb-6 bg-emerald-50/50 border-emerald-100">
        <h3 className="font-bold text-slate-800 mb-2">Upload New Policy Document</h3>
        <p className="text-sm text-slate-600 mb-4">This policy will be visible to all doctors and patients associated with your hospital.</p>
        <DocumentUploader onUploadComplete={loadData} />
      </Card>

      {policyUrl && (
        <Card className="flex items-center justify-between border-emerald-200">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-emerald-100 text-emerald-600 rounded-xl"><FileText size={24}/></div>
            <div>
              <h3 className="font-bold text-slate-800">Current Policy Document</h3>
              <p className="text-sm text-slate-500">Active and visible to staff</p>
            </div>
          </div>
          <a href={policyUrl} target="_blank" rel="noopener noreferrer" className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium px-6 py-2.5 rounded-xl transition-colors">
            View Policy
          </a>
        </Card>
      )}
    </div>
  );

  const tabs = [
    { id: 'overview', name: 'Overview', icon: LayoutDashboard },
    { id: 'doctors', name: 'Doctors', icon: UserPlus },
    { id: 'users', name: 'Patients', icon: Users },
    { id: 'cases', name: 'Cases', icon: FileText },
    { id: 'wallet', name: 'Wallet', icon: Wallet },
    { id: 'policy', name: 'Policy', icon: Shield },
    { id: 'profile', name: 'Profile', icon: Building2 },
  ];

  return (
    <div className="flex h-screen bg-slate-50 font-sans overflow-hidden">
      {/* Sidebar */}
      <div className="w-72 bg-slate-900 text-slate-300 flex flex-col border-r border-slate-800 hidden md:flex z-10 shadow-2xl">
        <div className="p-6 border-b border-slate-800 flex items-center gap-3">
          <div className="bg-indigo-600 p-2 rounded-xl text-white"><Building2 size={24}/></div>
          <h1 className="text-xl font-bold text-white tracking-tight">HealthifAI Hosp.</h1>
        </div>
        <div className="flex-1 overflow-y-auto py-6 px-4 space-y-1 custom-scrollbar">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button key={tab.id} onClick={() => { setActiveTab(tab.id); setPage(1); }} 
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 font-medium ${
                  isActive ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/50' : 'hover:bg-slate-800 hover:text-white'
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
            {tabs.find(t => t.id === activeTab)?.name}
          </h2>
          <div className="flex items-center gap-6 ml-auto">
            <NotificationBell />
            <div className="flex items-center gap-3 pl-6 border-l border-slate-200">
              <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center text-slate-600 font-bold border border-slate-200">
                {profile?.name ? profile.name.charAt(0).toUpperCase() : 'H'}
              </div>
              <div className="hidden sm:block">
                <p className="text-sm font-bold text-slate-800">{profile?.name || 'Hospital Admin'}</p>
                <p className="text-xs text-indigo-600 font-medium">HOSPITAL</p>
              </div>
            </div>
          </div>
        </header>

        {/* Scrollable Content */}
        <main className="flex-1 overflow-y-auto p-4 md:p-8 custom-scrollbar relative">
          <div className="max-w-7xl mx-auto">
            {activeTab === 'overview' && renderOverview()}
            {activeTab === 'profile' && renderProfile()}
            {activeTab === 'doctors' && renderDoctors()}
            {activeTab === 'users' && renderUsers()}
            {activeTab === 'cases' && renderCases()}
            {activeTab === 'wallet' && renderWallet()}
            {activeTab === 'policy' && renderPolicy()}
          </div>
        </main>
      </div>
    </div>
  );
};

export default HospitalDashboard;