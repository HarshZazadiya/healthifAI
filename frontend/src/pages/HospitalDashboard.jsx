import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import NotificationBell from '../components/NotificationBell';
import DocumentUploader from '../components/DocumentUploader';
import MapComponent from '../components/MapComponent';
import { useAuth } from '../context/AuthContext';
import {
  LayoutDashboard, Building2, Users, UserPlus,
  FileText, Wallet, Shield, MapPin,
  LogOut, Plus, Activity, Star, Mail, Phone,
  MessageCircle, Send, Paperclip, X, File, Download, CheckCircle2, Lock, Calendar, Upload
} from 'lucide-react';

// ============================================
// DOCUMENT VIEWER MODAL (reused from Doctor/User dashboards)
// ============================================
const DocumentViewerModal = ({ url, filename, onClose }) => {
  const [contentType, setContentType] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [cacheBuster, setCacheBuster] = useState(0);

  useEffect(() => {
    if (!url) return;
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
      <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex justify-center items-center z-[500] p-4">
        <div className="bg-white rounded-3xl p-8 w-full max-w-4xl text-center">Loading document preview...</div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex justify-center items-center z-[500] p-4">
        <div className="bg-white rounded-3xl p-8 w-full max-w-4xl text-center">
          <p className="text-red-500 mb-4">Unable to load document.</p>
          <a href={url} download className="bg-blue-600 text-white px-4 py-2 rounded-xl">Download</a>
          <button onClick={onClose} className="ml-4 bg-slate-200 px-4 py-2 rounded-xl">Close</button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex justify-center items-center z-[500] p-4 animate-fade-in">
      <div className="bg-white rounded-3xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl relative">
        <div className="flex justify-between items-center p-4 border-b border-slate-200">
          <h3 className="font-bold text-slate-800 truncate">{filename || 'Document'}</h3>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 bg-slate-100 rounded-full transition-colors"><X size={20} /></button>
        </div>
        <div className="flex-1 overflow-auto p-4 bg-slate-50 flex items-center justify-center min-h-[400px]">
          {contentType === 'image' ? (
            <img src={`${url}&_=${cacheBuster}`} alt={filename} className="max-w-full max-h-[70vh] object-contain rounded-lg" />
          ) : contentType === 'pdf' ? (
            <iframe src={url} className="w-full h-[70vh] rounded-lg border-0" title={filename} />
          ) : (
            <div className="text-center">
              <File size={48} className="mx-auto text-slate-400 mb-4" />
              <p className="text-slate-600 mb-4">Preview not available for this file type.</p>
              <a href={url} download className="bg-blue-600 text-white px-4 py-2 rounded-xl hover:bg-blue-700 transition-colors inline-flex items-center gap-2">
                <Download size={18} /> Download
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ============================================
// CHAT PANEL FOR HOSPITALS
// ============================================
const ChatPanel = ({ user, onShowToast, onOpenDocumentViewer, onSeeDoctorInfo, preSelectedDoctorId, clearPreSelectedDoctor }) => {
  const [availableDoctors, setAvailableDoctors] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [ws, setWs] = useState(null);
  const [loadingRooms, setLoadingRooms] = useState(true);
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [docType, setDocType] = useState('');
  const [showDocTypeModal, setShowDocTypeModal] = useState(false);
  const receivedMsgIds = useRef(new Set());

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf'];
    if (!allowedTypes.includes(file.type)) {
      onShowToast('Only images and PDF files are allowed');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }
    setSelectedFile(file);
    setDocType('');
    setShowDocTypeModal(true);
  };

  const chatApiCall = async (method, endpoint, data = null, params = {}) => {
    let token = sessionStorage.getItem('access_token');
    if (!token) {
      const refreshToken = sessionStorage.getItem('refresh_token');
      if (refreshToken) {
        try {
          const refreshRes = await api.post('/auth/refresh', null, { params: { token: refreshToken } });
          token = refreshRes.data.access_token;
          sessionStorage.setItem('access_token', token);
        } catch (e) {
          throw new Error('Session expired');
        }
      } else {
        throw new Error('No token available');
      }
    }
    const url = `${endpoint}?token=${token}`;
    const config = { method, url, params, headers: { 'Content-Type': 'application/json' } };
    if (data) config.data = data;
    return await api(config);
  };

  const fetchData = async () => {
    try {
      const roomsRes = await chatApiCall('get', '/chat/rooms');
      setRooms(roomsRes.data.rooms || []);

      const availableRes = await chatApiCall('get', '/chat/doctors/available');
      setAvailableDoctors(availableRes.data.doctors || []);

      if (roomsRes.data.rooms?.length > 0) {
        if (!preSelectedDoctorId) {
          setSelectedRoom(roomsRes.data.rooms[0]);
        }
      }
    } catch (err) {
      console.error(err);
      onShowToast('Failed to load chat data');
    } finally {
      setLoadingRooms(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (preSelectedDoctorId && availableDoctors.length > 0) {
      const existingRoom = rooms.find(r => r.doctor_id === preSelectedDoctorId);
      if (existingRoom) {
        setSelectedRoom(existingRoom);
      } else {
        startDoctorChat(preSelectedDoctorId);
      }
      clearPreSelectedDoctor();
    }
  }, [preSelectedDoctorId, availableDoctors, rooms]);

  const startDoctorChat = async (doctorId) => {
    try {
      const res = await chatApiCall('post', '/chat/room/hospital', null, { doctor_id: doctorId });
      onShowToast('Chat room created with doctor!');

      const roomsRes = await chatApiCall('get', '/chat/rooms');
      setRooms(roomsRes.data.rooms || []);

      const newRoom = roomsRes.data.rooms.find(r => r.doctor_id === doctorId);
      if (newRoom) {
        setSelectedRoom(newRoom);
      }

      const availableRes = await chatApiCall('get', '/chat/doctors/available');
      setAvailableDoctors(availableRes.data.doctors || []);
    } catch (err) {
      console.error(err);
      onShowToast('Failed to start chat with doctor');
    }
  };

  useEffect(() => {
    if (!selectedRoom) return;
    const loadMessages = async () => {
      try {
        const res = await chatApiCall('get', `/chat/messages/${selectedRoom.id}`, null, { limit: 100, chat_type: selectedRoom.chat_type || 'doctor_hospital' });
        setMessages(res.data.messages || []);
        scrollToBottom();
      } catch (err) { console.error(err); }
    };
    loadMessages();
  }, [selectedRoom]);

  useEffect(() => {
    if (!selectedRoom) return;
    const token = sessionStorage.getItem('access_token');
    if (!token) { onShowToast('Authentication token missing'); return; }
    const wsUrl = `ws://localhost:8000/chat/ws?token=${token}`;
    const socket = new WebSocket(wsUrl);
    socket.onopen = () => socket.send(JSON.stringify({ type: 'join_room', room_id: selectedRoom.id, chat_type: selectedRoom.chat_type || 'doctor_hospital' }));
    socket.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.type === 'message' && msg.room_id === selectedRoom.id) {
        if (receivedMsgIds.current.has(msg.id)) return;
        receivedMsgIds.current.add(msg.id);
        setMessages(prev => [...prev, msg]);
        scrollToBottom();
      } else if (msg.type === 'user_status') {
        setRooms(prevRooms => prevRooms.map(room =>
          room.id === msg.room_id
            ? { ...room, is_doctor_online: msg.is_online }
            : room
        ));
      }
    };
    socket.onerror = (err) => console.error('WebSocket error', err);
    setWs(socket);
    return () => { if (socket.readyState === WebSocket.OPEN) socket.close(); };
  }, [selectedRoom]);

  const scrollToBottom = () => setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);

  const sendMessage = async () => {
    if (!inputMessage.trim() && !selectedFile) return;
    if (!ws || ws.readyState !== WebSocket.OPEN) { onShowToast('Not connected to chat server'); return; }
    const file = selectedFile;
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        ws.send(JSON.stringify({
          type: 'message',
          room_id: selectedRoom.id,
          chat_type: selectedRoom.chat_type || 'doctor_hospital',
          message: inputMessage,
          message_type: file.type.startsWith('image/') ? 'image' : 'file',
          file_data: e.target.result,
          file_name: file.name,
          file_type: docType
        }));
        setInputMessage('');
        setSelectedFile(null);
        setDocType('');
        if (fileInputRef.current) fileInputRef.current.value = '';
      };
      reader.readAsDataURL(file);
    } else {
      ws.send(JSON.stringify({
        type: 'message',
        room_id: selectedRoom.id,
        chat_type: selectedRoom.chat_type || 'doctor_hospital',
        message: inputMessage,
        message_type: 'text'
      }));
      setInputMessage('');
    }
  };

  const getPartnerName = (room) => {
    if (!room) return '';
    return room.doctor_name || 'Doctor';
  };

  if (loadingRooms) return <div className="flex justify-center items-center h-full text-slate-500">Loading conversations...</div>;

  return (
    <div className="flex h-full bg-white rounded-2xl overflow-hidden border border-slate-200 shadow-sm min-h-[500px]">
      <div className="w-80 border-r border-slate-200 bg-slate-50 flex flex-col">
        <div className="p-4 border-b border-slate-200 bg-white">
          <h2 className="font-bold text-slate-800">Direct Messages</h2>
          <p className="text-xs text-slate-500 mt-1">Communicate directly with your doctors</p>
        </div>
        <div className="flex-1 overflow-y-auto">
          {availableDoctors.length === 0 ? (
            <div className="p-4 text-center text-slate-500 text-sm">No doctors assigned.</div>
          ) : (
            availableDoctors.map(doctor => {
              const existingRoom = rooms.find(r => r.doctor_id === doctor.id);
              const isSelected = selectedRoom?.doctor_id === doctor.id;
              const isOnline = existingRoom ? existingRoom.is_doctor_online : doctor.is_online;
              return (
                <div
                  key={doctor.id}
                  onClick={() => { if (existingRoom) setSelectedRoom(existingRoom); else startDoctorChat(doctor.id); }}
                  className={`p-4 border-b border-slate-100 cursor-pointer hover:bg-slate-100 transition-colors ${isSelected ? 'bg-indigo-50 border-l-4 border-l-indigo-500' : ''}`}
                >
                  <div className="flex justify-between items-center">
                    <div className="font-semibold text-slate-800">Dr. {doctor.name}</div>
                    <div className={`w-2 h-2 rounded-full ${isOnline ? 'bg-green-500' : 'bg-gray-400'}`}></div>
                  </div>
                  <div className="text-xs text-slate-500 mt-1">{doctor.speciality || 'General Practitioner'}</div>
                  {existingRoom?.last_message && <div className="text-xs text-slate-400 mt-1 truncate">{existingRoom.last_message}</div>}
                  {!doctor.has_active_chat && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        startDoctorChat(doctor.id);
                      }}
                      className="mt-3 w-full bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold py-2 px-3 rounded-lg transition-colors"
                    >
                      Start Chat Room
                    </button>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {selectedRoom ? (
        <div className="flex-1 flex flex-col">
          <div className="p-4 border-b border-slate-200 bg-white flex justify-between items-center relative">
            <div>
              <button
                onClick={() => {
                  const doc = availableDoctors.find(d => d.id === selectedRoom.doctor_id);
                  if (doc) onSeeDoctorInfo(doc);
                }}
                className="font-bold text-slate-800 hover:text-indigo-600 hover:underline transition-all text-left"
              >
                {getPartnerName(selectedRoom)}
              </button>
              <div className="flex items-center gap-1 mt-1">
                <div className={`w-2 h-2 rounded-full ${selectedRoom.is_doctor_online ? 'bg-green-500' : 'bg-gray-400'}`}></div>
                <p className="text-xs text-slate-500">{selectedRoom.is_doctor_online ? 'Online' : 'Offline'}</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  const doc = availableDoctors.find(d => d.id === selectedRoom.doctor_id);
                  if (doc) onSeeDoctorInfo(doc);
                }}
                title="Doctor Profile"
                className="px-3 py-1.5 bg-indigo-50 text-indigo-600 rounded-xl text-xs font-semibold hover:bg-indigo-100 transition-all"
              >
                Doctor Profile
              </button>
              <button
                onClick={() => setSelectedRoom(null)}
                title="Close chat"
                className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-all active:scale-95 shrink-0"
              >
                <X size={20} />
              </button>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50">
            {messages.map((msg, idx) => {
              const isSent = msg.sender_id === user.id && msg.sender_type === user.type;
              const fileUrl = msg.file_url;
              const fileName = msg.file_name || (msg.message_type === 'image' ? 'image.jpg' : 'file.pdf');
              return (
                <div key={idx} className={`flex ${isSent ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[70%] rounded-2xl px-4 py-2 ${isSent ? 'bg-indigo-600 text-white' : 'bg-white border border-slate-200 text-slate-800'}`}>
                    {msg.message_type === 'image' && fileUrl && (
                      <div className="cursor-pointer" onClick={() => onOpenDocumentViewer(fileUrl, fileName)}>
                        <img src={fileUrl} alt="attachment" className="max-w-[200px] rounded-lg mb-2" />
                      </div>
                    )}
                    {msg.message_type === 'file' && fileUrl && (
                      <button onClick={() => onOpenDocumentViewer(fileUrl, fileName)} className="text-sm underline flex items-center gap-1 hover:text-blue-500 transition-colors">
                        <File size={14} /> View file
                      </button>
                    )}
                    {msg.message && <p className="text-sm break-words">{msg.message}</p>}
                    <div className="text-[10px] opacity-70 mt-1">{new Date(msg.created_at).toLocaleTimeString()}</div>
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>
          {selectedFile && docType && (
            <div className="px-4 py-2 bg-indigo-50 border-t border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm text-indigo-800">
                <File size={16} className="text-indigo-600" />
                <span className="font-semibold">{selectedFile.name}</span>
                <span className="text-xs bg-indigo-200 px-2 py-0.5 rounded-full text-indigo-900 font-bold">{docType}</span>
              </div>
              <button onClick={() => { setSelectedFile(null); setDocType(''); if (fileInputRef.current) fileInputRef.current.value = ''; }} className="p-1 hover:bg-indigo-100 rounded-full text-indigo-600"><X size={16} /></button>
            </div>
          )}
          <div className="p-4 border-t border-slate-200 bg-white flex gap-2">
            <input type="text" value={inputMessage} onChange={e => setInputMessage(e.target.value)} onKeyPress={e => e.key === 'Enter' && sendMessage()} placeholder="Type a message..." className="flex-1 border border-slate-200 rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            <label className="p-2 rounded-xl bg-slate-100 cursor-pointer hover:bg-slate-200">
              <Paperclip size={20} className="text-slate-600" />
              <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileChange} accept="image/jpeg,image/png,image/gif,image/webp,application/pdf" />
            </label>
            <button onClick={sendMessage} className="bg-indigo-600 text-white px-4 py-2 rounded-xl hover:bg-indigo-700"><Send size={18} /></button>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center text-slate-400">Select a doctor to start chatting</div>
      )}

      {showDocTypeModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex justify-center items-center z-[150] p-4">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-slate-800">Name Your Attachment</h3>
              <button onClick={() => { setShowDocTypeModal(false); setSelectedFile(null); if (fileInputRef.current) fileInputRef.current.value = ''; }} className="p-1.5 text-slate-400 hover:text-slate-600 bg-slate-100 rounded-full"><X size={16} /></button>
            </div>
            <p className="text-sm text-slate-500 mb-4">Provide a name/type for your document (e.g. Policy, Reference)</p>
            <input type="text" placeholder="E.g. Policy Document" value={docType} onChange={(e) => setDocType(e.target.value)} className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none mb-6" autoFocus />
            <div className="flex justify-end gap-3">
              <button onClick={() => { setShowDocTypeModal(false); setSelectedFile(null); }} className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl">Cancel</button>
              <button onClick={() => { if (!docType.trim()) { onShowToast('Please provide a document name'); return; } setShowDocTypeModal(false); }} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl">Confirm</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const Card = ({ children, className = '', ...props }) => (
  <div className={`bg-white rounded-2xl border border-slate-100 shadow-sm p-6 transition-all duration-300 hover:shadow-md ${className}`} {...props}>
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

// ============================================
// MAIN HOSPITAL DASHBOARD
// ============================================
const HospitalDashboard = () => {
  const { logout, user: authUser } = useAuth();
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

  // Enhanced UI states
  const [toastMessage, setToastMessage] = useState('');
  const [confirmDialog, setConfirmDialog] = useState({ isOpen: false, title: '', message: '', onConfirm: null, isDestructive: true, confirmText: 'Confirm' });
  const [documentViewer, setDocumentViewer] = useState({ isOpen: false, url: '', filename: '' });
  const [newPassword, setNewPassword] = useState('');
  const [updatingPassword, setUpdatingPassword] = useState(false);
  const [selectedUserDetails, setSelectedUserDetails] = useState(null);
  const [usersFilters, setUsersFilters] = useState({ status: '', doctor_name: '', user_name: '' });
  const [casesFilters, setCasesFilters] = useState({ status: '', from_date: '', to_date: '', doctor_id: '', case_id: '' });
  const [doctorsFilters, setDoctorsFilters] = useState({ speciality: '', name: '', availability: '' });

  const handleSeeCase = (caseId) => {
    setSelectedUserDetails(null);
    setActiveTab('cases');
    viewCaseDetails(caseId);
  };

  const handleChatWithDoctor = (doctorId) => {
    setSelectedUserDetails(null);
    setPreSelectedDoctorId(doctorId);
    setActiveTab('chat');
  };

  const [selectedCase, setSelectedCase] = useState(null);
  const [showCaseModal, setShowCaseModal] = useState(false);
  const [modalLoading, setModalLoading] = useState(false);

  const viewCaseDetails = async (caseId) => {
    setModalLoading(true);
    setShowCaseModal(true);
    try {
      const res = await api.get('/hospital/cases', { params: { case_id: caseId } });
      const caseData = res.data.cases?.[0];
      if (!caseData) throw new Error('Case not found');
      setSelectedCase(caseData);
    } catch (err) {
      console.error(err);
      showToast('Error loading case details');
      setShowCaseModal(false);
    } finally {
      setModalLoading(false);
    }
  };

  // New state variables for commission, appointments, doctor details, and transactions
  const [hospitalChargesInput, setHospitalChargesInput] = useState(null);
  const [selectedDoctorDetails, setSelectedDoctorDetails] = useState(null);
  const [selectedDoctorBalance, setSelectedDoctorBalance] = useState(null);
  const [loadingDoctorBalance, setLoadingDoctorBalance] = useState(false);
  const [preSelectedDoctorId, setPreSelectedDoctorId] = useState(null);
  const [appointments, setAppointments] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [transactionsPage, setTransactionsPage] = useState(1);
  const [transactionsFilters, setTransactionsFilters] = useState({ type: '', doctor_name: '', date: '' });

  const showToast = (msg) => { setToastMessage(msg); setTimeout(() => setToastMessage(''), 3000); };
  const showConfirm = (title, message, onConfirm, confirmText = 'Confirm', isDestructive = true) => {
    setConfirmDialog({ isOpen: true, title, message, onConfirm, confirmText, isDestructive });
  };

  const loadData = async () => {
    try {
      if (activeTab === 'overview') {
        const docs = await api.get('/hospital/doctors');
        const casesRes = await api.get('/hospital/cases', { params: { page: 1, limit: 5 } });
        const walletRes = await api.get('/default/myWallet');
        setDoctors(docs.data || []);
        setCases(casesRes.data.cases || []);
        setWallet(walletRes.data || { balance: 0 });
      } else if (activeTab === 'profile') {
        const res = await api.get('/hospital/profile');
        setProfile(res.data);
        setEditProfile(res.data);
      } else if (activeTab === 'doctors') {
        const params = { page, limit: 12 };
        if (doctorsFilters.speciality) params.speciality = doctorsFilters.speciality;
        if (doctorsFilters.name) params.name = doctorsFilters.name;
        if (doctorsFilters.availability !== '') params.availability = doctorsFilters.availability === 'true';

        const res = await api.get('/hospital/doctors', { params });
        setDoctors(res.data || []);
        setTotalPages(res.data?.length < 12 ? page : page + 1);
      } else if (activeTab === 'users') {
        const params = { page, limit: 12 };
        if (usersFilters.status) params.status = usersFilters.status;
        if (usersFilters.user_name) params.user_name = usersFilters.user_name;
        if (usersFilters.doctor_name) params.doctor_name = usersFilters.doctor_name;

        const res = await api.get('/hospital/users', { params });
        setUsers(res.data.data || []);
        setTotalPages(Math.ceil((res.data.total || 0) / 12) || 1);
      } else if (activeTab === 'cases') {
        const params = { page, limit: 10 };
        if (casesFilters.status) params.status = casesFilters.status;
        if (casesFilters.from_date) params.from_date = casesFilters.from_date;
        if (casesFilters.to_date) params.to_date = casesFilters.to_date;
        if (casesFilters.doctor_id) params.doctor_id = casesFilters.doctor_id;
        if (casesFilters.case_id) params.case_id = casesFilters.case_id;

        const res = await api.get('/hospital/cases', { params });
        setCases(res.data.cases || []);
        setTotalPages(Math.ceil((res.data.total || 0) / 10) || 1);
      } else if (activeTab === 'appointments') {
        const res = await api.get('/hospital/appointments');
        setAppointments(res.data || []);
      } else if (activeTab === 'wallet') {
        const w = await api.get('/default/myWallet');
        setWallet(w.data || { balance: 0 });

        const txParams = { page: transactionsPage, limit: 10 };
        if (transactionsFilters.type) txParams.type = transactionsFilters.type;
        if (transactionsFilters.doctor_name) txParams.doctor_name = transactionsFilters.doctor_name;
        if (transactionsFilters.date) txParams.date = transactionsFilters.date;

        try {
          const txRes = await api.get('/hospital/doctor-transactions', { params: txParams });
          setTransactions(txRes.data || []);
        } catch (err) {
          setTransactions([]);
        }
      } else if (activeTab === 'policy') {
        try {
          const res = await api.get('/hospital/policy');
          setPolicyUrl(res.data.url);
        } catch (err) { setPolicyUrl(''); }
      }
    } catch (err) { console.error('Load error:', err); }
  };

  const loadProfileData = async () => {
    try {
      const res = await api.get('/hospital/profile');
      setProfile(res.data);
      setEditProfile(res.data);
      if (res.data.charges) {
        setHospitalChargesInput(Math.round(res.data.charges * 100));
      } else {
        setHospitalChargesInput(0);
      }
    } catch (err) {
      console.error("Failed to load hospital profile", err);
    }
  };

  useEffect(() => {
    loadProfileData();
  }, []);

  useEffect(() => { loadData(); }, [
    activeTab, page, transactionsPage,
    transactionsFilters.type, transactionsFilters.doctor_name, transactionsFilters.date,
    usersFilters.status, usersFilters.user_name, usersFilters.doctor_name,
    casesFilters.status, casesFilters.from_date, casesFilters.to_date, casesFilters.doctor_id, casesFilters.case_id,
    doctorsFilters.speciality, doctorsFilters.name, doctorsFilters.availability
  ]);

  const updateProfile = async () => {
    try {
      await api.put('/hospital/profile', editProfile);
      showToast('Profile updated successfully');
      loadData();
    } catch (err) {
      showToast('Failed to update profile');
    }
  };

  const changePassword = async (e) => {
    e.preventDefault();
    if (!newPassword.trim()) return showToast('Please enter a new password');
    setUpdatingPassword(true);
    try {
      await api.put('/default/password', { password: newPassword });
      showToast('Password updated successfully!');
      setNewPassword('');
    } catch (err) {
      showToast(err.response?.data?.detail || 'Failed to update password');
    } finally {
      setUpdatingPassword(false);
    }
  };

  const handleUpdateCharges = async () => {
    if (hospitalChargesInput < 0 || hospitalChargesInput > 50) {
      return showToast('Commission must be between 0% and 50%');
    }
    try {
      await api.put('/hospital/charges', null, { params: { charges: hospitalChargesInput } });
      showToast('Commission rate updated successfully!');
      loadProfileData();
    } catch (err) {
      showToast(err.response?.data?.detail || 'Failed to update commission rate');
    }
  };

  const handleMergeWallet = async (doctorId) => {
    showConfirm(
      'Merge Wallets?',
      'Are you sure you want to merge this doctor\'s wallet with the hospital\'s merged wallet? This action will channel their earnings directly through the merged wallet.',
      async () => {
        try {
          await api.post(`/hospital/merge-account/${doctorId}`);
          showToast('Wallets merged successfully!');
          setConfirmDialog({ isOpen: false });
          setSelectedDoctorDetails(null);
        } catch (err) {
          showToast(err.response?.data?.detail || 'Failed to merge wallets');
          setConfirmDialog({ isOpen: false });
        }
      },
      'Merge Wallets',
      false
    );
  };

  useEffect(() => {
    if (!selectedDoctorDetails) {
      setSelectedDoctorBalance(null);
      return;
    }
    const fetchBalance = async () => {
      setLoadingDoctorBalance(true);
      try {
        const res = await api.get('/hospital/doctor-balance', { params: { doctor_name: selectedDoctorDetails.name } });
        const docData = res.data.data?.find(d => d.id === selectedDoctorDetails.id);
        setSelectedDoctorBalance(docData ? docData.balance : 0);
      } catch (err) {
        console.error(err);
        setSelectedDoctorBalance(0);
      } finally {
        setLoadingDoctorBalance(false);
      }
    };
    fetchBalance();
  }, [selectedDoctorDetails]);

  const createDoctor = async (e) => {
    e.preventDefault();
    try {
      await api.post('/hospital/doctor', newDoctor);
      showToast('Doctor created successfully');
      setNewDoctor({ name: '', email: '', password: '', phone_number: '' });
      loadData();
    } catch (err) {
      showToast(err.response?.data?.detail || 'Failed to create doctor');
    }
  };

  const updateAvailability = async (doctorId, avail) => {
    try {
      await api.put(`/hospital/availibility/${doctorId}`, null, { params: { availibility: avail } });
      showToast('Doctor availability updated');
      loadData();
      if (selectedDoctorDetails && selectedDoctorDetails.id === doctorId) {
        setSelectedDoctorDetails(prev => ({ ...prev, availability: avail }));
      }
    } catch (err) {
      showToast('Failed to update availability');
    }
  };

  const updateCaseLimit = async (doctorId, limit) => {
    try {
      await api.put(`/hospital/limit/${doctorId}`, null, { params: { limit } });
      showToast('Case limit updated');
      loadData();
      if (selectedDoctorDetails && selectedDoctorDetails.id === doctorId) {
        setSelectedDoctorDetails(prev => ({ ...prev, case_limit: limit }));
      }
    } catch (err) {
      showToast('Failed to update case limit');
    }
  };

  const deleteDoctor = async (doctorId) => {
    showConfirm(
      'Remove Doctor?',
      'Are you sure you want to remove this doctor from your hospital? This action cannot be undone.',
      async () => {
        try {
          await api.delete(`/hospital/doctor/${doctorId}`);
          showToast('Doctor removed successfully');
          setConfirmDialog({ isOpen: false });
          loadData();
        } catch (err) {
          showToast('Failed to remove doctor');
          setConfirmDialog({ isOpen: false });
        }
      },
      'Remove Doctor',
      true
    );
  };

  const handleTopUp = async () => {
    if (topUpAmount <= 0) return showToast('Enter an amount > 0');
    try {
      await api.put('/default/topUp', { amount: topUpAmount });
      showToast('Wallet topped up successfully!');
      setTopUpAmount(0);
      loadData();
    } catch (err) {
      showToast('Failed to top up wallet');
    }
  };

  const handlePolicyUpload = async (fileObj) => {
    if (!fileObj) return;
    const formData = new FormData();
    const isUpdate = !!policyUrl;

    if (isUpdate) {
      formData.append('file', fileObj);
    } else {
      formData.append('File', fileObj);
    }

    showToast(isUpdate ? 'Updating policy...' : 'Uploading policy...');
    try {
      if (isUpdate) {
        await api.put('/hospital/policy', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      } else {
        await api.post('/hospital/policy', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      }
      showToast('Policy document saved successfully!');
      loadData();
    } catch (err) {
      showToast(err.response?.data?.detail || 'Failed to upload policy document');
    }
  };

  const connectGoogle = () => {
    const token = sessionStorage.getItem('access_token');
    window.location.href = `http://localhost:8000/auth/google?token=${token}`;
  };

  const mapMarkers = [];
  if (profile.lat && profile.lon) mapMarkers.push({ lat: parseFloat(profile.lat), lon: parseFloat(profile.lon), label: profile.name || 'Hospital' });
  users.forEach(u => { if (u.lat && u.lon) mapMarkers.push({ lat: parseFloat(u.lat), lon: parseFloat(u.lon), label: u.user_name }); });



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
              <div
                key={c.id}
                className="flex justify-between items-center p-3 border border-slate-100 rounded-xl cursor-pointer hover:bg-slate-50 hover:border-slate-200 transition-all"
                onClick={() => viewCaseDetails(c.id)}
              >
                <div>
                  <p className="font-semibold text-slate-800">Patient: {c.user?.name || "Unknown"}</p>
                  <p className="text-xs text-slate-500">Dr. {c.doctor?.name || 'Unassigned'} • Case #{c.case_id || c.id}</p>
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
                  <p className="text-xs text-slate-500">{d.speciality || 'General'}</p>
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
    <div className="max-w-3xl space-y-6 animate-fade-in">
      <Card>
        <h2 className="text-2xl font-bold text-slate-800 mb-6 flex items-center gap-2"><Building2 className="text-indigo-600" /> Hospital Profile</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-6">
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-slate-700 mb-1">Hospital Name</label>
            <input value={editProfile.name || ''} onChange={e => setEditProfile({ ...editProfile, username: e.target.value })} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-indigo-500 transition-all outline-none" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
            <input value={editProfile.email || ''} onChange={e => setEditProfile({ ...editProfile, email: e.target.value })} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-indigo-500 transition-all outline-none" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Phone</label>
            <input value={editProfile.phone_number || ''} onChange={e => setEditProfile({ ...editProfile, phone_number: e.target.value })} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-indigo-500 transition-all outline-none" />
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-slate-700 mb-1">Address</label>
            <input value={editProfile.address || ''} onChange={e => setEditProfile({ ...editProfile, address: e.target.value })} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-indigo-500 transition-all outline-none" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">City</label>
            <input value={editProfile.city || ''} onChange={e => setEditProfile({ ...editProfile, city: e.target.value })} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-indigo-500 transition-all outline-none" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">State</label>
            <input value={editProfile.state || ''} onChange={e => setEditProfile({ ...editProfile, state: e.target.value })} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-indigo-500 transition-all outline-none" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">ZIP Code</label>
            <input value={editProfile.zip || ''} onChange={e => setEditProfile({ ...editProfile, zip: e.target.value })} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-indigo-500 transition-all outline-none" />
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

      <Card>
        <h2 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2"><Lock className="text-indigo-600" /> Change Password</h2>
        <form onSubmit={changePassword} className="space-y-4 max-w-md">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">New Password</label>
            <input
              type="password"
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              placeholder="Enter new password"
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-indigo-500 transition-all outline-none"
            />
          </div>
          <button
            type="submit"
            disabled={updatingPassword}
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-6 py-2 rounded-xl transition-all shadow-sm disabled:opacity-50"
          >
            {updatingPassword ? 'Updating...' : 'Update Password'}
          </button>
        </form>
      </Card>
    </div>
  );

  const renderDoctors = () => (
    <div className="animate-fade-in">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2"><UserPlus className="text-indigo-500" /> Manage Doctors</h2>
        <div className="flex flex-wrap gap-2 w-full md:w-auto">
          <select
            value={doctorsFilters.availability}
            onChange={e => { setDoctorsFilters({ ...doctorsFilters, availability: e.target.value }); setPage(1); }}
            className="bg-white border border-slate-200 px-3 py-2 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">All Statuses</option>
            <option value="true">Available</option>
            <option value="false">Unavailable</option>
          </select>
          <input
            type="text"
            placeholder="Specialty..."
            value={doctorsFilters.speciality}
            onChange={e => { setDoctorsFilters({ ...doctorsFilters, speciality: e.target.value }); setPage(1); }}
            className="bg-white border border-slate-200 px-3 py-2 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500 w-full md:w-40"
          />
          <input
            type="text"
            placeholder="Doctor Name..."
            value={doctorsFilters.name}
            onChange={e => { setDoctorsFilters({ ...doctorsFilters, name: e.target.value }); setPage(1); }}
            className="bg-white border border-slate-200 px-3 py-2 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500 w-full md:w-40"
          />
        </div>
      </div>

      <Card className="mb-8 border-indigo-100 bg-indigo-50/30">
        <h3 className="font-bold text-lg text-slate-800 mb-4">Add New Doctor</h3>
        <form onSubmit={createDoctor} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Name</label>
            <input placeholder="Dr. John Doe" value={newDoctor.name} onChange={e => setNewDoctor({ ...newDoctor, name: e.target.value })} className="w-full bg-white border border-slate-200 p-2.5 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
            <input type="email" placeholder="doctor@hospital.com" value={newDoctor.email} onChange={e => setNewDoctor({ ...newDoctor, email: e.target.value })} className="w-full bg-white border border-slate-200 p-2.5 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
            <input type="password" placeholder="Temporary password" value={newDoctor.password} onChange={e => setNewDoctor({ ...newDoctor, password: e.target.value })} className="w-full bg-white border border-slate-200 p-2.5 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Phone</label>
            <div className="flex gap-2">
              <input placeholder="+1234567890" value={newDoctor.phone_number} onChange={e => setNewDoctor({ ...newDoctor, phone_number: e.target.value })} className="w-full bg-white border border-slate-200 p-2.5 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none" required />
              <button type="submit" className="bg-indigo-600 text-white p-2.5 rounded-xl hover:bg-indigo-700 transition-colors shrink-0">
                <Plus size={20} />
              </button>
            </div>
          </div>
        </form>
      </Card>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {doctors.map(d => (
          <Card key={d.id} className="flex flex-col border-t-4 border-t-indigo-400 hover:border-t-indigo-600 transition-all">
            <div className="cursor-pointer flex-1" onClick={() => setSelectedDoctorDetails(d)}>
              <div className="flex justify-between items-start mb-3">
                <h3 className="font-bold text-lg text-slate-800 hover:text-indigo-600 hover:underline">Dr. {d.name}</h3>
                <span className={`px-2 py-1 text-xs font-bold rounded-md ${d.availability ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                  {d.availability ? 'Available' : 'Unavailable'}
                </span>
              </div>

              <div className="space-y-2 mb-4 text-sm">
                <p className="flex items-center gap-2 text-slate-600"><Mail size={14} /> {d.registered_email || d.email}</p>
                <p className="flex items-center gap-2 text-slate-600"><Star size={14} /> {d.speciality || 'General'}</p>
                {d.rating && <p className="flex items-center gap-2 text-slate-600"><Star className="fill-amber-400 text-amber-400" size={14} /> {d.rating} Rating</p>}
              </div>
            </div>

            <div className="flex items-center justify-between border-t border-slate-100 pt-4 mt-2">
              <button
                onClick={() => updateAvailability(d.id, !d.availability)}
                className={`px-3 py-1 text-xs font-bold rounded-xl transition-all ${d.availability ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-600 border border-slate-200'}`}
              >
                Toggle Status
              </button>
              <button onClick={() => deleteDoctor(d.id)} className="text-xs text-rose-500 hover:text-rose-700 font-bold">
                Remove
              </button>
            </div>
          </Card>
        ))}
        {doctors.length === 0 && <p className="text-slate-500 col-span-full text-center py-8">No doctors registered yet.</p>}
      </div>

      <div className="flex justify-center items-center gap-2 mt-8">
        {page > 1 && (
          <button onClick={() => setPage(page - 1)} className="px-3 py-2 rounded-xl font-medium bg-white text-slate-600 border border-slate-200 hover:bg-slate-50">Prev</button>
        )}
        <span className="px-4 py-2 bg-indigo-50 text-indigo-700 font-bold border border-indigo-100 rounded-xl text-xs">Page {page}</span>
        {doctors.length >= 12 && (
          <button onClick={() => setPage(page + 1)} className="px-3 py-2 rounded-xl font-medium bg-white text-slate-600 border border-slate-200 hover:bg-slate-50">Next</button>
        )}
      </div>
    </div>
  );

  const renderUsers = () => (
    <div className="animate-fade-in">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2"><Users className="text-emerald-500" /> Patient Analytics</h2>
        <div className="flex flex-wrap gap-2 w-full md:w-auto">
          <select
            value={usersFilters.status}
            onChange={e => { setUsersFilters({ ...usersFilters, status: e.target.value }); setPage(1); }}
            className="bg-white border border-slate-200 px-3 py-2 rounded-xl text-sm outline-none focus:ring-2 focus:ring-emerald-500"
          >
            <option value="">All Statuses</option>
            <option value="OPEN">Open</option>
            <option value="CLOSED">Closed</option>
          </select>
          <input
            type="text"
            placeholder="Search Patient Name..."
            value={usersFilters.user_name}
            onChange={e => { setUsersFilters({ ...usersFilters, user_name: e.target.value }); setPage(1); }}
            className="bg-white border border-slate-200 px-3 py-2 rounded-xl text-sm outline-none focus:ring-2 focus:ring-emerald-500 w-full md:w-44"
          />
          <input
            type="text"
            placeholder="Search Doctor Name..."
            value={usersFilters.doctor_name}
            onChange={e => { setUsersFilters({ ...usersFilters, doctor_name: e.target.value }); setPage(1); }}
            className="bg-white border border-slate-200 px-3 py-2 rounded-xl text-sm outline-none focus:ring-2 focus:ring-emerald-500 w-full md:w-44"
          />
        </div>
      </div>

      {mapMarkers.length > 0 && (
        <Card className="mb-8 p-2 h-[400px]">
          <div className="h-full rounded-xl overflow-hidden">
            <MapComponent markers={mapMarkers} />
          </div>
        </Card>
      )}

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {users.map(u => (
          <Card
            key={u.user_id}
            className="cursor-pointer hover:shadow-lg hover:border-slate-300 transition-all border border-slate-100"
            onClick={() => setSelectedUserDetails(u)}
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center text-slate-600 font-bold border border-slate-200">
                {u.user_name ? u.user_name.charAt(0).toUpperCase() : 'P'}
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
        {users.length === 0 && (
          <p className="text-slate-500 col-span-full text-center py-8">No patients found matching the criteria.</p>
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex justify-center space-x-2 mt-8">
          {[...Array(totalPages)].map((_, i) => (
            <button
              key={i}
              onClick={() => setPage(i + 1)}
              className={`w-10 h-10 rounded-xl font-medium transition-all ${page === i + 1
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-200'
                : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
                }`}
            >
              {i + 1}
            </button>
          ))}
        </div>
      )}
    </div>
  );

  const renderCases = () => (
    <div className="animate-fade-in">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2"><FileText className="text-blue-500" /> Hospital Cases</h2>
        <div className="flex flex-wrap gap-2 w-full md:w-auto">
          <select
            value={casesFilters.status}
            onChange={e => { setCasesFilters({ ...casesFilters, status: e.target.value }); setPage(1); }}
            className="bg-white border border-slate-200 px-3 py-2 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Statuses</option>
            <option value="OPEN">Open</option>
            <option value="CLOSED">Closed</option>
          </select>
          <select
            value={casesFilters.doctor_id}
            onChange={e => { setCasesFilters({ ...casesFilters, doctor_id: e.target.value }); setPage(1); }}
            className="bg-white border border-slate-200 px-3 py-2 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Doctors</option>
            {doctors.map(d => (
              <option key={d.id} value={d.id}>Dr. {d.name}</option>
            ))}
          </select>
          <input
            type="number"
            placeholder="Case ID..."
            value={casesFilters.case_id}
            onChange={e => { setCasesFilters({ ...casesFilters, case_id: e.target.value }); setPage(1); }}
            className="bg-white border border-slate-200 px-3 py-2 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500 w-24"
          />
          <div className="flex items-center gap-1.5 text-xs text-slate-500 bg-white border border-slate-200 px-3 py-2 rounded-xl">
            <span>From:</span>
            <input type="date" value={casesFilters.from_date} onChange={e => { setCasesFilters({ ...casesFilters, from_date: e.target.value }); setPage(1); }} className="outline-none text-slate-700 font-medium" />
            <span>To:</span>
            <input type="date" value={casesFilters.to_date} onChange={e => { setCasesFilters({ ...casesFilters, to_date: e.target.value }); setPage(1); }} className="outline-none text-slate-700 font-medium" />
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {cases.map(c => (
          <Card
            key={c.id}
            className="border-l-4 border-l-blue-500 cursor-pointer hover:shadow-lg hover:border-l-blue-600 transition-all"
            onClick={() => viewCaseDetails(c.id)}
          >
            <div className="flex flex-col md:flex-row justify-between items-start gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <h3 className="text-lg font-bold text-slate-800">Case #{c.case_id || c.id}</h3>
                  <StatusBadge status={c.status} />
                  {c.disease && <span className="text-sm bg-purple-50 text-purple-700 px-2 py-0.5 rounded-md border border-purple-100 font-medium">{c.disease}</span>}
                </div>

                <div className="grid grid-cols-2 gap-4 text-sm mb-3">
                  <div>
                    <p className="text-slate-500">Patient</p>
                    <p className="font-medium text-slate-800">{c.user?.name || "Unknown"}</p>
                  </div>
                  <div>
                    <p className="text-slate-500">Attending Doctor</p>
                    <p className="font-medium text-slate-800">{c.doctor?.name || 'Unassigned'}</p>
                  </div>
                </div>

                {c.symptoms?.length > 0 && (
                  <div className="mb-2">
                    <span className="text-xs text-slate-500">Recorded Symptoms: </span>
                    <span className="text-sm text-slate-700">{c.symptoms.map(s => s.name || s.symptom).join(', ')}</span>
                  </div>
                )}
              </div>

              <div className="bg-slate-50 rounded-xl p-3 text-sm w-full md:w-64 border border-slate-100 flex flex-col justify-between">
                <div>
                  <p className="font-bold text-slate-700 mb-2">Attached Documents</p>
                  <div className="space-y-1 mb-3">
                    <p className="text-slate-600 flex justify-between"><span>Patient:</span> <span>{c.documents?.user?.length || 0} files</span></p>
                    <p className="text-slate-600 flex justify-between"><span>Doctor:</span> <span>{c.documents?.doctor?.length || 0} files</span></p>
                  </div>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    viewCaseDetails(c.id);
                  }}
                  className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-white font-semibold rounded-xl transition-all text-xs flex items-center justify-center gap-1.5"
                >
                  <FileText size={13} /> Details
                </button>
              </div>
            </div>
          </Card>
        ))}
        {cases.length === 0 && <p className="text-slate-500 text-center py-8">No cases recorded yet.</p>}
      </div>
      <div className="flex justify-center space-x-2 mt-6">
        {[...Array(totalPages)].map((_, i) => (
          <button key={i} onClick={() => setPage(i + 1)} className={`w-10 h-10 rounded-xl font-medium transition-all ${page === i + 1 ? 'bg-blue-600 text-white shadow-md shadow-blue-200' : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'}`}>{i + 1}</button>
        ))}
      </div>
    </div>
  );

  const getTxTypeBadge = (type) => {
    const colors = {
      'TOP-UP': 'bg-emerald-100 text-emerald-700 border-emerald-200',
      'INCOMING': 'bg-green-100 text-green-700 border-green-200',
      'OUTGOING': 'bg-rose-100 text-rose-700 border-rose-200',
    };
    return (
      <span className={`px-2.5 py-1 text-xs font-semibold border rounded-full ${colors[type] || 'bg-slate-100 text-slate-700'}`}>
        {type}
      </span>
    );
  };

  const renderWallet = () => (
    <div className="max-w-7xl animate-fade-in space-y-6">
      <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2"><Wallet className="text-violet-500" /> Wallet & Transactions</h2>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="bg-gradient-to-br from-violet-600 to-indigo-700 text-white border-none shadow-lg shadow-violet-200 animate-slide-in p-6">
          <p className="text-violet-100 font-medium mb-2">Hospital Wallet Balance</p>
          <h3 className="text-5xl font-bold mb-6">₹{wallet.balance}</h3>

          <div className="bg-white/10 p-4 rounded-xl backdrop-blur-md">
            <p className="text-sm text-violet-100 mb-2 font-medium">Add Funds</p>
            <div className="flex gap-2">
              <input type="number" value={topUpAmount || ''} onChange={e => setTopUpAmount(parseInt(e.target.value))} placeholder="Amount in ₹" className="w-full bg-white/20 border border-white/30 text-white placeholder-violet-200 p-2.5 rounded-lg outline-none focus:bg-white/30 transition-colors" />
              <button onClick={handleTopUp} className="bg-white text-violet-700 font-bold px-6 rounded-lg hover:bg-violet-50 transition-colors">Top Up</button>
            </div>
          </div>
        </Card>

        {/* Commission Setting Card */}
        <Card className="bg-gradient-to-br from-slate-50 to-white flex flex-col justify-between p-6">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-slate-800">Hospital Platform Commission</h3>
              <span className="bg-indigo-100 text-indigo-700 px-3 py-1 rounded-full text-xs font-bold border border-indigo-200">
                Current: {profile.charges ? Math.round(profile.charges * 100) : 0}%
              </span>
            </div>
            <p className="text-xs text-slate-500 leading-relaxed mb-6">
              Set the percentage of consulting fees that the hospital retains from doctors' appointments. Maximum allowed commission limit is 50%.
            </p>
          </div>
          <div className="bg-white p-4 rounded-2xl border border-slate-100">
            <label className="block text-xs font-bold text-slate-700 mb-2 uppercase tracking-wide">Update Commission Rate (%)</label>
            <div className="flex gap-2">
              <input
                type="number"
                max={50}
                min={0}
                placeholder="E.g. 15"
                value={hospitalChargesInput ?? ''}
                onChange={(e) => setHospitalChargesInput(parseFloat(e.target.value))}
                className="w-full bg-slate-50 border border-slate-200 p-2.5 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 transition-colors"
              />
              <button
                onClick={handleUpdateCharges}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-6 py-2.5 rounded-xl transition-all shadow-sm shadow-indigo-100 whitespace-nowrap"
              >
                Set Rate
              </button>
            </div>
          </div>
        </Card>
      </div>

      {/* Transaction Ledger */}
      <Card className="p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h3 className="text-lg font-bold text-slate-800">Doctor Transaction Ledger</h3>
            <p className="text-xs text-slate-500">Overview of all consulting payouts and top-up transactions</p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <input
              type="text"
              placeholder="Filter by Doctor..."
              value={transactionsFilters.doctor_name}
              onChange={(e) => setTransactionsFilters({ ...transactionsFilters, doctor_name: e.target.value })}
              className="bg-slate-50 border border-slate-200 text-xs px-3 py-2 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <select
              value={transactionsFilters.type}
              onChange={(e) => setTransactionsFilters({ ...transactionsFilters, type: e.target.value })}
              className="bg-slate-50 border border-slate-200 text-xs px-3 py-2 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">All Types</option>
              <option value="INCOMING">INCOMING</option>
              <option value="OUTGOING">OUTGOING</option>
              <option value="TOP-UP">TOP-UP</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm text-slate-500">
            <thead className="bg-slate-50 text-xs font-bold text-slate-700 uppercase tracking-wider">
              <tr>
                <th className="px-6 py-4">Transaction ID</th>
                <th className="px-6 py-4">Date</th>
                <th className="px-6 py-4">Doctor</th>
                <th className="px-6 py-4">Type</th>
                <th className="px-6 py-4">Notes / Details</th>
                <th className="px-6 py-4 text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 border-t border-slate-100">
              {transactions.map((tx) => (
                <tr key={tx.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="px-6 py-4 font-mono text-xs text-slate-600">#{tx.id}</td>
                  <td className="px-6 py-4 whitespace-nowrap">{new Date(tx.date).toLocaleDateString()} {new Date(tx.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                  <td className="px-6 py-4 font-semibold text-slate-800">{tx.doctor ? `Dr. ${tx.doctor}` : 'N/A'}</td>
                  <td className="px-6 py-4">{getTxTypeBadge(tx.type)}</td>
                  <td className="px-6 py-4 text-slate-700 font-medium max-w-xs truncate">{tx.note || 'N/A'}</td>
                  <td className={`px-6 py-4 text-right font-bold text-base ${tx.type === 'OUTGOING' ? 'text-rose-600' : 'text-emerald-600'}`}>
                    {tx.type === 'OUTGOING' ? '-' : '+'}₹{tx.amount}
                  </td>
                </tr>
              ))}
              {transactions.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-slate-400">No transactions matched your search criteria.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {transactions.length > 0 && (
          <div className="flex justify-between items-center mt-6 border-t border-slate-100 pt-4">
            <button
              disabled={transactionsPage === 1}
              onClick={() => setTransactionsPage(prev => Math.max(prev - 1, 1))}
              className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-semibold hover:bg-slate-50 transition-colors disabled:opacity-50"
            >
              Previous
            </button>
            <span className="text-xs text-slate-500 font-medium">Page {transactionsPage}</span>
            <button
              disabled={transactions.length < 10}
              onClick={() => setTransactionsPage(prev => prev + 1)}
              className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-semibold hover:bg-slate-50 transition-colors disabled:opacity-50"
            >
              Next
            </button>
          </div>
        )}
      </Card>
    </div>
  );

  const renderPolicy = () => {
    return (
      <div className="max-w-3xl animate-fade-in space-y-6">
        <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
          <Shield className="text-emerald-500" /> Hospital Policy
        </h2>

        {policyUrl ? (
          <Card className="border-emerald-200 bg-emerald-50/20">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-emerald-100 text-emerald-600 rounded-2xl"><FileText size={24} /></div>
                <div>
                  <h3 className="font-bold text-slate-800">Active Hospital Policy</h3>
                  <p className="text-sm text-slate-500">Currently active and visible to all doctors and patients.</p>
                </div>
              </div>
              <button
                onClick={() => setDocumentViewer({ isOpen: true, url: policyUrl, filename: 'Hospital Policy.pdf' })}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium px-6 py-2.5 rounded-xl transition-colors shadow-sm shadow-emerald-100"
              >
                View Policy
              </button>
            </div>
          </Card>
        ) : (
          <Card className="border-amber-100 bg-amber-50/20 p-6 flex items-center gap-4">
            <div className="p-3 bg-amber-100 text-amber-600 rounded-2xl"><Shield size={24} /></div>
            <div>
              <h3 className="font-bold text-slate-800">No Policy Document</h3>
              <p className="text-sm text-slate-500">Please upload a policy document for your hospital to make it available to doctors and patients.</p>
            </div>
          </Card>
        )}

        <Card>
          <h3 className="font-bold text-slate-800 mb-2">{policyUrl ? 'Replace Policy Document' : 'Upload Policy Document'}</h3>
          <p className="text-sm text-slate-600 mb-6">PDF, JPG, or PNG document outlining hospital guidelines and conditions.</p>

          <div className="relative border-2 border-dashed border-slate-300 rounded-2xl p-8 text-center hover:bg-slate-50 transition-colors cursor-pointer">
            <input
              type="file"
              onChange={(e) => {
                if (e.target.files?.[0]) handlePolicyUpload(e.target.files[0]);
              }}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              accept="image/jpeg,image/png,image/gif,image/webp,application/pdf"
            />
            <div className="flex flex-col items-center gap-3 text-slate-500">
              <Upload size={36} className="text-indigo-500 animate-bounce" />
              <span className="font-bold text-slate-700">Click to choose or drag & drop file</span>
              <span className="text-xs text-slate-400">PDF, JPG, PNG up to 10MB</span>
            </div>
          </div>
        </Card>
      </div>
    );
  };

  const renderAppointments = () => (
    <div className="animate-fade-in space-y-6">
      <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2"><Calendar className="text-indigo-500" /> Hospital Appointments</h2>

      <div className="overflow-x-auto bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
        <table className="w-full border-collapse text-left text-sm text-slate-500">
          <thead className="bg-slate-50 text-xs font-bold text-slate-700 uppercase tracking-wider">
            <tr>
              <th className="px-6 py-4">Appointment ID</th>
              <th className="px-6 py-4">Date</th>
              <th className="px-6 py-4">Time</th>
              <th className="px-6 py-4">Patient</th>
              <th className="px-6 py-4">Attending Doctor</th>
              <th className="px-6 py-4">Disease / Reason</th>
              <th className="px-6 py-4 text-center">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 border-t border-slate-100">
            {appointments.map((app) => (
              <tr key={app.id} className="hover:bg-slate-50/80 transition-colors">
                <td className="px-6 py-4 font-mono text-xs text-slate-600">#{app.id}</td>
                <td className="px-6 py-4 whitespace-nowrap">{new Date(app.date).toLocaleDateString()}</td>
                <td className="px-6 py-4 font-semibold text-slate-700">{app.time || 'N/A'}</td>
                <td className="px-6 py-4 text-slate-900 font-bold">{app.user_info?.[0] || 'Unknown'}</td>
                <td className="px-6 py-4 text-slate-700 font-semibold">Dr. {app.doctor_info?.[0] || 'Unassigned'}</td>
                <td className="px-6 py-4 text-purple-700 font-medium">{app.diesease || 'General Practioner'}</td>
                <td className="px-6 py-4 text-center">
                  <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${app.status === 'APPROVED' ? 'bg-emerald-100 text-emerald-700 border-emerald-200' :
                    app.status === 'PENDING' ? 'bg-amber-100 text-amber-700 border-amber-200' :
                      'bg-slate-100 text-slate-700 border-slate-200'
                    }`}>
                    {app.status}
                  </span>
                </td>
              </tr>
            ))}
            {appointments.length === 0 && (
              <tr>
                <td colSpan={7} className="text-center py-12 text-slate-400">No scheduled appointments found for this hospital.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderChat = () => (
    <div className="h-[calc(100vh-120px)] animate-fade-in">
      <ChatPanel
        user={authUser}
        onShowToast={showToast}
        onOpenDocumentViewer={(url, name) => setDocumentViewer({ isOpen: true, url, filename: name })}
        onSeeDoctorInfo={(doc) => setSelectedDoctorDetails(doc)}
        preSelectedDoctorId={preSelectedDoctorId}
        clearPreSelectedDoctor={() => setPreSelectedDoctorId(null)}
      />
    </div>
  );

  const tabs = [
    { id: 'overview', name: 'Overview', icon: LayoutDashboard },
    { id: 'appointments', name: 'Appointments', icon: Calendar },
    { id: 'doctors', name: 'Doctors', icon: UserPlus },
    { id: 'users', name: 'Patients', icon: Users },
    { id: 'cases', name: 'Cases', icon: FileText },
    { id: 'wallet', name: 'Wallet', icon: Wallet },
    { id: 'policy', name: 'Policy', icon: Shield },
    { id: 'chat', name: 'Chat', icon: MessageCircle },
    { id: 'profile', name: 'Profile', icon: Building2 },
  ];

  return (
    <div className="flex h-screen bg-slate-50 font-sans overflow-hidden">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50">
          <div className="bg-slate-800 text-white px-6 py-3 rounded-full shadow-2xl flex items-center gap-2 animate-bounce">
            <CheckCircle2 className="text-emerald-400" size={18} />
            {toastMessage}
          </div>
        </div>
      )}

      {/* Confirmation Dialog Modal */}
      {confirmDialog.isOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex justify-center items-center z-[150] p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full">
            <h3 className="text-xl font-bold text-slate-800 mb-2">{confirmDialog.title}</h3>
            <p className="text-slate-600 mb-6">{confirmDialog.message}</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setConfirmDialog({ isOpen: false })} className="px-4 py-2 bg-slate-100 rounded-xl">Cancel</button>
              <button onClick={confirmDialog.onConfirm} className={`px-4 py-2 text-white rounded-xl ${confirmDialog.isDestructive ? 'bg-rose-500 hover:bg-rose-600' : 'bg-indigo-600 hover:bg-indigo-700'}`}>{confirmDialog.confirmText}</button>
            </div>
          </div>
        </div>
      )}

      {/* Sidebar */}
      <div className="w-72 bg-slate-900 text-slate-300 flex flex-col border-r border-slate-800 hidden md:flex z-10 shadow-2xl">
        <Link to="/" className="p-6 border-b border-slate-800 flex items-center gap-3 hover:opacity-85 active:scale-95 transition-all">
          <div className="bg-indigo-600 p-2 rounded-xl text-white"><Building2 size={24} /></div>
          <h1 className="text-xl font-bold text-white tracking-tight">HealthifAI</h1>
        </Link>
        <div className="flex-1 overflow-y-auto py-6 px-4 space-y-1 custom-scrollbar">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button key={tab.id} onClick={() => { setActiveTab(tab.id); setPage(1); }}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 font-medium ${isActive ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/50' : 'hover:bg-slate-800 hover:text-white'
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
            {activeTab === 'chat' && renderChat()}
            {activeTab === 'appointments' && renderAppointments()}
          </div>
        </main>
      </div>

      {/* Selected Doctor Info Popup Modal */}
      {selectedDoctorDetails && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex justify-center items-center z-[100] p-4 animate-fade-in" onClick={() => setSelectedDoctorDetails(null)}>
          <div className="bg-white rounded-3xl w-full max-w-md p-6 shadow-2xl relative" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-start mb-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-indigo-100 text-indigo-600 rounded-2xl flex items-center justify-center font-bold text-lg">
                  {selectedDoctorDetails.name ? selectedDoctorDetails.name.charAt(0).toUpperCase() : 'D'}
                </div>
                <div>
                  <h3 className="text-xl font-bold text-slate-800">Dr. {selectedDoctorDetails.name}</h3>
                  <p className="text-sm text-indigo-600 font-semibold">{selectedDoctorDetails.speciality || 'General Practitioner'}</p>
                </div>
              </div>
              <button onClick={() => setSelectedDoctorDetails(null)} className="p-2 text-slate-400 hover:text-slate-600 bg-slate-100 rounded-full transition-colors">
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4 bg-slate-50 p-4 rounded-2xl border border-slate-100 text-sm mb-6">
              <div className="flex justify-between items-center py-2 border-b border-slate-200/50">
                <span className="text-slate-500 font-medium">Email:</span>
                <span className="text-slate-800 font-semibold">{selectedDoctorDetails.registered_email || selectedDoctorDetails.email}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-slate-200/50">
                <span className="text-slate-500 font-medium">Availability:</span>
                <button
                  onClick={() => updateAvailability(selectedDoctorDetails.id, !selectedDoctorDetails.availability)}
                  className={`px-3 py-1 rounded-xl text-xs font-bold border transition-all ${selectedDoctorDetails.availability
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                    : 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100'
                    }`}
                >
                  {selectedDoctorDetails.availability ? 'Available (Toggle)' : 'Unavailable (Toggle)'}
                </button>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-slate-200/50">
                <span className="text-slate-500 font-medium">Case Limit:</span>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={selectedDoctorDetails.case_limit ?? 0}
                    onChange={(e) => setSelectedDoctorDetails({ ...selectedDoctorDetails, case_limit: parseInt(e.target.value) || 0 })}
                    onBlur={(e) => updateCaseLimit(selectedDoctorDetails.id, parseInt(e.target.value) || 0)}
                    className="w-16 p-1 text-sm bg-white border border-slate-200 rounded outline-none font-bold text-slate-800 text-center focus:ring-2 focus:ring-indigo-500"
                  />
                  <span className="text-slate-400 text-xs">cases</span>
                </div>
              </div>
              <div className="flex justify-between items-center py-2">
                <span className="text-slate-500 font-medium">Wallet Balance:</span>
                {loadingDoctorBalance ? (
                  <span className="text-xs text-slate-400 animate-pulse">Loading balance...</span>
                ) : (
                  <span className="text-slate-800 font-extrabold text-indigo-600">₹{selectedDoctorBalance ?? 0}</span>
                )}
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <button
                onClick={() => {
                  setPreSelectedDoctorId(selectedDoctorDetails.id);
                  setActiveTab('chat');
                  setSelectedDoctorDetails(null);
                }}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 rounded-xl transition-all shadow-sm flex items-center justify-center gap-2"
              >
                <MessageCircle size={18} /> Chat with Doctor
              </button>

              <button
                onClick={() => {
                  handleMergeWallet(selectedDoctorDetails.id);
                }}
                className="w-full bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 text-emerald-700 font-semibold py-3 rounded-xl transition-all flex items-center justify-center gap-2"
              >
                <Wallet size={18} /> Merge Wallet Accounts
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Case Details Popup Modal */}
      {showCaseModal && (
        <div
          onClick={(e) => { if (e.target === e.currentTarget) setShowCaseModal(false); }}
          className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-[300] p-4 cursor-pointer"
        >
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col overflow-hidden animate-fade-in cursor-default">
            {modalLoading ? (
              <div className="p-12 flex flex-col items-center justify-center gap-3">
                <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                <p className="text-slate-400 text-sm">Loading case details...</p>
              </div>
            ) : selectedCase ? (
              <>
                <div className="p-5 border-b border-slate-100 flex justify-between items-start shrink-0">
                  <div>
                    <h2 className="text-xl font-extrabold text-slate-800">Case #{selectedCase.case_id || selectedCase.id}</h2>
                    <div className="flex flex-wrap items-center gap-2 mt-1.5">
                      <span className={`px-2.5 py-0.5 text-xs font-bold rounded-full ${selectedCase.status === 'OPEN' ? 'bg-emerald-100 text-emerald-700' :
                        selectedCase.status === 'CLOSED' ? 'bg-slate-100 text-slate-600' :
                          'bg-amber-100 text-amber-700'
                        }`}>{selectedCase.status}</span>
                      {selectedCase.disease && (
                        <span className="px-2.5 py-0.5 text-xs font-bold rounded-full bg-purple-100 text-purple-700">{selectedCase.disease}</span>
                      )}
                      {selectedCase.case_opened_on && (
                        <span className="text-xs text-slate-400">{new Date(selectedCase.case_opened_on).toLocaleDateString()}</span>
                      )}
                    </div>
                  </div>
                  <button onClick={() => setShowCaseModal(false)} className="p-2 text-slate-400 hover:text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-full transition-all shrink-0">
                    <X size={18} />
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto p-5 space-y-5">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-slate-50 rounded-xl p-3">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Patient</p>
                      <p className="font-semibold text-slate-800 text-sm">{selectedCase.user?.name || "Unknown"}</p>
                      <p className="text-xs text-slate-500">{selectedCase.user?.email || ""}</p>
                    </div>
                    <div className="bg-blue-50 rounded-xl p-3">
                      <p className="text-[10px] font-bold text-blue-600 uppercase tracking-wider mb-1">Attending Doctor</p>
                      <p className="font-semibold text-slate-800 text-sm">Dr. {selectedCase.doctor?.name || 'Unassigned'}</p>
                      <p className="text-xs text-slate-500">{selectedCase.doctor?.email || ""}</p>
                    </div>
                  </div>

                  {selectedCase.symptoms?.length > 0 && (
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Symptoms</p>
                      <div className="flex flex-wrap gap-2">
                        {selectedCase.symptoms.map((s, i) => (
                          <span key={i} className="px-3 py-1 bg-rose-50 text-rose-700 text-xs font-semibold rounded-full border border-rose-100">
                            {s.name || s.symptom || s}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Documents</p>
                    <div className="space-y-2">
                      {(selectedCase.documents?.user || []).map((d, i) => (
                        <div key={`u-${i}`} className="flex items-center gap-2 bg-blue-50 rounded-xl p-2.5 text-sm">
                          <FileText size={14} className="text-blue-600 shrink-0" />
                          <button
                            onClick={() => setDocumentViewer({ isOpen: true, url: d.url, filename: `${selectedCase.user?.name || 'Patient'} Document.pdf` })}
                            className="text-slate-700 flex-1 truncate text-left hover:text-blue-600 hover:underline"
                          >
                            {d.type}
                          </button>
                          <span className="text-[10px] bg-blue-200 text-blue-800 px-1.5 py-0.5 rounded font-bold">Patient</span>
                        </div>
                      ))}
                      {(selectedCase.documents?.doctor || []).map((d, i) => (
                        <div key={`d-${i}`} className="flex items-center gap-2 bg-emerald-50 rounded-xl p-2.5 text-sm">
                          <FileText size={14} className="text-emerald-600 shrink-0" />
                          <button
                            onClick={() => setDocumentViewer({ isOpen: true, url: d.url, filename: `Dr. ${selectedCase.doctor?.name || 'Doctor'} Document.pdf` })}
                            className="text-slate-700 flex-1 truncate text-left hover:text-emerald-600 hover:underline"
                          >
                            {d.type}
                          </button>
                          <span className="text-[10px] bg-emerald-200 text-emerald-800 px-1.5 py-0.5 rounded font-bold">Doctor</span>
                        </div>
                      ))}
                      {(!selectedCase.documents?.user?.length && !selectedCase.documents?.doctor?.length) && (
                        <p className="text-slate-400 text-sm italic">No documents attached yet</p>
                      )}
                    </div>
                  </div>
                </div>
              </>
            ) : null}
          </div>
        </div>
      )}

      {/* Patient/User Details Popup Modal */}
      {selectedUserDetails && (
        <div
          onClick={(e) => { if (e.target === e.currentTarget) setSelectedUserDetails(null); }}
          className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-[300] p-4 cursor-pointer"
        >
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-6 relative cursor-default animate-fade-in" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-start mb-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center font-bold text-lg">
                  {selectedUserDetails.user_name ? selectedUserDetails.user_name.charAt(0).toUpperCase() : 'P'}
                </div>
                <div>
                  <h3 className="text-xl font-bold text-slate-800">{selectedUserDetails.user_name}</h3>
                  <p className="text-xs text-slate-500">{selectedUserDetails.user_email}</p>
                </div>
              </div>
              <button onClick={() => setSelectedUserDetails(null)} className="p-2 text-slate-400 hover:text-slate-600 bg-slate-100 rounded-full transition-colors">
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4 bg-slate-50 p-4 rounded-2xl border border-slate-100 text-sm mb-6">
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Associated Case</p>
                <p className="font-semibold text-slate-800 text-sm">Case #{selectedUserDetails.case_id}</p>
                <div className="flex items-center gap-2 mt-1">
                  <StatusBadge status={selectedUserDetails.case_status} />
                  {selectedUserDetails.case_disease && (
                    <span className="px-2 py-0.5 text-xs font-semibold bg-purple-50 text-purple-700 border border-purple-100 rounded-md">
                      {selectedUserDetails.case_disease}
                    </span>
                  )}
                </div>
              </div>

              <div className="pt-3 border-t border-slate-200/50">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Attending Doctor</p>
                <p className="font-semibold text-slate-800 text-sm">Dr. {selectedUserDetails.doctor_name || 'None Assigned'}</p>
                {selectedUserDetails.doctor_email && (
                  <p className="text-xs text-slate-500 mt-0.5">{selectedUserDetails.doctor_email} • {selectedUserDetails.doctor_speciality || 'General Practitioner'}</p>
                )}
              </div>

              {(selectedUserDetails.lat || selectedUserDetails.lon) && (
                <div className="pt-3 border-t border-slate-200/50">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Location Coordinates</p>
                  <p className="font-medium text-slate-700 flex items-center gap-1 text-xs">
                    <MapPin size={12} className="text-slate-400" /> Lat: {selectedUserDetails.lat}, Lon: {selectedUserDetails.lon}
                  </p>
                </div>
              )}
            </div>

            <div className="flex flex-col gap-3">
              <button
                onClick={() => handleSeeCase(selectedUserDetails.case)}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-xl transition-all shadow-sm flex items-center justify-center gap-2"
              >
                <FileText size={18} /> See Case Details
              </button>

              <button
                onClick={() => {
                  if (!selectedUserDetails.doctor_id) {
                    showToast('No doctor assigned to this patient case');
                    return;
                  }
                  handleChatWithDoctor(selectedUserDetails.doctor_id);
                }}
                disabled={!selectedUserDetails.doctor_id}
                className="w-full bg-indigo-50 border border-indigo-200 hover:bg-indigo-100 text-indigo-700 font-semibold py-3 rounded-xl transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <MessageCircle size={18} /> Chat with Doctor
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Premium Document Viewer Modal */}
      {documentViewer.isOpen && (
        <DocumentViewerModal
          url={documentViewer.url}
          filename={documentViewer.filename}
          onClose={() => setDocumentViewer({ isOpen: false, url: '', filename: '' })}
        />
      )}
    </div>
  );
};

export default HospitalDashboard;