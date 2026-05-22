import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import NotificationBell from '../components/NotificationBell';
import DocumentUploader from '../components/DocumentUploader';
import MapComponent from '../components/MapComponent';
import { useAuth } from '../context/AuthContext';
import {
  LayoutDashboard, User, FileText, Calendar, Users,
  Wallet, File, Building2, DollarSign, X,
  LogOut, Activity, ChevronRight, CheckCircle2, Clock,
  Search, Plus, Download, MessageCircle, Send, Paperclip, Edit2, Lock,
  MapPin, Map, MapPinOff, MessageSquare, Shield
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
// CHAT PANEL (fully functional)
// ============================================
const ChatPanel = ({ user, onShowToast, onOpenDocumentViewer, assignedPatientsProp, roomsProp, selectedRoomProp, setSelectedRoomProp, createOrGetRoom, colleagueDoctorsProp, hospitalInfoProp, onSeePatientInfo, onSeeCaseInfo, onSeeColleagueInfo, onSeeHospitalInfo }) => {
  const [activeTab, setActiveTab] = useState('patients'); // 'patients', 'hospital', 'colleagues'
  const [assignedPatients, setAssignedPatients] = useState(assignedPatientsProp || []);
  const [rooms, setRooms] = useState(roomsProp || []);
  const [selectedRoom, setSelectedRoom] = useState(selectedRoomProp || null);
  const [hospitalInfo, setHospitalInfo] = useState(hospitalInfoProp || null);
  const [colleagueDoctors, setColleagueDoctors] = useState(colleagueDoctorsProp || []);
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [ws, setWs] = useState(null);
  const [loadingRooms, setLoadingRooms] = useState(false);
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [docType, setDocType] = useState('');
  const [showDocTypeModal, setShowDocTypeModal] = useState(false);
  const [hoverPopupOpen, setHoverPopupOpen] = useState(false);
  const popupRef = useRef(null);
  const receivedMsgIds = useRef(new Set());

  // Close popup when clicking outside
  useEffect(() => {
    if (!hoverPopupOpen) return;
    const handler = (e) => {
      if (popupRef.current && !popupRef.current.contains(e.target)) {
        setHoverPopupOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [hoverPopupOpen]);

  // Sync with props
  useEffect(() => {
    setAssignedPatients(assignedPatientsProp || []);
  }, [assignedPatientsProp]);

  useEffect(() => {
    setRooms(roomsProp || []);
  }, [roomsProp]);

  useEffect(() => {
    setSelectedRoom(selectedRoomProp);
    if (selectedRoomProp) {
      if (selectedRoomProp.chat_type === 'user_doctor') {
        setActiveTab('patients');
      } else if (selectedRoomProp.chat_type === 'doctor_hospital') {
        setActiveTab('hospital');
      } else if (selectedRoomProp.chat_type === 'doctor_doctor') {
        setActiveTab('colleagues');
      }
    }
  }, [selectedRoomProp]);

  useEffect(() => {
    setHospitalInfo(hospitalInfoProp);
  }, [hospitalInfoProp]);

  useEffect(() => {
    setColleagueDoctors(colleagueDoctorsProp || []);
  }, [colleagueDoctorsProp]);

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

  // Helper for chat API calls – reads token from sessionStorage
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

  const startHospitalChat = async () => {
    try {
      const res = await chatApiCall('post', '/chat/room/hospital');
      onShowToast('Chat room created with hospital!');
      // Refresh rooms
      const roomsRes = await chatApiCall('get', '/chat/rooms');
      setRooms(roomsRes.data.rooms || []);
      const newRoom = roomsRes.data.rooms.find(r => r.chat_type === 'doctor_hospital');
      if (newRoom) {
        setSelectedRoom(newRoom);
        if (setSelectedRoomProp) setSelectedRoomProp(newRoom);
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

  const createOrGetDoctorRoom = async (otherDoctorId) => {
    try {
      const res = await chatApiCall('post', '/chat/room/doctor', null, { other_doctor_id: otherDoctorId });
      onShowToast('Chat room created/opened with colleague!');
      const roomsRes = await chatApiCall('get', '/chat/rooms');
      setRooms(roomsRes.data.rooms || []);
      const newRoom = roomsRes.data.rooms.find(r => r.other_doctor_id === otherDoctorId && r.chat_type === 'doctor_doctor');
      if (newRoom) {
        setSelectedRoom(newRoom);
        if (setSelectedRoomProp) setSelectedRoomProp(newRoom);
      }
      return res.data;
    } catch (err) {
      console.error(err);
      onShowToast('Could not start conversation with colleague');
      return null;
    }
  };

  useEffect(() => {
    if (!selectedRoom) return;
    const loadMessages = async () => {
      try {
        const res = await chatApiCall('get', `/chat/messages/${selectedRoom.id}`, null, { limit: 100, chat_type: selectedRoom.chat_type });
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
    socket.onopen = () => socket.send(JSON.stringify({ type: 'join_room', room_id: selectedRoom.id, chat_type: selectedRoom.chat_type }));
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
          chat_type: selectedRoom.chat_type,
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
        chat_type: selectedRoom.chat_type,
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
    if (room.chat_type === 'doctor_doctor') {
      return room.other_doctor_name || 'Colleague Doctor';
    }
    return room.user_name || 'Patient';
  };

  if (loadingRooms && rooms.length === 0) return <div className="flex justify-center items-center h-full text-slate-500">Loading conversations...</div>;

  return (
    <div className="flex h-full bg-white rounded-2xl overflow-hidden border border-slate-200 shadow-sm min-h-[500px]">
      <div className="w-80 border-r border-slate-200 bg-slate-50 flex flex-col">
        <div className="p-4 border-b border-slate-200 bg-white">
          <h2 className="font-bold text-slate-800">Messages</h2>
          <div className="flex bg-slate-100 p-1 rounded-xl mt-3 gap-1">
            <button
              onClick={() => setActiveTab('patients')}
              className={`flex-1 py-1.5 text-[11px] font-semibold rounded-lg transition-all ${activeTab === 'patients' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
            >
              Patients
            </button>
            <button
              onClick={() => setActiveTab('hospital')}
              className={`flex-1 py-1.5 text-[11px] font-semibold rounded-lg transition-all ${activeTab === 'hospital' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
            >
              Hospital
            </button>
            <button
              onClick={() => setActiveTab('colleagues')}
              className={`flex-1 py-1.5 text-[11px] font-semibold rounded-lg transition-all ${activeTab === 'colleagues' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
            >
              Colleagues
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
                    onClick={() => {
                      if (existingRoom) {
                        setSelectedRoom(existingRoom);
                        if (setSelectedRoomProp) setSelectedRoomProp(existingRoom);
                      } else if (createOrGetRoom) {
                        createOrGetRoom(patient.user_id).then(newRoom => {
                          if (newRoom && setSelectedRoomProp) setSelectedRoomProp(newRoom);
                        });
                      }
                    }}
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
          ) : activeTab === 'hospital' ? (
            !hospitalInfo ? (
              <div className="p-4 text-center text-slate-500 text-sm">No hospital assigned.</div>
            ) : (
              <div
                onClick={() => {
                  const hospRoom = rooms.find(r => r.chat_type === 'doctor_hospital');
                  if (hospRoom) {
                    setSelectedRoom(hospRoom);
                    if (setSelectedRoomProp) setSelectedRoomProp(hospRoom);
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
          ) : (
            colleagueDoctors.length === 0 ? (
              <div className="p-4 text-center text-slate-500 text-sm">No colleague doctors registered under this hospital.</div>
            ) : (
              colleagueDoctors.filter(colleague => colleague.id !== user?.id).map(colleague => {
                const existingRoom = rooms.find(r => (r.doctor1_id === colleague.id || r.doctor2_id === colleague.id) && r.chat_type === 'doctor_doctor');
                const isSelected = selectedRoom?.chat_type === 'doctor_doctor' && (selectedRoom?.doctor1_id === colleague.id || selectedRoom?.doctor2_id === colleague.id);
                const isOnline = existingRoom ? existingRoom.is_other_doctor_online : false;
                return (
                  <div
                    key={colleague.id}
                    onClick={() => {
                      if (existingRoom) {
                        setSelectedRoom(existingRoom);
                        if (setSelectedRoomProp) setSelectedRoomProp(existingRoom);
                      } else {
                        createOrGetDoctorRoom(colleague.id);
                      }
                    }}
                    className={`p-4 border-b border-slate-100 cursor-pointer hover:bg-slate-100 transition-colors ${isSelected ? 'bg-blue-50 border-l-4 border-l-blue-500' : ''}`}
                  >
                    <div className="flex justify-between items-center">
                      <div className="font-semibold text-slate-800">Dr. {colleague.name}</div>
                      <div className={`w-2 h-2 rounded-full ${isOnline ? 'bg-green-500' : 'bg-gray-400'}`}></div>
                    </div>
                    <div className="text-xs text-blue-600 font-medium mt-0.5">{colleague.specialty || 'General Practice'}</div>
                    {existingRoom?.last_message && <div className="text-xs text-slate-400 mt-1 truncate">{existingRoom.last_message}</div>}
                  </div>
                );
              })
            )
          )}
        </div>
      </div>

      {selectedRoom ? (
        <div className="flex-1 flex flex-col">
          <div className="p-4 border-b border-slate-200 bg-white flex justify-between items-center relative">
            <div className="relative" ref={popupRef}>
              <button
                onClick={() => setHoverPopupOpen(prev => !prev)}
                className="flex items-center gap-2 group text-left outline-none"
              >
                <div>
                  <h3 className="font-bold text-slate-800 group-hover:text-blue-600 transition-colors flex items-center gap-1.5">
                    {getPartnerName(selectedRoom)}
                    <span className="text-[10px] bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded-full font-bold border border-blue-200">
                      ▾
                    </span>
                  </h3>
                  <div className="flex items-center gap-1 mt-0.5">
                    <div className={`w-2 h-2 rounded-full ${selectedRoom.chat_type === 'doctor_hospital'
                      ? (selectedRoom.is_hospital_online ? 'bg-green-500' : 'bg-gray-400')
                      : selectedRoom.chat_type === 'doctor_doctor'
                        ? (selectedRoom.is_other_doctor_online ? 'bg-green-500' : 'bg-gray-400')
                        : (selectedRoom.is_user_online ? 'bg-green-500' : 'bg-gray-400')
                      }`}></div>
                    <p className="text-xs text-slate-500">
                      {selectedRoom.chat_type === 'doctor_hospital'
                        ? (selectedRoom.is_hospital_online ? 'Online' : 'Offline')
                        : selectedRoom.chat_type === 'doctor_doctor'
                          ? (selectedRoom.is_other_doctor_online ? 'Online' : 'Offline')
                          : (selectedRoom.is_user_online ? 'Online' : 'Offline')}
                    </p>
                  </div>
                </div>
              </button>

              {hoverPopupOpen && (
                <div className="absolute left-0 top-full mt-2 w-56 bg-slate-900 border border-slate-700 text-white rounded-2xl overflow-hidden shadow-2xl z-[200]">
                  <div className="px-3 pt-3 pb-1">
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Quick Actions</p>
                  </div>
                  {selectedRoom.chat_type === 'user_doctor' ? (
                    <>
                      <button
                        onClick={() => {
                          setHoverPopupOpen(false);
                          if (onSeePatientInfo) onSeePatientInfo(selectedRoom.user_id);
                        }}
                        className="flex items-center gap-2.5 w-full px-4 py-3 text-sm font-semibold text-slate-200 hover:bg-white/10 hover:text-white transition-all text-left"
                      >
                        <User size={15} className="text-blue-400 shrink-0" />
                        See Patient Profile
                      </button>
                      <button
                        onClick={() => {
                          setHoverPopupOpen(false);
                          if (onSeeCaseInfo) onSeeCaseInfo(selectedRoom.user_id);
                        }}
                        className="flex items-center gap-2.5 w-full px-4 py-3 text-sm font-semibold text-slate-200 hover:bg-white/10 hover:text-white transition-all text-left"
                      >
                        <FileText size={15} className="text-emerald-400 shrink-0" />
                        See Case Details
                      </button>
                    </>
                  ) : selectedRoom.chat_type === 'doctor_doctor' ? (
                    <button
                      onClick={() => {
                        setHoverPopupOpen(false);
                        const doc = colleagueDoctors.find(d => d.id === selectedRoom.other_doctor_id || (selectedRoom.doctor1_id === d.id || selectedRoom.doctor2_id === d.id));
                        if (doc && onSeeColleagueInfo) {
                          onSeeColleagueInfo(doc);
                        }
                      }}
                      className="flex items-center gap-2.5 w-full px-4 py-3 text-sm font-semibold text-slate-200 hover:bg-white/10 hover:text-white transition-all text-left"
                    >
                      <User size={15} className="text-blue-400 shrink-0" />
                      Colleague Info
                    </button>
                  ) : (
                    <button
                      onClick={() => {
                        setHoverPopupOpen(false);
                        if (onSeeHospitalInfo) onSeeHospitalInfo();
                      }}
                      className="flex items-center gap-2.5 w-full px-4 py-3 text-sm font-semibold text-slate-200 hover:bg-white/10 hover:text-white transition-all text-left"
                    >
                      <Building2 size={15} className="text-amber-400 shrink-0" />
                      See Hospital Info
                    </button>
                  )}
                </div>
              )}
            </div>

            <button
              onClick={() => { setSelectedRoom(null); if (setSelectedRoomProp) setSelectedRoomProp(null); }}
              title="Close chat"
              className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-all active:scale-95 shrink-0"
            >
              <X size={20} />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50">
            {messages.map((msg, idx) => {
              const isSent = msg.sender_id === user?.id && msg.sender_type === user?.type;
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
        <div
          onClick={(e) => { if (e.target === e.currentTarget) { setShowDocTypeModal(false); setSelectedFile(null); if (fileInputRef.current) fileInputRef.current.value = ''; } }}
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex justify-center items-center z-[150] p-4 cursor-pointer"
        >
          <div
            onClick={e => e.stopPropagation()}
            className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl cursor-default"
          >
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

  const [selectedUserModal, setSelectedUserModal] = useState(null);
  const [selectedDoctorModal, setSelectedDoctorModal] = useState(null);
  const [showUserMap, setShowUserMap] = useState(false);

  const calculateDistance = (lat1, lon1, lat2, lon2) => {
    if (!lat1 || !lon1 || !lat2 || !lon2) return null;
    const R = 6371; // km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return (R * c).toFixed(2);
  };

  // State for data
  const [cases, setCases] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [assignedUsers, setAssignedUsers] = useState([]);
  const [fees, setFees] = useState({ fees: 0, appointment_fees: 0 });
  const [hospital, setHospital] = useState({});
  const [hospitalDoctors, setHospitalDoctors] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [wallet, setWallet] = useState({ balance: 0 });
  const [topUpAmount, setTopUpAmount] = useState(0);
  const [selectedCase, setSelectedCase] = useState(null);
  const [policyUrl, setPolicyUrl] = useState('');
  const [caseSymptoms, setCaseSymptoms] = useState([]);
  const [caseUserDocs, setCaseUserDocs] = useState([]);
  const [caseDoctorDocs, setCaseDoctorDocs] = useState([]);

  // Pagination & Filters
  const [casesPage, setCasesPage] = useState(1);
  const [casesTotalPages, setCasesTotalPages] = useState(1);
  const [casesSearch, setCasesSearch] = useState('');
  const [caseFilters, setCaseFilters] = useState({ status: '', from_date: '', to_date: '' });

  const [appointmentsPage, setAppointmentsPage] = useState(1);
  const [appointmentsTotal, setAppointmentsTotal] = useState(0);
  const [appointmentFilters, setAppointmentFilters] = useState({ status: '', date: '' });

  const [transactionsPage, setTransactionsPage] = useState(1);
  const [transactionsHasMore, setTransactionsHasMore] = useState(true);
  const [transactionFilters, setTransactionFilters] = useState({ type: '', date: '' });
  const [editingTransaction, setEditingTransaction] = useState(null);
  const [editNote, setEditNote] = useState('');

  const [assignedUsersSearch, setAssignedUsersSearch] = useState('');

  // Chat state
  const [chatRooms, setChatRooms] = useState([]);
  const [selectedChatRoom, setSelectedChatRoom] = useState(null);
  const [colleagueDoctors, setColleagueDoctors] = useState([]);
  const [hospitalInfoForChat, setHospitalInfoForChat] = useState(null);

  // Misc
  const [toastMessage, setToastMessage] = useState('');
  const [confirmDialog, setConfirmDialog] = useState({ isOpen: false, title: '', message: '', onConfirm: null, isDestructive: true, confirmText: 'Confirm' });
  const [documentViewer, setDocumentViewer] = useState({ isOpen: false, url: '', filename: '' });
  const [caseDocUpload, setCaseDocUpload] = useState({ file: null, type: '', isOpen: false });
  const [newPassword, setNewPassword] = useState('');
  const caseDocInputRef = useRef(null);

  const showToast = (msg) => { setToastMessage(msg); setTimeout(() => setToastMessage(''), 3000); };
  const showConfirm = (title, message, onConfirm, confirmText = 'Delete', isDestructive = true) => {
    setConfirmDialog({ isOpen: true, title, message, onConfirm, confirmText, isDestructive });
  };

  // Helper for chat API calls
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

  const createOrGetRoomForPatient = async (patientId) => {
    try {
      const res = await chatApiCall('post', '/chat/room', null, { patient_id: patientId });
      showToast('Chat room created/opened with patient!');
      // Refresh rooms
      const roomsRes = await chatApiCall('get', '/chat/rooms');
      setChatRooms(roomsRes.data.rooms || []);
      const newRoom = roomsRes.data.rooms.find(r => r.user_id === patientId && r.chat_type === 'user_doctor');
      if (newRoom) {
        setSelectedChatRoom(newRoom);
        return newRoom;
      }
      return null;
    } catch (err) {
      console.error(err);
      showToast('Could not start conversation');
      return null;
    }
  };

  const loadHospitalData = async () => {
    try {
      const res = await api.get('/doctor/hospital');
      setHospital(res.data || {});
      return res.data;
    } catch (err) {
      console.error("Failed to load hospital", err);
      return null;
    }
  };

  const loadAssignedUsers = async () => {
    try {
      const res = await api.get('/doctor/assigned-users/', { params: { limit: 100 } });
      setAssignedUsers(res.data || []);
    } catch (err) {
      console.error(err);
    }
  };

  const loadChatData = async () => {
    try {
      // Fetch assigned users/patients so they appear in Chat
      await loadAssignedUsers();

      // Fetch chat rooms
      const roomsRes = await chatApiCall('get', '/chat/rooms');
      setChatRooms(roomsRes.data.rooms || []);

      // Fetch hospital info for chat
      const availableRes = await chatApiCall('get', '/chat/doctors/available');
      if (availableRes.data.hospital) {
        setHospitalInfoForChat(availableRes.data.hospital);
      }

      // Fetch colleague doctors
      try {
        const docsRes = await api.get('/doctor/doctors');
        setColleagueDoctors(docsRes.data || []);
      } catch (err) {
        console.error("Colleagues fetch failed", err);
      }
    } catch (err) {
      console.error(err);
    }
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
        const params = { page: casesPage, limit: 20 };
        if (caseFilters.status) params.status = caseFilters.status;
        if (caseFilters.from_date) params.from_date = caseFilters.from_date;
        if (caseFilters.to_date) params.to_date = caseFilters.to_date;
        const res = await api.get('/doctor/cases', { params });
        setCases(res.data.cases || []);
        setCasesTotalPages(Math.ceil((res.data.total || 0) / 20) || 1);
      } else if (activeTab === 'appointments') {
        const params = { page: appointmentsPage, limit: 20 };
        if (appointmentFilters.status) params.status = appointmentFilters.status;
        if (appointmentFilters.date) {
          const dateObj = new Date(appointmentFilters.date);
          params.date = dateObj.toISOString().split('T')[0];
        }
        const res = await api.get('/doctor/appointment/', { params });
        setAppointments(res.data.appointments || []);
        setAppointmentsTotal(res.data.total || 0);
      } else if (activeTab === 'assignedUsers') {
        await loadAssignedUsers();
      } else if (activeTab === 'fees') {
        const res = await api.get('/doctor/fees');
        setFees(res.data || { fees: 0, appointment_fees: 0 });
      } else if (activeTab === 'hospital') {
        await loadHospitalData();
        try {
          const docsRes = await api.get('/doctor/doctors');
          setHospitalDoctors(docsRes.data || []);
        } catch (e) {
          console.error("Failed to load hospital doctors", e);
        }
      } else if (activeTab === 'transactions') {
        const params = { page: transactionsPage, limit: 20 };
        if (transactionFilters.type) params.type = transactionFilters.type;
        if (transactionFilters.date) params.date = transactionFilters.date;
        try {
          const res = await api.get('/doctor/transactions/', { params });
          const newTx = res.data || [];
          setTransactions(newTx);
          setTransactionsHasMore(newTx.length === 20);
        } catch (err) {
          setTransactions([]);
          setTransactionsHasMore(false);
        }
      } else if (activeTab === 'documents') {
        const res = await api.get('/default/documents', { params: { limit: 20, offset: 0 } });
        setDocuments(res.data || []);
      } else if (activeTab === 'wallet') {
        const w = await api.get('/default/myWallet');
        setWallet(w.data || { balance: 0 });
        // Also load recent transactions for wallet tab
        const params = { page: transactionsPage, limit: 20 };
        if (transactionFilters.type) params.type = transactionFilters.type;
        if (transactionFilters.date) params.date = transactionFilters.date;
        try {
          const res = await api.get('/doctor/transactions/', { params });
          const newTx = res.data || [];
          setTransactions(newTx);
          setTransactionsHasMore(newTx.length === 20);
        } catch (err) {
          setTransactions([]);
          setTransactionsHasMore(false);
        }
      } else if (activeTab === 'chat') {
        await loadChatData();
      } else if (activeTab === 'policy') {
        try {
          const res = await api.get('/doctor/policy');
          if (res.data && res.data.length > 0) {
            setPolicyUrl(res.data[0].url);
          } else if (res.data && res.data.url) {
            setPolicyUrl(res.data.url);
          } else {
            setPolicyUrl('');
          }
        } catch (err) {
          console.error("Failed to load policy", err);
          setPolicyUrl('');
        }
      }
    } catch (err) { console.error(err); showToast('Failed to load data'); }
  };

  const loadProfileData = async () => {
    try {
      const res = await api.get('/doctor/profile');
      setProfile(res.data);
      setEditProfile({ username: res.data.name, email: res.data.email, specialty: res.data.specialty, availability: res.data.availability });
    } catch (err) {
      console.error("Failed to load doctor profile", err);
    }
  };

  // Load hospital and profile on mount
  useEffect(() => {
    loadHospitalData();
    loadProfileData();
  }, []);

  useEffect(() => {
    loadData();
  }, [activeTab, casesPage, caseFilters.status, caseFilters.from_date, caseFilters.to_date, appointmentsPage, appointmentFilters.status, appointmentFilters.date, transactionsPage, transactionFilters.type, transactionFilters.date]);

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
    if (!newPassword.trim()) {
      showToast('Please enter a new password');
      return;
    }
    try {
      await api.put('/default/password', { password: newPassword });
      showToast('Password changed successfully');
      setNewPassword('');
    } catch (err) {
      showToast('Failed to change password');
    }
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

  const startChatWithColleague = async (colleagueId) => {
    try {
      let token = sessionStorage.getItem('access_token');
      await api.post(`/chat/room/doctor?token=${token}`, null, { params: { other_doctor_id: colleagueId } });

      const roomsRes = await api.get(`/chat/rooms?token=${token}`);
      const roomsList = roomsRes.data.rooms || [];
      setChatRooms(roomsList);

      const newRoom = roomsList.find(r => (r.doctor1_id === colleagueId || r.doctor2_id === colleagueId) && r.chat_type === 'doctor_doctor');
      if (newRoom) {
        setSelectedChatRoom(newRoom);
      }
      setActiveTab('chat');
      showToast('Opening conversation...');
    } catch (err) {
      console.error(err);
      showToast('Could not open conversation');
    }
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

  // Google OAuth (like UserDashboard)
  const connectGoogle = () => {
    const token = sessionStorage.getItem('access_token');
    window.location.href = `http://localhost:8000/auth/google?token=${token}`;
  };

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
          <div className="flex justify-between items-center mb-4"><h3 className="text-lg font-bold text-slate-800">Recent Cases</h3><button onClick={() => setActiveTab('cases')} className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-0.5 font-semibold">View all <ChevronRight size={14} /></button></div>
          {cases.slice(0, 3).map(c => (
            <div key={c.id} className="py-3 border-b border-slate-100 last:border-0 flex justify-between items-center">
              <div><p className="font-semibold text-slate-800">Patient: {c.user_name || 'Unknown'}</p><p className="text-sm text-slate-500">Case #{c.case_id}</p></div>
              <StatusBadge status={c.status} />
            </div>
          ))}
          {cases.length === 0 && <p className="text-slate-500 text-sm">No active cases.</p>}
        </Card>
        <Card>
          <div className="flex justify-between items-center mb-4"><h3 className="text-lg font-bold text-slate-800">Upcoming Appointments</h3><button onClick={() => setActiveTab('appointments')} className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-0.5 font-semibold">View all <ChevronRight size={14} /></button></div>
          {appointments.slice(0, 3).map(a => (
            <div key={a.id} className="py-3 border-b border-slate-100 last:border-0 flex justify-between items-center">
              <div><p className="font-semibold text-slate-800">{a.username}</p><p className="text-sm text-slate-500 flex items-center gap-1"><Clock size={14} /> {new Date(a.date).toLocaleString()}</p></div>
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
            <input value={editProfile.username} onChange={e => setEditProfile({ ...editProfile, username: e.target.value })} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-blue-500 outline-none" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Email Address</label>
            <input value={editProfile.email} onChange={e => setEditProfile({ ...editProfile, email: e.target.value })} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-blue-500 outline-none" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Specialty</label>
              <input value={editProfile.specialty} onChange={e => setEditProfile({ ...editProfile, specialty: e.target.value })} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-blue-500 outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Availability</label>
              <input value={editProfile.availability} onChange={e => setEditProfile({ ...editProfile, availability: e.target.value })} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-blue-500 outline-none" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Google Connection</label>
            <input value={profile.google_email_id || 'Not connected'} disabled className="w-full bg-slate-100 border border-slate-200 rounded-xl px-4 py-2.5 text-slate-500" />
          </div>
          <div className="pt-2 flex gap-3">
            <button onClick={updateProfile} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 rounded-xl shadow-sm transition-all shadow-blue-200">Save Changes</button>
          </div>
        </div>
      </Card>

      <Card>
        <h2 className="text-2xl font-bold text-slate-800 mb-6 flex items-center gap-2"><Lock className="text-amber-500" /> Security</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">New Password</label>
            <input
              type="password"
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              placeholder="Enter new password"
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-amber-500 outline-none"
            />
          </div>
          <div className="pt-2">
            <button onClick={changePassword} className="w-full bg-amber-500 hover:bg-amber-600 text-white font-medium py-2.5 rounded-xl shadow-sm transition-all shadow-amber-200">Update Password</button>
          </div>
          <div className="pt-4 border-t border-slate-100">
            <label className="block text-sm font-medium text-slate-700 mb-2">Google Integration</label>
            {(!profile.google_email_id || profile.google_email_id === 'Google account is not connected') ? (
              <button
                onClick={connectGoogle}
                className="w-full bg-slate-900 hover:bg-slate-800 text-white font-semibold py-2.5 rounded-xl flex items-center justify-center gap-2 shadow-sm transition-all shadow-slate-200"
              >
                <svg className="h-5 w-5" viewBox="0 0 24 24">
                  <path fill="#ffffff" d="M12.24 10.285V14.4h6.887c-.648 2.41-2.519 4.114-5.136 4.114A5.99 5.99 0 0 1 8 12.5a5.99 5.99 0 0 1 5.99-6.012c1.49 0 2.845.55 3.9 1.455l3.076-3.075C19.11 3.2 16.733 2 13.99 2 8.138 2 3.39 6.748 3.39 12.6s4.748 10.6 10.6 10.6c7.045 0 10.655-4.832 10.1-10.6H12.24Z" />
                </svg>
                Connect Google Account
              </button>
            ) : (
              <button
                onClick={connectGoogle}
                className="w-full bg-amber-600 hover:bg-amber-700 text-white font-semibold py-2.5 rounded-xl flex items-center justify-center gap-2 shadow-sm transition-all shadow-amber-200"
              >
                <svg className="h-5 w-5" viewBox="0 0 24 24">
                  <path fill="#ffffff" d="M12.24 10.285V14.4h6.887c-.648 2.41-2.519 4.114-5.136 4.114A5.99 5.99 0 0 1 8 12.5a5.99 5.99 0 0 1 5.99-6.012c1.49 0 2.845.55 3.9 1.455l3.076-3.075C19.11 3.2 16.733 2 13.99 2 8.138 2 3.39 6.748 3.39 12.6s4.748 10.6 10.6 10.6c7.045 0 10.655-4.832 10.1-10.6H12.24Z" />
                </svg>
                Change Google Account
              </button>
            )}
          </div>
        </div>
      </Card>
    </div>
  );

  const renderCases = () => {
    const filteredCases = cases.filter(c => c.case_id.toString().includes(casesSearch) || (c.user_name && c.user_name.toLowerCase().includes(casesSearch.toLowerCase())));
    return (
      <div className="animate-fade-in">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
          <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2"><FileText className="text-blue-600" /> My Cases</h2>
          <div className="flex flex-wrap gap-2 w-full md:w-auto items-center">
            <select value={caseFilters.status} onChange={e => setCaseFilters({ ...caseFilters, status: e.target.value, casesPage: 1 })} className="bg-white border border-slate-200 px-3 py-2 rounded-xl text-sm outline-none cursor-pointer">
              <option value="">All Statuses</option>
              <option value="OPEN">Open</option>
              <option value="CLOSED">Closed</option>
              <option value="REQUESTED_BY_DOCTOR">Requested by Me</option>
              <option value="REQUESTED_BY_USER">Requested by Patient</option>
            </select>
            <input type="date" value={caseFilters.from_date} onChange={e => setCaseFilters({ ...caseFilters, from_date: e.target.value, casesPage: 1 })} className="bg-white border border-slate-200 px-3 py-2 rounded-xl text-sm outline-none cursor-pointer" title="From Date" />
            <input type="date" value={caseFilters.to_date} onChange={e => setCaseFilters({ ...caseFilters, to_date: e.target.value, casesPage: 1 })} className="bg-white border border-slate-200 px-3 py-2 rounded-xl text-sm outline-none cursor-pointer" title="To Date" />
            <div className="relative flex-1 min-w-[150px] md:w-48"><Search className="absolute left-3 top-2.5 text-slate-400" size={18} /><input placeholder="Search patient..." value={casesSearch} onChange={e => setCasesSearch(e.target.value)} className="w-full bg-white border border-slate-200 pl-10 pr-4 py-2 rounded-xl text-sm outline-none" /></div>
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
          <div className="flex justify-center gap-2 pt-4"><button disabled={casesPage === 1} onClick={() => setCasesPage(p => p - 1)} className="px-4 py-2 bg-white border rounded-xl disabled:opacity-50">Previous</button><span className="px-4 py-2">{casesPage} / {casesTotalPages}</span><button disabled={casesPage >= casesTotalPages} onClick={() => setCasesPage(p => p + 1)} className="px-4 py-2 bg-white border rounded-xl disabled:opacity-50">Next</button></div>
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
      <div
        onClick={(e) => { if (e.target === e.currentTarget) setSelectedCase(null); }}
        className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex justify-center items-center z-50 p-4 animate-fade-in cursor-pointer"
      >
        <div
          onClick={e => e.stopPropagation()}
          className="bg-white rounded-3xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl relative cursor-default"
        >
          <div className="flex justify-between items-start p-6 border-b border-slate-200">
            <div><h2 className="text-2xl font-bold text-slate-800">Case #{selectedCase.case_id}</h2><div className="flex flex-wrap gap-2 mt-2"><StatusBadge status={selectedCase.status} /><span className="px-3 py-1 bg-slate-100 rounded-full text-sm">Patient: {selectedCase.user_name}</span><span className="px-3 py-1 bg-slate-100 rounded-full text-sm">Opened: {new Date(selectedCase.case_opened_on).toLocaleDateString()}</span></div></div>
            <button onClick={() => setSelectedCase(null)} className="p-2 bg-slate-100 rounded-full"><X size={20} /></button>
          </div>
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            <div className="grid md:grid-cols-2 gap-6">
              <div><h3 className="font-bold text-lg mb-3 flex items-center gap-2"><Activity className="text-rose-500" size={20} /> Symptoms</h3>
                <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                  <ul className="space-y-2 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
                    {caseSymptoms.map(s => (
                      <li key={s.id} className="flex justify-between items-center bg-white p-3 rounded-xl border border-slate-100 shadow-sm group">
                        <div><span className="font-medium text-slate-800">{s.name}</span></div>
                        {s.severity !== undefined && (<span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${getSeverityColor(s.severity)}`}>Severity: {s.severity}/10</span>)}
                        <button onClick={() => removeSymptomFromCase(selectedCase.id, s.id)} className="text-rose-400 hover:text-rose-600"><X size={14} /></button>
                      </li>
                    ))}
                    {caseSymptoms.length === 0 && <p className="text-sm italic text-slate-500 text-center py-4">No symptoms recorded.</p>}
                  </ul>
                </div>
              </div>
              <div><h3 className="font-bold text-lg mb-3 flex items-center gap-2"><FileText className="text-blue-500" size={20} /> Documents</h3>
                <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 space-y-4">
                  <div><h4 className="text-sm font-semibold mb-2 text-slate-600">From Patient</h4><ul className="space-y-2">{caseUserDocs.map(d => <li key={d.id} className="flex items-center justify-between bg-blue-50 p-2.5 rounded-xl group"><button onClick={() => openDocumentViewer(d.url, d.type)} className="flex items-center gap-2 text-sm text-blue-700 font-medium"><File size={14} /> {d.type}</button></li>)} {caseUserDocs.length === 0 && <p className="text-xs italic text-slate-500">None</p>}</ul></div>
                  <div><h4 className="text-sm font-semibold mb-2 text-slate-600">From Me</h4><ul className="space-y-2">{caseDoctorDocs.map(d => <li key={d.id} className="flex items-center justify-between bg-emerald-50 p-2.5 rounded-xl group"><button onClick={() => openDocumentViewer(d.url, d.type)} className="flex items-center gap-2 text-sm text-emerald-700 font-medium"><File size={14} /> {d.type}</button><button onClick={() => removeDocumentFromCase(selectedCase.id, d.id)} className="text-emerald-400 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-opacity bg-white p-1 rounded-full"><X size={14} /></button></li>)} {caseDoctorDocs.length === 0 && <p className="text-xs italic text-slate-500">None</p>}</ul></div>
                  <div className="pt-3 border-t border-slate-200/60 flex justify-end">
                    <input type="file" ref={caseDocInputRef} className="hidden" accept="image/jpeg,image/png,image/webp,application/pdf" onChange={e => { if (e.target.files?.[0]) setCaseDocUpload({ ...caseDocUpload, file: e.target.files[0], isOpen: true }); e.target.value = ''; }} />
                    <button onClick={() => caseDocInputRef.current?.click()} className="bg-blue-600 text-white px-4 py-2.5 rounded-xl flex items-center gap-2 text-sm font-bold hover:bg-blue-700 transition-colors shadow-sm"><Plus size={16} /> Upload File</button>
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
    <div className="animate-fade-in space-y-6">
      <div className="flex flex-wrap justify-between items-center gap-4">
        <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2"><Calendar className="text-emerald-500" /> Appointments Schedule</h2>
        <div className="flex gap-2">
          <select value={appointmentFilters.status} onChange={e => { setAppointmentFilters({ ...appointmentFilters, status: e.target.value }); setAppointmentsPage(1); }} className="bg-white border border-slate-200 px-3 py-2 rounded-xl text-sm">
            <option value="">All Statuses</option>
            <option value="CONFIRMED">Confirmed</option>
            <option value="PENDING">Pending</option>
            <option value="COMPLETED">Completed</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
          <input type="date" value={appointmentFilters.date} onChange={e => { setAppointmentFilters({ ...appointmentFilters, date: e.target.value }); setAppointmentsPage(1); }} className="bg-white border border-slate-200 px-3 py-2 rounded-xl text-sm" />
        </div>
      </div>
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {appointments.map(a => {
          const statusColors = {
            CONFIRMED: 'from-blue-500 to-blue-600 text-blue-600 bg-blue-50/50 border-blue-100',
            PENDING: 'from-amber-400 to-amber-500 text-amber-700 bg-amber-50/50 border-amber-100',
            COMPLETED: 'from-emerald-500 to-emerald-600 text-emerald-700 bg-emerald-50/50 border-emerald-100',
            CANCELLED: 'from-rose-500 to-rose-600 text-rose-700 bg-rose-50/50 border-rose-100'
          };
          const statusStyle = statusColors[a.status] || 'from-slate-400 to-slate-500 text-slate-700 bg-slate-50/50 border-slate-100';
          return (
            <Card key={a.id} className="relative overflow-hidden group border border-slate-150 shadow-sm hover:shadow-md transition-all rounded-2xl flex flex-col justify-between">
              <div className={`absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r ${statusStyle.split(' ')[0]} ${statusStyle.split(' ')[1]}`}></div>
              <div className="p-5 pt-6 space-y-4 flex-1 flex flex-col justify-between">
                <div>
                  <div className="flex justify-between items-center mb-3">
                    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${statusStyle.split(' ').slice(2).join(' ')}`}>{a.status}</span>
                    {a.status !== 'CANCELLED' && a.status !== 'COMPLETED' && (<button onClick={() => cancelAppointment(a.id)} className="text-xs text-rose-500 hover:text-white hover:bg-rose-500 border border-rose-200 px-2.5 py-1 rounded-lg font-bold transition-all">Cancel</button>)}
                  </div>
                  <h3 className="font-bold text-lg text-slate-800 mb-1">{a.username}</h3>
                  <div className="flex items-center gap-1.5 text-slate-500 text-sm mt-2"><Clock size={15} className="text-slate-400" /><span className="font-medium">{new Date(a.date).toLocaleString()}</span></div>
                </div>
                <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400"><span>ID: #{a.id}</span>{a.case_number ? (<span className="bg-slate-100 text-slate-600 font-bold px-2 py-0.5 rounded">Case #{a.case_number}</span>) : (<span className="italic">No linked case</span>)}</div>
              </div>
            </Card>
          );
        })}
        {appointments.length === 0 && (<div className="col-span-full py-12 text-center bg-white border border-slate-200 rounded-2xl"><Calendar className="mx-auto text-slate-300 mb-3" size={40} /><p className="text-slate-500 font-medium">No appointments scheduled.</p></div>)}
      </div>
      <div className="flex justify-center gap-2 pt-4"><button disabled={appointmentsPage === 1} onClick={() => setAppointmentsPage(p => p - 1)} className="px-4 py-2 bg-white border rounded-xl disabled:opacity-50">Previous</button><span className="px-4 py-2">{appointmentsPage}</span><button disabled={appointments.length < 20} onClick={() => setAppointmentsPage(p => p + 1)} className="px-4 py-2 bg-white border rounded-xl disabled:opacity-50">Next</button></div>
    </div>
  );

  const renderAssignedUsers = () => {
    const filteredUsers = assignedUsers.filter(u => u.username.toLowerCase().includes(assignedUsersSearch.toLowerCase()));
    return (
      <div className="animate-fade-in space-y-6">
        <div className="flex flex-wrap justify-between items-center gap-4">
          <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2"><Users className="text-indigo-500" /> Assigned Patients</h2>
          <div className="relative w-64"><Search className="absolute left-3 top-2.5 text-slate-400" size={18} /><input placeholder="Search by name..." value={assignedUsersSearch} onChange={e => setAssignedUsersSearch(e.target.value)} className="w-full bg-white border border-slate-200 pl-10 pr-4 py-2 rounded-xl text-sm outline-none" /></div>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredUsers.map(u => (
            <Card key={u.user_id} className="border-t-4 border-t-indigo-500 cursor-pointer hover:-translate-y-1 hover:shadow-lg hover:border-indigo-600 transition-all duration-300 rounded-2xl flex flex-col justify-between" onClick={() => { setSelectedUserModal(u); setShowUserMap(false); }}>
              <div><h3 className="font-extrabold text-lg text-slate-800 mb-2">{u.username}</h3><span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2.5 py-0.5 rounded-full">Active Case #{u.case_id || 'N/A'}</span></div>
              <div className="mt-6 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400"><span>Opened: {new Date(u.case_opened_at).toLocaleDateString()}</span><span className="text-indigo-500 font-bold hover:underline">View Profile &rarr;</span></div>
            </Card>
          ))}
          {filteredUsers.length === 0 && (<div className="col-span-full py-12 text-center bg-white border border-slate-200 rounded-2xl"><Users className="mx-auto text-slate-300 mb-3" size={40} /><p className="text-slate-500 font-medium">No assigned patients found.</p></div>)}
        </div>
      </div>
    );
  };

  const renderFees = () => (
    <div className="max-w-xl animate-fade-in">
      <Card><h2 className="text-2xl font-bold text-slate-800 mb-6 flex items-center gap-2"><DollarSign className="text-emerald-500" /> Fee Management</h2>
        <div className="space-y-5">
          <div><label className="block text-sm font-medium text-slate-700 mb-1">Consultation Fee (₹)</label><input type="number" value={fees.fees} onChange={e => setFees({ ...fees, fees: parseInt(e.target.value) })} className="w-full bg-slate-50 border p-3 rounded-xl" /></div>
          <div><label className="block text-sm font-medium text-slate-700 mb-1">Appointment Fee (₹)</label><input type="number" value={fees.appointment_fees} onChange={e => setFees({ ...fees, appointment_fees: parseInt(e.target.value) })} className="w-full bg-slate-50 border p-3 rounded-xl" /></div>
          <button onClick={updateFees} className="bg-emerald-600 text-white px-6 py-2.5 rounded-xl">Update Fees</button>
        </div>
      </Card>
    </div>
  );

  const renderHospital = () => (
    <div className="animate-fade-in space-y-8">
      <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2"><Building2 className="text-indigo-500" /> Hospital Portal</h2>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-1 border border-slate-100 flex flex-col justify-between">
          <div className="space-y-6">
            <div><span className="text-xs font-bold uppercase tracking-wider bg-indigo-50 text-indigo-600 px-3 py-1 rounded-full">Primary Facility</span><h3 className="text-2xl font-black text-slate-800 mt-3">{hospital.name || 'N/A'}</h3></div>
            <div className="space-y-4 text-sm">
              <div><p className="text-xs font-bold uppercase text-slate-400">Email Contact</p><p className="font-semibold text-slate-700 mt-0.5">{hospital.email || 'N/A'}</p></div>
              <div><p className="text-xs font-bold uppercase text-slate-400">Phone Number</p><p className="font-semibold text-slate-700 mt-0.5">{hospital.phone || 'N/A'}</p></div>
              <div><p className="text-xs font-bold uppercase text-slate-400">Address</p><p className="font-semibold text-slate-700 mt-0.5">{hospital.address ? `${hospital.address}, ${hospital.city}, ${hospital.state} - ${hospital.zip}` : 'N/A'}</p></div>
            </div>
          </div>
        </Card>
        <Card className="lg:col-span-2 p-0 overflow-hidden relative border border-slate-155 shadow-sm rounded-2xl min-h-[300px]">
          {hospital.lat && hospital.lon ? (
            <MapComponent markers={[{ lat: parseFloat(hospital.lat), lon: parseFloat(hospital.lon), label: hospital.name }]} zoom={14} />
          ) : (<div className="absolute inset-0 bg-slate-100 flex flex-col items-center justify-center text-slate-400 p-4"><MapPinOff size={36} className="mb-2" /><p className="text-sm font-semibold">Hospital Geolocation Coordinates Unavailable</p></div>)}
        </Card>
      </div>
      <div className="space-y-4">
        <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2"><Users className="text-blue-500" /> Hospital Colleague Registry</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {hospitalDoctors.map(doc => (
            <Card
              key={doc.id}
              onClick={() => setSelectedDoctorModal(doc)}
              className="border border-slate-150 hover:shadow-md transition-all rounded-2xl flex items-start gap-4 cursor-pointer hover:border-blue-300"
            >
              <div className="w-12 h-12 bg-blue-50 text-blue-600 font-extrabold rounded-full flex items-center justify-center text-base border border-blue-100 shadow-sm shrink-0">{doc.name?.charAt(0) || 'D'}</div>
              <div className="space-y-1 min-w-0 flex-1">
                <h4 className="font-extrabold text-slate-800 truncate text-base">Dr. {doc.name}</h4>
                <p className="text-xs font-bold text-blue-600 uppercase tracking-wider">{doc.specialty || 'General Practitioner'}</p>
                <div className="pt-2 text-xs text-slate-400 space-y-0.5">
                  <p className="truncate"><span className="font-medium text-slate-500">Email:</span> {doc.registered_email}</p>
                  {doc.google_email_id && (
                    <p className="truncate text-emerald-600 font-semibold"><span className="font-medium text-slate-500">Google:</span> Connected</p>
                  )}
                </div>
              </div>
            </Card>
          ))}
          {hospitalDoctors.length === 0 && (<div className="col-span-full py-8 text-center bg-white border border-slate-200 rounded-2xl"><p className="text-slate-400 italic">No other doctors registered under this hospital.</p></div>)}
        </div>
      </div>
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
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-bold text-slate-800">Recent Transactions</h3>
            <div className="flex gap-2">
              <select value={transactionFilters.type} onChange={e => { setTransactionFilters({ ...transactionFilters, type: e.target.value }); setTransactionsPage(1); }} className="text-sm border border-slate-200 rounded-lg p-1.5 outline-none bg-slate-50">
                <option value="">All Types</option>
                <option value="INCOMING">Incoming</option>
                <option value="OUTGOING">Outgoing</option>
                <option value="TOP-UP">TOP-UP</option>
              </select>
              <input type="date" value={transactionFilters.date} onChange={e => { setTransactionFilters({ ...transactionFilters, date: e.target.value }); setTransactionsPage(1); }} className="text-sm border border-slate-200 rounded-lg p-1.5 outline-none bg-slate-50" />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto pr-2 space-y-3 max-h-[300px] custom-scrollbar">
            {transactions.map(t => {
              const isCredit = ['INCOMING', 'TOP-UP', 'TOPUP'].includes(t.type.toUpperCase());
              return (
                <div key={t.id} className="flex justify-between items-center p-3 rounded-xl hover:bg-slate-50 transition-colors border border-transparent hover:border-slate-100 group/item">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${isCredit ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'}`}>
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
                  <span className={`font-bold ${isCredit ? 'text-emerald-600' : 'text-slate-800'}`}>
                    {isCredit ? '+' : '-'}₹{t.amount}
                  </span>
                </div>
              );
            })}
            {transactions.length === 0 && <p className="text-slate-500 text-center py-8">No recent transactions.</p>}
          </div>
          <div className="flex justify-between items-center pt-3 border-t border-slate-100 mt-2">
            <button disabled={transactionsPage === 1} onClick={() => setTransactionsPage(p => p - 1)} className="px-3 py-1 text-sm bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors">Previous</button>
            <span className="text-sm font-medium text-slate-600">Page {transactionsPage}</span>
            <button disabled={transactions.length < 20} onClick={() => setTransactionsPage(p => p + 1)} className="px-3 py-1 text-sm bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors">Next</button>
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
        <div className="md:col-span-2"><Card><h3 className="font-bold text-lg mb-4">Stored Documents</h3><div className="grid grid-cols-1 sm:grid-cols-2 gap-4">{documents.map(d => (<div key={d.document_id || d.id} className="relative group bg-slate-50 p-4 rounded-2xl hover:border-blue-300 hover:shadow-md transition-all flex items-start gap-4"><div onClick={() => openDocumentViewer(d.document_url || d.url, d.document_type || d.type)} className="flex items-start gap-4 flex-1 cursor-pointer"><div className="p-3 bg-white text-blue-500 rounded-xl shadow-sm group-hover:bg-blue-500 group-hover:text-white transition-colors"><FileText size={24} /></div><div><p className="font-semibold">{d.document_type || d.type}</p><p className="text-xs text-slate-500 mt-1">{d.date}</p></div></div><button onClick={() => handleDeleteDocumentRequest(d.document_id || d.id)} className="p-2 text-slate-400 hover:text-rose-500 bg-white rounded-full opacity-0 group-hover:opacity-100 absolute right-2 top-2 shadow-sm"><X size={16} /></button></div>))}{documents.length === 0 && <p className="text-slate-500 col-span-full py-8 text-center">No documents uploaded yet.</p>}</div></Card></div>
      </div>
    </div>
  );

  const renderChat = () => (
    <div className="h-[calc(100vh-120px)]">
      <ChatPanel
        user={authUser}
        onShowToast={showToast}
        onOpenDocumentViewer={openDocumentViewer}
        assignedPatientsProp={assignedUsers}
        roomsProp={chatRooms}
        selectedRoomProp={selectedChatRoom}
        setSelectedRoomProp={setSelectedChatRoom}
        createOrGetRoom={createOrGetRoomForPatient}
        colleagueDoctorsProp={colleagueDoctors}
        hospitalInfoProp={hospitalInfoForChat}
        onSeePatientInfo={(patientId) => {
          const patient = assignedUsers.find(u => u.user_id === patientId);
          if (patient) {
            setSelectedUserModal(patient);
          } else {
            showToast("Patient details not found");
          }
        }}
        onSeeCaseInfo={(patientId) => {
          const associatedCase = cases.find(c => c.user_id === patientId);
          if (associatedCase) {
            viewCaseDetails(associatedCase.id);
            setActiveTab('cases');
          } else {
            showToast("No active case found for this patient");
          }
        }}
        onSeeColleagueInfo={(doc) => {
          setSelectedDoctorModal(doc);
        }}
        onSeeHospitalInfo={() => {
          setActiveTab('hospital');
        }}
      />
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
                  <h3 className="font-bold text-slate-800">Hospital Policy Document</h3>
                  <p className="text-sm text-slate-500">Official guidelines and terms set by your hospital administration.</p>
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
              <p className="text-sm text-slate-500">Your hospital has not uploaded a policy document yet.</p>
            </div>
          </Card>
        )}
      </div>
    );
  };

  const tabs = [
    { id: 'overview', name: 'Overview', icon: LayoutDashboard },
    { id: 'cases', name: 'My Cases', icon: FileText },
    { id: 'appointments', name: 'Appointments', icon: Calendar },
    { id: 'assignedUsers', name: 'Assigned Patients', icon: Users },
    { id: 'fees', name: 'Fee Settings', icon: DollarSign },
    { id: 'hospital', name: 'My Hospital', icon: Building2 },
    { id: 'documents', name: 'Documents', icon: File },
    { id: 'policy', name: 'Hospital Policy', icon: Shield },
    { id: 'wallet', name: 'Wallet & Transactions', icon: Wallet },
    { id: 'chat', name: 'Chat', icon: MessageCircle },
    { id: 'profile', name: 'Profile', icon: User },
  ];

  return (
    <div className="flex h-screen bg-slate-50 font-sans overflow-hidden">
      {toastMessage && (<div className="fixed top-6 left-1/2 -translate-x-1/2 z-50"><div className="bg-slate-800 text-white px-6 py-3 rounded-full shadow-2xl flex items-center gap-2"><CheckCircle2 className="text-emerald-400" size={18} /> {toastMessage}</div></div>)}
      {confirmDialog.isOpen && (
        <div
          onClick={(e) => { if (e.target === e.currentTarget) setConfirmDialog({ ...confirmDialog, isOpen: false }); }}
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex justify-center items-center z-[100] p-4 cursor-pointer"
        >
          <div
            onClick={e => e.stopPropagation()}
            className="bg-white rounded-2xl p-6 max-w-sm w-full cursor-default"
          >
            <h3 className="text-xl font-bold text-slate-800 mb-2">{confirmDialog.title}</h3>
            <p className="text-slate-600 mb-6">{confirmDialog.message}</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setConfirmDialog({ ...confirmDialog, isOpen: false })} className="px-4 py-2 bg-slate-100 rounded-xl">Cancel</button>
              <button onClick={confirmDialog.onConfirm} className={`px-4 py-2 text-white rounded-xl ${confirmDialog.isDestructive ? 'bg-rose-500 hover:bg-rose-600' : 'bg-blue-600 hover:bg-blue-700'}`}>{confirmDialog.confirmText}</button>
            </div>
          </div>
        </div>
      )}

      <div className="w-72 bg-slate-900 text-slate-300 flex flex-col border-r border-slate-800 hidden md:flex z-10 shadow-2xl">
        <Link to="/" className="p-6 border-b border-slate-800 flex items-center gap-3 hover:opacity-85 active:scale-95 transition-all">
          <div className="bg-emerald-600 p-2 rounded-xl text-white"><Activity size={24} /></div>
          <h1 className="text-xl font-bold text-white tracking-tight">HealthifAI</h1>
        </Link>
        <div className="flex-1 overflow-y-auto py-6 px-4 space-y-1 custom-scrollbar">
          {tabs.map(tab => {
            const Icon = tab.icon; const isActive = activeTab === tab.id;
            return (<button key={tab.id} onClick={() => { setActiveTab(tab.id); setCasesPage(1); setAppointmentsPage(1); setTransactionsPage(1); }} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 font-medium ${isActive ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/50' : 'hover:bg-slate-800 hover:text-white'}`}><Icon size={20} className={isActive ? "text-white" : "text-slate-400"} />{tab.name}</button>);
          })}
        </div>
        <div className="p-4 border-t border-slate-800"><button onClick={logout} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-rose-500/10 text-rose-400 hover:text-rose-300 transition-colors"><LogOut size={20} /> Logout</button></div>
      </div>

      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        <header className="bg-white border-b border-slate-200 px-8 py-4 flex justify-between items-center z-10 shadow-sm">
          <h2 className="text-xl font-bold text-slate-800 hidden md:block">{tabs.find(t => t.id === activeTab)?.name}</h2>
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
            {activeTab === 'policy' && renderPolicy()}
            {activeTab === 'chat' && renderChat()}
          </div>
        </main>
      </div>
      {selectedCase && renderCaseModal()}

      {selectedUserModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex justify-center items-center z-[150] p-4 animate-fade-in" onClick={() => { setSelectedUserModal(null); setShowUserMap(false); }}>
          <div className={`bg-white rounded-3xl p-6 shadow-2xl relative transition-all duration-300 flex flex-col md:flex-row gap-6 max-h-[90vh] overflow-y-auto ${showUserMap ? 'max-w-4xl w-full' : 'max-w-md w-full'}`} onClick={e => e.stopPropagation()}>
            <button onClick={() => { setSelectedUserModal(null); setShowUserMap(false); }} className="absolute right-4 top-4 p-1.5 text-slate-400 hover:text-slate-600 bg-slate-100 rounded-full"><X size={16} /></button>
            <div className="flex-1 space-y-5">
              <div><span className="text-xs font-bold uppercase tracking-wider bg-indigo-50 text-indigo-600 px-3 py-1 rounded-full">Patient Profile</span><h3 className="text-2xl font-black text-slate-800 mt-2">{selectedUserModal.username}</h3><p className="text-sm text-slate-500">Case ID: #{selectedUserModal.case_id || 'N/A'}</p></div>
              <div className="space-y-3 bg-slate-50 p-4 rounded-2xl border border-slate-100 text-sm"><div className="flex justify-between"><span className="text-slate-500 font-medium">Phone:</span> <span className="font-bold text-slate-800">{selectedUserModal.phone_number || 'N/A'}</span></div><div className="flex justify-between"><span className="text-slate-500 font-medium">Google ID:</span> <span className="font-bold text-slate-800">{selectedUserModal.user_google_email_id || 'Not linked'}</span></div><div className="flex justify-between"><span className="text-slate-500 font-medium">Assigned On:</span> <span className="font-bold text-slate-800">{new Date(selectedUserModal.case_opened_at).toLocaleDateString()}</span></div><div className="flex justify-between"><span className="text-slate-500 font-medium">Last Sync:</span> <span className="font-bold text-slate-800">{new Date(selectedUserModal.last_updated).toLocaleString()}</span></div></div>
              <div className="flex gap-3">
                <button onClick={() => { createOrGetRoomForPatient(selectedUserModal.user_id).then(room => { if (room) setActiveTab('chat'); setSelectedUserModal(null); }); }} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 rounded-xl shadow-md flex items-center justify-center gap-2 transition-all shadow-blue-200"><MessageSquare size={16} /> Chat</button>
                <button onClick={() => { setShowUserMap(!showUserMap); if (!hospital.lat || !hospital.lon) loadHospitalData(); }} className="flex-1 bg-slate-900 hover:bg-slate-800 text-white font-semibold py-2.5 rounded-xl flex items-center justify-center gap-2 shadow-md transition-all shadow-slate-200"><MapPin size={16} /> {showUserMap ? "Hide Map" : "Show Map"}</button>
                <button onClick={() => { if (selectedUserModal.case_db_id) { viewCaseDetails(selectedUserModal.case_db_id); setActiveTab('cases'); setSelectedUserModal(null); } else showToast("No case associated"); }} className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-2.5 rounded-xl flex items-center justify-center gap-2 shadow-md transition-all shadow-emerald-200"><FileText size={16} /> See Case</button>
              </div>
            </div>
            {showUserMap && (
              <div className="flex-1 flex flex-col min-h-[300px]">
                <h4 className="font-bold text-slate-800 mb-2 flex items-center gap-1.5"><Map size={18} className="text-indigo-600" /> Location</h4>
                {selectedUserModal.user_lat && selectedUserModal.user_lon && hospital.lat && hospital.lon ? (
                  <div className="flex-1 flex flex-col space-y-3">
                    <div className="rounded-2xl overflow-hidden border border-slate-200 shadow-inner flex-1 min-h-[220px]">
                      <MapComponent
                        markers={[
                          { lat: parseFloat(selectedUserModal.user_lat), lon: parseFloat(selectedUserModal.user_lon), label: `${selectedUserModal.username} (Patient)`, isUser: true },
                          { lat: parseFloat(hospital.lat), lon: parseFloat(hospital.lon), label: `${hospital.name} (Hospital/Doctor)` }
                        ]}
                        zoom={11}
                      />
                    </div>
                    <div className="text-xs bg-indigo-50 border border-indigo-100 rounded-xl p-3 text-indigo-900 flex justify-between items-center">
                      <span>Distance to Hospital:</span>
                      <span className="font-extrabold text-sm text-indigo-700">{calculateDistance(selectedUserModal.user_lat, selectedUserModal.user_lon, hospital.lat, hospital.lon)} km</span>
                    </div>
                  </div>
                ) : (<div className="flex-1 bg-slate-100 rounded-2xl flex flex-col items-center justify-center text-slate-400 p-4 text-center text-sm border border-dashed border-slate-350"><MapPinOff size={24} className="mb-2" />Coordinates not available for user or hospital.</div>)}
              </div>
            )}
          </div>
        </div>
      )}

      {selectedDoctorModal && (
        <div
          onClick={(e) => { if (e.target === e.currentTarget) setSelectedDoctorModal(null); }}
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex justify-center items-center z-[150] p-4 animate-fade-in cursor-pointer"
        >
          <div
            onClick={e => e.stopPropagation()}
            className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl relative cursor-default border border-slate-100"
          >
            <button
              onClick={() => setSelectedDoctorModal(null)}
              className="absolute right-4 top-4 p-1.5 text-slate-400 hover:text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-full transition-all"
            >
              <X size={18} />
            </button>

            <div className="flex flex-col items-center text-center pb-4 border-b border-slate-100">
              <div className="w-20 h-20 bg-blue-50 text-blue-600 font-black rounded-full flex items-center justify-center text-3xl border-2 border-blue-200 shadow-md mb-3">
                {selectedDoctorModal.name?.charAt(0) || 'D'}
              </div>
              <span className="text-xs font-bold uppercase tracking-wider bg-blue-50 text-blue-600 px-3 py-1 rounded-full border border-blue-100">
                Hospital Colleague
              </span>
              <h3 className="text-2xl font-black text-slate-800 mt-2">Dr. {selectedDoctorModal.name}</h3>
              <p className="text-sm font-semibold text-blue-600 uppercase tracking-wide mt-1">
                {selectedDoctorModal.specialty || 'General Practice'}
              </p>
            </div>

            <div className="my-5 space-y-3 bg-slate-50 p-4 rounded-2xl border border-slate-100 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500 font-medium">Email:</span>
                <span className="font-bold text-slate-800 truncate max-w-[200px]" title={selectedDoctorModal.registered_email}>
                  {selectedDoctorModal.registered_email || 'N/A'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-medium">Phone:</span>
                <span className="font-bold text-slate-800">{selectedDoctorModal.phone_number || 'N/A'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-medium">Rating:</span>
                <span className="font-bold text-slate-800 flex items-center gap-1">
                  ★ {selectedDoctorModal.rating || '-'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-medium">Total Cases:</span>
                <span className="font-bold text-slate-800">{selectedDoctorModal.total_cases !== undefined ? selectedDoctorModal.total_cases : '0'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-medium">Consultation Fee:</span>
                <span className="font-bold text-emerald-600">₹{selectedDoctorModal.fees || '0'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-medium">Appointment Fee:</span>
                <span className="font-bold text-emerald-600">₹{selectedDoctorModal.appointment_fees || '0'}</span>
              </div>
            </div>

            <div className="flex gap-3 mt-4">
              <button
                onClick={() => {
                  setSelectedDoctorModal(null);
                  setActiveTab('hospital');
                }}
                className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-2.5 rounded-xl transition-all text-sm text-center"
              >
                View Registry
              </button>

              <button
                onClick={() => {
                  setSelectedDoctorModal(null);
                  startChatWithColleague(selectedDoctorModal.id);
                }}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 rounded-xl transition-all shadow-sm shadow-blue-200 text-sm text-center flex items-center justify-center gap-2"
              >
                <MessageCircle size={16} />
                Chat
              </button>
            </div>
          </div>
        </div>
      )}

      {documentViewer.isOpen && <DocumentViewerModal url={documentViewer.url} filename={documentViewer.filename} onClose={() => setDocumentViewer({ isOpen: false, url: '', filename: '' })} />}

      {caseDocUpload.isOpen && (
        <div
          onClick={(e) => { if (e.target === e.currentTarget) setCaseDocUpload({ file: null, type: '', isOpen: false }); }}
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex justify-center items-center z-[150] p-4 animate-fade-in cursor-pointer"
        >
          <div
            onClick={e => e.stopPropagation()}
            className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl relative cursor-default"
          >
            <h3 className="text-xl font-bold text-slate-800 mb-2">Upload Document</h3>
            <p className="text-sm text-slate-500 mb-4">Provide a descriptive name for this document to attach it to the case.</p>
            <div className="mb-4 text-sm text-blue-600 font-medium bg-blue-50 p-3 rounded-xl border border-blue-100 flex items-center gap-2"><File size={16} className="text-blue-500" /><span className="truncate">{caseDocUpload.file?.name}</span></div>
            <input autoFocus value={caseDocUpload.type} onChange={e => setCaseDocUpload({ ...caseDocUpload, type: e.target.value })} placeholder="e.g. Prescription, Lab Report..." className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl mb-6 outline-none focus:ring-2 focus:ring-blue-500 font-medium" />
            <div className="flex justify-end gap-3"><button onClick={() => setCaseDocUpload({ file: null, type: '', isOpen: false })} className="px-5 py-2.5 bg-slate-100 text-slate-700 rounded-xl font-medium hover:bg-slate-200 transition-colors">Cancel</button><button onClick={handleCaseDocUpload} className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 transition-colors text-white rounded-xl font-bold shadow-md shadow-blue-200">Upload</button></div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DoctorDashboard;