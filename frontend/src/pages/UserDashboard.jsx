import { useState, useEffect } from 'react';
import api from '../services/api';
import NotificationBell from '../components/NotificationBell';
import MapComponent from '../components/MapComponent';
import LocationPicker from '../components/LocationPicker';
import DocumentUploader from '../components/DocumentUploader';
import { useAuth } from '../context/AuthContext';
import {
  LayoutDashboard, User, Activity, FileText, Calendar,
  Search, Users, Wallet, File, MapPin, X, Plus,
  Map as MapIcon, LogOut, ChevronRight,
  Clock, DollarSign, Star, Navigation, Upload, CheckCircle2, Lock, Building2, Edit2
} from 'lucide-react';

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

const UserDashboard = () => {
  const { logout } = useAuth();
  const [activeTab, setActiveTab] = useState('overview');
  const [profile, setProfile] = useState({});
  const [editProfile, setEditProfile] = useState({ name: '', email: '' });
  const [newPassword, setNewPassword] = useState('');
  const [symptoms, setSymptoms] = useState([]);
  const [cases, setCases] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [myDoctors, setMyDoctors] = useState([]);
  const [wallet, setWallet] = useState({ balance: 0 });
  const [transactions, setTransactions] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [location, setLocation] = useState({ lat: null, lon: null });
  const [nearbyDoctors, setNearbyDoctors] = useState([]);
  const [newSymptom, setNewSymptom] = useState({ symptom: '', severity: 5 });
  const [topUpAmount, setTopUpAmount] = useState(0);
  const [selectedCase, setSelectedCase] = useState(null);
  const [caseSymptoms, setCaseSymptoms] = useState([]);
  const [caseUserDocs, setCaseUserDocs] = useState([]);
  const [caseDoctorDocs, setCaseDoctorDocs] = useState([]);
  const [allSymptoms, setAllSymptoms] = useState([]);
  const [allDocuments, setAllDocuments] = useState([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [filters, setFilters] = useState({ doctor_name: '', hospital_name: '', specialty: '' });
  const [caseSearch, setCaseSearch] = useState('');
  const [toastMessage, setToastMessage] = useState('');
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const [numNearbyDoctors, setNumNearbyDoctors] = useState(5);
  const [selectedDoctor, setSelectedDoctor] = useState(null);
  const [confirmDialog, setConfirmDialog] = useState({ isOpen: false, title: '', message: '', onConfirm: null, isDestructive: true, confirmText: 'Confirm' });

  const showConfirm = (title, message, onConfirm, confirmText = 'Delete', isDestructive = true) => {
    setConfirmDialog({ isOpen: true, title, message, onConfirm, confirmText, isDestructive });
  };

  const [caseFilters, setCaseFilters] = useState({ status: '', date: '' });
  const [symptomFilters, setSymptomFilters] = useState({ date: '' });
  const [editingSymptom, setEditingSymptom] = useState(null);
  const [editSymptomData, setEditSymptomData] = useState({ symptom: '', severity: 5 });

  const [transactionFilters, setTransactionFilters] = useState({ type: '', date: '' });
  const [editingTransaction, setEditingTransaction] = useState(null);
  const [editNote, setEditNote] = useState('');

  const [availableDoctors, setAvailableDoctors] = useState([]);
  const [showBookingForm, setShowBookingForm] = useState(false);
  const [bookingDoctorId, setBookingDoctorId] = useState('');
  const [bookingDate, setBookingDate] = useState('');
  const [bookingStatusFilter, setBookingStatusFilter] = useState('');

  const [selectedSymptomToAdd, setSelectedSymptomToAdd] = useState('');
  const [selectedDocumentToAdd, setSelectedDocumentToAdd] = useState('');

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 3000);
  };

  const loadData = async () => {
    try {
      if (activeTab === 'overview') {
        const casesRes = await api.get('/user/cases', { params: { page: 1, limit: 5 } });
        const aptsRes = await api.get('/user/appointment', { params: { page: 1, limit: 5 } });
        const walletRes = await api.get('/default/myWallet');
        setCases(casesRes.data.cases || []);
        setAppointments(aptsRes.data || []);
        setWallet(walletRes.data || { balance: 0 });
      } else if (activeTab === 'profile') {
        const res = await api.get('/user/profile');
        setProfile(res.data);
        setEditProfile({ name: res.data.name, email: res.data.email });
      } else if (activeTab === 'symptoms') {
        const res = await api.get('/user/symptom', { params: { page, limit: 20, date: symptomFilters.date || undefined } });
        setSymptoms(res.data || []);
      } else if (activeTab === 'cases') {
        const res = await api.get('/user/cases', { params: { page, limit: 20, status: caseFilters.status || undefined, from_date: caseFilters.date || undefined } });
        setCases(res.data.cases || []);
        setTotalPages(Math.ceil((res.data.total || 0) / 20) || 1);
      } else if (activeTab === 'appointments') {
        const res = await api.get('/user/appointment', { params: { page, limit: 20 } });
        setAppointments(res.data || []);
      } else if (activeTab === 'doctors') {
        const res = await api.get('/user/doctors/', { params: { doctor_name: filters.doctor_name || undefined, hospital_name: filters.hospital_name || undefined, page, limit: 20 } });
        setDoctors(res.data || []);
      } else if (activeTab === 'myDoctors') {
        const res = await api.get('/user/my-doctors', { params: { doctor_name: filters.doctor_name || undefined, hospital_name: filters.hospital_name || undefined, page, limit: 20 } });
        setMyDoctors(res.data || []);
      } else if (activeTab === 'wallet') {
        const w = await api.get('/default/myWallet');
        const t = await api.get('/user/transactions/', { params: { page, limit: 20, type: transactionFilters.type || undefined, date: transactionFilters.date || undefined } });
        setWallet(w.data || { balance: 0 });
        setTransactions(t.data?.data || t.data || []);
      } else if (activeTab === 'documents') {
        try {
          const res = await api.get('/default/documents', { params: { limit: 20, offset: 0 } });
          setDocuments(res.data || []);
          setAllDocuments(res.data || []);
        } catch (err) {
          console.error(err);
          setDocuments([]);
        }
      } else if (activeTab === 'location') {
        try {
          const res = await api.get('/user/location');
          setLocation({ lat: res.data.latitude, lon: res.data.longitude });
        } catch (err) { console.error('Location empty'); }
      }
    } catch (err) { console.error('Load error:', err); }
  };

  useEffect(() => { loadData(); }, [activeTab, page, transactionFilters.type, transactionFilters.date, caseFilters.status, caseFilters.date, symptomFilters.date]);

  // Actions
  const updateProfile = async () => {
    try {
      await api.put('/user/profile', { username: editProfile.name, email: editProfile.email });
      showToast('Profile updated successfully!');
      loadData();
    } catch (err) { showToast(err.response?.data?.detail || 'Failed to update profile'); }
  };

  const changePassword = async () => {
    if (!newPassword) return showToast('Please enter a new password');
    try {
      await api.put('/default/password', { password: newPassword });
      showToast('Password changed successfully!');
      setNewPassword('');
    } catch (err) { showToast(err.response?.data?.detail || 'Failed to change password'); }
  };

  const connectGoogle = () => {
    window.location.href = 'http://localhost:8000/auth/google';
  };

  const handleTopUp = async () => {
    if (topUpAmount <= 0) return showToast('Enter a valid amount');
    try {
      const res = await api.put('/default/topUp', { amount: topUpAmount });
      showToast('Wallet topped up successfully!');
      setTopUpAmount(0);
      setWallet({ balance: res.data.balance });
      loadData();
    } catch (err) { showToast('Failed to top up wallet'); }
  };

  const updateTransactionNote = async (tId) => {
    try {
      await api.put('/user/transactions', null, { params: { transaction_id: tId, note: editNote } });
      showToast('Note updated successfully!');
      setEditingTransaction(null);
      loadData();
    } catch (err) { showToast('Failed to update note'); }
  };

  const updateSymptom = async (symId) => {
    try {
      await api.put('/user/symptom', editSymptomData, { params: { symptom_id: symId } });
      showToast('Symptom updated');
      setEditingSymptom(null);
      loadData();
    } catch (err) { showToast('Failed to update symptom'); }
  };

  const deleteSymptom = async (symId, force = false) => {
    try {
      await api.delete(`/user/symptom/${symId}`, { params: { force } });
      showToast('Symptom deleted');
      setConfirmDialog({ isOpen: false });
      loadData();
    } catch (err) {
      if (err.response?.status === 400 && err.response?.data?.detail?.includes("attached to")) {
        showConfirm(
          'Symptom Attached to Cases',
          'This symptom is currently attached to one or more cases. Do you want to safely remove it from all cases and delete it permanently?',
          () => deleteSymptom(symId, true),
          'Force Delete',
          true
        );
      } else {
        showToast('Failed to delete symptom');
      }
    }
  };

  const handleDeleteSymptomRequest = (symId) => {
    showConfirm('Delete Symptom', 'Are you sure you want to delete this symptom?', () => {
      setConfirmDialog({ isOpen: false });
      deleteSymptom(symId, false);
    });
  };

  const deleteDocument = async (docId, force = false) => {
    try {
      await api.delete(`/default/documents/${docId}`, { params: { force } });
      showToast('Document deleted');
      setConfirmDialog({ isOpen: false });
      loadData();
    } catch (err) {
      if (err.response?.status === 400 && err.response?.data?.detail?.includes("case")) {
        showConfirm(
          'Document Attached to Cases',
          'This document is currently attached to one or more cases. Do you want to safely remove it from all cases and delete it permanently?',
          () => deleteDocument(docId, true),
          'Force Delete',
          true
        );
      } else {
        showToast('Failed to delete document');
      }
    }
  };

  const handleDeleteDocumentRequest = (docId) => {
    showConfirm('Delete Document', 'Are you sure you want to delete this document?', () => {
      setConfirmDialog({ isOpen: false });
      deleteDocument(docId, false);
    });
  };

  const addSymptom = async (e) => {
    e.preventDefault();
    try {
      await api.post('/user/symptom', newSymptom);
      setNewSymptom({ symptom: '', severity: 5 });
      showToast('Symptom recorded!');
      loadData();
    } catch (err) { showToast('Failed to add symptom'); }
  };

  const assignDoctor = async (doctorId) => {
    try {
      await api.post(`/user/assign/${doctorId}`);
      showToast('Doctor assigned! New case created.');
      loadData();
    } catch (err) {
      showToast(err.response?.data?.detail || 'Failed to assign doctor');
    }
  };

  const closeCase = async (caseId) => {
    try {
      await api.put(`/user/cases/close/${caseId}`);
      showToast('Case closure requested');
      loadData();
    } catch (err) { showToast('Failed to close case'); }
  };

  const reopenCase = async (caseId) => {
    try {
      await api.put(`/user/reopen/${caseId}`);
      showToast('Case reopened successfully');
      loadData();
    } catch (err) { showToast('Failed to reopen case'); }
  };

  const addSymptomToCase = async (caseId) => {
    if (!selectedSymptomToAdd) return;
    try {
      await api.put(`/user/cases/${caseId}/symptoms`, { symptom_ids: [parseInt(selectedSymptomToAdd)] });
      showToast('Symptom attached to case');
      setSelectedSymptomToAdd('');
      if (selectedCase) viewCaseDetails(caseId);
      loadData();
    } catch (err) { showToast('Failed to attach symptom'); }
  };

  const removeSymptomFromCase = async (caseId, symptomId) => {
    showConfirm('Remove Symptom', 'Remove this symptom from the case?', async () => {
      setConfirmDialog({ isOpen: false });
      try {
        await api.delete(`/user/cases/symptom/${caseId}/${symptomId}`);
        showToast('Symptom removed from case');
        if (selectedCase) viewCaseDetails(caseId);
        loadData();
      } catch (err) { showToast('Failed to remove symptom'); }
    });
  };

  const addDocumentToCase = async (caseId) => {
    if (!selectedDocumentToAdd) return;
    try {
      await api.put(`/user/cases/${caseId}/documents`, { document_ids: [parseInt(selectedDocumentToAdd)] });
      showToast('Document attached to case');
      setSelectedDocumentToAdd('');
      if (selectedCase) viewCaseDetails(caseId);
      loadData();
    } catch (err) { showToast('Failed to attach document'); }
  };

  const removeDocumentFromCase = async (caseId, docId) => {
    showConfirm('Remove Document', 'Remove this document from the case?', async () => {
      setConfirmDialog({ isOpen: false });
      try {
        await api.delete(`/user/cases/document/${caseId}/${docId}`);
        showToast('Document removed from case');
        if (selectedCase) viewCaseDetails(caseId);
        loadData();
      } catch (err) { showToast('Failed to remove document'); }
    });
  };

  const updateLocation = async (lat, lon) => {
    try {
      await api.put('/user/location', { latitude: lat, longitude: lon });
      showToast('Location saved');
      loadData();
    } catch (err) { showToast('Failed to save location'); }
  };

  const findNearbyDoctors = async (n) => {
    if (!location.lat || !location.lon) {
      showToast('Please set your location first');
      return;
    }
    try {
      const res = await api.get(`/user/nearby-doctors/${n}`);
      const data = res.data.data || [];
      if (data.length === 0) showToast('No nearby doctors found');
      setNearbyDoctors(data);
    } catch (err) {
      console.error(err);
      showToast('Failed to fetch nearby doctors');
    }
  };

  const viewCaseDetails = async (caseId) => {
    try {
      const res = await api.get('/user/cases', { params: { case_id: caseId } });
      const caseData = res.data.cases?.[0];
      if (!caseData) throw new Error('Case not found');
      setSelectedCase(caseData);
      setCaseSymptoms(caseData.symptoms || []);
      setCaseUserDocs(caseData.documents?.user || []);
      setCaseDoctorDocs(caseData.documents?.doctor || []);

      const symRes = await api.get('/user/symptom');
      setAllSymptoms(symRes.data || []);
      const docRes = await api.get('/default/documents');
      setAllDocuments(docRes.data || []);
    } catch (err) {
      console.error(err);
      showToast('Error loading case details');
    }
  };

  const openBookingForm = async () => {
    setShowBookingForm(true);
    try {
      // Fetch only assigned doctors for booking
      const myDocsRes = await api.get('/user/my-doctors', { params: { limit: 100 } });
      const myDocsIds = myDocsRes.data?.map(d => d.doctor_id) || [];

      const res = await api.get('/user/doctors', { params: { limit: 100 } });
      const allDocs = [];
      (res.data || []).forEach(h => {
        (h.doctors || []).forEach(d => { allDocs.push(d); });
      });
      // Filter the full doctor objects (which contain fees) against myDocsIds
      setAvailableDoctors(allDocs.filter(d => myDocsIds.includes(d.id)));
    } catch (err) { console.error(err); }
  };

  const bookAppointment = async (e) => {
    e.preventDefault();
    if (!bookingDoctorId || !bookingDate) return showToast('Please select doctor and date');
    try {
      await api.post('/user/appointment', { doctor_id: parseInt(bookingDoctorId), date: new Date(bookingDate).toISOString() });
      showToast('Appointment booked successfully!');
      setShowBookingForm(false);
      setBookingDoctorId('');
      setBookingDate('');
      loadData();
    } catch (err) {
      showToast('Booking failed: ' + (err.response?.data?.detail || err.message));
    }
  };

  const cancelAppointment = async (appointmentId) => {
    showConfirm('Cancel Appointment', 'Cancel this appointment?', async () => {
      setConfirmDialog({ isOpen: false });
      try {
        await api.delete(`/user/appointment/${appointmentId}`);
        showToast('Appointment cancelled');
        loadData();
      } catch (err) {
        showToast('Failed to cancel: ' + (err.response?.data?.detail || err.message));
      }
    });
  };

  // Sub-Renders
  const renderOverview = () => (
    <div className="space-y-6 animate-fade-in">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="bg-gradient-to-br from-blue-50 to-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-blue-600 mb-1">Total Cases</p>
              <h3 className="text-4xl font-bold text-slate-800">{cases.length}</h3>
            </div>
            <div className="p-3 bg-blue-100 rounded-xl text-blue-600"><FileText size={24} /></div>
          </div>
        </Card>
        <Card className="bg-gradient-to-br from-emerald-50 to-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-emerald-600 mb-1">Upcoming Appointments</p>
              <h3 className="text-4xl font-bold text-slate-800">
                {appointments.filter(a => new Date(a.date) > new Date() && a.status !== 'CANCELLED').length}
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
            <button onClick={() => setActiveTab('cases')} className="text-sm text-blue-600 hover:text-blue-800 flex items-center">View all <ChevronRight size={16} /></button>
          </div>
          {cases.slice(0, 3).map(c => (
            <div key={c.id} className="py-3 border-b border-slate-100 last:border-0 flex justify-between items-center">
              <div>
                <p className="font-semibold text-slate-800">Case #{c.case_id} {c.diesease ? `- ${c.diesease}` : ''}</p>
                <p className="text-sm text-slate-500">Dr. {c.doctor_name || 'Unassigned'}</p>
              </div>
              <StatusBadge status={c.status} />
            </div>
          ))}
          {cases.length === 0 && <p className="text-slate-500 text-sm">No active cases.</p>}
        </Card>

        <Card>
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-bold text-slate-800">Upcoming Appointments</h3>
            <button onClick={() => setActiveTab('appointments')} className="text-sm text-blue-600 hover:text-blue-800 flex items-center">View all <ChevronRight size={16} /></button>
          </div>
          {appointments.slice(0, 3).map(a => (
            <div key={a.id} className="py-3 border-b border-slate-100 last:border-0 flex justify-between items-center">
              <div>
                <p className="font-semibold text-slate-800">Dr. {a.doctor_name}</p>
                <p className="text-sm text-slate-500 flex items-center gap-1"><Clock size={14} /> {new Date(a.date).toLocaleString()}</p>
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
    <div className="max-w-4xl animate-fade-in grid md:grid-cols-2 gap-6">
      <Card>
        <h2 className="text-2xl font-bold text-slate-800 mb-6 flex items-center gap-2"><User className="text-blue-600" /> My Profile</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Full Name</label>
            <input value={editProfile.name} onChange={e => setEditProfile({ ...editProfile, name: e.target.value })} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-blue-500 outline-none" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Email Address</label>
            <input value={editProfile.email} onChange={e => setEditProfile({ ...editProfile, email: e.target.value })} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-blue-500 outline-none" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Google Connection</label>
            <div className="flex items-center gap-3">
              <input value={profile.google_email_id || 'Not connected'} disabled className="w-full bg-slate-100 border border-slate-200 rounded-xl px-4 py-2.5 text-slate-500" />
            </div>
          </div>
          <div className="pt-2 flex gap-3">
            <button onClick={updateProfile} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 rounded-xl shadow-sm transition-all shadow-blue-200">
              Save Changes
            </button>
            {!profile.google_email_id && (
              <button onClick={connectGoogle} className="flex-1 bg-white border border-slate-200 text-slate-700 font-medium py-2.5 rounded-xl hover:bg-slate-50 transition-colors">
                Connect Google
              </button>
            )}
          </div>
        </div>
      </Card>

      <Card>
        <h2 className="text-2xl font-bold text-slate-800 mb-6 flex items-center gap-2"><Lock className="text-amber-500" /> Change Password</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">New Password</label>
            <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="Enter new password" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-amber-500 outline-none" />
          </div>
          <div className="pt-2">
            <button onClick={changePassword} className="w-full bg-amber-500 hover:bg-amber-600 text-white font-medium py-2.5 rounded-xl shadow-sm transition-all shadow-amber-200">
              Update Password
            </button>
          </div>
        </div>
      </Card>
    </div>
  );

  const renderCases = () => {
    const filteredCases = cases.filter(c =>
      c.case_id.toString().includes(caseSearch) ||
      (c.diagnosis && c.diagnosis.toLowerCase().includes(caseSearch.toLowerCase())) ||
      (c.doctor_name && c.doctor_name.toLowerCase().includes(caseSearch.toLowerCase()))
    );

    return (
      <div className="animate-fade-in">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
          <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2"><FileText className="text-blue-600" /> My Cases</h2>
          <div className="flex flex-wrap gap-2">
            <select value={caseFilters.status} onChange={e => { setCaseFilters({ ...caseFilters, status: e.target.value }); setPage(1); }} className="bg-white border border-slate-200 px-3 py-2 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">All Statuses</option>
              <option value="REQUESTED_BY_USER">Requested By Me</option>
              <option value="REQUESTED_BY_DOCTOR">REQUESTED By Doctor</option>
              <option value="OPEN">Open</option>
              <option value="CLOSED">Closed</option>
            </select>
            <input type="date" value={caseFilters.date} onChange={e => { setCaseFilters({ ...caseFilters, date: e.target.value }); setPage(1); }} className="bg-white border border-slate-200 px-3 py-2 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500" />
            <div className="relative w-full md:w-48">
              <Search className="absolute left-3 top-2.5 text-slate-400" size={18} />
              <input
                placeholder="Search case ID/doc..."
                value={caseSearch}
                onChange={(e) => setCaseSearch(e.target.value)}
                className="w-full bg-white border border-slate-200 pl-10 pr-4 py-2 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
          </div>
        </div>

        <div className="space-y-4">
          {filteredCases.map(c => (
            <Card key={c.id} className="border-l-4 border-l-blue-500">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div className="space-y-2">
                  <div className="flex items-center gap-3">
                    <h3 className="text-lg font-bold text-slate-800">Case #{c.case_id}</h3>
                    <StatusBadge status={c.status} />
                    {c.diesease && <span className="text-sm bg-purple-50 text-purple-700 px-2 py-0.5 rounded-md border border-purple-100 font-medium">{c.diesease}</span>}
                  </div>
                  <div className="grid grid-cols-2 gap-x-8 gap-y-1 text-sm text-slate-600">
                    <p><span className="font-medium">Doctor:</span> Dr. {c.doctor_name || 'Not assigned'}</p>
                    <p><span className="font-medium">Cost:</span> <span className="text-emerald-600 font-bold">₹{c.cost || 0}</span></p>
                    <p><span className="font-medium">Opened:</span> {new Date(c.case_opened_on).toLocaleDateString()}</p>
                    {c.case_updated_on && <p><span className="font-medium">Updated:</span> {new Date(c.case_updated_on).toLocaleDateString()}</p>}
                  </div>
                </div>
                <div className="flex gap-2 w-full md:w-auto">
                  {c.status === 'OPEN' && <button onClick={() => closeCase(c.id)} className="flex-1 md:flex-none px-4 py-2 bg-rose-50 text-rose-600 font-medium rounded-xl hover:bg-rose-100 transition-colors">Close Case</button>}
                  {c.status === 'CLOSED' && <button onClick={() => reopenCase(c.id)} className="flex-1 md:flex-none px-4 py-2 bg-blue-50 text-blue-600 font-medium rounded-xl hover:bg-blue-100 transition-colors">Reopen</button>}
                  <button onClick={() => viewCaseDetails(c.id)} className="flex-1 md:flex-none px-4 py-2 bg-slate-800 text-white font-medium rounded-xl hover:bg-slate-700 transition-colors">Details</button>
                </div>
              </div>
            </Card>
          ))}
          {filteredCases.length === 0 && (
            <div className="text-center py-12 bg-white rounded-2xl border border-dashed border-slate-300">
              <FileText className="mx-auto h-12 w-12 text-slate-300 mb-3" />
              <h3 className="text-lg font-medium text-slate-900">No cases found</h3>
            </div>
          )}
          <div className="flex justify-between items-center pt-4 border-t border-slate-200 mt-4">
            <button disabled={page === 1} onClick={() => setPage(page - 1)} className="px-4 py-2 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 font-medium disabled:opacity-50">Previous</button>
            <span className="font-medium text-slate-600">Page {page} of {totalPages}</span>
            <button disabled={page >= totalPages} onClick={() => setPage(page + 1)} className="px-4 py-2 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 font-medium disabled:opacity-50">Next</button>
          </div>
        </div>
      </div>
    );
  };

  const renderDoctorModal = () => {
    if (!selectedDoctor) return null;
    return (
      <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex justify-center items-center z-50 p-4 animate-fade-in">
        <div className="bg-white rounded-3xl p-8 max-w-lg w-full shadow-2xl relative">
          <button onClick={() => setSelectedDoctor(null)} className="absolute top-6 right-6 p-2 text-slate-400 hover:text-slate-600 bg-slate-100 rounded-full transition-colors"><X size={20} /></button>
          <div className="flex items-center gap-4 mb-6">
            <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center font-bold text-3xl">{selectedDoctor.name.charAt(0)}</div>
            <div>
              <h2 className="text-2xl font-bold text-slate-800">Dr. {selectedDoctor.name}</h2>
              <p className="text-blue-600 font-medium">{selectedDoctor.specialty || 'General Physician'}</p>
            </div>
          </div>

          <div className="space-y-4 mb-6">
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
              <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Contact Info</h4>
              {selectedDoctor.email && <p className="text-sm text-slate-700 flex items-center gap-2 mb-1">✉️ {selectedDoctor.email}</p>}
              {selectedDoctor.phone_number && <p className="text-sm text-slate-700 flex items-center gap-2 mb-1">📞 {selectedDoctor.phone_number}</p>}
              {selectedDoctor.fees && <p className="text-sm text-slate-700 flex items-center gap-2">💰 Fees: ₹{selectedDoctor.fees}</p>}
            </div>

            <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-100">
              <h4 className="text-xs font-bold text-emerald-600 uppercase tracking-wider mb-2 flex items-center gap-2"><Building2 size={14} /> Hospital Details</h4>
              <p className="font-bold text-slate-800">{selectedDoctor.hospital_name || selectedDoctor.hospital}</p>
              <p className="text-sm text-slate-600 mt-1"><MapPin size={14} className="inline mr-1" /> {selectedDoctor.hospital_address || selectedDoctor.address}</p>
              {selectedDoctor.hospital_phone_number && <p className="text-sm text-slate-600 mt-1">📞 {selectedDoctor.hospital_phone_number}</p>}
            </div>
          </div>

          <div className="flex flex-col gap-3">
            {selectedDoctor.isMyDoctor ? (
              <>
                <button onClick={() => { setSelectedDoctor(null); setActiveTab('cases'); }} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 rounded-xl transition-colors">View Cases</button>
                <button onClick={() => { setSelectedDoctor(null); setActiveTab('appointments'); openBookingForm(); setBookingDoctorId(selectedDoctor.doctor_id || selectedDoctor.id); }} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-medium py-3 rounded-xl transition-colors">Book Appointment</button>
              </>
            ) : (
              <button onClick={() => { assignDoctor(selectedDoctor.id); setSelectedDoctor(null); }} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 rounded-xl transition-colors">Assign & Create Case</button>
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderCaseModal = () => {
    if (!selectedCase) return null;
    return (
      <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex justify-center items-center z-50 p-4 animate-fade-in">
        <div className="bg-white rounded-3xl p-8 max-w-3xl w-full max-h-[90vh] overflow-auto shadow-2xl relative">
          <button onClick={() => setSelectedCase(null)} className="absolute top-6 right-6 p-2 text-slate-400 hover:text-slate-600 bg-slate-100 rounded-full transition-colors"><X size={20} /></button>

          <div className="mb-8">
            <div className="flex justify-between items-start mb-2">
              <h2 className="text-3xl font-bold text-slate-800">Case #{selectedCase.case_id}</h2>
              <div className="flex gap-2 pr-10">
                {selectedCase.status === 'OPEN' && (
                  <button onClick={() => { closeCase(selectedCase.id); setSelectedCase(null); }} className="px-4 py-1.5 bg-rose-50 text-rose-600 font-medium rounded-xl hover:bg-rose-100 transition-colors text-sm">Close Case</button>
                )}
                {selectedCase.status === 'CLOSED' && (
                  <button onClick={() => { reopenCase(selectedCase.id); setSelectedCase(null); }} className="px-4 py-1.5 bg-blue-50 text-blue-600 font-medium rounded-xl hover:bg-blue-100 transition-colors text-sm">Reopen Case</button>
                )}
              </div>
            </div>
            <div className="flex flex-wrap gap-3 mb-2">
              <StatusBadge status={selectedCase.status} />
              <span className="px-3 py-1 bg-slate-100 text-slate-600 rounded-full text-sm font-medium"><Calendar size={14} className="inline mr-1" /> Opened: {new Date(selectedCase.case_opened_on).toLocaleDateString()}</span>
              {selectedCase.diesease && <span className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-sm font-medium"><Activity size={14} className="inline mr-1" /> {selectedCase.diesease}</span>}
            </div>
            <p className="text-slate-600 font-medium">Total Cost: <span className="text-emerald-600 font-bold">₹{selectedCase.cost || 0}</span></p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
            <div className="space-y-6">
              <div>
                <h3 className="font-bold text-lg text-slate-800 mb-3 flex items-center gap-2"><Activity className="text-rose-500" size={20} /> Symptoms</h3>
                <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100">
                  <ul className="space-y-2 mb-4">
                    {caseSymptoms.map(s => (
                      <li key={s.id} className="flex justify-between items-center bg-white p-2 px-3 rounded-lg border border-slate-100 shadow-sm">
                        <div>
                          <span className="font-medium text-slate-700">{s.name}</span>
                        </div>
                        <button onClick={() => removeSymptomFromCase(selectedCase.id, s.id)} className="text-rose-400 hover:text-rose-600 p-1"><X size={14} /></button>
                      </li>
                    ))}
                    {caseSymptoms.length === 0 && <p className="text-sm text-slate-500 italic">No symptoms recorded.</p>}
                  </ul>
                  <div className="flex gap-2">
                    <select value={selectedSymptomToAdd} onChange={e => setSelectedSymptomToAdd(e.target.value)} className="flex-1 bg-white border border-slate-200 p-2 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500">
                      <option value="">Choose Symptom...</option>
                      {allSymptoms.map(s => <option key={s.id} value={s.id}>{s.symptom}</option>)}
                    </select>
                    <button onClick={() => addSymptomToCase(selectedCase.id)} className="bg-blue-600 text-white px-3 py-2 rounded-xl hover:bg-blue-700 transition-colors"><Plus size={16} /></button>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <div>
                <h3 className="font-bold text-lg text-slate-800 mb-3 flex items-center gap-2"><FileText className="text-blue-500" size={20} /> Documents</h3>
                <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 space-y-4">
                  <div>
                    <h4 className="text-sm font-semibold text-slate-600 mb-2">From You</h4>
                    <ul className="space-y-2">
                      {caseUserDocs.map(d => (
                        <li key={d.id} className="flex items-center justify-between bg-blue-50 p-2 rounded-lg group">
                          <a href={d.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-blue-600 hover:underline"><File size={16} /> {d.type}</a>
                          <button onClick={() => removeDocumentFromCase(selectedCase.id, d.id)} className="text-blue-400 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-opacity"><X size={14} /></button>
                        </li>
                      ))}
                      {caseUserDocs.length === 0 && <p className="text-xs text-slate-400">None</p>}
                    </ul>
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-slate-600 mb-2">From Doctor</h4>
                    <ul className="space-y-2">
                      {caseDoctorDocs.map(d => (
                        <li key={d.id} className="flex items-center bg-emerald-50 p-2 rounded-lg">
                          <a href={d.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-emerald-600 hover:underline"><File size={16} /> {d.type}</a>
                        </li>
                      ))}
                      {caseDoctorDocs.length === 0 && <p className="text-xs text-slate-400">None</p>}
                    </ul>
                  </div>
                  <div className="pt-2 border-t border-slate-200">
                    <div className="flex gap-2">
                      <select value={selectedDocumentToAdd} onChange={e => setSelectedDocumentToAdd(e.target.value)} className="flex-1 bg-white border border-slate-200 p-2 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500">
                        <option value="">Attach Document...</option>
                        {allDocuments.map(d => <option key={d.document_id || d.id} value={d.document_id || d.id}>{d.document_type || d.type}</option>)}
                      </select>
                      <button onClick={() => addDocumentToCase(selectedCase.id)} className="bg-blue-600 text-white px-3 py-2 rounded-xl hover:bg-blue-700 transition-colors"><Plus size={16} /></button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderSymptoms = () => (
    <div className="animate-fade-in max-w-3xl">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2"><Activity className="text-rose-500" /> My Symptoms</h2>
        <input type="date" value={symptomFilters.date} onChange={e => { setSymptomFilters({ date: e.target.value }); setPage(1); }} className="bg-white border border-slate-200 px-3 py-2 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500" />
      </div>
      <Card className="mb-8 bg-gradient-to-r from-rose-50 to-white border-rose-100">
        <h3 className="font-bold text-slate-800 mb-4">Record New Symptom</h3>
        <form onSubmit={addSymptom} className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <input value={newSymptom.symptom} onChange={e => setNewSymptom({ ...newSymptom, symptom: e.target.value })} placeholder="E.g., Headache, Nausea" className="w-full bg-white border border-slate-200 p-3 rounded-xl focus:ring-2 focus:ring-rose-500 outline-none" required />
          </div>
          <div className="w-full md:w-48">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-slate-600">Severity: {newSymptom.severity}</span>
              <input type="range" min="1" max="10" value={newSymptom.severity} onChange={e => setNewSymptom({ ...newSymptom, severity: parseInt(e.target.value) })} className="w-full accent-rose-500" />
            </div>
          </div>
          <button type="submit" className="bg-rose-500 hover:bg-rose-600 text-white font-medium px-6 py-3 rounded-xl shadow-sm shadow-rose-200 transition-all whitespace-nowrap flex items-center gap-2">
            <Plus size={18} /> Add
          </button>
        </form>
      </Card>

      <div className="space-y-3">
        {symptoms.map(s => (
          <div key={s.id} className="bg-white border border-slate-100 p-4 rounded-2xl shadow-sm flex justify-between items-center group/sym">
            {editingSymptom === s.id ? (
              <div className="flex-1 flex flex-col sm:flex-row gap-3 items-center w-full">
                <input value={editSymptomData.symptom} onChange={e => setEditSymptomData({ ...editSymptomData, symptom: e.target.value })} className="flex-1 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-lg outline-none" />
                <div className="flex items-center gap-2">
                  <span className="text-xs">Lv {editSymptomData.severity}</span>
                  <input type="range" min="1" max="10" value={editSymptomData.severity} onChange={e => setEditSymptomData({ ...editSymptomData, severity: parseInt(e.target.value) })} className="w-24 accent-rose-500" />
                </div>
                <div className="flex gap-2">
                  <button onClick={() => updateSymptom(s.id)} className="bg-emerald-500 text-white px-3 py-1.5 rounded-lg text-sm font-medium">Save</button>
                  <button onClick={() => setEditingSymptom(null)} className="bg-slate-200 text-slate-700 px-3 py-1.5 rounded-lg text-sm font-medium">Cancel</button>
                </div>
              </div>
            ) : (
              <>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-bold text-slate-800 text-lg">{s.symptom}</p>
                    <div className="opacity-0 group-hover/sym:opacity-100 transition-opacity flex gap-1 ml-2">
                      <button onClick={() => { setEditingSymptom(s.id); setEditSymptomData({ symptom: s.symptom, severity: s.severity }); }} className="text-blue-500 p-1 hover:bg-blue-50 rounded"><Edit2 size={14} /></button>
                      <button onClick={() => handleDeleteSymptomRequest(s.id)} className="text-rose-500 p-1 hover:bg-rose-50 rounded"><X size={14} /></button>
                    </div>
                  </div>
                  <p className="text-sm text-slate-500">{new Date(s.date).toLocaleString()}</p>
                </div>
                <div className="text-right">
                  <span className={`inline-block px-3 py-1 rounded-lg font-bold ${s.severity > 7 ? 'bg-rose-100 text-rose-700' : s.severity > 4 ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
                    Level {s.severity}
                  </span>
                </div>
              </>
            )}
          </div>
        ))}
        {symptoms.length === 0 && <p className="text-slate-500 text-center py-4">No symptoms recorded.</p>}
      </div>
      <div className="flex justify-between items-center mt-4">
        <button disabled={page === 1} onClick={() => setPage(page - 1)} className="px-3 py-1 text-sm bg-white border border-slate-200 rounded-lg hover:bg-slate-50 font-medium disabled:opacity-50">Previous</button>
        <button disabled={symptoms.length < 20} onClick={() => setPage(page + 1)} className="px-3 py-1 text-sm bg-white border border-slate-200 rounded-lg hover:bg-slate-50 font-medium disabled:opacity-50">Next</button>
      </div>
    </div>
  );

  const renderAppointments = () => (
    <div className="animate-fade-in">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2"><Calendar className="text-emerald-500" /> Appointments</h2>
        <button onClick={openBookingForm} className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-xl font-medium shadow-sm transition-all flex items-center gap-2">
          {showBookingForm ? <X size={18} /> : <Plus size={18} />} {showBookingForm ? 'Close' : 'Book New'}
        </button>
      </div>

      {showBookingForm && (
        <Card className="mb-8 border-emerald-100 bg-emerald-50/30">
          <h3 className="font-bold text-lg text-slate-800 mb-4">Book New Appointment (Assigned Doctors)</h3>
          <form onSubmit={bookAppointment} className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Select Assigned Doctor</label>
              <select value={bookingDoctorId} onChange={e => setBookingDoctorId(e.target.value)} className="w-full bg-white border border-slate-200 p-3 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none" required>
                <option value="">-- Choose --</option>
                {availableDoctors.map(d => <option key={d.id} value={d.id}>Dr. {d.name} (Fees: ₹{d.appointment_fees || d.fees})</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Date & Time</label>
              <input type="datetime-local" value={bookingDate} onChange={e => setBookingDate(e.target.value)} className="w-full bg-white border border-slate-200 p-3 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none" required />
            </div>
            <div className="flex gap-2">
              <button type="submit" className="flex-1 bg-emerald-600 text-white p-3 rounded-xl font-medium hover:bg-emerald-700 transition-colors">Confirm</button>
              <button type="button" onClick={() => setShowBookingForm(false)} className="px-4 bg-slate-200 text-slate-700 rounded-xl font-medium hover:bg-slate-300 transition-colors">Cancel</button>
            </div>
          </form>
          {availableDoctors.length === 0 && <p className="text-sm text-slate-500 mt-2">You don't have any assigned doctors yet. Assign one from the 'Find Doctors' tab.</p>}
        </Card>
      )}

      <div className="flex gap-2 mb-6 overflow-x-auto pb-2 custom-scrollbar">
        {['All', 'PENDING', 'CONFIRMED', 'COMPLETED', 'CANCELLED'].map(status => (
          <button key={status} onClick={() => setBookingStatusFilter(status === 'All' ? '' : status)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${(bookingStatusFilter === status || (status === 'All' && !bookingStatusFilter))
              ? 'bg-slate-800 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}>
            {status}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {(bookingStatusFilter ? appointments.filter(a => a.status === bookingStatusFilter) : appointments).map(a => (
          <Card key={a.id} className="relative overflow-hidden group">
            <div className={`absolute top-0 left-0 w-1 h-full ${a.status === 'CONFIRMED' ? 'bg-blue-500' : a.status === 'PENDING' ? 'bg-amber-400' : a.status === 'COMPLETED' ? 'bg-emerald-500' : 'bg-red-400'}`}></div>
            <div className="pl-3">
              <div className="flex justify-between items-start mb-3">
                <StatusBadge status={a.status} />
                {a.status !== 'CANCELLED' && a.status !== 'COMPLETED' && (
                  <button onClick={() => cancelAppointment(a.id)} className="text-xs text-rose-500 font-medium hover:bg-rose-50 px-2 py-1 rounded transition-colors opacity-0 group-hover:opacity-100">Cancel</button>
                )}
              </div>
              <h3 className="font-bold text-lg text-slate-800 mb-1">Dr. {a.doctor_name}</h3>
              <p className="text-slate-500 text-sm flex items-center gap-2 mb-2"><Clock size={14} /> {new Date(a.date).toLocaleString()}</p>
              {a.price > 0 && <p className="text-slate-600 font-medium text-sm flex items-center gap-1"><DollarSign size={14} /> ₹{a.price}</p>}
              {a.case_id && <p className="text-slate-400 text-xs mt-2">Case #{a.case_id}</p>}
            </div>
          </Card>
        ))}
        {appointments.length === 0 && <p className="text-slate-500 col-span-full">No appointments found.</p>}
      </div>
    </div>
  );

  const renderDoctors = () => (
    <div className="animate-fade-in">
      <h2 className="text-2xl font-bold text-slate-800 mb-6 flex items-center gap-2"><Search className="text-blue-500" /> Find Doctors</h2>
      <Card className="mb-6">
        <div className="flex flex-wrap gap-3">
          <div className="flex-1 min-w-[200px] relative">
            <Search className="absolute left-3 top-3 text-slate-400" size={18} />
            <input placeholder="Doctor name" className="w-full bg-slate-50 border border-slate-200 pl-10 p-2.5 rounded-xl outline-none focus:ring-2 focus:ring-blue-500" onChange={e => setFilters({ ...filters, doctor_name: e.target.value })} />
          </div>
          <input placeholder="Hospital name" className="flex-1 min-w-[200px] bg-slate-50 border border-slate-200 p-2.5 rounded-xl outline-none focus:ring-2 focus:ring-blue-500" onChange={e => setFilters({ ...filters, hospital_name: e.target.value })} />
          <button onClick={() => { setPage(1); loadData(); }} className="bg-slate-800 hover:bg-slate-900 text-white px-6 py-2.5 rounded-xl font-medium transition-colors">Search</button>
        </div>
      </Card>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {doctors.map(h => h.doctors?.map(d => (
          <Card key={d.id} onClick={() => setSelectedDoctor({ ...d, hospital_name: h.hospital_name, hospital_address: h.hospital_address, hospital_phone_number: h.hospital_phone_number, isMyDoctor: false })} className="flex flex-col cursor-pointer hover:shadow-lg hover:border-blue-300 transition-all">
            <div className="flex justify-between items-start mb-4">
              <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center font-bold text-xl">{d.name.charAt(0)}</div>
              <span className="bg-emerald-100 text-emerald-700 px-2 py-1 rounded text-xs font-bold">₹{d.fees} / visit</span>
            </div>
            <h3 className="font-bold text-lg text-slate-800 mb-1">Dr. {d.name}</h3>
            <p className="text-blue-600 font-medium text-sm mb-3">{d.specialty || 'General Physician'}</p>
            <div className="space-y-2 text-sm text-slate-600 mb-6 flex-1">
              <p className="flex items-center gap-2"><MapPin size={14} className="text-slate-400" /> {h.hospital_name}</p>
            </div>
            <button onClick={(e) => { e.stopPropagation(); assignDoctor(d.id); }} className="w-full bg-blue-50 hover:bg-blue-600 text-blue-600 hover:text-white font-semibold py-2.5 rounded-xl transition-colors">
              Assign & Create Case
            </button>
          </Card>
        )))}
        {(!doctors || doctors.length === 0) && <p className="text-slate-500 col-span-full">No doctors found matching criteria.</p>}
      </div>
    </div>
  );

  const renderMyDoctors = () => {
    const filteredDocs = myDoctors.filter(d =>
      d.name?.toLowerCase().includes(filters.doctor_name?.toLowerCase() || '') &&
      d.specialty?.toLowerCase().includes(filters.specialty?.toLowerCase() || '')
    );
    return (
      <div className="animate-fade-in">
        <h2 className="text-2xl font-bold text-slate-800 mb-6 flex items-center gap-2"><Users className="text-indigo-500" /> My Assigned Doctors</h2>
        <Card className="mb-6">
          <div className="flex flex-wrap gap-3">
            <div className="flex-1 min-w-[200px] relative">
              <Search className="absolute left-3 top-3 text-slate-400" size={18} />
              <input placeholder="Filter by name..." value={filters.doctor_name || ''} onChange={e => setFilters({ ...filters, doctor_name: e.target.value })} className="w-full bg-slate-50 border border-slate-200 pl-10 p-2.5 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
          </div>
        </Card>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredDocs.map(d => (
            <Card key={d.doctor_id} onClick={() => setSelectedDoctor({ ...d, isMyDoctor: true })} className="border-t-4 border-t-indigo-500 flex flex-col cursor-pointer hover:shadow-lg hover:border-indigo-300 transition-all">
              <h3 className="font-bold text-lg text-slate-800">Dr. {d.name}</h3>
              <p className="text-indigo-600 font-medium text-sm mb-3">{d.specialty || 'General'}</p>
              <div className="space-y-2 text-sm text-slate-600 mb-4 flex-1">
                <p className="flex items-center gap-2"><MapPin size={14} className="text-slate-400" /> {d.hospital_name || d.hospital}</p>
                {d.case_id && <p className="flex items-center gap-2"><FileText size={14} className="text-slate-400" /> Active Case #{d.case_id}</p>}
              </div>
            </Card>
          ))}
          {filteredDocs.length === 0 && <p className="text-slate-500 col-span-full">No assigned doctors found.</p>}
        </div>
      </div>
    );
  };

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
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-bold text-slate-800">Recent Transactions</h3>
            <div className="flex gap-2">
              <select value={transactionFilters.type} onChange={e => { setTransactionFilters({ ...transactionFilters, type: e.target.value }); setPage(1); }} className="text-sm border border-slate-200 rounded-lg p-1.5 outline-none bg-slate-50">
                <option value="">All Types</option>
                <option value="INCOMING">Incoming</option>
                <option value="OUTGOING">Outgoing</option>
                <option value="TOPUP">Top-Up</option>
              </select>
              <input type="date" value={transactionFilters.date} onChange={e => { setTransactionFilters({ ...transactionFilters, date: e.target.value }); setPage(1); }} className="text-sm border border-slate-200 rounded-lg p-1.5 outline-none bg-slate-50" />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto pr-2 space-y-3 max-h-[300px] custom-scrollbar">
            {transactions.map(t => (
              <div key={t.id} className="flex justify-between items-center p-3 rounded-xl hover:bg-slate-50 transition-colors border border-transparent hover:border-slate-100 group/item">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${t.type === 'INCOMING' || t.type === 'TOPUP' || t.type === 'CREDIT' ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'}`}>
                    <DollarSign size={18} />
                  </div>
                  <div>
                    {editingTransaction === t.id ? (
                      <div className="flex items-center gap-2 mt-1 mb-1">
                        <input value={editNote} onChange={e => setEditNote(e.target.value)} className="border border-slate-300 rounded px-2 py-0.5 text-sm outline-none focus:border-blue-500" autoFocus />
                        <button onClick={() => updateTransactionNote(t.id)} className="text-xs bg-blue-600 text-white px-2 py-0.5 rounded font-medium">Save</button>
                        <button onClick={() => setEditingTransaction(null)} className="text-xs bg-slate-200 text-slate-700 px-2 py-0.5 rounded font-medium">Cancel</button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-slate-800 text-sm">{t.note || t.type}</p>
                        <button onClick={() => { setEditingTransaction(t.id); setEditNote(t.note || ''); }} className="opacity-0 group-hover/item:opacity-100 text-slate-400 hover:text-blue-600 transition-opacity"><Edit2 size={12} /></button>
                      </div>
                    )}
                    <p className="text-xs text-slate-500">{new Date(t.date).toLocaleString()}</p>
                  </div>
                </div>
                <span className={`font-bold ${t.type === 'INCOMING' || t.type === 'TOPUP' || t.type === 'CREDIT' ? 'text-emerald-600' : 'text-slate-800'}`}>
                  {t.type === 'INCOMING' || t.type === 'TOPUP' || t.type === 'CREDIT' ? '+' : '-'}₹{t.amount}
                </span>
              </div>
            ))}
            {transactions.length === 0 && <p className="text-slate-500 text-center py-8">No recent transactions.</p>}
          </div>
          <div className="flex justify-between items-center pt-3 border-t border-slate-100 mt-2">
            <button disabled={page === 1} onClick={() => setPage(page - 1)} className="px-3 py-1 text-sm bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors">Previous</button>
            <span className="text-sm font-medium text-slate-600">Page {page}</span>
            <button disabled={transactions.length < 20} onClick={() => setPage(page + 1)} className="px-3 py-1 text-sm bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors">Next</button>
          </div>
        </Card>
      </div>
    </div>
  );

  const renderDocuments = () => (
    <div className="animate-fade-in max-w-5xl">
      <h2 className="text-2xl font-bold text-slate-800 mb-6 flex items-center gap-2"><File className="text-blue-500" /> My Documents</h2>
      <div className="grid md:grid-cols-3 gap-6">
        <div className="md:col-span-1">
          <DocumentUploader onUploadComplete={loadData} />
        </div>

        <div className="md:col-span-2">
          <Card className="h-full border-blue-100">
            <h3 className="font-bold text-lg text-slate-800 mb-4">Stored Documents</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {documents.map(d => (
                <div key={d.document_id} className="relative group bg-slate-50 border border-slate-200 p-4 rounded-2xl hover:border-blue-300 hover:shadow-md transition-all flex items-start gap-4">
                  <a href={d.document_url} target="_blank" rel="noopener noreferrer" className="flex items-start gap-4 flex-1">
                    <div className="p-3 bg-white text-blue-500 rounded-xl shadow-sm group-hover:bg-blue-500 group-hover:text-white transition-colors">
                      <FileText size={24} />
                    </div>
                    <div>
                      <p className="font-semibold text-slate-800 line-clamp-1">{d.document_type}</p>
                      <p className="text-xs text-slate-500 mt-1">Doc #{d.document_id}</p>
                    </div>
                  </a>
                  <button onClick={() => handleDeleteDocumentRequest(d.document_id)} className="p-2 text-slate-400 hover:text-rose-500 bg-white rounded-full opacity-0 group-hover:opacity-100 transition-all absolute right-2 top-2 shadow-sm border border-slate-200"><X size={16} /></button>
                </div>
              ))}
              {documents.length === 0 && <p className="text-slate-500 col-span-full py-8 text-center bg-slate-50 rounded-xl border border-dashed border-slate-300">No documents uploaded yet.</p>}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );

  const renderLocation = () => (
    <div className="animate-fade-in max-w-4xl">
      <h2 className="text-2xl font-bold text-slate-800 mb-6 flex items-center gap-2"><MapPin className="text-rose-500" /> Location & Nearby</h2>
      <Card className="mb-8">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-bold text-slate-800">Your Location</h3>
          {location.lat && location.lon && (
            <button onClick={() => setShowLocationPicker(!showLocationPicker)} className="text-sm bg-slate-100 text-slate-600 px-4 py-1.5 rounded-lg font-medium hover:bg-slate-200 transition-colors">
              {showLocationPicker ? 'Hide Map' : 'Update Location'}
            </button>
          )}
        </div>

        {(!location.lat || !location.lon || showLocationPicker) && (
          <div className="h-[400px] rounded-xl overflow-hidden mb-4 border border-slate-200 shadow-inner">
            <LocationPicker onLocationSelect={(lat, lon) => { updateLocation(lat, lon); setShowLocationPicker(false); }} initialLat={location.lat} initialLon={location.lon} />
          </div>
        )}

        {location.lat && location.lon && (
          <div className="flex flex-col items-center mt-6 p-4 bg-slate-50 rounded-xl border border-slate-100">
            <p className="text-sm text-slate-600 mb-3">Find doctors near your current location</p>
            <div className="flex items-center gap-3">
              <label className="text-sm font-medium text-slate-700">How many?</label>
              <input type="number" min="1" max="50" value={numNearbyDoctors} onChange={(e) => setNumNearbyDoctors(parseInt(e.target.value) || 5)} className="w-20 border border-slate-300 rounded-lg p-2 text-center outline-none focus:ring-2 focus:ring-blue-500" />
              <button onClick={() => findNearbyDoctors(numNearbyDoctors)} className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-xl font-medium shadow-sm transition-all flex items-center gap-2">
                <Navigation size={18} /> Search
              </button>
            </div>
          </div>
        )}
      </Card>

      {nearbyDoctors.length > 0 && (
        <div className="animate-fade-in">
          <h3 className="text-xl font-bold text-slate-800 mb-4">Nearby Doctors</h3>
          {nearbyDoctors.some(d => d.hospital_lat && d.hospital_lon) && (
            <Card className="mb-6 p-2">
              <div className="h-[500px] rounded-lg overflow-hidden">
                <MapComponent
                  markers={[
                    { lat: location.lat, lon: location.lon, label: 'You are here', isUser: true },
                    ...nearbyDoctors.filter(d => d.hospital_lat && d.hospital_lon).map(d => ({
                      lat: parseFloat(d.hospital_lat),
                      lon: parseFloat(d.hospital_lon),
                      label: `${d.name} (${d.distance_km?.toFixed(1)} km) - ${d.hospital_name}`
                    }))
                  ]}
                />
              </div>
            </Card>
          )}
          <div className="grid md:grid-cols-2 gap-4">
            {nearbyDoctors.map(d => (
              <Card key={d.id} className="border-l-4 border-l-rose-400">
                <div className="flex justify-between h-full">
                  <div className="flex flex-col">
                    <h4 className="font-bold text-lg text-slate-800">Dr. {d.name}</h4>
                    <p className="text-rose-500 text-sm font-medium">{d.specialty || 'General'}</p>
                    <p className="text-slate-600 text-sm mt-auto pt-3"><Building2 size={14} className="inline mr-1" />{d.hospital_name}</p>
                  </div>
                  <div className="text-right flex flex-col justify-between">
                    <span className="bg-slate-100 text-slate-700 px-2 py-1 rounded font-bold text-sm">
                      {d.distance_km ? `${d.distance_km.toFixed(1)} km` : '?'}
                    </span>
                    <button onClick={() => assignDoctor(d.id)} className="text-sm font-semibold text-blue-600 hover:text-blue-800 mt-2 whitespace-nowrap">
                      Assign &rarr;
                    </button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  const tabs = [
    { id: 'overview', name: 'Overview', icon: LayoutDashboard },
    { id: 'cases', name: 'My Cases', icon: FileText },
    { id: 'symptoms', name: 'Symptoms', icon: Activity },
    { id: 'appointments', name: 'Appointments', icon: Calendar },
    { id: 'doctors', name: 'Find Doctors', icon: Search },
    { id: 'myDoctors', name: 'My Doctors', icon: Users },
    { id: 'documents', name: 'Documents', icon: File },
    { id: 'wallet', name: 'Wallet', icon: Wallet },
    { id: 'location', name: 'Location', icon: MapIcon },
    { id: 'profile', name: 'Profile', icon: User },
  ];

  return (
    <div className="flex h-screen bg-slate-50 font-sans overflow-hidden">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 animate-fade-in">
          <div className="bg-slate-800 text-white px-6 py-3 rounded-full shadow-2xl flex items-center gap-2 font-medium">
            <CheckCircle2 className="text-emerald-400" size={18} />
            {toastMessage}
          </div>
        </div>
      )}

      {/* Confirm Dialog */}
      {confirmDialog.isOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex justify-center items-center z-[100] p-4 animate-fade-in">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl relative">
            <h3 className="text-xl font-bold text-slate-800 mb-2">{confirmDialog.title}</h3>
            <p className="text-slate-600 mb-6">{confirmDialog.message}</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setConfirmDialog({ isOpen: false })} className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl font-medium hover:bg-slate-200 transition-colors">Cancel</button>
              <button onClick={confirmDialog.onConfirm} className={`px-4 py-2 text-white rounded-xl font-medium transition-colors ${confirmDialog.isDestructive ? 'bg-rose-500 hover:bg-rose-600' : 'bg-blue-600 hover:bg-blue-700'}`}>
                {confirmDialog.confirmText}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sidebar */}
      <div className="w-72 bg-slate-900 text-slate-300 flex flex-col border-r border-slate-800 hidden md:flex z-10 shadow-2xl">
        <div className="p-6 border-b border-slate-800 flex items-center gap-3">
          <div className="bg-blue-600 p-2 rounded-xl text-white"><Activity size={24} /></div>
          <h1 className="text-xl font-bold text-white tracking-tight">HealthifAI</h1>
        </div>
        <div className="flex-1 overflow-y-auto py-6 px-4 space-y-1 custom-scrollbar">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button key={tab.id} onClick={() => { setActiveTab(tab.id); setPage(1); }}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 font-medium ${isActive ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/50' : 'hover:bg-slate-800 hover:text-white'
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
                {profile?.name ? profile.name.charAt(0).toUpperCase() : 'U'}
              </div>
              <div className="hidden sm:block">
                <p className="text-sm font-bold text-slate-800">{profile?.name || 'User'}</p>
                <p className="text-xs text-slate-500 font-medium">{profile?.role?.toUpperCase() || 'PATIENT'}</p>
              </div>
            </div>
          </div>
        </header>

        {/* Scrollable Content */}
        <main className="flex-1 overflow-y-auto p-4 md:p-8 custom-scrollbar relative">
          <div className="max-w-7xl mx-auto">
            {activeTab === 'overview' && renderOverview()}
            {activeTab === 'profile' && renderProfile()}
            {activeTab === 'symptoms' && renderSymptoms()}
            {activeTab === 'cases' && renderCases()}
            {activeTab === 'appointments' && renderAppointments()}
            {activeTab === 'doctors' && renderDoctors()}
            {activeTab === 'myDoctors' && renderMyDoctors()}
            {activeTab === 'wallet' && renderWallet()}
            {activeTab === 'documents' && renderDocuments()}
            {activeTab === 'location' && renderLocation()}
          </div>
        </main>
      </div>
      {selectedCase && renderCaseModal()}
    </div>
  );
};

export default UserDashboard;