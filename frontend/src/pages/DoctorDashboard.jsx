import { useState, useEffect } from 'react';
import api from '../services/api';
import NotificationBell from '../components/NotificationBell';
import DocumentUploader from '../components/DocumentUploader';
import { useAuth } from '../context/AuthContext';
import { 
  LayoutDashboard, User, FileText, Calendar, Users, 
  Wallet, File, Building2, DollarSign, X, 
  LogOut, Activity, ChevronRight, CheckCircle2, Clock
} from 'lucide-react';

const DoctorDashboard = () => {
  const { logout } = useAuth();
  const [activeTab, setActiveTab] = useState('overview');
  const [profile, setProfile] = useState({});
  const [editProfile, setEditProfile] = useState({ username: '', email: '', specialty: '', availability: '' });
  const [cases, setCases] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [assignedUsers, setAssignedUsers] = useState([]);
  const [fees, setFees] = useState({ fees: 0, appointment_fees: 0 });
  const [hospital, setHospital] = useState({});
  const [transactions, setTransactions] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [wallet, setWallet] = useState({ balance: 0 });
  const [topUpAmount, setTopUpAmount] = useState(0);
  const [selectedCase, setSelectedCase] = useState(null);
  const [caseSymptoms, setCaseSymptoms] = useState([]);
  const [caseUserDocs, setCaseUserDocs] = useState([]);
  const [caseDoctorDocs, setCaseDoctorDocs] = useState([]);
  const [allSymptoms, setAllSymptoms] = useState([]);
  const [allDocuments, setAllDocuments] = useState([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const [toastMsg, setToastMsg] = useState('');
  const showToast = (msg) => { setToastMsg(msg); setTimeout(() => setToastMsg(''), 3000); };

  const loadData = async () => {
    try {
      if (activeTab === 'overview') {
        const casesRes = await api.get('/doctor/cases', { params: { page: 1, limit: 5 } });
        const aptsRes = await api.get('/doctor/appointment', { params: { limit: 5 } });
        const walletRes = await api.get('/default/myWallet');
        setCases(casesRes.data.cases || []);
        setAppointments(aptsRes.data.appointments || []);
        setWallet(walletRes.data);
      } else if (activeTab === 'profile') {
        const res = await api.get('/doctor/profile');
        setProfile(res.data);
        setEditProfile({ username: res.data.name, email: res.data.email, specialty: res.data.specialty, availability: res.data.availability });
      } else if (activeTab === 'cases') {
        const res = await api.get('/doctor/cases', { params: { page, limit: 10 } });
        setCases(res.data.cases || []);
        setTotalPages(Math.ceil((res.data.total || 0) / 10));
      } else if (activeTab === 'appointments') {
        const res = await api.get('/doctor/appointment', { params: { page, limit: 10 } });
        setAppointments(res.data.appointments || []);
      } else if (activeTab === 'assignedUsers') {
        const res = await api.get('/doctor/assigned-users');
        setAssignedUsers(res.data || []);
      } else if (activeTab === 'fees') {
        const res = await api.get('/doctor/fees');
        setFees(res.data || { fees: 0, appointment_fees: 0 });
      } else if (activeTab === 'hospital') {
        const res = await api.get('/doctor/hospital');
        setHospital(res.data || {});
      } else if (activeTab === 'transactions') {
        const res = await api.get('/doctor/transactions', { params: { page, limit: 10 } });
        setTransactions(res.data || []);
      } else if (activeTab === 'documents') {
        const res = await api.get('/default/documents', { params: { limit: 20 } });
        setDocuments(res.data.documents || []);
        setAllDocuments(res.data.documents || []);
      } else if (activeTab === 'wallet') {
        const w = await api.get('/default/myWallet');
        setWallet(w.data);
      }
    } catch (err) { console.error(err); }
  };

  useEffect(() => { loadData(); }, [activeTab, page]);

  const updateProfile = async () => {
    await api.put('/doctor/profile', editProfile);
    showToast('Profile updated');
    loadData();
  };

  const updateFees = async () => {
    await api.put('/doctor/fees', fees);
    showToast('Fees updated');
    loadData();
  };

  const closeCase = async (caseId) => {
    await api.put(`/doctor/cases/close/${caseId}`);
    showToast('Case closed');
    loadData();
  };

  const viewCaseDetails = async (caseId) => {
    const res = await api.get('/doctor/cases', { params: { case_id: caseId } });
    const caseData = res.data.cases[0];
    if(!caseData) return;
    setSelectedCase(caseData);
    setCaseSymptoms(caseData.symptoms || []);
    setCaseUserDocs(caseData.documents?.user || []);
    setCaseDoctorDocs(caseData.documents?.doctor || []);
    const symRes = await api.get('/user/symptom');
    setAllSymptoms(symRes.data || []);
    const docRes = await api.get('/default/documents');
    setAllDocuments(docRes.data.documents || []);
  };

  const addDoctorDocumentToCase = async (caseId, docId) => {
    await api.put(`/doctor/cases/document/${caseId}`, { document_ids: [docId] });
    showToast('Document added');
    viewCaseDetails(caseId);
  };

  const addSymptomToCase = async (caseId, symptomId) => {
    await api.put(`/doctor/cases/symptoms/${caseId}`, { symptom_ids: [symptomId] });
    showToast('Symptom added');
    viewCaseDetails(caseId);
  };

  const handleTopUp = async () => {
    if (topUpAmount <= 0) return showToast('Enter a valid amount');
    try {
      await api.put('/default/topUp', { amount: topUpAmount });
      showToast('Wallet topped up');
      setTopUpAmount(0);
      loadData();
    } catch (err) { showToast('Top-up failed'); }
  };

  // UI Components
  const StatusBadge = ({ status }) => {
    const colors = {
      OPEN: 'bg-emerald-100 text-emerald-700 border-emerald-200',
      CLOSED: 'bg-slate-100 text-slate-700 border-slate-200',
      CONFIRMED: 'bg-blue-100 text-blue-700 border-blue-200',
      PENDING: 'bg-amber-100 text-amber-700 border-amber-200',
      CANCELLED: 'bg-red-100 text-red-700 border-red-200',
      COMPLETED: 'bg-indigo-100 text-indigo-700 border-indigo-200'
    };
    return (
      <span className={`px-2.5 py-1 text-xs font-semibold border rounded-full ${colors[status] || 'bg-gray-100 text-gray-700'}`}>
        {status}
      </span>
    );
  };

  const Card = ({ children, className = '' }) => (
    <div className={`bg-white rounded-2xl border border-slate-100 shadow-sm p-6 transition-all duration-300 hover:shadow-md ${className}`}>
      {children}
    </div>
  );

  const renderOverview = () => (
    <div className="space-y-6 animate-fade-in">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="bg-gradient-to-br from-blue-50 to-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-blue-600 mb-1">Active Cases</p>
              <h3 className="text-4xl font-bold text-slate-800">{cases.filter(c => c.status === 'OPEN').length}</h3>
            </div>
            <div className="p-3 bg-blue-100 rounded-xl text-blue-600"><Activity size={24} /></div>
          </div>
        </Card>
        <Card className="bg-gradient-to-br from-emerald-50 to-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-emerald-600 mb-1">Today's Appointments</p>
              <h3 className="text-4xl font-bold text-slate-800">
                {appointments.filter(a => new Date(a.date).toDateString() === new Date().toDateString()).length}
              </h3>
            </div>
            <div className="p-3 bg-emerald-100 rounded-xl text-emerald-600"><Calendar size={24} /></div>
          </div>
        </Card>
        <Card className="bg-gradient-to-br from-violet-50 to-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-violet-600 mb-1">Wallet Balance</p>
              <h3 className="text-4xl font-bold text-slate-800">₹{wallet.balance}</h3>
            </div>
            <div className="p-3 bg-violet-100 rounded-xl text-violet-600"><Wallet size={24} /></div>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-bold text-slate-800">Recent Cases</h3>
            <button onClick={() => setActiveTab('cases')} className="text-sm text-blue-600 hover:text-blue-800 flex items-center">View all <ChevronRight size={16}/></button>
          </div>
          {cases.slice(0,3).map(c => (
            <div key={c.id} className="py-3 border-b border-slate-100 last:border-0 flex justify-between items-center">
              <div>
                <p className="font-semibold text-slate-800">Patient: {c.user_name}</p>
                <p className="text-sm text-slate-500">Case #{c.case_id} {c.disease ? `- ${c.disease}` : ''}</p>
              </div>
              <StatusBadge status={c.status} />
            </div>
          ))}
          {cases.length === 0 && <p className="text-slate-500 text-sm">No active cases.</p>}
        </Card>
        
        <Card>
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-bold text-slate-800">Upcoming Appointments</h3>
            <button onClick={() => setActiveTab('appointments')} className="text-sm text-blue-600 hover:text-blue-800 flex items-center">View all <ChevronRight size={16}/></button>
          </div>
          {appointments.slice(0,3).map(a => (
            <div key={a.id} className="py-3 border-b border-slate-100 last:border-0 flex justify-between items-center">
              <div>
                <p className="font-semibold text-slate-800">{a.username}</p>
                <p className="text-sm text-slate-500 flex items-center gap-1"><Clock size={14}/> {new Date(a.date).toLocaleString()}</p>
              </div>
              <StatusBadge status={a.status} />
            </div>
          ))}
          {appointments.length === 0 && <p className="text-slate-500 text-sm">No upcoming appointments.</p>}
        </Card>
      </div>
    </div>
  );

  const renderProfile = () => (
    <div className="max-w-2xl animate-fade-in">
      <Card>
        <h2 className="text-2xl font-bold text-slate-800 mb-6 flex items-center gap-2"><User className="text-blue-600" /> My Profile</h2>
        <div className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Full Name</label>
            <input value={editProfile.username || ''} onChange={e => setEditProfile({...editProfile, username: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-blue-500 transition-all outline-none" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Email Address</label>
            <input value={editProfile.email || ''} onChange={e => setEditProfile({...editProfile, email: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-blue-500 transition-all outline-none" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Specialty</label>
              <input value={editProfile.specialty || ''} onChange={e => setEditProfile({...editProfile, specialty: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-blue-500 transition-all outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Availability</label>
              <input value={editProfile.availability || ''} onChange={e => setEditProfile({...editProfile, availability: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-blue-500 transition-all outline-none" />
            </div>
          </div>
          <div className="pt-4">
            <button onClick={updateProfile} className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-6 py-2.5 rounded-xl shadow-sm transition-all shadow-blue-200">
              Save Profile
            </button>
          </div>
        </div>
      </Card>
    </div>
  );

  const renderCases = () => (
    <div className="animate-fade-in">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2"><FileText className="text-blue-600" /> Patient Cases</h2>
      </div>
      <div className="space-y-4">
        {cases.map(c => (
          <Card key={c.id} className="border-l-4 border-l-blue-500">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <h3 className="text-lg font-bold text-slate-800">Case #{c.case_id}</h3>
                  <StatusBadge status={c.status} />
                  {c.disease && <span className="text-sm bg-purple-50 text-purple-700 px-2 py-0.5 rounded-md border border-purple-100 font-medium">{c.disease}</span>}
                </div>
                <div className="grid grid-cols-2 gap-x-8 gap-y-1 text-sm text-slate-600">
                  <p><span className="font-medium">Patient:</span> {c.user_name}</p>
                  <p><span className="font-medium">Cost:</span> ₹{c.cost || 0}</p>
                  <p><span className="font-medium">Opened:</span> {new Date(c.case_opened_on).toLocaleDateString()}</p>
                </div>
                {c.symptoms?.length > 0 && (
                  <div className="flex items-center gap-2 mt-2 flex-wrap">
                    <span className="text-xs font-medium text-slate-500">Symptoms:</span>
                    {c.symptoms.map(s => (
                      <span key={s.id} className="text-xs bg-slate-100 text-slate-700 px-2 py-1 rounded-md">{s.symptom} (Lv {s.severity})</span>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex gap-2 w-full md:w-auto">
                {c.status === 'OPEN' && <button onClick={() => closeCase(c.id)} className="flex-1 md:flex-none px-4 py-2 bg-rose-50 text-rose-600 font-medium rounded-xl hover:bg-rose-100 transition-colors">Close Case</button>}
                <button onClick={() => viewCaseDetails(c.id)} className="flex-1 md:flex-none px-4 py-2 bg-slate-800 text-white font-medium rounded-xl hover:bg-slate-700 transition-colors">Details</button>
              </div>
            </div>
          </Card>
        ))}
        {cases.length === 0 && <p className="text-slate-500 text-center py-8">No active cases assigned.</p>}
      </div>
      <div className="flex justify-center space-x-2 mt-6">
        {[...Array(totalPages)].map((_, i) => (
          <button key={i} onClick={() => setPage(i+1)} className={`w-10 h-10 rounded-xl font-medium transition-all ${page === i+1 ? 'bg-blue-600 text-white shadow-md shadow-blue-200' : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'}`}>{i+1}</button>
        ))}
      </div>
    </div>
  );

  const renderCaseModal = () => {
    if (!selectedCase) return null;
    return (
      <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex justify-center items-center z-50 p-4 animate-fade-in">
        <div className="bg-white rounded-3xl p-8 max-w-3xl w-full max-h-[90vh] overflow-auto shadow-2xl relative">
          <button onClick={() => setSelectedCase(null)} className="absolute top-6 right-6 p-2 text-slate-400 hover:text-slate-600 bg-slate-100 rounded-full transition-colors"><X size={20}/></button>
          
          <div className="mb-8">
            <h2 className="text-3xl font-bold text-slate-800 mb-2">Case #{selectedCase.case_id}</h2>
            <div className="flex flex-wrap gap-3">
              <StatusBadge status={selectedCase.status} />
              <span className="px-3 py-1 bg-slate-100 text-slate-600 rounded-full text-sm font-medium"><User size={14} className="inline mr-1"/> Patient: {selectedCase.user_name}</span>
              <span className="px-3 py-1 bg-slate-100 text-slate-600 rounded-full text-sm font-medium"><Calendar size={14} className="inline mr-1"/> Opened: {new Date(selectedCase.case_opened_on).toLocaleDateString()}</span>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
            <div className="space-y-6">
              <div>
                <h3 className="font-bold text-lg text-slate-800 mb-3 flex items-center gap-2"><Activity className="text-rose-500" size={20}/> Symptoms</h3>
                <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100">
                  <ul className="space-y-2 mb-4">
                    {caseSymptoms.map(s => (
                      <li key={s.id} className="flex justify-between items-center bg-white p-2 px-3 rounded-lg border border-slate-100 shadow-sm">
                        <span className="font-medium text-slate-700">{s.symptom}</span>
                        <span className={`text-xs px-2 py-1 rounded-md font-bold ${s.severity > 7 ? 'bg-rose-100 text-rose-700' : s.severity > 4 ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>Lv {s.severity}</span>
                      </li>
                    ))}
                    {caseSymptoms.length === 0 && <p className="text-sm text-slate-500 italic">No symptoms recorded.</p>}
                  </ul>
                  <div className="flex gap-2">
                    <select onChange={e => {if(e.target.value) addSymptomToCase(selectedCase.id, parseInt(e.target.value))}} className="flex-1 bg-white border border-slate-200 p-2.5 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500">
                      <option value="">+ Add Symptom</option>
                      {allSymptoms.map(s => <option key={s.id} value={s.id}>{s.symptom}</option>)}
                    </select>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <div>
                <h3 className="font-bold text-lg text-slate-800 mb-3 flex items-center gap-2"><FileText className="text-blue-500" size={20}/> Documents</h3>
                <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 space-y-4">
                  <div>
                    <h4 className="text-sm font-semibold text-slate-600 mb-2">From Patient</h4>
                    <ul className="space-y-2">
                      {caseUserDocs.map(d => (
                        <li key={d.id}><a href={d.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-blue-600 bg-blue-50 hover:bg-blue-100 p-2 rounded-lg transition-colors"><File size={16}/> {d.type}</a></li>
                      ))}
                      {caseUserDocs.length === 0 && <p className="text-xs text-slate-400">None</p>}
                    </ul>
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-slate-600 mb-2">From You (Doctor)</h4>
                    <ul className="space-y-2">
                      {caseDoctorDocs.map(d => (
                        <li key={d.id}><a href={d.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-emerald-600 bg-emerald-50 hover:bg-emerald-100 p-2 rounded-lg transition-colors"><File size={16}/> {d.type}</a></li>
                      ))}
                      {caseDoctorDocs.length === 0 && <p className="text-xs text-slate-400">None</p>}
                    </ul>
                  </div>
                  <div className="pt-2 border-t border-slate-200">
                    <select onChange={e => {if(e.target.value) addDoctorDocumentToCase(selectedCase.id, parseInt(e.target.value))}} className="w-full bg-white border border-slate-200 p-2.5 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500">
                      <option value="">+ Attach My Document</option>
                      {allDocuments.map(d => <option key={d.id} value={d.id}>{d.type} - {new Date(d.date).toLocaleDateString()}</option>)}
                    </select>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderAppointments = () => (
    <div className="animate-fade-in">
      <h2 className="text-2xl font-bold text-slate-800 mb-6 flex items-center gap-2"><Calendar className="text-emerald-500" /> Appointments</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {appointments.map(a => (
          <Card key={a.id} className="relative overflow-hidden group">
            <div className={`absolute top-0 left-0 w-1 h-full ${a.status==='CONFIRMED'?'bg-blue-500':a.status==='PENDING'?'bg-amber-400':a.status==='COMPLETED'?'bg-emerald-500':'bg-red-400'}`}></div>
            <div className="pl-3">
              <div className="flex justify-between items-start mb-3">
                <StatusBadge status={a.status} />
              </div>
              <h3 className="font-bold text-lg text-slate-800 mb-1">{a.username}</h3>
              <p className="text-slate-500 text-sm flex items-center gap-2 mb-2"><Clock size={14}/> {new Date(a.date).toLocaleString()}</p>
              {a.price > 0 && <p className="text-slate-600 font-medium text-sm flex items-center gap-1"><DollarSign size={14}/> ₹{a.price}</p>}
              {a.case_id && <p className="text-slate-400 text-xs mt-2">Case #{a.case_id}</p>}
            </div>
          </Card>
        ))}
        {appointments.length === 0 && <p className="text-slate-500 col-span-full">No appointments scheduled.</p>}
      </div>
    </div>
  );

  const renderAssignedUsers = () => (
    <div className="animate-fade-in">
      <h2 className="text-2xl font-bold text-slate-800 mb-6 flex items-center gap-2"><Users className="text-blue-500" /> Assigned Patients</h2>
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {assignedUsers.map(u => (
          <Card key={u.id} className="border-t-4 border-t-blue-500">
            <h3 className="font-bold text-lg text-slate-800 mb-2">{u.username}</h3>
            <p className="text-slate-600 text-sm mb-1"><span className="font-medium">Active Case:</span> #{u.case_id}</p>
            <p className="text-slate-500 text-sm"><span className="font-medium">Opened:</span> {new Date(u.case_opened_at).toLocaleDateString()}</p>
          </Card>
        ))}
        {assignedUsers.length === 0 && <p className="text-slate-500 col-span-full">No assigned patients.</p>}
      </div>
    </div>
  );

  const renderFees = () => (
    <div className="max-w-xl animate-fade-in">
      <Card>
        <h2 className="text-2xl font-bold text-slate-800 mb-6 flex items-center gap-2"><DollarSign className="text-emerald-500" /> Fee Management</h2>
        <div className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">General Consultation Fee (₹)</label>
            <input type="number" value={fees.fees || 0} onChange={e => setFees({...fees, fees: parseInt(e.target.value)})} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-emerald-500 transition-all outline-none" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Appointment Fee (₹)</label>
            <input type="number" value={fees.appointment_fees || 0} onChange={e => setFees({...fees, appointment_fees: parseInt(e.target.value)})} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-emerald-500 transition-all outline-none" />
          </div>
          <div className="pt-4">
            <button onClick={updateFees} className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium px-6 py-2.5 rounded-xl shadow-sm transition-all shadow-emerald-200">
              Update Fees
            </button>
          </div>
        </div>
      </Card>
    </div>
  );

  const renderHospital = () => (
    <div className="max-w-2xl animate-fade-in">
      <Card>
        <h2 className="text-2xl font-bold text-slate-800 mb-6 flex items-center gap-2"><Building2 className="text-indigo-500" /> My Hospital</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div>
            <p className="text-sm text-slate-500 mb-1">Hospital Name</p>
            <p className="font-semibold text-slate-800">{hospital.name || 'Not Available'}</p>
          </div>
          <div>
            <p className="text-sm text-slate-500 mb-1">Email</p>
            <p className="font-semibold text-slate-800">{hospital.email || 'N/A'}</p>
          </div>
          <div>
            <p className="text-sm text-slate-500 mb-1">Phone Number</p>
            <p className="font-semibold text-slate-800">{hospital.phone || 'N/A'}</p>
          </div>
          <div>
            <p className="text-sm text-slate-500 mb-1">Address</p>
            <p className="font-semibold text-slate-800">{hospital.address}</p>
            <p className="text-sm text-slate-600">{hospital.city}, {hospital.state} - {hospital.zip}</p>
          </div>
        </div>
      </Card>
    </div>
  );

  const renderWallet = () => (
    <div className="max-w-4xl animate-fade-in">
      <h2 className="text-2xl font-bold text-slate-800 mb-6 flex items-center gap-2"><Wallet className="text-violet-500" /> Wallet & Transactions</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card className="bg-gradient-to-br from-violet-600 to-indigo-700 text-white md:col-span-1 border-none shadow-lg shadow-violet-200">
          <p className="text-violet-100 font-medium mb-2">Available Balance</p>
          <h3 className="text-5xl font-bold mb-6">₹{wallet.balance}</h3>
          
          <div className="bg-white/10 p-4 rounded-xl backdrop-blur-md">
            <p className="text-sm text-violet-100 mb-2 font-medium">Quick Top-Up</p>
            <div className="flex gap-2">
              <input type="number" value={topUpAmount || ''} onChange={e => setTopUpAmount(parseInt(e.target.value))} placeholder="Amount" className="w-full bg-white/20 border border-white/30 text-white placeholder-violet-200 p-2.5 rounded-lg outline-none focus:bg-white/30 transition-colors" />
              <button onClick={handleTopUp} className="bg-white text-violet-700 font-bold px-4 rounded-lg hover:bg-violet-50 transition-colors">Add</button>
            </div>
          </div>
        </Card>
        
        <Card className="md:col-span-2 overflow-hidden flex flex-col">
          <h3 className="font-bold text-slate-800 mb-4">Recent Transactions</h3>
          <div className="flex-1 overflow-y-auto pr-2 space-y-3 max-h-[300px]">
            {transactions.map(t => (
              <div key={t.id} className="flex justify-between items-center p-3 rounded-xl hover:bg-slate-50 transition-colors border border-transparent hover:border-slate-100">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${t.type.toLowerCase().includes('credit') || t.type.toLowerCase().includes('topup') || t.type.toLowerCase().includes('refund') ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'}`}>
                    <DollarSign size={18} />
                  </div>
                  <div>
                    <p className="font-semibold text-slate-800 text-sm">{t.note || t.type}</p>
                    <p className="text-xs text-slate-500">{new Date(t.date).toLocaleString()}</p>
                  </div>
                </div>
                <span className={`font-bold ${t.type.toLowerCase().includes('credit') || t.type.toLowerCase().includes('topup') || t.type.toLowerCase().includes('refund') ? 'text-emerald-600' : 'text-slate-800'}`}>
                  {t.type.toLowerCase().includes('credit') || t.type.toLowerCase().includes('topup') || t.type.toLowerCase().includes('refund') ? '+' : '-'}₹{t.amount}
                </span>
              </div>
            ))}
            {transactions.length === 0 && <p className="text-slate-500 text-center py-8">No recent transactions.</p>}
          </div>
        </Card>
      </div>
    </div>
  );

  const renderDocuments = () => (
    <div className="animate-fade-in max-w-4xl">
      <h2 className="text-2xl font-bold text-slate-800 mb-6 flex items-center gap-2"><File className="text-blue-500" /> My Documents</h2>
      <Card className="mb-8 bg-blue-50/50 border-blue-100">
        <h3 className="font-bold text-slate-800 mb-4">Upload New Document</h3>
        <DocumentUploader onUploadComplete={loadData} />
      </Card>
      
      <div>
        <h3 className="font-bold text-lg text-slate-800 mb-4">Stored Documents</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {documents.map(d => (
            <a href={d.url} target="_blank" rel="noopener noreferrer" key={d.id} className="group bg-white border border-slate-200 p-4 rounded-2xl hover:border-blue-300 hover:shadow-md transition-all flex items-start gap-4">
              <div className="p-3 bg-blue-50 text-blue-500 rounded-xl group-hover:bg-blue-500 group-hover:text-white transition-colors">
                <FileText size={24}/>
              </div>
              <div>
                <p className="font-semibold text-slate-800 line-clamp-1">{d.type}</p>
                <p className="text-xs text-slate-500 mt-1">{new Date(d.date).toLocaleDateString()}</p>
              </div>
            </a>
          ))}
          {documents.length === 0 && <p className="text-slate-500 col-span-full">No documents uploaded yet.</p>}
        </div>
      </div>
    </div>
  );

  const tabs = [
    { id: 'overview', name: 'Overview', icon: LayoutDashboard },
    { id: 'cases', name: 'Patient Cases', icon: FileText },
    { id: 'appointments', name: 'Appointments', icon: Calendar },
    { id: 'assignedUsers', name: 'Assigned Patients', icon: Users },
    { id: 'fees', name: 'Fee Settings', icon: DollarSign },
    { id: 'hospital', name: 'My Hospital', icon: Building2 },
    { id: 'documents', name: 'Documents', icon: File },
    { id: 'wallet', name: 'Wallet & Trans', icon: Wallet },
    { id: 'profile', name: 'Profile', icon: User },
  ];

  return (
    <div className="flex h-screen bg-slate-50 font-sans overflow-hidden">
      {toastMsg && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50">
          <div className="bg-slate-800 text-white px-6 py-3 rounded-full shadow-2xl flex items-center gap-2 font-medium">
            <CheckCircle2 className="text-emerald-400" size={18} />
            {toastMsg}
          </div>
        </div>
      )}
      {/* Sidebar */}
      <div className="w-72 bg-slate-900 text-slate-300 flex flex-col border-r border-slate-800 hidden md:flex z-10 shadow-2xl">
        <div className="p-6 border-b border-slate-800 flex items-center gap-3">
          <div className="bg-emerald-600 p-2 rounded-xl text-white"><Activity size={24}/></div>
          <h1 className="text-xl font-bold text-white tracking-tight">HealthifAI Pro</h1>
        </div>
        <div className="flex-1 overflow-y-auto py-6 px-4 space-y-1 custom-scrollbar">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button key={tab.id} onClick={() => { setActiveTab(tab.id); setPage(1); }} 
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 font-medium ${
                  isActive ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/50' : 'hover:bg-slate-800 hover:text-white'
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
                {profile?.username ? profile.username.charAt(0).toUpperCase() : 'D'}
              </div>
              <div className="hidden sm:block">
                <p className="text-sm font-bold text-slate-800">Dr. {profile?.username || 'Doctor'}</p>
                <p className="text-xs text-emerald-600 font-medium">DOCTOR</p>
              </div>
            </div>
          </div>
        </header>

        {/* Scrollable Content */}
        <main className="flex-1 overflow-y-auto p-4 md:p-8 custom-scrollbar relative">
          <div className="max-w-7xl mx-auto">
            {activeTab === 'overview' && renderOverview()}
            {activeTab === 'profile' && renderProfile()}
            {activeTab === 'cases' && renderCases()}
            {activeTab === 'appointments' && renderAppointments()}
            {activeTab === 'assignedUsers' && renderAssignedUsers()}
            {activeTab === 'fees' && renderFees()}
            {activeTab === 'hospital' && renderHospital()}
            {activeTab === 'transactions' && renderWallet()}
            {activeTab === 'documents' && renderDocuments()}
            {activeTab === 'wallet' && renderWallet()}
          </div>
        </main>
      </div>
      {selectedCase && renderCaseModal()}
    </div>
  );
};

export default DoctorDashboard;