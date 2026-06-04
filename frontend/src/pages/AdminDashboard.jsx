import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import Chatbot from '../components/Chatbot';
import api from '../services/api';
import NotificationBell from '../components/NotificationBell';
import MapComponent from '../components/MapComponent';
import { useAuth } from '../context/AuthContext';
import { 
  LayoutDashboard, Users, UserCheck, Building2, 
  FileText, Wallet, BellRing, LogOut, 
  MapPin, ShieldAlert, CheckCircle2, ChevronRight, ChevronLeft,
  Activity, DollarSign, Lock, X, Search, Eye, Star, Calendar, 
  ArrowUpDown, SlidersHorizontal, Download, File, Navigation
} from 'lucide-react';

// ============================================
// DOCUMENT VIEWER MODAL
// ============================================
const DocumentViewerModal = ({ url, filename, onClose }) => {
  const [contentType, setContentType] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [cacheBuster, setCacheBuster] = useState(0);

  useEffect(() => {
    if (!url) {
      setLoadError(true);
      setLoading(false);
      return;
    }
    setCacheBuster(prev => prev + 1);
    setLoading(true);
    setLoadError(false);
    setContentType(null);

    fetch(url, { method: 'HEAD', credentials: 'include' })
      .then(res => {
        if (!res.ok) throw new Error('HTTP error');
        const type = res.headers.get('content-type');
        if (type?.startsWith('image/')) setContentType('image');
        else if (type?.includes('pdf')) setContentType('pdf');
        else throw new Error('Unrecognized type');
      })
      .catch(() => {
        const ext = filename?.split('.').pop()?.toLowerCase();
        if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext)) setContentType('image');
        else if (ext === 'pdf') setContentType('pdf');
        else setContentType('other');
      })
      .finally(() => setLoading(false));
  }, [url, filename]);

  if (loading) {
    return (
      <div
        onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex justify-center items-center z-[500] p-4 cursor-pointer"
      >
        <div className="bg-white rounded-3xl p-8 w-full max-w-4xl text-center shadow-2xl cursor-default">Loading document preview...</div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div
        onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex justify-center items-center z-[500] p-4 cursor-pointer"
      >
        <div className="bg-white rounded-3xl p-8 w-full max-w-4xl text-center shadow-2xl cursor-default" onClick={e => e.stopPropagation()}>
          <p className="text-red-500 mb-4 font-bold text-lg">Unable to load document.</p>
          <div className="flex justify-center gap-4">
            {url && <a href={url} download className="bg-blue-600 hover:bg-blue-700 transition-colors text-white px-6 py-2.5 rounded-xl font-medium">Download Directly</a>}
            <button onClick={onClose} className="bg-slate-200 hover:bg-slate-300 transition-colors px-6 py-2.5 rounded-xl font-medium text-slate-700">Close</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex justify-center items-center z-[500] p-4 animate-fade-in cursor-pointer"
    >
      <div
        onClick={e => e.stopPropagation()}
        className="bg-white rounded-3xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl relative cursor-default"
      >
        <div className="flex justify-between items-center p-4 border-b border-slate-200">
          <h3 className="font-bold text-slate-800 truncate">{filename || 'Document'}</h3>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-rose-500 bg-slate-100 hover:bg-rose-50 rounded-full transition-all"><X size={20} /></button>
        </div>
        <div className="flex-1 overflow-auto p-4 bg-slate-50 flex items-center justify-center min-h-[400px]">
          {contentType === 'image' ? (
            <img src={`${url}&_=${cacheBuster}`} alt={filename} className="max-w-full max-h-[70vh] object-contain rounded-lg shadow-sm" />
          ) : contentType === 'pdf' ? (
            <iframe src={url} className="w-full h-[70vh] rounded-lg border-0 shadow-sm" title={filename} />
          ) : (
            <div className="text-center">
              <File size={48} className="mx-auto text-slate-400 mb-4" />
              <p className="text-slate-600 mb-4 font-medium">Preview not available for this file type.</p>
              <a href={url} download className="bg-blue-600 text-white px-6 py-2.5 rounded-xl hover:bg-blue-700 transition-colors inline-flex items-center gap-2 shadow-sm font-medium">
                <Download size={18} /> Download File
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ============================================
// COMPONENT DECLARATIONS (LIFTED STATICALLY)
// ============================================
const Card = ({ children, className = '', ...props }) => (
  <div className={`bg-white rounded-2xl border border-slate-100 shadow-sm p-6 transition-all duration-300 hover:shadow-md ${className}`} {...props}>
    {children}
  </div>
);

const PaginationControls = ({ current, total, hasMoreFlag, onPrev, onNext }) => {
  const isTotalAvailable = total !== undefined && total > 0;
  return (
    <div className="flex justify-between items-center mt-8 pt-4 border-t border-slate-200">
      <button 
        disabled={current === 1}
        onClick={onPrev}
        className="flex items-center gap-1.5 px-4 py-2 border border-slate-200 rounded-xl bg-white hover:bg-slate-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm font-semibold text-slate-700"
      >
        <ChevronLeft size={16} /> Previous
      </button>
      <span className="text-sm font-bold text-slate-500 bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200/50">
        Page {current} {isTotalAvailable && `of ${total}`}
      </span>
      <button 
        disabled={isTotalAvailable ? current === total : !hasMoreFlag}
        onClick={onNext}
        className="flex items-center gap-1.5 px-4 py-2 border border-slate-200 rounded-xl bg-white hover:bg-slate-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm font-semibold text-slate-700"
      >
        Next <ChevronRight size={16} />
      </button>
    </div>
  );
};

// ============================================
// MAIN COMPONENT
// ============================================
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
  const [policies, setPolicies] = useState([]);
  const [hospitalPolicy, setHospitalPolicy] = useState(null);
  const [loadingHospitalPolicy, setLoadingHospitalPolicy] = useState(false);
  const [doctorHospitalPolicy, setDoctorHospitalPolicy] = useState(null);
  const [loadingDoctorHospitalPolicy, setLoadingDoctorHospitalPolicy] = useState(false);
  
  // Unified Pagination states
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [hasMore, setHasMore] = useState(false);

  // Modern UI states
  const [toastMessage, setToastMessage] = useState('');
  const [confirmDialog, setConfirmDialog] = useState({ isOpen: false, title: '', message: '', onConfirm: null, isDestructive: true, confirmText: 'Confirm' });
  const [newPassword, setNewPassword] = useState('');
  const [updatingPassword, setUpdatingPassword] = useState(false);

  // Dynamic Popups States
  const [selectedUser, setSelectedUser] = useState(null);
  const [userWalletBalance, setUserWalletBalance] = useState('Loading...');

  const [selectedDoctor, setSelectedDoctor] = useState(null);
  const [doctorWalletBalance, setDoctorWalletBalance] = useState('Loading...');

  const [selectedHospital, setSelectedHospital] = useState(null);
  const [hospitalWalletBalance, setHospitalWalletBalance] = useState('Loading...');

  const [selectedCase, setSelectedCase] = useState(null);
  const [documentViewer, setDocumentViewer] = useState({ isOpen: false, url: '', filename: '' });

  // Tab-specific Filter States
  const [userFilters, setUserFilters] = useState({ name: '', email: '', account_type: '', is_active: '' });
  const [doctorFilters, setDoctorFilters] = useState({ name: '', email: '', speciality: '', rating: '', availability: '', is_active: '' });
  const [hospitalFilters, setHospitalFilters] = useState({ name: '', email: '', city: '', state: '', zip: '', rating: '', cases: '' });
  const [caseFilters, setCaseFilters] = useState({ date: '', doctor_name: '', user_name: '', cost: '', diesease: '' });
  const [transactionFilters, setTransactionFilters] = useState({ usertype: 'all', date: '', amount: '' });
  const [walletFilters, setWalletFilters] = useState({ role: '', amount: '' });

  const showToast = (msg) => { setToastMessage(msg); setTimeout(() => setToastMessage(''), 3000); };
  
  const showConfirm = (title, message, onConfirm, confirmText = 'Confirm', isDestructive = true) => {
    setConfirmDialog({ isOpen: true, title, message, onConfirm, confirmText, isDestructive });
  };

  const handleFilterChange = (tab, field, value) => {
    setPage(1); // Always reset page to 1 on filter change
    if (tab === 'users') setUserFilters(prev => ({ ...prev, [field]: value }));
    else if (tab === 'doctors') setDoctorFilters(prev => ({ ...prev, [field]: value }));
    else if (tab === 'hospitals') setHospitalFilters(prev => ({ ...prev, [field]: value }));
    else if (tab === 'cases') setCaseFilters(prev => ({ ...prev, [field]: value }));
    else if (tab === 'transactions') setTransactionFilters(prev => ({ ...prev, [field]: value }));
    else if (tab === 'wallets') setWalletFilters(prev => ({ ...prev, [field]: value }));
  };

  const resetFilters = (tab) => {
    setPage(1);
    if (tab === 'users') setUserFilters({ name: '', email: '', account_type: '', is_active: '' });
    else if (tab === 'doctors') setDoctorFilters({ name: '', email: '', speciality: '', rating: '', availability: '', is_active: '' });
    else if (tab === 'hospitals') setHospitalFilters({ name: '', email: '', city: '', state: '', zip: '', rating: '', cases: '' });
    else if (tab === 'cases') setCaseFilters({ date: '', doctor_name: '', user_name: '', cost: '', diesease: '' });
    else if (tab === 'transactions') setTransactionFilters({ usertype: 'all', date: '', amount: '' });
    else if (tab === 'wallets') setWalletFilters({ role: '', amount: '' });
  };

  // Popup Opening Helpers with fresh balance sniffing
  const openUserModal = async (userObj) => {
    setSelectedUser(userObj);
    setUserWalletBalance('Loading...');
    try {
      const res = await api.get('/admin/wallets/', { params: { role: 'user', page: 1, limit: 100 } });
      const userWallet = res.data?.find(w => w.user_id === userObj.id);
      setUserWalletBalance(userWallet ? `₹${userWallet.balance}` : '₹0');
    } catch (err) {
      setUserWalletBalance('₹0');
    }
  };

  const openDoctorModal = async (doctorObj) => {
    setSelectedDoctor(doctorObj);
    setDoctorWalletBalance('Loading...');
    setDoctorHospitalPolicy(null);
    setLoadingDoctorHospitalPolicy(true);
    try {
      const res = await api.get('/admin/wallets/', { params: { role: 'doctor', page: 1, limit: 100 } });
      const docWallet = res.data?.find(w => w.user_id === doctorObj.id);
      setDoctorWalletBalance(docWallet ? `₹${docWallet.balance}` : '₹0');
    } catch (err) {
      setDoctorWalletBalance('₹0');
    }
    if (doctorObj.hospital_id) {
      try {
        const policyRes = await api.get('/admin/policy', { params: { hospital_id: doctorObj.hospital_id } });
        if (policyRes.data && policyRes.data.length > 0) {
          setDoctorHospitalPolicy(policyRes.data[0]);
        }
      } catch (err) {
        console.error("Failed to load doctor's hospital policy", err);
      } finally {
        setLoadingDoctorHospitalPolicy(false);
      }
    } else {
      setLoadingDoctorHospitalPolicy(false);
    }
  };

  const openHospitalModal = async (hospObj) => {
    setSelectedHospital(hospObj);
    setHospitalWalletBalance('Loading...');
    setHospitalPolicy(null);
    setLoadingHospitalPolicy(true);
    try {
      const res = await api.get('/admin/wallets/', { params: { role: 'hospital', page: 1, limit: 100 } });
      const hospWallet = res.data?.find(w => w.user_id === hospObj.id);
      setHospitalWalletBalance(hospWallet ? `₹${hospWallet.balance}` : '₹0');
    } catch (err) {
      setHospitalWalletBalance('₹0');
    }
    try {
      const policyRes = await api.get('/admin/policy', { params: { hospital_id: hospObj.id } });
      if (policyRes.data && policyRes.data.length > 0) {
        setHospitalPolicy(policyRes.data[0]);
      }
    } catch (err) {
      console.error("Failed to load hospital policy", err);
    } finally {
      setLoadingHospitalPolicy(false);
    }
  };

  const loadData = async () => {
    try {
      if (activeTab === 'users') {
        try {
          const res = await api.get('/admin/users', { 
            params: { 
              page, 
              limit: 10,
              name: userFilters.name || undefined,
              email: userFilters.email || undefined,
              account_type: userFilters.account_type || undefined,
              is_active: userFilters.is_active !== '' ? userFilters.is_active : undefined
            } 
          });
          setUsers(res.data || []);
          setHasMore(res.data?.length === 10);
        } catch (err) {
          setUsers([]);
          setHasMore(false);
        }
      } else if (activeTab === 'doctors') {
        try {
          const res = await api.get('/admin/doctors', { 
            params: { 
              page, 
              limit: 10,
              name: doctorFilters.name || undefined,
              email: doctorFilters.email || undefined,
              speciality: doctorFilters.speciality || undefined,
              rating: doctorFilters.rating || undefined,
              availability: doctorFilters.availability !== '' ? doctorFilters.availability === 'true' : undefined,
              is_active: doctorFilters.is_active !== '' ? doctorFilters.is_active === 'true' : undefined
            } 
          });
          setDoctors(res.data.data || []);
          setTotalPages(res.data.total_pages || 1);
        } catch (err) {
          setDoctors([]);
          setTotalPages(1);
        }
      } else if (activeTab === 'hospitals') {
        try {
          const res = await api.get('/admin/hospitals', { 
            params: { 
              page, 
              limit: 10,
              name: hospitalFilters.name || undefined,
              email: hospitalFilters.email || undefined,
              city: hospitalFilters.city || undefined,
              state: hospitalFilters.state || undefined,
              zip: hospitalFilters.zip || undefined,
              rating: hospitalFilters.rating || undefined,
              cases: hospitalFilters.cases || undefined
            } 
          });
          setHospitals(res.data || []);
          setHasMore(res.data?.length === 10);
        } catch (err) {
          setHospitals([]);
          setHasMore(false);
        }
      } else if (activeTab === 'cases') {
        try {
          const res = await api.get('/admin/cases', { 
            params: { 
              page, 
              limit: 10,
              date: caseFilters.date ? `${caseFilters.date}T00:00:00` : undefined,
              doctor_name: caseFilters.doctor_name || undefined,
              user_name: caseFilters.user_name || undefined,
              cost: caseFilters.cost || undefined,
              diesease: caseFilters.diesease || undefined
            } 
          });
          setCases(res.data.data || []);
          setTotalPages(res.data.total_pages || 1);
        } catch (err) {
          setCases([]);
          setTotalPages(1);
        }
      } else if (activeTab === 'transactions') {
        try {
          const res = await api.get('/admin/transactions/', { 
            params: { 
              page, 
              limit: 10,
              usertype: transactionFilters.usertype || 'all',
              date: transactionFilters.date ? `${transactionFilters.date}T00:00:00` : undefined,
              amount: transactionFilters.amount || undefined
            } 
          });
          const tData = res.data.data || { user_transactions: [], doctor_transactions: [] };
          setTransactions(tData);
          const userLen = tData.user_transactions?.length || 0;
          const docLen = tData.doctor_transactions?.length || 0;
          setHasMore(userLen === 10 || docLen === 10);
        } catch (err) {
          setTransactions({ user_transactions: [], doctor_transactions: [] });
          setHasMore(false);
        }
      } else if (activeTab === 'wallets') {
        try {
          const res = await api.get('/admin/wallets/', { 
            params: { 
              page, 
              limit: 12,
              role: walletFilters.role || undefined,
              amount: walletFilters.amount || undefined
            } 
          });
          setWallets(res.data || []);
          setHasMore(res.data?.length === 12);
        } catch (err) {
          setWallets([]);
          setHasMore(false);
        }
      } else if (activeTab === 'policies') {
        try {
          const res = await api.get('/admin/policy');
          setPolicies(res.data || []);
          if (hospitals.length === 0) {
            const hRes = await api.get('/admin/hospitals', { params: { page: 1, limit: 100 } });
            setHospitals(hRes.data || []);
          }
        } catch (err) {
          setPolicies([]);
        }
      }
    } catch (err) { 
      console.error('Load error:', err); 
    }
  };

  useEffect(() => {
    const handleNavigation = (e) => {
      const targetTab = e.detail?.tab;
      if (targetTab) {
        const exists = tabs.some(t => t.id === targetTab);
        if (exists) {
          setActiveTab(targetTab);
          setPage(1);
        }
      }
    };
    window.addEventListener('navigate-to-tab', handleNavigation);
    return () => window.removeEventListener('navigate-to-tab', handleNavigation);
  }, []);

  useEffect(() => { 
    loadData(); 
  }, [
    activeTab, 
    page,
    userFilters,
    doctorFilters,
    hospitalFilters,
    caseFilters,
    transactionFilters,
    walletFilters
  ]);

  const deleteEntity = async (type, id) => {
    let deletePath = `/admin/${type}/${id}`;
    if (type === 'user') deletePath = `/admin/users/${id}`;
    else if (type === 'doctor') deletePath = `/admin/doctors/${id}`;
    else if (type === 'hospital') deletePath = `/admin/hospital/${id}`;

    showConfirm(
      `Deactivate ${type}?`,
      `Are you sure you want to temporarily deactivate this ${type}? They will lose access to the platform immediately.`,
      async () => {
        try {
          await api.delete(deletePath);
          showToast(`${type} deactivated successfully`);
          setConfirmDialog({ isOpen: false });
          loadData();
        } catch (err) {
          showToast(`Failed to deactivate ${type}`);
          setConfirmDialog({ isOpen: false });
        }
      },
      'Deactivate',
      true
    );
  };

  const reactivateEntity = async (type, id) => {
    try {
      await api.put(`/admin/reactive/${type}/${id}`);
      showToast(`${type} reactivated successfully`);
      loadData();
    } catch (err) {
      showToast(`Failed to reactivate ${type}`);
    }
  };

  const sendNotification = async () => {
    if(!notification.recipient_id || !notification.message) return showToast("Please fill all notification fields");
    try {
      await api.post('/default/notification', {
        recipient_id: parseInt(notification.recipient_id),
        recipient_role: notification.recipient_role,
        message: notification.message
      });
      showToast('Notification sent successfully');
      setNotification({ recipient_id: '', recipient_role: 'user', message: '' });
    } catch(err) {
      showToast(err.response?.data?.detail || 'Failed to send notification');
    }
  };

  const changePassword = async (e) => {
    e.preventDefault();
    if (!newPassword.trim()) return showToast('Please enter a new password');
    setUpdatingPassword(true);
    try {
      await api.put('/default/password', { password: newPassword });
      showToast('Admin password updated successfully');
      setNewPassword('');
    } catch (err) {
      showToast(err.response?.data?.detail || 'Failed to update password');
    } finally {
      setUpdatingPassword(false);
    }
  };

  const userMarkers = users.filter(u => u.lat && u.lon).map(u => ({ lat: parseFloat(u.lat), lon: parseFloat(u.lon), label: u.username }));
  const hospitalMarkers = hospitals.filter(h => h.lat && h.lon).map(h => ({ lat: parseFloat(h.lat), lon: parseFloat(h.lon), label: h.name }));

  // Lifted Card and PaginationControls statically to component declarations block.

  // ============================================
  // RENDER SECTIONS
  // ============================================
  const renderUsers = () => (
    <div className="animate-fade-in">
      <h2 className="text-2xl font-bold text-slate-800 mb-6 flex items-center gap-2"><Users className="text-blue-500" /> Platform Users</h2>
      
      {/* Filters */}
      <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm mb-6 flex flex-wrap gap-4 items-end">
        <div className="flex-1 min-w-[200px]">
          <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Name</label>
          <div className="relative">
            <Search className="absolute left-3 top-2.5 text-slate-400" size={18} />
            <input 
              type="text" 
              placeholder="Search name..." 
              value={userFilters.name}
              onChange={(e) => handleFilterChange('users', 'name', e.target.value)}
              className="pl-10 w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 focus:ring-2 focus:ring-blue-500 outline-none text-sm"
            />
          </div>
        </div>
        <div className="flex-1 min-w-[200px]">
          <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Email</label>
          <input 
            type="text" 
            placeholder="Search email..." 
            value={userFilters.email}
            onChange={(e) => handleFilterChange('users', 'email', e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 focus:ring-2 focus:ring-blue-500 outline-none text-sm"
          />
        </div>
        <div className="w-[150px]">
          <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Account Type</label>
          <select 
            value={userFilters.account_type}
            onChange={(e) => handleFilterChange('users', 'account_type', e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 focus:ring-2 focus:ring-blue-500 outline-none text-sm text-slate-700"
          >
            <option value="">All Types</option>
            <option value="general">General</option>
            <option value="premium">Premium</option>
          </select>
        </div>
        <div className="w-[150px]">
          <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Status</label>
          <select 
            value={userFilters.is_active}
            onChange={(e) => handleFilterChange('users', 'is_active', e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 focus:ring-2 focus:ring-blue-500 outline-none text-sm text-slate-700"
          >
            <option value="">All Status</option>
            <option value="true">Active</option>
            <option value="false">Inactive</option>
          </select>
        </div>
        <button 
          onClick={() => resetFilters('users')}
          className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-sm transition-all"
        >
          Clear
        </button>
      </div>

      {userMarkers.length > 0 && (
        <Card className="mb-6 p-2 h-[300px]">
          <div className="h-full rounded-xl overflow-hidden">
            <MapComponent markers={userMarkers} />
          </div>
        </Card>
      )}

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {users.map(u => (
          <Card key={u.id} className="relative overflow-hidden group border-l-4 border-l-blue-400">
            <div className="pl-2">
              <div className="flex justify-between items-start mb-2">
                <h3 onClick={() => openUserModal(u)} className="font-bold text-lg text-slate-800 truncate cursor-pointer hover:text-blue-600 transition-colors" title="View user details">{u.username}</h3>
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
                <button onClick={() => openUserModal(u)} className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium py-1.5 px-3 rounded-lg transition-colors text-sm flex items-center justify-center gap-1"><Eye size={14} /> Details</button>
                {u.is_active !== false ? (
                  <button onClick={() => deleteEntity('user', u.id)} className="flex-1 bg-rose-50 text-rose-600 font-medium py-1.5 rounded-lg hover:bg-rose-100 transition-colors text-sm">Deactivate</button>
                ) : (
                  <button onClick={() => reactivateEntity('user', u.id)} className="flex-1 bg-emerald-50 text-emerald-600 font-medium py-1.5 rounded-lg hover:bg-emerald-100 transition-colors text-sm">Reactivate</button>
                )}
              </div>
            </div>
          </Card>
        ))}
        {users.length === 0 && <p className="text-slate-500 col-span-full py-8 text-center bg-white rounded-2xl border border-slate-100 shadow-sm font-medium">No users match your criteria.</p>}
      </div>

      <PaginationControls current={page} hasMoreFlag={hasMore} onPrev={() => setPage(p => Math.max(p - 1, 1))} onNext={() => setPage(p => p + 1)} />
    </div>
  );

  const renderDoctors = () => (
    <div className="animate-fade-in">
      <h2 className="text-2xl font-bold text-slate-800 mb-6 flex items-center gap-2"><UserCheck className="text-indigo-500" /> Platform Doctors</h2>
      
      {/* Filters */}
      <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm mb-6 flex flex-wrap gap-4 items-end">
        <div className="flex-1 min-w-[150px]">
          <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Name</label>
          <div className="relative">
            <Search className="absolute left-3 top-2.5 text-slate-400" size={18} />
            <input 
              type="text" 
              placeholder="Search name..." 
              value={doctorFilters.name}
              onChange={(e) => handleFilterChange('doctors', 'name', e.target.value)}
              className="pl-10 w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
            />
          </div>
        </div>
        <div className="flex-1 min-w-[150px]">
          <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Speciality</label>
          <input 
            type="text" 
            placeholder="Speciality..." 
            value={doctorFilters.speciality}
            onChange={(e) => handleFilterChange('doctors', 'speciality', e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
          />
        </div>
        <div className="w-[120px]">
          <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Min Rating</label>
          <select 
            value={doctorFilters.rating}
            onChange={(e) => handleFilterChange('doctors', 'rating', e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 focus:ring-2 focus:ring-indigo-500 outline-none text-sm text-slate-700"
          >
            <option value="">All Ratings</option>
            <option value="4.5">★ 4.5+</option>
            <option value="4.0">★ 4.0+</option>
            <option value="3.0">★ 3.0+</option>
          </select>
        </div>
        <div className="w-[120px]">
          <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Availability</label>
          <select 
            value={doctorFilters.availability}
            onChange={(e) => handleFilterChange('doctors', 'availability', e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 focus:ring-2 focus:ring-indigo-500 outline-none text-sm text-slate-700"
          >
            <option value="">All</option>
            <option value="true">Available</option>
            <option value="false">Unavailable</option>
          </select>
        </div>
        <div className="w-[120px]">
          <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Status</label>
          <select 
            value={doctorFilters.is_active}
            onChange={(e) => handleFilterChange('doctors', 'is_active', e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 focus:ring-2 focus:ring-indigo-500 outline-none text-sm text-slate-700"
          >
            <option value="">All</option>
            <option value="true">Active</option>
            <option value="false">Inactive</option>
          </select>
        </div>
        <button 
          onClick={() => resetFilters('doctors')}
          className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-sm transition-all"
        >
          Clear
        </button>
      </div>
      
      {doctors.map(h => (
        <div key={h.hospital_id} className="mb-8 bg-slate-100/50 p-6 rounded-3xl border border-slate-250/20">
          <h3 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2"><Building2 className="text-slate-400" size={20}/> {h.hospital_name}</h3>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {h.doctors.map(d => (
              <Card key={d.id} className="relative overflow-hidden border-t-4 border-t-indigo-400 flex flex-col justify-between">
                <div>
                  <div className="flex justify-between items-start mb-2">
                    <h3 onClick={() => openDoctorModal({ ...d, hospital_id: h.hospital_id, hospital_name: h.hospital_name, hospital_lat: h.hospital_lat, hospital_lon: h.hospital_lon })} className="font-bold text-lg text-slate-800 truncate cursor-pointer hover:text-indigo-600 transition-colors" title="View details">Dr. {d.name}</h3>
                    <span className={`px-2 py-0.5 text-xs font-bold rounded ${d.is_active !== false ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                      {d.is_active !== false ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  <div className="text-sm text-slate-600 mb-4 space-y-1 flex-1">
                    <p>ID: <span className="font-medium text-slate-800">{d.id}</span></p>
                    <p className="truncate">Email: {d.email}</p>
                    <p className="text-indigo-600 font-semibold text-xs uppercase tracking-wider">{d.speciality || 'General Practice'}</p>
                    <p className="text-xs text-slate-400 flex items-center gap-1">Consultation: <span className="font-bold text-slate-700">₹{d.fees || 0}</span></p>
                  </div>
                </div>
                <div className="flex gap-2 mt-2">
                  <button onClick={() => openDoctorModal({ ...d, hospital_id: h.hospital_id, hospital_name: h.hospital_name, hospital_lat: h.hospital_lat, hospital_lon: h.hospital_lon })} className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium py-1.5 px-3 rounded-lg transition-colors text-sm flex items-center justify-center gap-1"><Eye size={14} /> Profile</button>
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
      {doctors.length === 0 && <p className="text-slate-500 py-8 text-center bg-white rounded-2xl border border-slate-100 shadow-sm font-medium">No doctors found matching filters.</p>}

      <PaginationControls current={page} total={totalPages} onPrev={() => setPage(p => Math.max(p - 1, 1))} onNext={() => setPage(p => p + 1)} />
    </div>
  );

  const renderHospitals = () => (
    <div className="animate-fade-in">
      <h2 className="text-2xl font-bold text-slate-800 mb-6 flex items-center gap-2"><Building2 className="text-emerald-500" /> Platform Hospitals</h2>
      
      {/* Filters */}
      <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm mb-6 flex flex-wrap gap-4 items-end">
        <div className="flex-1 min-w-[150px]">
          <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Hospital Name</label>
          <div className="relative">
            <Search className="absolute left-3 top-2.5 text-slate-400" size={18} />
            <input 
              type="text" 
              placeholder="Search..." 
              value={hospitalFilters.name}
              onChange={(e) => handleFilterChange('hospitals', 'name', e.target.value)}
              className="pl-10 w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 focus:ring-2 focus:ring-blue-500 outline-none text-sm"
            />
          </div>
        </div>
        <div className="w-[120px]">
          <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">City</label>
          <input 
            type="text" 
            placeholder="City" 
            value={hospitalFilters.city}
            onChange={(e) => handleFilterChange('hospitals', 'city', e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 focus:ring-2 focus:ring-blue-500 outline-none text-sm"
          />
        </div>
        <div className="w-[100px]">
          <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">State</label>
          <input 
            type="text" 
            placeholder="State" 
            value={hospitalFilters.state}
            onChange={(e) => handleFilterChange('hospitals', 'state', e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 focus:ring-2 focus:ring-blue-500 outline-none text-sm"
          />
        </div>
        <div className="w-[110px]">
          <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Rating</label>
          <select 
            value={hospitalFilters.rating}
            onChange={(e) => handleFilterChange('hospitals', 'rating', e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 focus:ring-2 focus:ring-blue-500 outline-none text-sm text-slate-700"
          >
            <option value="">All</option>
            <option value="5">★ 5 Stars</option>
            <option value="4">★ 4 Stars</option>
            <option value="3">★ 3 Stars</option>
          </select>
        </div>
        <div className="w-[110px]">
          <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Min Cases</label>
          <input 
            type="number" 
            placeholder="Min Cases" 
            value={hospitalFilters.cases}
            onChange={(e) => handleFilterChange('hospitals', 'cases', e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 focus:ring-2 focus:ring-blue-500 outline-none text-sm"
          />
        </div>
        <button 
          onClick={() => resetFilters('hospitals')}
          className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-sm transition-all"
        >
          Clear
        </button>
      </div>

      {hospitalMarkers.length > 0 && (
        <Card className="mb-6 p-2 h-[300px]">
          <div className="h-full rounded-xl overflow-hidden">
            <MapComponent markers={hospitalMarkers} />
          </div>
        </Card>
      )}

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {hospitals.map(h => (
          <Card key={h.id} className="relative overflow-hidden group border-l-4 border-l-emerald-400">
            <div className="pl-2">
              <div className="flex justify-between items-start mb-2">
                <h3 onClick={() => openHospitalModal(h)} className="font-bold text-lg text-slate-800 truncate cursor-pointer hover:text-emerald-650 transition-colors" title="View details">{h.name}</h3>
                <span className={`px-2 py-0.5 text-xs font-bold rounded ${h.is_active !== false ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                  {h.is_active !== false ? 'Active' : 'Inactive'}
                </span>
              </div>
              <div className="text-sm text-slate-600 mb-4 space-y-1">
                <p>ID: <span className="font-medium text-slate-800">{h.id}</span></p>
                <p className="truncate">Email: {h.email}</p>
                <p className="truncate">City: {h.city || 'N/A'}</p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => openHospitalModal(h)} className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium py-1.5 px-3 rounded-lg transition-colors text-sm flex items-center justify-center gap-1"><Eye size={14} /> Details</button>
                {h.is_active !== false ? (
                  <button onClick={() => deleteEntity('hospital', h.id)} className="flex-1 bg-rose-50 text-rose-600 font-medium py-1.5 rounded-lg hover:bg-rose-100 transition-colors text-sm">Deactivate</button>
                ) : (
                  <button onClick={() => reactivateEntity('hospital', h.id)} className="flex-1 bg-emerald-50 text-emerald-600 font-medium py-1.5 rounded-lg hover:bg-emerald-100 transition-colors text-sm">Reactivate</button>
                )}
              </div>
            </div>
          </Card>
        ))}
        {hospitals.length === 0 && <p className="text-slate-500 col-span-full py-8 text-center bg-white rounded-2xl border border-slate-100 shadow-sm font-medium">No hospitals found.</p>}
      </div>

      <PaginationControls current={page} hasMoreFlag={hasMore} onPrev={() => setPage(p => Math.max(p - 1, 1))} onNext={() => setPage(p => p + 1)} />
    </div>
  );

  const renderCases = () => (
    <div className="animate-fade-in">
      <h2 className="text-2xl font-bold text-slate-800 mb-6 flex items-center gap-2"><FileText className="text-blue-500" /> Platform Cases</h2>
      
      {/* Filters */}
      <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm mb-6 flex flex-wrap gap-4 items-end">
        <div className="w-[150px]">
          <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Date</label>
          <input 
            type="date" 
            value={caseFilters.date}
            onChange={(e) => handleFilterChange('cases', 'date', e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 focus:ring-2 focus:ring-blue-500 outline-none text-sm text-slate-700"
          />
        </div>
        <div className="flex-1 min-w-[150px]">
          <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Disease</label>
          <input 
            type="text" 
            placeholder="Search disease..." 
            value={caseFilters.diesease}
            onChange={(e) => handleFilterChange('cases', 'diesease', e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 focus:ring-2 focus:ring-blue-500 outline-none text-sm"
          />
        </div>
        <div className="flex-1 min-w-[150px]">
          <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Doctor Name</label>
          <input 
            type="text" 
            placeholder="Doctor's name..." 
            value={caseFilters.doctor_name}
            onChange={(e) => handleFilterChange('cases', 'doctor_name', e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 focus:ring-2 focus:ring-blue-500 outline-none text-sm"
          />
        </div>
        <div className="flex-1 min-w-[150px]">
          <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">User Name</label>
          <input 
            type="text" 
            placeholder="User's name..." 
            value={caseFilters.user_name}
            onChange={(e) => handleFilterChange('cases', 'user_name', e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 focus:ring-2 focus:ring-blue-500 outline-none text-sm"
          />
        </div>
        <div className="w-[120px]">
          <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Cost (₹)</label>
          <input 
            type="number" 
            placeholder="Cost" 
            value={caseFilters.cost}
            onChange={(e) => handleFilterChange('cases', 'cost', e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 focus:ring-2 focus:ring-blue-500 outline-none text-sm"
          />
        </div>
        <button 
          onClick={() => resetFilters('cases')}
          className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-sm transition-all"
        >
          Clear
        </button>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {cases.map(c => (
          <Card key={c.id} className="border-l-4 border-l-blue-400 cursor-pointer hover:scale-[1.01] hover:border-l-blue-600 transition-all flex flex-col justify-between" onClick={() => setSelectedCase(c)}>
            <div>
              <div className="flex justify-between items-center mb-2">
                <h3 className="font-bold text-lg text-slate-800">Case #{c.case_id}</h3>
                <span className={`px-2 py-0.5 text-xs font-bold rounded ${c.status === 'OPEN' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-655'}`}>{c.status}</span>
              </div>
              <div className="text-sm text-slate-600 space-y-1 mb-4">
                <p>User: <span className="font-semibold text-slate-800">{c.user?.name || c.user_name || 'N/A'}</span></p>
                <p>Doctor: <span className="font-semibold text-slate-800">{c.doctor?.name || c.doctor_name || 'N/A'}</span></p>
                {(c.diesease || c.disease) && <p>Disease: <span className="font-semibold text-slate-850">{c.diesease || c.disease}</span></p>}
              </div>
            </div>
            <div className="flex justify-between items-center mt-2 border-t border-slate-100 pt-2 text-xs text-slate-400">
              <span className="font-bold text-slate-600">₹{c.cost}</span>
              <span>{new Date(c.date || c.case_opened_on).toLocaleDateString()}</span>
            </div>
          </Card>
        ))}
        {cases.length === 0 && <p className="text-slate-500 col-span-full py-8 text-center bg-white rounded-2xl border border-slate-100 shadow-sm font-medium">No cases found.</p>}
      </div>

      <PaginationControls current={page} total={totalPages} onPrev={() => setPage(p => Math.max(p - 1, 1))} onNext={() => setPage(p => p + 1)} />
    </div>
  );

  const renderTransactions = () => (
    <div className="animate-fade-in max-w-5xl">
      <h2 className="text-2xl font-bold text-slate-800 mb-6 flex items-center gap-2"><DollarSign className="text-emerald-500" /> Platform Transactions</h2>
      
      {/* Filters */}
      <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm mb-6 flex flex-wrap gap-4 items-end">
        <div className="w-[150px]">
          <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">User Type</label>
          <select 
            value={transactionFilters.usertype}
            onChange={(e) => handleFilterChange('transactions', 'usertype', e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 focus:ring-2 focus:ring-blue-500 outline-none text-sm text-slate-700"
          >
            <option value="all">All</option>
            <option value="user">User Payments</option>
            <option value="doctor">Doctor Payouts</option>
          </select>
        </div>
        <div className="w-[150px]">
          <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Date</label>
          <input 
            type="date" 
            value={transactionFilters.date}
            onChange={(e) => handleFilterChange('transactions', 'date', e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 focus:ring-2 focus:ring-blue-500 outline-none text-sm text-slate-700"
          />
        </div>
        <div className="w-[150px]">
          <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Amount (₹)</label>
          <input 
            type="number" 
            placeholder="Exact amount..." 
            value={transactionFilters.amount}
            onChange={(e) => handleFilterChange('transactions', 'amount', e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 focus:ring-2 focus:ring-blue-500 outline-none text-sm text-slate-700"
          />
        </div>
        <button 
          onClick={() => resetFilters('transactions')}
          className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-sm transition-all"
        >
          Clear
        </button>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {(transactionFilters.usertype === 'all' || transactionFilters.usertype === 'user') && (
          <Card className="bg-slate-50 border-slate-200 flex flex-col justify-between">
            <div>
              <h3 className="font-bold text-lg text-slate-800 mb-4 flex items-center gap-2"><Users size={18} className="text-blue-500" /> User Payments</h3>
              <div className="space-y-3 overflow-y-auto max-h-[500px] pr-2 custom-scrollbar">
                {transactions.user_transactions?.map(t => (
                  <div key={t.id} className="bg-white p-3 rounded-xl border border-slate-100 shadow-sm flex justify-between items-center">
                    <div>
                      <p className="font-bold text-sm text-slate-800">{t.user_name || 'Unknown User'}</p>
                      <p className="text-[10px] text-slate-400">User ID: {t.user_id}</p>
                      <p className="text-xs text-slate-500 font-medium mt-1">{t.note || t.type}</p>
                    </div>
                    <div className="text-right">
                      <span className={`font-extrabold text-sm ${t.type?.toLowerCase()?.includes('credit') || t.type?.toLowerCase()?.includes('topup') ? 'text-emerald-600' : 'text-slate-800'}`}>
                        ₹{t.amount}
                      </span>
                      <p className="text-[10px] text-slate-400 mt-0.5">{new Date(t.date).toLocaleDateString()}</p>
                    </div>
                  </div>
                ))}
                {!transactions.user_transactions?.length && <p className="text-slate-500 text-sm italic py-4 text-center">No user transactions found.</p>}
              </div>
            </div>
          </Card>
        )}

        {(transactionFilters.usertype === 'all' || transactionFilters.usertype === 'doctor') && (
          <Card className="bg-slate-50 border-slate-200 flex flex-col justify-between">
            <div>
              <h3 className="font-bold text-lg text-slate-800 mb-4 flex items-center gap-2"><UserCheck size={18} className="text-indigo-500" /> Doctor Withdrawals</h3>
              <div className="space-y-3 overflow-y-auto max-h-[500px] pr-2 custom-scrollbar">
                {transactions.doctor_transactions?.map(t => (
                  <div key={t.id} className="bg-white p-3 rounded-xl border border-slate-100 shadow-sm flex justify-between items-center">
                    <div>
                      <p className="font-bold text-sm text-slate-800">Dr. {t.doctor_name || 'Unknown Doctor'}</p>
                      <p className="text-[10px] text-slate-400">Doctor ID: {t.doctor_id}</p>
                      <p className="text-xs text-slate-500 font-medium mt-1">{t.note || t.type}</p>
                    </div>
                    <div className="text-right">
                      <span className="font-extrabold text-sm text-indigo-650">
                        ₹{t.amount}
                      </span>
                      <p className="text-[10px] text-slate-400 mt-0.5">{new Date(t.date).toLocaleDateString()}</p>
                    </div>
                  </div>
                ))}
                {!transactions.doctor_transactions?.length && <p className="text-slate-500 text-sm italic py-4 text-center">No doctor transactions found.</p>}
              </div>
            </div>
          </Card>
        )}
      </div>

      <PaginationControls current={page} hasMoreFlag={hasMore} onPrev={() => setPage(p => Math.max(p - 1, 1))} onNext={() => setPage(p => p + 1)} />
    </div>
  );

  const renderWallets = () => (
    <div className="animate-fade-in">
      <h2 className="text-2xl font-bold text-slate-800 mb-6 flex items-center gap-2"><Wallet className="text-violet-500" /> Platform Wallets</h2>
      
      {/* Filters */}
      <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm mb-6 flex flex-wrap gap-4 items-end">
        <div className="w-[150px]">
          <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">User Role</label>
          <select 
            value={walletFilters.role}
            onChange={(e) => handleFilterChange('wallets', 'role', e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 focus:ring-2 focus:ring-blue-500 outline-none text-sm text-slate-700"
          >
            <option value="">All</option>
            <option value="user">User</option>
            <option value="doctor">Doctor</option>
            <option value="hospital">Hospital</option>
          </select>
        </div>
        <div className="w-[150px]">
          <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Balance (₹)</label>
          <input 
            type="number" 
            placeholder="Exact balance..." 
            value={walletFilters.amount}
            onChange={(e) => handleFilterChange('wallets', 'amount', e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 focus:ring-2 focus:ring-blue-500 outline-none text-sm text-slate-700"
          />
        </div>
        <button 
          onClick={() => resetFilters('wallets')}
          className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-sm transition-all"
        >
          Clear
        </button>
      </div>

      <div className="grid md:grid-cols-3 lg:grid-cols-4 gap-4">
        {wallets.map(w => (
          <Card key={`${w.role}-${w.id}`} className="text-center py-6 border border-slate-150/40 hover:border-violet-300 flex flex-col justify-between h-full">
            <div>
              <div className={`mx-auto w-12 h-12 rounded-full flex items-center justify-center mb-3 ${w.role === 'user' ? 'bg-blue-100 text-blue-600' : w.role === 'doctor' ? 'bg-indigo-100 text-indigo-600' : 'bg-emerald-100 text-emerald-600'}`}>
                {w.role === 'user' ? <Users size={20}/> : w.role === 'doctor' ? <UserCheck size={20}/> : <Building2 size={20}/>}
              </div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">{w.role} ID: {w.id}</p>
              <h4 className="font-bold text-slate-850 text-sm truncate px-2 mb-2" title={w.name}>{w.name || 'N/A'}</h4>
            </div>
            <h3 className="text-2xl font-black text-slate-800 mt-2">₹{w.balance}</h3>
          </Card>
        ))}
        {wallets.length === 0 && <p className="text-slate-500 col-span-full py-8 text-center bg-white rounded-2xl border border-slate-100 shadow-sm font-medium">No wallets found matching criteria.</p>}
      </div>

      <PaginationControls current={page} hasMoreFlag={hasMore} onPrev={() => setPage(p => Math.max(p - 1, 1))} onNext={() => setPage(p => p + 1)} />
    </div>
  );

  const renderNotifications = () => (
    <div className="max-w-xl animate-fade-in">
      <Card>
        <h2 className="text-2xl font-bold text-slate-800 mb-6 flex items-center gap-2"><BellRing className="text-amber-500" /> Send System Notification</h2>
        <div className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Recipient ID</label>
            <input type="number" placeholder="Enter recipient ID..." value={notification.recipient_id} onChange={e => setNotification({...notification, recipient_id: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-amber-500 transition-all outline-none" />
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
            <textarea placeholder="Type message here..." value={notification.message} onChange={e => setNotification({...notification, message: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-amber-500 transition-all outline-none resize-none" rows="4" />
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

  const renderSettings = () => (
    <div className="max-w-xl space-y-6 animate-fade-in">
      <Card>
        <h2 className="text-2xl font-bold text-slate-800 mb-6 flex items-center gap-2"><Lock className="text-rose-600" /> Administrative Security</h2>
        <form onSubmit={changePassword} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">New Administrator Password</label>
            <input 
              type="password" 
              value={newPassword} 
              onChange={e => setNewPassword(e.target.value)} 
              placeholder="Enter new administrator password"
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-rose-500 transition-all outline-none"
              required
            />
          </div>
          <button 
            type="submit" 
            disabled={updatingPassword}
            className="w-full bg-rose-600 hover:bg-rose-700 text-white font-semibold py-3 rounded-xl transition-all shadow-sm shadow-rose-200 disabled:opacity-50"
          >
            {updatingPassword ? 'Updating Security...' : 'Update Password'}
          </button>
        </form>
      </Card>

      <Card>
        <h3 className="font-bold text-slate-800 mb-2">System Credentials & Logs</h3>
        <p className="text-sm text-slate-600 mb-4">Access server logs, Redis configurations, and JWT configurations.</p>
        <button disabled className="bg-slate-100 text-slate-400 font-medium px-4 py-2 rounded-xl text-sm cursor-not-allowed">Export Configuration</button>
      </Card>
    </div>
  );

  const renderPolicies = () => {
    return (
      <div className="animate-fade-in">
        <h2 className="text-2xl font-bold text-slate-800 mb-6 flex items-center gap-2">
          <ShieldAlert className="text-indigo-500" /> Platform Policies
        </h2>
        <p className="text-sm text-slate-500 mb-6">
          View all policy documents uploaded by platform hospitals.
        </p>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {policies.map(p => {
            const hospital = hospitals.find(h => h.id === p.hospital_id);
            return (
              <Card key={p.id} className="border-t-4 border-t-indigo-500 flex flex-col justify-between hover:shadow-lg transition-all">
                <div className="space-y-4">
                  <div>
                    <h3 className="font-bold text-lg text-slate-850 mb-1">
                      {hospital ? hospital.name : `Hospital #${p.hospital_id}`}
                    </h3>
                    {hospital && (
                      <p className="text-xs text-slate-500 flex items-center gap-1">
                        <MapPin size={12} className="text-slate-450" /> {hospital.address}, {hospital.city}
                      </p>
                    )}
                  </div>
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 space-y-1 text-xs">
                    <p className="font-bold text-indigo-500 uppercase tracking-wider">Policy Document</p>
                    <p className="text-slate-700 font-medium">Uploaded at: {p.uploaded_at ? new Date(p.uploaded_at).toLocaleString() : 'N/A'}</p>
                    <p className="text-slate-400">ID: {p.id}</p>
                  </div>
                </div>
                <button
                  onClick={() => setDocumentViewer({ isOpen: true, url: p.url, filename: `${hospital?.name || 'Hospital'} Policy.pdf` })}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2.5 rounded-xl transition-all mt-6 shadow-md shadow-indigo-150 flex items-center justify-center gap-2"
                >
                  <Eye size={16} /> View Policy Document
                </button>
              </Card>
            );
          })}
          {policies.length === 0 && (
            <p className="text-slate-500 col-span-full py-8 text-center bg-white rounded-2xl border border-slate-100 shadow-sm font-medium">
              No hospital policies found on the platform.
            </p>
          )}
        </div>
      </div>
    );
  };

  const tabs = [
    { id: 'users', name: 'Users', icon: Users },
    { id: 'doctors', name: 'Doctors', icon: UserCheck },
    { id: 'hospitals', name: 'Hospitals', icon: Building2 },
    { id: 'policies', name: 'Policies', icon: ShieldAlert },
    { id: 'cases', name: 'All Cases', icon: FileText },
    { id: 'transactions', name: 'Transactions', icon: DollarSign },
    { id: 'wallets', name: 'Wallets', icon: Wallet },
    { id: 'notifications', name: 'Alerts', icon: BellRing },
    { id: 'settings', name: 'Settings', icon: Lock },
  ];

  return (
    <div className="flex h-screen bg-slate-50 font-sans overflow-hidden">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50">
          <div className="bg-slate-800 text-white px-6 py-3 rounded-full shadow-2xl flex items-center gap-2 animate-bounce">
            <CheckCircle2 className="text-emerald-400" size={18}/> 
            {toastMessage}
          </div>
        </div>
      )}

      {/* Document Viewer Modal */}
      {documentViewer.isOpen && (
        <DocumentViewerModal 
          url={documentViewer.url} 
          filename={documentViewer.filename} 
          onClose={() => setDocumentViewer({ isOpen: false, url: '', filename: '' })} 
        />
      )}

      {/* Confirmation Dialog Modal */}
      {confirmDialog.isOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex justify-center items-center z-[150] p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full animate-fade-in">
            <h3 className="text-xl font-bold text-slate-800 mb-2">{confirmDialog.title}</h3>
            <p className="text-slate-650 mb-6 text-sm">{confirmDialog.message}</p>
            <div className="flex justify-end gap-3 text-sm font-semibold">
              <button onClick={() => setConfirmDialog({isOpen:false})} className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl hover:bg-slate-200 transition-all">Cancel</button>
              <button onClick={confirmDialog.onConfirm} className={`px-4 py-2 text-white rounded-xl ${confirmDialog.isDestructive ? 'bg-rose-500 hover:bg-rose-600' : 'bg-blue-600 hover:bg-blue-755'}`}>{confirmDialog.confirmText}</button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================
          DYNAMIC DETAIL MODALS
         ============================================ */}
      
      {/* User Details Modal */}
      {selectedUser && (
        <div onClick={(e) => { if (e.target === e.currentTarget) setSelectedUser(null); }} className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex justify-center items-center z-[100] p-4 cursor-pointer">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl relative cursor-default animate-fade-in flex flex-col gap-5 max-h-[90vh] overflow-y-auto custom-scrollbar" onClick={e => e.stopPropagation()}>
            <button onClick={() => setSelectedUser(null)} className="absolute right-4 top-4 p-1.5 text-slate-400 hover:text-slate-600 bg-slate-100 rounded-full transition-colors z-10"><X size={16} /></button>
            <div>
              <span className="text-xs font-bold uppercase tracking-wider bg-blue-50 text-blue-605 px-3 py-1 rounded-full border border-blue-100">User Profile</span>
              <div className="flex items-center gap-4 mt-3">
                <div className="w-14 h-14 bg-blue-100 text-blue-600 rounded-2xl flex items-center justify-center font-extrabold text-2xl">
                  {selectedUser.username?.charAt(0)?.toUpperCase()}
                </div>
                <div>
                  <h3 className="text-xl font-black text-slate-800">{selectedUser.username}</h3>
                  <p className="text-slate-500 font-medium text-xs">Role: {selectedUser.role?.toUpperCase()}</p>
                </div>
              </div>
            </div>
            <div className="space-y-3 bg-slate-50 p-4 rounded-2xl border border-slate-100 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500 font-medium">User ID:</span>
                <span className="font-bold text-slate-850">{selectedUser.id}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-medium">Email:</span>
                <span className="font-bold text-slate-850 truncate max-w-[200px]" title={selectedUser.email}>{selectedUser.email}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-medium">Phone:</span>
                <span className="font-bold text-slate-850">{selectedUser.phone_number || 'N/A'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-medium">Google Account:</span>
                <span className="font-bold text-slate-850 truncate max-w-[200px]" title={selectedUser.google_email_id}>{selectedUser.google_email_id || 'Not connected'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-medium">Account Type:</span>
                <span className="font-bold text-indigo-650 uppercase tracking-wider text-[10px] bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">{selectedUser.account_type}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-medium">Wallet Balance:</span>
                <span className="font-extrabold text-emerald-600">{userWalletBalance}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-medium">Status:</span>
                <span className={`px-2 py-0.5 text-xs font-bold rounded ${selectedUser.is_active !== false ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                  {selectedUser.is_active !== false ? 'Active' : 'Inactive'}
                </span>
              </div>
            </div>
            {selectedUser.lat && selectedUser.lon && (
              <div className="h-[180px] rounded-2xl overflow-hidden border border-slate-200">
                <MapComponent markers={[{ lat: parseFloat(selectedUser.lat), lon: parseFloat(selectedUser.lon), label: selectedUser.username }]} />
              </div>
            )}
            <div className="flex gap-2">
              {selectedUser.is_active !== false ? (
                <button onClick={() => { setSelectedUser(null); deleteEntity('user', selectedUser.id); }} className="flex-1 bg-rose-600 hover:bg-rose-700 text-white font-bold py-2.5 rounded-xl shadow-md transition-all text-sm">Deactivate Account</button>
              ) : (
                <button onClick={() => { setSelectedUser(null); reactivateEntity('user', selectedUser.id); }} className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 rounded-xl shadow-md transition-all text-sm">Reactivate Account</button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Doctor Details Modal */}
      {selectedDoctor && (
        <div onClick={(e) => { if (e.target === e.currentTarget) setSelectedDoctor(null); }} className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex justify-center items-center z-[100] p-4 cursor-pointer">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl relative cursor-default animate-fade-in flex flex-col gap-5 max-h-[90vh] overflow-y-auto custom-scrollbar" onClick={e => e.stopPropagation()}>
            <button onClick={() => setSelectedDoctor(null)} className="absolute right-4 top-4 p-1.5 text-slate-400 hover:text-slate-600 bg-slate-100 rounded-full transition-colors z-10"><X size={16} /></button>
            <div>
              <span className="text-xs font-bold uppercase tracking-wider bg-indigo-50 text-indigo-605 px-3 py-1 rounded-full border border-indigo-100">Doctor Profile</span>
              <div className="flex items-center gap-4 mt-3">
                <div className="w-14 h-14 bg-indigo-100 text-indigo-600 rounded-2xl flex items-center justify-center font-extrabold text-2xl">
                  {selectedDoctor.name?.charAt(0)?.toUpperCase()}
                </div>
                <div>
                  <h3 className="text-xl font-black text-slate-800">Dr. {selectedDoctor.name}</h3>
                  <p className="text-indigo-600 font-semibold text-xs uppercase tracking-wider">{selectedDoctor.speciality || 'General Practitioner'}</p>
                </div>
              </div>
            </div>
            <div className="space-y-3 bg-slate-50 p-4 rounded-2xl border border-slate-100 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500 font-medium">Doctor ID:</span>
                <span className="font-bold text-slate-850">{selectedDoctor.id}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-medium">Email:</span>
                <span className="font-bold text-slate-855 truncate max-w-[200px]" title={selectedDoctor.email}>{selectedDoctor.email}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-medium">Phone:</span>
                <span className="font-bold text-slate-850">{selectedDoctor.phone_number || 'N/A'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-medium">Google Account:</span>
                <span className="font-bold text-slate-850 truncate max-w-[200px]" title={selectedDoctor.google_email_id}>{selectedDoctor.google_email_id || 'Not connected'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-medium">Consultation Fees:</span>
                <span className="font-bold text-slate-850">₹{selectedDoctor.fees || 0}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-medium">Appointment Fees:</span>
                <span className="font-bold text-slate-850">₹{selectedDoctor.appointment_fees || 0}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-medium">Rating:</span>
                <span className="font-bold text-amber-500 flex items-center gap-1">★ {selectedDoctor.rating || '0.0'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-medium">Wallet Balance:</span>
                <span className="font-extrabold text-emerald-600">{doctorWalletBalance}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-medium">Availability:</span>
                <span className={`px-2 py-0.5 text-xs font-bold rounded ${selectedDoctor.availability !== false ? 'bg-emerald-105 text-emerald-700' : 'bg-amber-105 text-amber-700'}`}>
                  {selectedDoctor.availability !== false ? 'Available' : 'Unavailable'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-medium">Status:</span>
                <span className={`px-2 py-0.5 text-xs font-bold rounded ${selectedDoctor.is_active !== false ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                  {selectedDoctor.is_active !== false ? 'Active' : 'Inactive'}
                </span>
              </div>
              <div className="flex justify-between items-center border-t border-slate-100 pt-3 mt-1 text-sm">
                <span className="text-slate-500 font-medium">Hospital Policy:</span>
                {loadingDoctorHospitalPolicy ? (
                  <span className="text-xs text-slate-400">Loading policy...</span>
                ) : doctorHospitalPolicy ? (
                  <button
                    onClick={() => setDocumentViewer({ isOpen: true, url: doctorHospitalPolicy.url, filename: `${selectedDoctor.hospital_name || 'Hospital'} Policy.pdf` })}
                    className="text-xs bg-indigo-50 hover:bg-indigo-100 text-indigo-650 font-bold px-2.5 py-1 rounded-lg transition-colors flex items-center gap-1"
                  >
                    <Eye size={12} /> View Policy
                  </button>
                ) : (
                  <span className="text-xs text-rose-500 font-semibold">No active policy</span>
                )}
              </div>
            </div>
            {selectedDoctor.hospital_lat && selectedDoctor.hospital_lon && (
              <div className="h-[180px] rounded-2xl overflow-hidden border border-slate-200">
                <MapComponent markers={[{ lat: parseFloat(selectedDoctor.hospital_lat), lon: parseFloat(selectedDoctor.hospital_lon), label: selectedDoctor.hospital_name || `Dr. ${selectedDoctor.name}'s Hospital` }]} />
              </div>
            )}
            <div className="flex gap-2">
              {selectedDoctor.is_active !== false ? (
                <button onClick={() => { setSelectedDoctor(null); deleteEntity('doctor', selectedDoctor.id); }} className="flex-1 bg-rose-600 hover:bg-rose-700 text-white font-bold py-2.5 rounded-xl shadow-md transition-all text-sm">Deactivate Doctor</button>
              ) : (
                <button onClick={() => { setSelectedDoctor(null); reactivateEntity('doctor', selectedDoctor.id); }} className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 rounded-xl shadow-md transition-all text-sm">Reactivate Doctor</button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Hospital Details Modal */}
      {selectedHospital && (
        <div onClick={(e) => { if (e.target === e.currentTarget) setSelectedHospital(null); }} className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex justify-center items-center z-[100] p-4 cursor-pointer">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl relative cursor-default animate-fade-in flex flex-col gap-5 max-h-[90vh] overflow-y-auto custom-scrollbar" onClick={e => e.stopPropagation()}>
            <button onClick={() => setSelectedHospital(null)} className="absolute right-4 top-4 p-1.5 text-slate-400 hover:text-slate-600 bg-slate-100 rounded-full transition-colors z-10"><X size={16} /></button>
            <div>
              <span className="text-xs font-bold uppercase tracking-wider bg-emerald-50 text-emerald-605 px-3 py-1 rounded-full border border-emerald-100">Hospital Details</span>
              <div className="flex items-center gap-4 mt-3">
                <div className="w-14 h-14 bg-emerald-100 text-emerald-605 rounded-2xl flex items-center justify-center font-extrabold text-2xl">
                  {selectedHospital.name?.charAt(0)?.toUpperCase()}
                </div>
                <div>
                  <h3 className="text-xl font-black text-slate-800">{selectedHospital.name}</h3>
                  <p className="text-slate-500 font-medium text-xs">Rating: ★ {selectedHospital.rating || '0.0'}</p>
                </div>
              </div>
            </div>
            <div className="space-y-3 bg-slate-50 p-4 rounded-2xl border border-slate-100 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500 font-medium">Hospital ID:</span>
                <span className="font-bold text-slate-850">{selectedHospital.id}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-medium">Email:</span>
                <span className="font-bold text-slate-850 truncate max-w-[200px]" title={selectedHospital.email}>{selectedHospital.email}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-medium">Phone:</span>
                <span className="font-bold text-slate-850">{selectedHospital.phone_number || 'N/A'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-medium">Address:</span>
                <span className="font-bold text-slate-850 text-right max-w-[200px]">{selectedHospital.address}, {selectedHospital.city}, {selectedHospital.state} - {selectedHospital.zip}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-medium">Total Cases:</span>
                <span className="font-bold text-slate-850">{selectedHospital.cases || 0}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-medium">Wallet Balance:</span>
                <span className="font-extrabold text-emerald-600">{hospitalWalletBalance}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-medium">Status:</span>
                <span className={`px-2 py-0.5 text-xs font-bold rounded ${selectedHospital.is_active !== false ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                  {selectedHospital.is_active !== false ? 'Active' : 'Inactive'}
                </span>
              </div>
              <div className="flex justify-between items-center border-t border-slate-100 pt-3 mt-1 text-sm">
                <span className="text-slate-500 font-medium">Policy Document:</span>
                {loadingHospitalPolicy ? (
                  <span className="text-xs text-slate-400">Loading policy...</span>
                ) : hospitalPolicy ? (
                  <button
                    onClick={() => setDocumentViewer({ isOpen: true, url: hospitalPolicy.url, filename: `${selectedHospital.name} Policy.pdf` })}
                    className="text-xs bg-indigo-50 hover:bg-indigo-100 text-indigo-650 font-bold px-2.5 py-1 rounded-lg transition-colors flex items-center gap-1"
                  >
                    <Eye size={12} /> View Policy
                  </button>
                ) : (
                  <span className="text-xs text-rose-500 font-semibold">No active policy</span>
                )}
              </div>
            </div>
            {selectedHospital.lat && selectedHospital.lon && (
              <div className="h-[180px] rounded-2xl overflow-hidden border border-slate-200">
                <MapComponent markers={[{ lat: parseFloat(selectedHospital.lat), lon: parseFloat(selectedHospital.lon), label: selectedHospital.name }]} />
              </div>
            )}
            <div className="flex gap-2">
              {selectedHospital.is_active !== false ? (
                <button onClick={() => { setSelectedHospital(null); deleteEntity('hospital', selectedHospital.id); }} className="flex-1 bg-rose-600 hover:bg-rose-700 text-white font-bold py-2.5 rounded-xl shadow-md transition-all text-sm">Deactivate Hospital</button>
              ) : (
                <button onClick={() => { setSelectedHospital(null); reactivateEntity('hospital', selectedHospital.id); }} className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 rounded-xl shadow-md transition-all text-sm">Reactivate Hospital</button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Case Details Modal */}
      {selectedCase && (
        <div onClick={(e) => { if (e.target === e.currentTarget) setSelectedCase(null); }} className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex justify-center items-center z-[100] p-4 cursor-pointer">
          <div className="bg-white rounded-3xl p-6 max-w-2xl w-full shadow-2xl relative cursor-default animate-fade-in flex flex-col gap-6 max-h-[90vh] overflow-y-auto custom-scrollbar animate-fade-in" onClick={e => e.stopPropagation()}>
            <button onClick={() => setSelectedCase(null)} className="absolute right-4 top-4 p-1.5 text-slate-400 hover:text-slate-600 bg-slate-100 rounded-full transition-colors z-10"><X size={16} /></button>
            <div>
              <span className="text-xs font-bold uppercase tracking-wider bg-blue-50 text-blue-605 px-3 py-1 rounded-full border border-blue-100">Case Details</span>
              <div className="flex justify-between items-center mt-3">
                <h3 className="text-2xl font-black text-slate-800">Case #{selectedCase.case_id}</h3>
                <span className={`px-3 py-1 text-xs font-bold border rounded-full ${selectedCase.status === 'OPEN' ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : 'bg-slate-100 text-slate-700 border-slate-200'}`}>
                  {selectedCase.status}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1">Opened on: {new Date(selectedCase.date).toLocaleString()}</p>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-2 text-sm">
                <h4 className="font-bold text-blue-600 text-xs uppercase tracking-wider">Patient Details</h4>
                <p className="font-bold text-slate-800">{selectedCase.user?.name || 'N/A'}</p>
                <p className="text-xs text-slate-500">ID: {selectedCase.user?.id || 'N/A'}</p>
                <p className="text-xs text-slate-500">{selectedCase.user?.email || ''}</p>
                <p className="text-xs text-slate-500">{selectedCase.user?.phone_number || ''}</p>
              </div>
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-2 text-sm">
                <h4 className="font-bold text-indigo-600 text-xs uppercase tracking-wider">Doctor Details</h4>
                <p className="font-bold text-slate-800">Dr. {selectedCase.doctor?.name || 'N/A'}</p>
                <p className="text-xs text-slate-500">ID: {selectedCase.doctor?.id || 'N/A'}</p>
                <p className="text-xs text-slate-500">{selectedCase.doctor?.speciality || ''}</p>
                <p className="text-xs text-slate-500">{selectedCase.doctor?.email || ''}</p>
              </div>
            </div>

            {selectedCase.hospital && (
              <div className="bg-emerald-50/50 p-4 rounded-2xl border border-emerald-105 space-y-1 text-sm">
                <h4 className="font-bold text-emerald-605 text-xs uppercase tracking-wider">Hospital Details</h4>
                <p className="font-bold text-slate-805">{selectedCase.hospital.name}</p>
                <p className="text-xs text-slate-600">{selectedCase.hospital.address}</p>
                <p className="text-xs text-slate-550">Phone: {selectedCase.hospital.phone_number}</p>
              </div>
            )}

            <div className="space-y-2 bg-slate-50 p-4 rounded-2xl border border-slate-100 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-505 font-medium">Disease:</span>
                <span className="font-bold text-slate-800 capitalize">{selectedCase.diesease || selectedCase.disease || 'N/A'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-505 font-medium">Consultation Cost:</span>
                <span className="font-extrabold text-slate-800">₹{selectedCase.cost || 0}</span>
              </div>
            </div>

            {selectedCase.symptoms?.length > 0 && (
              <div>
                <h4 className="font-bold text-slate-800 text-sm mb-2">Reported Symptoms</h4>
                <div className="flex flex-wrap gap-2">
                  {selectedCase.symptoms.map(s => {
                    let sev = '';
                    if (s && s.severity !== undefined && s.severity !== null) {
                      if (typeof s.severity === 'string') sev = s.severity.toLowerCase();
                      else if (typeof s.severity === 'number') {
                        // categorize numeric severity into low/medium/high
                        sev = s.severity >= 7 ? 'high' : s.severity >= 4 ? 'medium' : 'low';
                      } else {
                        sev = String(s.severity).toLowerCase();
                      }
                    }
                    const isHigh = sev === 'high';
                    const isMed = sev === 'medium';
                    return (
                      <span key={s.id} className={`px-2.5 py-1 text-xs font-semibold rounded-full border ${isHigh ? 'bg-rose-100 text-rose-700 border-rose-200' : isMed ? 'bg-amber-100 text-amber-700 border-amber-200' : 'bg-emerald-100 text-emerald-700 border-emerald-200'}`}>
                        {s.symptom} ({typeof s.severity === 'number' ? `${s.severity}` : s.severity})
                      </span>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="grid md:grid-cols-2 gap-4 border-t border-slate-100 pt-4">
              <div>
                <h4 className="font-bold text-slate-800 text-sm mb-2 flex items-center gap-1.5"><Users size={16} className="text-blue-500" /> Patient Documents</h4>
                <div className="space-y-2">
                  {selectedCase.user_documents?.map(doc => (
                    <div key={doc.id} className="flex items-center justify-between bg-slate-50 p-2.5 rounded-xl border border-slate-100 text-xs">
                      <span className="font-semibold text-slate-700 truncate max-w-[150px]">{doc.type}</span>
                      <button onClick={() => setDocumentViewer({ isOpen: true, url: doc.url, filename: `${doc.type}.${doc.url.split('.').pop()?.split('?')[0]}` })} className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-650 font-bold rounded-lg transition-colors flex items-center gap-1">
                        <Eye size={12} /> View
                      </button>
                    </div>
                  ))}
                  {!selectedCase.user_documents?.length && <p className="text-xs text-slate-400 italic">No patient documents uploaded.</p>}
                </div>
              </div>
              <div>
                <h4 className="font-bold text-slate-800 text-sm mb-2 flex items-center gap-1.5"><UserCheck size={16} className="text-indigo-500" /> Doctor Documents</h4>
                <div className="space-y-2">
                  {selectedCase.doctor_documents?.map(doc => (
                    <div key={doc.id} className="flex items-center justify-between bg-slate-50 p-2.5 rounded-xl border border-slate-105 text-xs">
                      <span className="font-semibold text-slate-700 truncate max-w-[150px]">{doc.type}</span>
                      <button onClick={() => setDocumentViewer({ isOpen: true, url: doc.url, filename: `${doc.type}.${doc.url.split('.').pop()?.split('?')[0]}` })} className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-605 font-bold rounded-lg transition-colors flex items-center gap-1">
                        <Eye size={12} /> View
                      </button>
                    </div>
                  ))}
                  {!selectedCase.doctor_documents?.length && <p className="text-xs text-slate-400 italic">No doctor documents uploaded.</p>}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Sidebar */}
      <div className="w-72 bg-slate-900 text-slate-300 flex flex-col border-r border-slate-800 hidden md:flex z-10 shadow-2xl">
        <Link to="/" className="p-6 border-b border-slate-800 flex items-center gap-3 hover:opacity-85 active:scale-95 transition-all">
          <div className="bg-rose-600 p-2 rounded-xl text-white"><ShieldAlert size={24}/></div>
          <h1 className="text-xl font-bold text-white tracking-tight">HealthifAI Admin</h1>
        </Link>
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
            {activeTab === 'policies' && renderPolicies()}
            {activeTab === 'cases' && renderCases()}
            {activeTab === 'transactions' && renderTransactions()}
            {activeTab === 'wallets' && renderWallets()}
            {activeTab === 'notifications' && renderNotifications()}
            {activeTab === 'settings' && renderSettings()}
          </div>
        </main>
      </div>
      <Chatbot />
    </div>
  );
};

export default AdminDashboard;