import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import NotificationBell from '../components/NotificationBell';
import DocumentUploader from '../components/DocumentUploader';
import { useAuth } from '../context/AuthContext';
import {
  LayoutDashboard, User, FileText, Calendar, Users,
  Wallet, File, Building2, DollarSign, X,
  LogOut, Activity, ChevronRight, CheckCircle2, Clock,
  Search, Plus, Download, MessageCircle, Send, Paperclip, Edit2, Lock
} from 'lucide-react';

// ============================================
// COMMON COMPONENTS (shared with UserDashboard)
// ============================================
const StatusBadge = ({ status }) => {
  const colors = {
    OPEN: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    CLOSED: 'bg-slate-100 text-slate-700 border-slate-200',
    CONFIRMED: 'bg-blue-100 text-blue-700 border-blue-200',
    PENDING: 'bg-amber-100 text-amber-700 border-amber-200',
    CANCELLED: 'bg-red-100 text-red-700 border-red-200',
    COMPLETED: 'bg-indigo-100 text-indigo-700 border-indigo-200',
    REQUESTED_BY_USER: 'bg-purple-100 text-purple-700 border-purple-200',
    REQUESTED_BY_DOCTOR: 'bg-orange-100 text-orange-700 border-orange-200'
  };
  return (
    <span className={`px-2.5 py-1 text-xs font-semibold border rounded-full ${colors[status] || 'bg-gray-100 text-gray-700'}`}>
      {status}
    </span>
  );
};

const Card = ({ children, className = '', ...props }) => (
  <div className={`bg-white rounded-2xl border border-slate-100 shadow-sm p-6 transition-all duration-300 hover:shadow-md ${className}`} {...props}>
    {children}
  </div>
);

// ============================================
// DOCUMENT VIEWER MODAL (reused from UserDashboard)
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
        const type = res.headers.get('content-type');
        if (type?.startsWith('image/')) setContentType('image');
        else if (type?.includes('pdf')) setContentType('pdf');
        else setContentType('other');
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
      <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex justify-center items-center z-[110] p-4">
        <div className="bg-white rounded-3xl p-8 w-full max-w-4xl text-center shadow-2xl">Loading document preview...</div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex justify-center items-center z-[110] p-4">
        <div className="bg-white rounded-3xl p-8 w-full max-w-4xl text-center shadow-2xl">
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
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex justify-center items-center z-[110] p-4 animate-fade-in">
      <div className="bg-white rounded-3xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl relative">
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
const ChatPanel = ({ user, onShowToast, onOpenDocumentViewer }) => {
  const [activeTab, setActiveTab] = useState('patients'); // 'patients' or 'hospital'
  const [assignedPatients, setAssignedPatients] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [hospitalInfo, setHospitalInfo] = useState(null);
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
      const patientsRes = await api.get('/doctor/assigned-users/', { params: { limit: 100 } });
      setAssignedPatients(patientsRes.data || []);
      
      const roomsRes = await chatApiCall('get', '/chat/rooms');
      setRooms(roomsRes.data.rooms || []);
      
      const availableRes = await chatApiCall('get', '/chat/doctors/available');
      if (availableRes.data.hospital) {
        setHospitalInfo(availableRes.data.hospital);
      }
      
      if (roomsRes.data.rooms?.length > 0) {
        const initialRoom = roomsRes.data.rooms.find(r => r.chat_type === 'user_doctor') || roomsRes.data.rooms[0];
        setSelectedRoom(initialRoom);
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

  const createOrGetRoom = async (patientId) => {
    try {
      onShowToast('Only patients can start new conversations. Please ask your patient to send the first message.');
      return null;
    } catch (err) {
      onShowToast('Could not start conversation');
      return null;
    }
  };

  const startHospitalChat = async () => {
    try {
      const res = await chatApiCall('post', '/chat/room/hospital');
      onShowToast('Chat room created with hospital!');
      
      // Refresh
      const roomsRes = await chatApiCall('get', '/chat/rooms');
      setRooms(roomsRes.data.rooms || []);
      
      const newRoom = roomsRes.data.rooms.find(r => r.chat_type === 'doctor_hospital');
      if (newRoom) {
        setSelectedRoom(newRoom);
      }
      
      const availableRes = await chatApiCall('get', '/chat/doctors/available');
      if (availableRes.data.hospital) {
        setHospitalInfo(availableRes.data.hospital);
      }
    } catch (err) {
      console.error(err);
      onShowToast('Failed to start chat with hospital');
    }
  };

  useEffect(() => {
    if (!selectedRoom) return;
    const loadMessages = async () => {
      try {
        const res = await chatApiCall('get', `/chat/messages/${selectedRoom.id}`, null, { limit: 100 });
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
    socket.onopen = () => socket.send(JSON.stringify({ type: 'join_room', room_id: selectedRoom.id }));
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
            ? { ...room, is_user_online: msg.is_online, is_hospital_online: msg.is_online, is_doctor_online: msg.is_online }
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
        message: inputMessage,
        message_type: 'text'
      }));
      setInputMessage('');
    }
  };

  const getPartnerName = (room) => {
    if (!room) return '';
    if (room.chat_type === 'doctor_hospital') {
      return room.hospital_name || 'Hospital';
    }
    return user.type === 'user' ? room.doctor_name : room.user_name;
  };

  if (loadingRooms) return <div className="flex justify-center items-center h-full text-slate-500">Loading conversations...</div>;

  return (
    <div className="flex h-full bg-white rounded-2xl overflow-hidden border border-slate-200 shadow-sm min-h-[500px]">
      <div className="w-80 border-r border-slate-200 bg-slate-50 flex flex-col">
        <div className="p-4 border-b border-slate-200 bg-white">
          <h2 className="font-bold text-slate-800">Messages</h2>
          <div className="flex bg-slate-100 p-1 rounded-xl mt-3">
            <button
              onClick={() => setActiveTab('patients')}
              className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all ${activeTab === 'patients' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
            >
              Patients
            </button>
            <button
              onClick={() => setActiveTab('hospital')}
              className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all ${activeTab === 'hospital' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
            >
              Hospital
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {activeTab === 'patients' ? (
            assignedPatients.length === 0 ? (
              <div className="p-4 text-center text-slate-500 text-sm">No assigned patients yet.</div>
            ) : (
              assignedPatients.map(patient => {
                const existingRoom = rooms.find(r => r.user_id === patient.user_id && r.chat_type === 'user_doctor');
                const isSelected = selectedRoom?.user_id === patient.user_id && selectedRoom?.chat_type === 'user_doctor';
                const isOnline = existingRoom ? existingRoom.is_user_online : false;
                return (
                  <div
                    key={patient.user_id}
                    onClick={() => { if (existingRoom) setSelectedRoom(existingRoom); else createOrGetRoom(patient.user_id); }}
                    className={`p-4 border-b border-slate-100 cursor-pointer hover:bg-slate-100 transition-colors ${isSelected ? 'bg-blue-50 border-l-4 border-l-blue-500' : ''}`}
                  >
                    <div className="flex justify-between items-center">
                      <div className="font-semibold text-slate-800">{patient.username}</div>
                      <div className={`w-2 h-2 rounded-full ${isOnline ? 'bg-green-500' : 'bg-gray-400'}`}></div>
                    </div>
                    <div className="text-xs text-slate-500 mt-1">Case #{patient.case_id}</div>
                    {existingRoom?.last_message && <div className="text-xs text-slate-400 mt-1 truncate">{existingRoom.last_message}</div>}
                  </div>
                );
              })
            )
          ) : (
            !hospitalInfo ? (
              <div className="p-4 text-center text-slate-500 text-sm">No hospital assigned.</div>
            ) : (
              <div
                onClick={() => {
                  const hospRoom = rooms.find(r => r.chat_type === 'doctor_hospital');
                  if (hospRoom) {
                    setSelectedRoom(hospRoom);
                  }
                }}
                className={`p-4 border-b border-slate-100 cursor-pointer hover:bg-slate-100 transition-colors ${selectedRoom?.chat_type === 'doctor_hospital' ? 'bg-blue-50 border-l-4 border-l-blue-500' : ''}`}
              >
                <div className="flex justify-between items-center">
                  <div className="font-semibold text-slate-800">{hospitalInfo.name}</div>
                  <div className={`w-2 h-2 rounded-full ${hospitalInfo.is_online ? 'bg-green-500' : 'bg-gray-400'}`}></div>
                </div>
                <div className="text-xs text-slate-500 mt-1">Direct communication channel</div>
                {rooms.find(r => r.chat_type === 'doctor_hospital')?.last_message && (
                  <div className="text-xs text-slate-400 mt-1 truncate">
                    {rooms.find(r => r.chat_type === 'doctor_hospital').last_message}
                  </div>
                )}
                {!hospitalInfo.has_active_chat && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      startHospitalChat();
                    }}
                    className="mt-3 w-full bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold py-2 px-3 rounded-lg transition-colors"
                  >
                    Start Chat Room
                  </button>
                )}
              </div>
            )
          )}
        </div>
      </div>

      {selectedRoom ? (
        <div className="flex-1 flex flex-col">
          <div className="p-4 border-b border-slate-200 bg-white">
            <h3 className="font-bold text-slate-800">{getPartnerName(selectedRoom)}</h3>
            <div className="flex items-center gap-1 mt-1">
              <div className={`w-2 h-2 rounded-full ${
                selectedRoom.chat_type === 'doctor_hospital'
                  ? (selectedRoom.is_hospital_online ? 'bg-green-500' : 'bg-gray-400')
                  : (selectedRoom.is_user_online ? 'bg-green-500' : 'bg-gray-400')
              }`}></div>
              <p className="text-xs text-slate-500">
                {selectedRoom.chat_type === 'doctor_hospital'
                  ? (selectedRoom.is_hospital_online ? 'Online' : 'Offline')
                  : (selectedRoom.is_user_online ? 'Online' : 'Offline')}
              </p>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50">
            {messages.map((msg, idx) => {
              const isSent = msg.sender_id === user.id && msg.sender_type === user.type;
              const fileUrl = msg.file_url;
              const fileName = msg.file_name || (msg.message_type === 'image' ? 'image.jpg' : 'file.pdf');
              return (
                <div key={idx} className={`flex ${isSent ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[70%] rounded-2xl px-4 py-2 ${isSent ? 'bg-blue-600 text-white' : 'bg-white border border-slate-200 text-slate-800'}`}>
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
            <div className="px-4 py-2 bg-blue-50 border-t border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm text-blue-800">
                <File size={16} className="text-blue-600" />
                <span className="font-semibold">{selectedFile.name}</span>
                <span className="text-xs bg-blue-200 px-2 py-0.5 rounded-full text-blue-900 font-bold">{docType}</span>
              </div>
              <button onClick={() => { setSelectedFile(null); setDocType(''); if (fileInputRef.current) fileInputRef.current.value = ''; }} className="p-1 hover:bg-blue-100 rounded-full text-blue-600"><X size={16} /></button>
            </div>
          )}
          <div className="p-4 border-t border-slate-200 bg-white flex gap-2">
            <input type="text" value={inputMessage} onChange={e => setInputMessage(e.target.value)} onKeyPress={e => e.key === 'Enter' && sendMessage()} placeholder="Type a message..." className="flex-1 border border-slate-200 rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
            <label className="p-2 rounded-xl bg-slate-100 cursor-pointer hover:bg-slate-200">
              <Paperclip size={20} className="text-slate-600" />
              <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileChange} accept="image/jpeg,image/png,image/gif,image/webp,application/pdf" />
            </label>
            <button onClick={sendMessage} className="bg-blue-600 text-white px-4 py-2 rounded-xl hover:bg-blue-700"><Send size={18} /></button>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center text-slate-400">Select a contact to start chatting</div>
      )}

      {showDocTypeModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex justify-center items-center z-[150] p-4">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-slate-800">Name Your Attachment</h3>
              <button onClick={() => { setShowDocTypeModal(false); setSelectedFile(null); if (fileInputRef.current) fileInputRef.current.value = ''; }} className="p-1.5 text-slate-400 hover:text-slate-600 bg-slate-100 rounded-full"><X size={16} /></button>
            </div>
            <p className="text-sm text-slate-500 mb-4">Provide a name/type for your document (e.g. X-Ray, Prescription)</p>
            <input type="text" placeholder="E.g. X-Ray" value={docType} onChange={(e) => setDocType(e.target.value)} className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none mb-6" autoFocus />
            <div className="flex justify-end gap-3">
              <button onClick={() => { setShowDocTypeModal(false); setSelectedFile(null); }} className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl">Cancel</button>
              <button onClick={() => { if (!docType.trim()) { onShowToast('Please provide a document name'); return; } setShowDocTypeModal(false); }} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl">Confirm</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ============================================
// MAIN DOCTOR DASHBOARD
// ============================================
const DoctorDashboard = () => {
  const { logout, user: authUser } = useAuth();
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
  const [allDocuments, setAllDocuments] = useState([]);
  const [wallet, setWallet] = useState({ balance: 0 });
  const [topUpAmount, setTopUpAmount] = useState(0);
  const [selectedCase, setSelectedCase] = useState(null);
  const [caseSymptoms, setCaseSymptoms] = useState([]);
  const [caseUserDocs, setCaseUserDocs] = useState([]);
  const [caseDoctorDocs, setCaseDoctorDocs] = useState([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [caseSearch, setCaseSearch] = useState('');
  const [toastMessage, setToastMessage] = useState('');
  const [confirmDialog, setConfirmDialog] = useState({ isOpen: false, title: '', message: '', onConfirm: null, isDestructive: true, confirmText: 'Confirm' });
  const [documentViewer, setDocumentViewer] = useState({ isOpen: false, url: '', filename: '' });
  const [filters, setFilters] = useState({ doctor_name: '', hospital_name: '', specialty: '' });
  const [editingTransaction, setEditingTransaction] = useState(null);
  const [editNote, setEditNote] = useState('');
  const [transactionFilters, setTransactionFilters] = useState({ type: '', date: '' });
  const [caseFilters, setCaseFilters] = useState({ status: '', from_date: '', to_date: '' });
  const [caseDocUpload, setCaseDocUpload] = useState({ file: null, type: '', isOpen: false });
  const caseDocInputRef = useRef(null);

  const showToast = (msg) => { setToastMessage(msg); setTimeout(() => setToastMessage(''), 3000); };
  const showConfirm = (title, message, onConfirm, confirmText = 'Delete', isDestructive = true) => {
    setConfirmDialog({ isOpen: true, title, message, onConfirm, confirmText, isDestructive });
  };

  const loadData = async () => {
    try {
      if (activeTab === 'overview') {
        const casesRes = await api.get('/doctor/cases', { params: { page: 1, limit: 5 } });
        const aptsRes = await api.get('/doctor/appointment/', { params: { limit: 5 } });
        const walletRes = await api.get('/default/myWallet');
        setCases(casesRes.data.cases || []);
        setAppointments(aptsRes.data.appointments || []);
        setWallet(walletRes.data || { balance: 0 });
      } else if (activeTab === 'profile') {
        const res = await api.get('/doctor/profile');
        setProfile(res.data);
        setEditProfile({ username: res.data.name, email: res.data.email, specialty: res.data.specialty, availability: res.data.availability });
      } else if (activeTab === 'cases') {
        const params = { page, limit: 20 };
        if (caseFilters.status) params.status = caseFilters.status;
        if (caseFilters.from_date) params.from_date = caseFilters.from_date;
        if (caseFilters.to_date) params.to_date = caseFilters.to_date;
        const res = await api.get('/doctor/cases', { params });
        setCases(res.data.cases || []);
        setTotalPages(Math.ceil((res.data.total || 0) / 20) || 1);
      } else if (activeTab === 'appointments') {
        const res = await api.get('/doctor/appointment/', { params: { page, limit: 20 } });
        setAppointments(res.data.appointments || []);
      } else if (activeTab === 'assignedUsers') {
        const res = await api.get('/doctor/assigned-users/', { params: { limit: 100 } });
        setAssignedUsers(res.data || []);
      } else if (activeTab === 'fees') {
        const res = await api.get('/doctor/fees');
        setFees(res.data || { fees: 0, appointment_fees: 0 });
      } else if (activeTab === 'hospital') {
        const res = await api.get('/doctor/hospital');
        setHospital(res.data || {});
      } else if (activeTab === 'transactions') {
        const res = await api.get('/doctor/transactions/', { params: { page, limit: 20, type: transactionFilters.type || undefined, date: transactionFilters.date || undefined } });
        setTransactions(res.data || []);
      } else if (activeTab === 'documents') {
        const res = await api.get('/default/documents', { params: { limit: 20, offset: 0 } });
        setDocuments(res.data || []);
        setAllDocuments(res.data || []);
      } else if (activeTab === 'wallet') {
        const w = await api.get('/default/myWallet');
        setWallet(w.data || { balance: 0 });
        const t = await api.get('/doctor/transactions/', { params: { page: 1, limit: 20 } });
        setTransactions(t.data || []);
      }
    } catch (err) { console.error(err); showToast('Failed to load data'); }
  };

  useEffect(() => { loadData(); }, [activeTab, page, transactionFilters.type, transactionFilters.date, caseFilters.status, caseFilters.from_date, caseFilters.to_date]);

  const updateProfile = async () => {
    try {
      await api.put('/doctor/profile', editProfile);
      showToast('Profile updated successfully');
      loadData();
    } catch (err) { showToast('Failed to update profile'); }
  };

  const updateFees = async () => {
    try {
      await api.put('/doctor/fees', fees);
      showToast('Fees updated successfully');
      loadData();
    } catch (err) { showToast('Failed to update fees'); }
  };

  const changePassword = async () => {
    const newPassword = prompt('Enter new password');
    if (!newPassword) return;
    try {
      await api.put('/default/password', { password: newPassword });
      showToast('Password changed successfully');
    } catch (err) { showToast('Failed to change password'); }
  };

  const handleTopUp = async () => {
    if (topUpAmount <= 0) return showToast('Enter a valid amount');
    try {
      await api.put('/default/topUp', { amount: topUpAmount });
      showToast('Wallet topped up successfully');
      setTopUpAmount(0);
      loadData();
    } catch (err) { showToast('Top-up failed'); }
  };

  const updateTransactionNote = async (tId) => {
    try {
      await api.put('/doctor/transactions', null, { params: { transaction_id: tId, note: editNote } });
      showToast('Note updated');
      setEditingTransaction(null);
      loadData();
    } catch (err) { showToast('Failed to update note'); }
  };

  const closeCase = async (caseId) => {
    try {
      await api.put(`/doctor/cases/${caseId}`);
      showToast('Case closure requested');
      loadData();
    } catch (err) { showToast('Failed to close case'); }
  };

  const viewCaseDetails = async (caseId) => {
    try {
      const res = await api.get('/doctor/cases', { params: { case_id: caseId } });
      const caseData = res.data.cases?.[0];
      if (!caseData) throw new Error('Case not found');
      setSelectedCase(caseData);
      setCaseUserDocs(caseData.documents?.user || []);
      setCaseDoctorDocs(caseData.documents?.doctor || []);
      setCaseSymptoms(caseData.symptoms || []);
    } catch (err) { console.error(err); showToast('Error loading case details'); }
  };

  const removeSymptomFromCase = async (caseId, symptomId) => {
    showConfirm('Remove Symptom', 'Remove this symptom from the case?', async () => {
      setConfirmDialog({ isOpen: false });
      try {
        await api.delete(`/user/cases/symptom/${caseId}/${symptomId}`);
        showToast('Symptom removed');
        if (selectedCase) viewCaseDetails(caseId);
        loadData();
      } catch (err) { showToast('Failed to remove symptom'); }
    });
  };

  const handleCaseDocUpload = async () => {
    if (!caseDocUpload.file || !caseDocUpload.type.trim() || !selectedCase) {
      showToast('Please provide a file and a document name');
      return;
    }
    const formData = new FormData();
    formData.append('document', caseDocUpload.file);
    try {
      await api.post(`/default/documents?type=${caseDocUpload.type}&case_id=${selectedCase.id}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      showToast('Document uploaded to case');
      setCaseDocUpload({ file: null, type: '', isOpen: false });
      viewCaseDetails(selectedCase.id);
      loadData();
    } catch (err) {
      showToast('Failed to upload document');
    }
  };

  const removeDocumentFromCase = async (caseId, docId) => {
    showConfirm('Remove Document', 'Remove this document from the case?', async () => {
      setConfirmDialog({ isOpen: false });
      try {
        await api.delete(`/doctor/cases/document?case_id=${caseId}&document_id=${docId}`);
        showToast('Document removed');
        if (selectedCase) viewCaseDetails(caseId);
        loadData();
      } catch (err) { showToast('Failed to remove document'); }
    });
  };

  const cancelAppointment = async (appointmentId) => {
    showConfirm('Cancel Appointment', 'Cancel this appointment?', async () => {
      setConfirmDialog({ isOpen: false });
      try {
        await api.delete('/doctor/appointment/', { params: { appointment_id: appointmentId } });
        showToast('Appointment cancelled');
        loadData();
      } catch (err) { showToast('Failed to cancel appointment'); }
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
        showConfirm('Document Attached to Cases', 'This document is attached to cases. Force delete?', () => deleteDocument(docId, true), 'Force Delete', true);
      } else { showToast('Failed to delete document'); }
    }
  };

  const handleDeleteDocumentRequest = (docId) => {
    showConfirm('Delete Document', 'Are you sure you want to delete this document?', () => { setConfirmDialog({ isOpen: false }); deleteDocument(docId, false); });
  };

  const openDocumentViewer = (url, filename) => { setDocumentViewer({ isOpen: true, url, filename }); };

  // ============================================
  // RENDER FUNCTIONS
  // ============================================
  const renderOverview = () => (
    <div className="space-y-6 animate-fade-in">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="bg-gradient-to-br from-blue-50 to-white">
          <div className="flex items-center justify-between">
            <div><p className="text-sm font-medium text-blue-600 mb-1">Active Cases</p><h3 className="text-4xl font-bold text-slate-800">{cases.filter(c => c.status === 'OPEN').length}</h3></div>
            <div className="p-3 bg-blue-100 rounded-xl text-blue-600"><Activity size={24} /></div>
          </div>
        </Card>
        <Card className="bg-gradient-to-br from-emerald-50 to-white">
          <div className="flex items-center justify-between">
            <div><p className="text-sm font-medium text-emerald-600 mb-1">Today's Appointments</p><h3 className="text-4xl font-bold text-slate-800">{appointments.filter(a => new Date(a.date).toDateString() === new Date().toDateString()).length}</h3></div>
            <div className="p-3 bg-emerald-100 rounded-xl text-emerald-600"><Calendar size={24} /></div>
          </div>
        </Card>
        <Card className="bg-gradient-to-br from-violet-50 to-white">
          <div className="flex items-center justify-between">
            <div><p className="text-sm font-medium text-violet-600 mb-1">Wallet Balance</p><h3 className="text-4xl font-bold text-slate-800">₹{wallet.balance}</h3></div>
            <div className="p-3 bg-violet-100 rounded-xl text-violet-600"><Wallet size={24} /></div>
          </div>
        </Card>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <div className="flex justify-between items-center mb-4"><h3 className="text-lg font-bold text-slate-800">Recent Cases</h3><button onClick={() => setActiveTab('cases')} className="text-sm text-blue-600 hover:text-blue-800">View all <ChevronRight size={16}/></button></div>
          {cases.slice(0,3).map(c => (
            <div key={c.id} className="py-3 border-b border-slate-100 last:border-0 flex justify-between items-center">
              <div><p className="font-semibold text-slate-800">Patient: {c.user_name || 'Unknown'}</p><p className="text-sm text-slate-500">Case #{c.case_id}</p></div>
              <StatusBadge status={c.status} />
            </div>
          ))}
          {cases.length === 0 && <p className="text-slate-500 text-sm">No active cases.</p>}
        </Card>
        <Card>
          <div className="flex justify-between items-center mb-4"><h3 className="text-lg font-bold text-slate-800">Upcoming Appointments</h3><button onClick={() => setActiveTab('appointments')} className="text-sm text-blue-600 hover:text-blue-800">View all <ChevronRight size={16}/></button></div>
          {appointments.slice(0,3).map(a => (
            <div key={a.id} className="py-3 border-b border-slate-100 last:border-0 flex justify-between items-center">
              <div><p className="font-semibold text-slate-800">{a.username}</p><p className="text-sm text-slate-500 flex items-center gap-1"><Clock size={14}/> {new Date(a.date).toLocaleString()}</p></div>
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
      <Card><h2 className="text-2xl font-bold text-slate-800 mb-6 flex items-center gap-2"><User className="text-blue-600" /> My Profile</h2>
        <div className="space-y-4">
          <div><label className="block text-sm font-medium text-slate-700 mb-1">Full Name</label><input value={editProfile.username} onChange={e => setEditProfile({...editProfile, username: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-blue-500 outline-none" /></div>
          <div><label className="block text-sm font-medium text-slate-700 mb-1">Email Address</label><input value={editProfile.email} onChange={e => setEditProfile({...editProfile, email: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-blue-500 outline-none" /></div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="block text-sm font-medium text-slate-700 mb-1">Specialty</label><input value={editProfile.specialty} onChange={e => setEditProfile({...editProfile, specialty: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5" /></div>
            <div><label className="block text-sm font-medium text-slate-700 mb-1">Availability</label><input value={editProfile.availability} onChange={e => setEditProfile({...editProfile, availability: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5" /></div>
          </div>
          <div className="pt-2"><button onClick={updateProfile} className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 rounded-xl w-full">Save Changes</button></div>
        </div>
      </Card>
      <Card><h2 className="text-2xl font-bold text-slate-800 mb-6 flex items-center gap-2"><Lock className="text-amber-500" /> Change Password</h2>
        <div className="space-y-4"><button onClick={changePassword} className="w-full bg-amber-500 hover:bg-amber-600 text-white font-medium py-2.5 rounded-xl">Update Password</button></div>
      </Card>
    </div>
  );

  const renderCases = () => {
    const filteredCases = cases.filter(c => c.case_id.toString().includes(caseSearch) || (c.user_name && c.user_name.toLowerCase().includes(caseSearch.toLowerCase())));
    return (
      <div className="animate-fade-in">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
          <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2"><FileText className="text-blue-600" /> My Cases</h2>
          <div className="flex flex-wrap gap-2 w-full md:w-auto items-center">
            <select value={caseFilters.status} onChange={e => setCaseFilters({...caseFilters, status: e.target.value})} className="bg-white border border-slate-200 px-3 py-2 rounded-xl text-sm outline-none cursor-pointer">
              <option value="">All Statuses</option>
              <option value="OPEN">Open</option>
              <option value="CLOSED">Closed</option>
              <option value="REQUESTED_BY_DOCTOR">Requested by Me</option>
              <option value="REQUESTED_BY_USER">Requested by Patient</option>
            </select>
            <input type="date" value={caseFilters.from_date} onChange={e => setCaseFilters({...caseFilters, from_date: e.target.value})} className="bg-white border border-slate-200 px-3 py-2 rounded-xl text-sm outline-none cursor-pointer" title="From Date" />
            <input type="date" value={caseFilters.to_date} onChange={e => setCaseFilters({...caseFilters, to_date: e.target.value})} className="bg-white border border-slate-200 px-3 py-2 rounded-xl text-sm outline-none cursor-pointer" title="To Date" />
            <div className="relative flex-1 min-w-[150px] md:w-48"><Search className="absolute left-3 top-2.5 text-slate-400" size={18} /><input placeholder="Search patient..." value={caseSearch} onChange={e => setCaseSearch(e.target.value)} className="w-full bg-white border border-slate-200 pl-10 pr-4 py-2 rounded-xl text-sm outline-none" /></div>
          </div>
        </div>
        <div className="space-y-4">
          {filteredCases.map(c => (
            <Card key={c.id} className="border-l-4 border-l-blue-500">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div className="space-y-2">
                  <div className="flex items-center gap-3"><h3 className="text-lg font-bold text-slate-800">Case #{c.case_id}</h3><StatusBadge status={c.status} /></div>
                  <div className="grid grid-cols-2 gap-x-8 gap-y-1 text-sm text-slate-600">
                    <p><span className="font-medium">Patient:</span> {c.user_name || 'Unknown'}</p>
                    <p><span className="font-medium">Opened:</span> {new Date(c.case_opened_on).toLocaleDateString()}</p>
                  </div>
                  {c.symptoms?.length > 0 && <div className="flex flex-wrap gap-1"><span className="text-xs font-medium text-slate-500">Symptoms:</span>{c.symptoms.map(s => <span key={s.id} className="text-xs bg-slate-100 px-2 py-0.5 rounded">{s.name}</span>)}</div>}
                </div>
                <div className="flex gap-2 w-full md:w-auto">
                  {c.status === 'OPEN' && <button onClick={() => closeCase(c.id)} className="px-4 py-2 bg-rose-50 text-rose-600 font-medium rounded-xl hover:bg-rose-100">Close Case</button>}
                  <button onClick={() => viewCaseDetails(c.id)} className="px-4 py-2 bg-slate-800 text-white font-medium rounded-xl hover:bg-slate-700">Details</button>
                </div>
              </div>
            </Card>
          ))}
          {filteredCases.length === 0 && <p className="text-slate-500 text-center py-8">No cases found.</p>}
          <div className="flex justify-center gap-2 pt-4"><button disabled={page===1} onClick={()=>setPage(p=>p-1)} className="px-4 py-2 bg-white border rounded-xl disabled:opacity-50">Previous</button><span className="px-4 py-2">{page} / {totalPages}</span><button disabled={page>=totalPages} onClick={()=>setPage(p=>p+1)} className="px-4 py-2 bg-white border rounded-xl disabled:opacity-50">Next</button></div>
        </div>
      </div>
    );
  };

  const renderCaseModal = () => {
    if (!selectedCase) return null;
    const getSeverityColor = (severity) => {
      if (severity >= 8) return 'bg-red-100 text-red-700 border-red-200';
      if (severity >= 5) return 'bg-orange-100 text-orange-700 border-orange-200';
      if (severity >= 3) return 'bg-yellow-100 text-yellow-700 border-yellow-200';
      return 'bg-green-100 text-green-700 border-green-200';
    };
    return (
      <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex justify-center items-center z-50 p-4 animate-fade-in">
        <div className="bg-white rounded-3xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl relative">
          <div className="flex justify-between items-start p-6 border-b border-slate-200">
            <div><h2 className="text-2xl font-bold text-slate-800">Case #{selectedCase.case_id}</h2><div className="flex flex-wrap gap-2 mt-2"><StatusBadge status={selectedCase.status} /><span className="px-3 py-1 bg-slate-100 rounded-full text-sm">Patient: {selectedCase.user_name}</span><span className="px-3 py-1 bg-slate-100 rounded-full text-sm">Opened: {new Date(selectedCase.case_opened_on).toLocaleDateString()}</span></div></div>
            <button onClick={() => setSelectedCase(null)} className="p-2 bg-slate-100 rounded-full"><X size={20} /></button>
          </div>
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            <div className="grid md:grid-cols-2 gap-6">
              <div><h3 className="font-bold text-lg mb-3 flex items-center gap-2"><Activity className="text-rose-500" size={20}/> Symptoms</h3>
                <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                  <ul className="space-y-2 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
                    {caseSymptoms.map(s => (<li key={s.id} className="flex justify-between items-center bg-white p-3 rounded-xl border border-slate-100 shadow-sm group"><div><span className="font-medium text-slate-800">{s.name}</span></div></li>))}
                    {caseSymptoms.length===0 && <p className="text-sm italic text-slate-500 text-center py-4">No symptoms recorded.</p>}
                  </ul>
                </div>
              </div>
              <div><h3 className="font-bold text-lg mb-3 flex items-center gap-2"><FileText className="text-blue-500" size={20}/> Documents</h3>
                <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 space-y-4">
                  <div><h4 className="text-sm font-semibold mb-2 text-slate-600">From Patient</h4><ul className="space-y-2">{caseUserDocs.map(d=><li key={d.id} className="flex items-center justify-between bg-blue-50 p-2.5 rounded-xl group"><button onClick={()=>openDocumentViewer(d.url,d.type)} className="flex items-center gap-2 text-sm text-blue-700 font-medium"><File size={14}/> {d.type}</button></li>)} {caseUserDocs.length===0 && <p className="text-xs italic text-slate-500">None</p>}</ul></div>
                  <div><h4 className="text-sm font-semibold mb-2 text-slate-600">From Me</h4><ul className="space-y-2">{caseDoctorDocs.map(d=><li key={d.id} className="flex items-center justify-between bg-emerald-50 p-2.5 rounded-xl group"><button onClick={()=>openDocumentViewer(d.url,d.type)} className="flex items-center gap-2 text-sm text-emerald-700 font-medium"><File size={14}/> {d.type}</button><button onClick={()=>removeDocumentFromCase(selectedCase.id,d.id)} className="text-emerald-400 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-opacity bg-white p-1 rounded-full"><X size={14}/></button></li>)} {caseDoctorDocs.length===0 && <p className="text-xs italic text-slate-500">None</p>}</ul></div>
                  <div className="pt-3 border-t border-slate-200/60 flex justify-end">
                    <input type="file" ref={caseDocInputRef} className="hidden" accept="image/jpeg,image/png,image/webp,application/pdf" onChange={e => { if (e.target.files?.[0]) setCaseDocUpload({ ...caseDocUpload, file: e.target.files[0], isOpen: true }); e.target.value = ''; }} />
                    <button onClick={() => caseDocInputRef.current?.click()} className="bg-blue-600 text-white px-4 py-2.5 rounded-xl flex items-center gap-2 text-sm font-bold hover:bg-blue-700 transition-colors shadow-sm"><Plus size={16}/> Upload File</button>
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
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {appointments.map(a => (
          <Card key={a.id} className="relative overflow-hidden group">
            <div className={`absolute top-0 left-0 w-1 h-full ${a.status==='CONFIRMED'?'bg-blue-500':a.status==='PENDING'?'bg-amber-400':a.status==='COMPLETED'?'bg-emerald-500':'bg-red-400'}`}></div>
            <div className="pl-3">
              <div className="flex justify-between items-start mb-2"><StatusBadge status={a.status} /><button onClick={()=>cancelAppointment(a.id)} className="text-xs text-rose-500 font-medium opacity-0 group-hover:opacity-100 transition-opacity">Cancel</button></div>
              <h3 className="font-bold text-slate-800">{a.username}</h3>
              <p className="text-slate-500 text-sm flex items-center gap-1 mt-1"><Clock size={14}/> {new Date(a.date).toLocaleString()}</p>
              {a.case_number && <p className="text-slate-400 text-xs mt-2">Case #{a.case_number}</p>}
            </div>
          </Card>
        ))}
        {appointments.length===0 && <p className="text-slate-500 col-span-full text-center">No appointments scheduled.</p>}
      </div>
    </div>
  );

  const renderAssignedUsers = () => (
    <div className="animate-fade-in">
      <h2 className="text-2xl font-bold text-slate-800 mb-6 flex items-center gap-2"><Users className="text-indigo-500" /> Assigned Patients</h2>
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {assignedUsers.map(u => (
          <Card key={u.user_id} className="border-t-4 border-t-indigo-500">
            <h3 className="font-bold text-lg text-slate-800">{u.username}</h3>
            <p className="text-slate-600 text-sm mt-1">Active Case #{u.case_id}</p>
            <p className="text-slate-500 text-xs mt-2">Opened: {new Date(u.case_opened_at).toLocaleDateString()}</p>
          </Card>
        ))}
        {assignedUsers.length===0 && <p className="text-slate-500 col-span-full text-center">No assigned patients.</p>}
      </div>
    </div>
  );

  const renderFees = () => (
    <div className="max-w-xl animate-fade-in">
      <Card><h2 className="text-2xl font-bold text-slate-800 mb-6 flex items-center gap-2"><DollarSign className="text-emerald-500" /> Fee Management</h2>
        <div className="space-y-5">
          <div><label className="block text-sm font-medium text-slate-700 mb-1">Consultation Fee (₹)</label><input type="number" value={fees.fees} onChange={e=>setFees({...fees, fees: parseInt(e.target.value)})} className="w-full bg-slate-50 border p-3 rounded-xl" /></div>
          <div><label className="block text-sm font-medium text-slate-700 mb-1">Appointment Fee (₹)</label><input type="number" value={fees.appointment_fees} onChange={e=>setFees({...fees, appointment_fees: parseInt(e.target.value)})} className="w-full bg-slate-50 border p-3 rounded-xl" /></div>
          <button onClick={updateFees} className="bg-emerald-600 text-white px-6 py-2.5 rounded-xl">Update Fees</button>
        </div>
      </Card>
    </div>
  );

  const renderHospital = () => (
    <div className="max-w-2xl animate-fade-in">
      <Card><h2 className="text-2xl font-bold text-slate-800 mb-6 flex items-center gap-2"><Building2 className="text-indigo-500" /> My Hospital</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div><p className="text-sm text-slate-500">Hospital Name</p><p className="font-semibold">{hospital.name || 'N/A'}</p></div>
          <div><p className="text-sm text-slate-500">Email</p><p className="font-semibold">{hospital.email || 'N/A'}</p></div>
          <div><p className="text-sm text-slate-500">Phone</p><p className="font-semibold">{hospital.phone || 'N/A'}</p></div>
          <div><p className="text-sm text-slate-500">Address</p><p className="font-semibold">{hospital.address}, {hospital.city}, {hospital.state} - {hospital.zip}</p></div>
        </div>
      </Card>
    </div>
  );

  const renderWallet = () => (
    <div className="max-w-4xl animate-fade-in">
      <h2 className="text-2xl font-bold text-slate-800 mb-6 flex items-center gap-2"><Wallet className="text-violet-500" /> Wallet & Transactions</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card className="bg-gradient-to-br from-violet-600 to-indigo-700 text-white md:col-span-1 border-none shadow-violet-200">
          <p className="text-violet-100 font-medium mb-2">Available Balance</p>
          <h3 className="text-5xl font-bold mb-6">₹{wallet.balance}</h3>
          <div className="bg-white/10 p-4 rounded-xl backdrop-blur-md">
            <p className="text-sm text-violet-100 mb-2">Quick Top-Up</p>
            <div className="flex gap-2"><input type="number" value={topUpAmount} onChange={e=>setTopUpAmount(parseInt(e.target.value))} placeholder="Amount" className="w-full bg-white/20 border border-white/30 text-white placeholder-violet-200 p-2.5 rounded-lg" /><button onClick={handleTopUp} className="bg-white text-violet-700 font-bold px-4 rounded-lg">Add</button></div>
          </div>
        </Card>
        <Card className="md:col-span-2 overflow-auto max-h-[400px]">
          <div className="flex justify-between items-center mb-4"><h3 className="font-bold text-slate-800">Transactions</h3><div className="flex gap-2"><select value={transactionFilters.type} onChange={e=>setTransactionFilters({...transactionFilters, type: e.target.value})} className="text-sm border rounded-lg p-1"><option value="">All</option><option value="CREDIT">Credit</option><option value="DEBIT">Debit</option></select><input type="date" onChange={e=>setTransactionFilters({...transactionFilters, date: e.target.value})} className="text-sm border rounded-lg p-1" /></div></div>
          <div className="space-y-3">
            {transactions.map(t => (
              <div key={t.id} className="flex justify-between items-center p-3 rounded-xl hover:bg-slate-50 border border-transparent hover:border-slate-100">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${t.type.toLowerCase().includes('credit')?'bg-emerald-100 text-emerald-600':'bg-rose-100 text-rose-600'}`}><DollarSign size={18}/></div>
                  <div>{editingTransaction===t.id ? <div className="flex gap-2"><input value={editNote} onChange={e=>setEditNote(e.target.value)} className="border rounded px-2 py-0.5 text-sm" autoFocus /><button onClick={()=>updateTransactionNote(t.id)} className="text-xs bg-blue-600 text-white px-2 py-0.5 rounded">Save</button><button onClick={()=>setEditingTransaction(null)} className="text-xs bg-slate-200 px-2 py-0.5 rounded">Cancel</button></div> : <><p className="font-semibold text-sm">{t.note || t.type}</p><p className="text-xs text-slate-500">{new Date(t.date).toLocaleString()}</p></>}</div>
                </div>
                <span className={`font-bold ${t.type.toLowerCase().includes('credit')?'text-emerald-600':'text-slate-800'}`}>{t.type.toLowerCase().includes('credit')?'+':'-'}₹{t.amount}</span>
                {editingTransaction!==t.id && <button onClick={()=>{setEditingTransaction(t.id); setEditNote(t.note||'')}} className="opacity-0 group-hover:opacity-100 text-slate-400"><Edit2 size={14}/></button>}
              </div>
            ))}
            {transactions.length===0 && <p className="text-slate-500 text-center py-8">No transactions.</p>}
          </div>
        </Card>
      </div>
    </div>
  );

  const renderDocuments = () => (
    <div className="animate-fade-in max-w-5xl">
      <h2 className="text-2xl font-bold text-slate-800 mb-6 flex items-center gap-2"><File className="text-blue-500" /> My Documents</h2>
      <div className="grid md:grid-cols-3 gap-6">
        <div className="md:col-span-1"><DocumentUploader onUploadComplete={loadData} /></div>
        <div className="md:col-span-2"><Card><h3 className="font-bold text-lg mb-4">Stored Documents</h3><div className="grid grid-cols-1 sm:grid-cols-2 gap-4">{documents.map(d=>(<div key={d.document_id || d.id} className="relative group bg-slate-50 p-4 rounded-2xl hover:border-blue-300 hover:shadow-md transition-all flex items-start gap-4"><div onClick={()=>openDocumentViewer(d.document_url || d.url, d.document_type || d.type)} className="flex items-start gap-4 flex-1 cursor-pointer"><div className="p-3 bg-white text-blue-500 rounded-xl shadow-sm group-hover:bg-blue-500 group-hover:text-white transition-colors"><FileText size={24}/></div><div><p className="font-semibold">{d.document_type || d.type}</p><p className="text-xs text-slate-500 mt-1">{d.date}</p></div></div><button onClick={()=>handleDeleteDocumentRequest(d.document_id || d.id)} className="p-2 text-slate-400 hover:text-rose-500 bg-white rounded-full opacity-0 group-hover:opacity-100 absolute right-2 top-2 shadow-sm"><X size={16}/></button></div>))}{documents.length===0 && <p className="text-slate-500 col-span-full py-8 text-center">No documents uploaded yet.</p>}</div></Card></div>
      </div>
    </div>
  );

  const renderChat = () => (
    <div className="h-[calc(100vh-120px)]">
      <ChatPanel user={authUser} onShowToast={showToast} onOpenDocumentViewer={openDocumentViewer} />
    </div>
  );

  const tabs = [
    { id: 'overview', name: 'Overview', icon: LayoutDashboard },
    { id: 'cases', name: 'My Cases', icon: FileText },
    { id: 'appointments', name: 'Appointments', icon: Calendar },
    { id: 'assignedUsers', name: 'Assigned Patients', icon: Users },
    { id: 'fees', name: 'Fee Settings', icon: DollarSign },
    { id: 'hospital', name: 'My Hospital', icon: Building2 },
    { id: 'documents', name: 'Documents', icon: File },
    { id: 'wallet', name: 'Wallet & Transactions', icon: Wallet },
    { id: 'chat', name: 'Chat', icon: MessageCircle },
    { id: 'profile', name: 'Profile', icon: User },
  ];

  return (
    <div className="flex h-screen bg-slate-50 font-sans overflow-hidden">
      {toastMessage && (<div className="fixed top-6 left-1/2 -translate-x-1/2 z-50"><div className="bg-slate-800 text-white px-6 py-3 rounded-full shadow-2xl flex items-center gap-2"><CheckCircle2 className="text-emerald-400" size={18}/> {toastMessage}</div></div>)}
      {confirmDialog.isOpen && (<div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex justify-center items-center z-[100] p-4"><div className="bg-white rounded-2xl p-6 max-w-sm w-full"><h3 className="text-xl font-bold text-slate-800 mb-2">{confirmDialog.title}</h3><p className="text-slate-600 mb-6">{confirmDialog.message}</p><div className="flex justify-end gap-3"><button onClick={()=>setConfirmDialog({isOpen:false})} className="px-4 py-2 bg-slate-100 rounded-xl">Cancel</button><button onClick={confirmDialog.onConfirm} className={`px-4 py-2 text-white rounded-xl ${confirmDialog.isDestructive?'bg-rose-500 hover:bg-rose-600':'bg-blue-600 hover:bg-blue-700'}`}>{confirmDialog.confirmText}</button></div></div></div>)}

      <div className="w-72 bg-slate-900 text-slate-300 flex flex-col border-r border-slate-800 hidden md:flex z-10 shadow-2xl">
        <Link to="/" className="p-6 border-b border-slate-800 flex items-center gap-3 hover:opacity-85 active:scale-95 transition-all">
          <div className="bg-emerald-600 p-2 rounded-xl text-white"><Activity size={24}/></div>
          <h1 className="text-xl font-bold text-white tracking-tight">HealthifAI Pro</h1>
        </Link>
        <div className="flex-1 overflow-y-auto py-6 px-4 space-y-1 custom-scrollbar">
          {tabs.map(tab => { const Icon = tab.icon; const isActive = activeTab === tab.id;
            return (<button key={tab.id} onClick={()=>{setActiveTab(tab.id); setPage(1);}} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 font-medium ${isActive ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/50' : 'hover:bg-slate-800 hover:text-white'}`}><Icon size={20} className={isActive?"text-white":"text-slate-400"} />{tab.name}</button>);
          })}
        </div>
        <div className="p-4 border-t border-slate-800"><button onClick={logout} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-rose-500/10 text-rose-400 hover:text-rose-300 transition-colors"><LogOut size={20}/> Logout</button></div>
      </div>

      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        <header className="bg-white border-b border-slate-200 px-8 py-4 flex justify-between items-center z-10 shadow-sm">
          <h2 className="text-xl font-bold text-slate-800 hidden md:block">{tabs.find(t=>t.id===activeTab)?.name}</h2>
          <div className="flex items-center gap-6 ml-auto"><NotificationBell /><div className="flex items-center gap-3 pl-6 border-l border-slate-200"><div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center text-slate-600 font-bold border border-slate-200">{profile?.username?.charAt(0) || 'D'}</div><div className="hidden sm:block"><p className="text-sm font-bold text-slate-800">Dr. {profile?.name || 'Doctor'}</p><p className="text-xs text-emerald-600 font-medium">DOCTOR</p></div></div></div>
        </header>
        <main className="flex-1 overflow-y-auto p-4 md:p-8 custom-scrollbar">
          <div className="max-w-7xl mx-auto">
            {activeTab === 'overview' && renderOverview()}
            {activeTab === 'profile' && renderProfile()}
            {activeTab === 'cases' && renderCases()}
            {activeTab === 'appointments' && renderAppointments()}
            {activeTab === 'assignedUsers' && renderAssignedUsers()}
            {activeTab === 'fees' && renderFees()}
            {activeTab === 'hospital' && renderHospital()}
            {activeTab === 'wallet' && renderWallet()}
            {activeTab === 'documents' && renderDocuments()}
            {activeTab === 'chat' && renderChat()}
          </div>
        </main>
      </div>
      {selectedCase && renderCaseModal()}
      {documentViewer.isOpen && <DocumentViewerModal url={documentViewer.url} filename={documentViewer.filename} onClose={()=>setDocumentViewer({isOpen:false, url:'', filename:''})} />}
      
      {caseDocUpload.isOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex justify-center items-center z-[150] p-4 animate-fade-in">
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl relative">
            <h3 className="text-xl font-bold text-slate-800 mb-2">Upload Document</h3>
            <p className="text-sm text-slate-500 mb-4">Provide a descriptive name for this document to attach it to the case.</p>
            <div className="mb-4 text-sm text-blue-600 font-medium bg-blue-50 p-3 rounded-xl border border-blue-100 flex items-center gap-2">
              <File size={16} className="text-blue-500"/>
              <span className="truncate">{caseDocUpload.file?.name}</span>
            </div>
            <input autoFocus value={caseDocUpload.type} onChange={e => setCaseDocUpload({ ...caseDocUpload, type: e.target.value })} placeholder="e.g. Prescription, Lab Report..." className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl mb-6 outline-none focus:ring-2 focus:ring-blue-500 font-medium" />
            <div className="flex justify-end gap-3">
              <button onClick={() => setCaseDocUpload({ file: null, type: '', isOpen: false })} className="px-5 py-2.5 bg-slate-100 text-slate-700 rounded-xl font-medium hover:bg-slate-200 transition-colors">Cancel</button>
              <button onClick={handleCaseDocUpload} className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 transition-colors text-white rounded-xl font-bold shadow-md shadow-blue-200">Upload</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DoctorDashboard;