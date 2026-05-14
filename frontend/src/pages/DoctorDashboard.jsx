import { useState, useEffect } from 'react';
import api from '../services/api';
import NotificationBell from '../components/NotificationBell';
import DocumentUploader from '../components/DocumentUploader';

const DoctorDashboard = () => {
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
        const res = await api.get('/doctor/cases', { params: { page, limit: 5 } });
        setCases(res.data.cases);
        setTotalPages(Math.ceil(res.data.total / 5));
      } else if (activeTab === 'appointments') {
        const res = await api.get('/doctor/appointment', { params: { page, limit: 5 } });
        setAppointments(res.data.appointments);
      } else if (activeTab === 'assignedUsers') {
        const res = await api.get('/doctor/assigned-users');
        setAssignedUsers(res.data);
      } else if (activeTab === 'fees') {
        const res = await api.get('/doctor/fees');
        setFees(res.data);
      } else if (activeTab === 'hospital') {
        const res = await api.get('/doctor/hospital');
        setHospital(res.data);
      } else if (activeTab === 'transactions') {
        const res = await api.get('/doctor/transactions', { params: { page, limit: 10 } });
        setTransactions(res.data);
      } else if (activeTab === 'documents') {
        const res = await api.get('/default/documents', { params: { limit: 20 } });
        setDocuments(res.data.documents);
        setAllDocuments(res.data.documents);
      } else if (activeTab === 'wallet') {
        const w = await api.get('/default/myWallet');
        setWallet(w.data);
      }
    } catch (err) { console.error(err); }
  };

  useEffect(() => { loadData(); }, [activeTab, page]);

  const updateProfile = async () => {
    await api.put('/doctor/profile', editProfile);
    alert('Profile updated');
    loadData();
  };

  const updateFees = async () => {
    await api.put('/doctor/fees', fees);
    alert('Fees updated');
    loadData();
  };

  const closeCase = async (caseId) => {
    await api.put(`/doctor/cases/${caseId}`);
    alert('Case closed');
    loadData();
  };

  const viewCaseDetails = async (caseId) => {
    const res = await api.get('/doctor/cases', { params: { case_id: caseId } });
    const caseData = res.data.cases[0];
    setSelectedCase(caseData);
    setCaseSymptoms(caseData.symptoms || []);
    setCaseUserDocs(caseData.documents?.user || []);
    setCaseDoctorDocs(caseData.documents?.doctor || []);
    const symRes = await api.get('/user/symptom');
    setAllSymptoms(symRes.data);
    const docRes = await api.get('/default/documents');
    setAllDocuments(docRes.data.documents);
  };

  const addDoctorDocumentToCase = async (caseId, docId) => {
    await api.put(`/doctor/cases/${caseId}/documents`, { document_ids: [docId] });
    alert('Document added');
    loadData();
  };

  const addSymptomToCase = async (caseId, symptomId) => {
    await api.put(`/doctor/cases/${caseId}/symptoms`, { symptom_ids: [symptomId] });
    alert('Symptom added');
    loadData();
  };

  const handleTopUp = async () => {
    await api.put('/default/topUp', { amount: topUpAmount });
    alert('Wallet topped up');
    loadData();
  };

  const renderOverview = () => (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <div className="bg-white p-6 rounded shadow"><h3 className="font-semibold">Active Cases</h3><p className="text-3xl text-blue-600">{cases.filter(c => c.status === 'OPEN').length}</p></div>
      <div className="bg-white p-6 rounded shadow"><h3 className="font-semibold">Today's Appointments</h3><p className="text-3xl text-green-600">{appointments.filter(a => new Date(a.date).toDateString() === new Date().toDateString()).length}</p></div>
      <div className="bg-white p-6 rounded shadow"><h3 className="font-semibold">Wallet Balance</h3><p className="text-3xl text-purple-600">₹{wallet.balance}</p></div>
    </div>
  );

  const renderProfile = () => (
    <div className="bg-white p-6 rounded shadow max-w-md"><h2 className="text-2xl font-bold mb-4">Profile</h2><div className="space-y-3"><input value={editProfile.username} onChange={e => setEditProfile({...editProfile, username: e.target.value})} placeholder="Name" className="border p-2 w-full rounded" /><input value={editProfile.email} onChange={e => setEditProfile({...editProfile, email: e.target.value})} placeholder="Email" className="border p-2 w-full rounded" /><input value={editProfile.specialty} onChange={e => setEditProfile({...editProfile, specialty: e.target.value})} placeholder="Specialty" className="border p-2 w-full rounded" /><input value={editProfile.availability} onChange={e => setEditProfile({...editProfile, availability: e.target.value})} placeholder="Availability" className="border p-2 w-full rounded" /><button onClick={updateProfile} className="bg-blue-600 text-white px-4 py-2 rounded">Update</button></div></div>
  );

  const renderCases = () => (
    <div>{cases.map(c => <div key={c.id} className="border p-4 mb-4 rounded shadow"><div className="flex justify-between"><div><span className="font-bold">Case {c.case_id}</span> - Status: {c.status}<br/>Patient: {c.user_name}</div><button onClick={() => closeCase(c.id)} className="bg-red-500 text-white px-3 py-1 rounded">Close Case</button><button onClick={() => viewCaseDetails(c.id)} className="bg-gray-500 text-white px-3 py-1 rounded ml-2">Details</button></div></div>)}<div className="flex justify-center">{/* pagination */}</div></div>
  );

  const renderCaseModal = () => {
    if (!selectedCase) return null;
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50"><div className="bg-white rounded-lg p-6 max-w-3xl w-full"><h2 className="text-2xl font-bold mb-4">Case {selectedCase.case_id}</h2><div><h3 className="font-bold">Symptoms</h3><ul>{caseSymptoms.map(s => <li key={s.id}>{s.name}</li>)}</ul><select onChange={e => addSymptomToCase(selectedCase.id, parseInt(e.target.value))} className="border p-2 mt-2"><option value="">Add Symptom</option>{allSymptoms.map(s => <option key={s.id} value={s.id}>{s.symptom}</option>)}</select></div><div className="mt-4"><h3 className="font-bold">User Documents</h3><ul>{caseUserDocs.map(d => <li key={d.id}><a href={d.url} target="_blank">{d.type}</a></li>)}</ul></div><div className="mt-4"><h3 className="font-bold">My Documents (Doctor)</h3><ul>{caseDoctorDocs.map(d => <li key={d.id}><a href={d.url} target="_blank">{d.type}</a></li>)}</ul><select onChange={e => addDoctorDocumentToCase(selectedCase.id, parseInt(e.target.value))} className="border p-2 mt-2"><option value="">Add My Document</option>{allDocuments.map(d => <option key={d.id} value={d.id}>{d.type}</option>)}</select></div><div className="mt-4 text-right"><button onClick={() => setSelectedCase(null)} className="bg-gray-500 text-white px-4 py-2 rounded">Close</button></div></div></div>
    );
  };

  const renderAppointments = () => (
    <div>{appointments.map(a => <div key={a.id} className="border p-3 mb-2 rounded"><span className="font-bold">{new Date(a.date).toLocaleString()}</span> - {a.username} - {a.status}</div>)}</div>
  );

  const renderAssignedUsers = () => (
    <div className="grid md:grid-cols-2 gap-4">{assignedUsers.map(u => <div key={u.id} className="border p-3 rounded shadow"><span className="font-bold">{u.username}</span><br/>Case: {u.case_id}<br/>Opened: {new Date(u.case_opened_at).toLocaleDateString()}</div>)}</div>
  );

  const renderFees = () => (
    <div className="bg-white p-6 rounded shadow max-w-md"><h2 className="text-2xl font-bold mb-4">My Fees</h2><div><label>Consultation Fee</label><input type="number" value={fees.fees} onChange={e => setFees({...fees, fees: parseInt(e.target.value)})} className="border p-2 w-full rounded mb-2" /><label>Appointment Fee</label><input type="number" value={fees.appointment_fees} onChange={e => setFees({...fees, appointment_fees: parseInt(e.target.value)})} className="border p-2 w-full rounded mb-2" /><button onClick={updateFees} className="bg-blue-600 text-white px-4 py-2 rounded">Update Fees</button></div></div>
  );

  const renderHospital = () => (
    <div className="bg-white p-6 rounded shadow"><h2 className="text-2xl font-bold mb-4">My Hospital</h2><p><span className="font-bold">Name:</span> {hospital.name}</p><p><span className="font-bold">Email:</span> {hospital.email}</p><p><span className="font-bold">Address:</span> {hospital.address}, {hospital.city}, {hospital.state} - {hospital.zip}</p><p><span className="font-bold">Phone:</span> {hospital.phone}</p></div>
  );

  const renderTransactions = () => (
    <div><h2 className="text-2xl font-bold mb-4">Transactions</h2><ul>{transactions.map(t => <li key={t.id} className="border p-2 mb-1 rounded">₹{t.amount} - {t.type} - {t.note}<br/><span className="text-xs">{new Date(t.date).toLocaleString()}</span></li>)}</ul></div>
  );

  const renderDocuments = () => (
    <div>
      <h2 className="text-2xl font-bold mb-4">My Documents</h2>
      <DocumentUploader onUploadComplete={loadData} />
      <div className="mt-6">
        <h3 className="font-semibold text-lg mb-2">Uploaded Documents</h3>
        {documents.length === 0 ? (
          <p className="text-gray-500">No documents uploaded yet.</p>
        ) : (
          <div className="grid md:grid-cols-2 gap-3">
            {documents.map(d => (
              <div key={d.id} className="border p-3 rounded flex justify-between items-center">
                <div>
                  <span className="font-medium">{d.type}</span>
                  <span className="text-gray-500 text-sm ml-2">{new Date(d.date).toLocaleDateString()}</span>
                </div>
                <a href={d.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">View</a>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  const renderWallet = () => (
    <div className="bg-white p-6 rounded shadow max-w-md"><h2 className="text-2xl font-bold mb-4">Wallet</h2><div className="text-center mb-4"><span className="text-4xl font-bold text-green-600">₹{wallet.balance}</span></div><div className="flex gap-2"><input type="number" placeholder="Amount" value={topUpAmount} onChange={e => setTopUpAmount(parseInt(e.target.value))} className="border p-2 flex-1 rounded" /><button onClick={handleTopUp} className="bg-blue-600 text-white px-4 py-2 rounded">Top Up</button></div></div>
  );

  const tabs = ['overview', 'profile', 'cases', 'appointments', 'assignedUsers', 'fees', 'hospital', 'transactions', 'documents', 'wallet'];
  const tabNames = ['Overview', 'Profile', 'Cases', 'Appointments', 'Assigned Users', 'Fees', 'Hospital', 'Transactions', 'Documents', 'Wallet'];

  return (
    <div>
      <div className="flex justify-between bg-blue-600 text-white p-4"><h1>Doctor Dashboard</h1><NotificationBell /></div>
      <div className="flex"><div className="w-64 bg-gray-800 text-white min-h-screen p-4">{tabs.map((tab, idx) => <button key={tab} onClick={() => setActiveTab(tab)} className={`block w-full text-left p-2 rounded mb-1 ${activeTab === tab ? 'bg-blue-600' : 'hover:bg-gray-700'}`}>{tabNames[idx]}</button>)}</div><div className="flex-1 p-6 bg-gray-100">{activeTab === 'overview' && renderOverview()}{activeTab === 'profile' && renderProfile()}{activeTab === 'cases' && renderCases()}{activeTab === 'appointments' && renderAppointments()}{activeTab === 'assignedUsers' && renderAssignedUsers()}{activeTab === 'fees' && renderFees()}{activeTab === 'hospital' && renderHospital()}{activeTab === 'transactions' && renderTransactions()}{activeTab === 'documents' && renderDocuments()}{activeTab === 'wallet' && renderWallet()}</div></div>
      {selectedCase && renderCaseModal()}
    </div>
  );
};

export default DoctorDashboard;