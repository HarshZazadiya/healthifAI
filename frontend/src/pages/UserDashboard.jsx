import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import NotificationBell from '../components/NotificationBell';
import MapComponent from '../components/MapComponent';
import LocationPicker from '../components/LocationPicker';
import DocumentUploader from '../components/DocumentUploader';
import { useAuth } from '../context/AuthContext';
import {
  LayoutDashboard, User, Activity, FileText, Calendar,
  Search, Users, Wallet, File, MapPin, X, Plus, Shield,
  Map as MapIcon, LogOut, ChevronRight,
  Clock, DollarSign, Navigation, Upload, CheckCircle2, Lock, Building2, Edit2, Download,
  MessageCircle, Send, Paperclip
} from 'lucide-react';

// ============================================
// COMMON COMPONENTS
// ============================================
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

const Card = ({ children, className = '', ...props }) => (
  <div className={`bg-white rounded-2xl border border-slate-100 shadow-sm p-6 transition-all duration-300 hover:shadow-md ${className}`} {...props}>
    {children}
  </div>
);

// ============================================
// MAP MODAL (for doctor location)
// ============================================
const MapModal = ({ hospitalLat, hospitalLon, hospitalName, userLat, userLon, onClose, onGoToLocationTab }) => {
  const markers = [];
  if (hospitalLat && hospitalLon) {
    markers.push({ lat: parseFloat(hospitalLat), lon: parseFloat(hospitalLon), label: hospitalName, isUser: false });
  }
  if (userLat && userLon) {
    markers.push({ lat: parseFloat(userLat), lon: parseFloat(userLon), label: 'Your location', isUser: true });
  }

  const hasHospitalLocation = hospitalLat && hospitalLon;
  const hasUserLocation = userLat && userLon;

  if (!hasHospitalLocation) {
    return (
      <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl">
        <div className="text-center">
          <MapIcon size={48} className="mx-auto text-slate-400 mb-4" />
          <h3 className="text-xl font-bold text-slate-800 mb-2">Location not available</h3>
          <p className="text-slate-600 mb-6">This hospital hasn't provided its exact location.</p>
          <button onClick={onClose} className="bg-blue-600 text-white px-6 py-2 rounded-xl">Close</button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-3xl w-full h-full flex flex-col shadow-2xl">
      <div className="flex justify-between items-center p-4 border-b border-slate-200">
        <h3 className="font-bold text-slate-800">Location - {hospitalName}</h3>
        <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600"><X size={20} /></button>
      </div>
      <div className="flex-1 p-4 min-h-[400px]">
        {!hasUserLocation && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-4 text-amber-800 text-sm flex justify-between items-center">
            <span>⚠️ Your location is not set. The map shows only the hospital.</span>
            <button onClick={onGoToLocationTab} className="bg-amber-100 hover:bg-amber-200 px-3 py-1 rounded-lg text-amber-900 font-medium text-xs">Set Location</button>
          </div>
        )}
        <MapComponent markers={markers} />
      </div>
    </div>
  );
};

// ============================================
// DOCTOR DETAILS MODAL (embedded in the main modal container)
// ============================================
const DoctorDetailsModal = ({ doctor, hospital, userLocation, onClose, onChat, onSeeCase, onSeePolicy }) => {
  const [showMap, setShowMap] = useState(false);

  if (!doctor) return null;

  // Haversine / Distance calculation
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

  const distance = calculateDistance(userLocation?.lat, userLocation?.lon, hospital?.lat, hospital?.lon);

  return (
    <div
      className={`bg-white rounded-3xl p-6 shadow-2xl relative transition-all duration-300 flex flex-col md:flex-row gap-6 max-h-[90vh] overflow-y-auto ${showMap ? 'max-w-4xl w-full' : 'max-w-md w-full'}`}
      onClick={e => e.stopPropagation()}
    >
      <button onClick={onClose} className="absolute right-4 top-4 p-1.5 text-slate-400 hover:text-slate-600 bg-slate-100 rounded-full transition-colors z-10"><X size={16} /></button>

      <div className="flex-1 space-y-5">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider bg-indigo-50 text-indigo-600 px-3 py-1 rounded-full">Doctor Profile</span>
          <div className="flex items-center gap-4 mt-3">
            <div className="w-14 h-14 bg-blue-100 text-blue-600 rounded-2xl flex items-center justify-center font-extrabold text-2xl">
              {doctor.name?.charAt(0)?.toUpperCase()}
            </div>
            <div>
              <h3 className="text-xl font-black text-slate-800">Dr. {doctor.name}</h3>
              <p className="text-blue-600 font-medium text-sm">{doctor.speciality || 'General Physician'}</p>
            </div>
          </div>
        </div>

        <div className="space-y-3 bg-slate-50 p-4 rounded-2xl border border-slate-100 text-sm">
          {doctor.email && (
            <div className="flex justify-between">
              <span className="text-slate-500 font-medium">Email:</span>
              <span className="font-bold text-slate-800 truncate max-w-[200px]" title={doctor.email}>{doctor.email}</span>
            </div>
          )}
          {doctor.phone_number && (
            <div className="flex justify-between">
              <span className="text-slate-500 font-medium">Phone:</span>
              <span className="font-bold text-slate-800">{doctor.phone_number}</span>
            </div>
          )}
          {doctor.fees && (
            <div className="flex justify-between">
              <span className="text-slate-500 font-medium">Consultation Fee:</span>
              <span className="font-bold text-slate-800">₹{doctor.fees}</span>
            </div>
          )}
          {doctor.appointment_fees && (
            <div className="flex justify-between">
              <span className="text-slate-500 font-medium">Appointment Fee:</span>
              <span className="font-bold text-slate-800">₹{doctor.appointment_fees}</span>
            </div>
          )}
        </div>

        {hospital && (
          <div className="bg-emerald-50 p-4 rounded-2xl border border-emerald-100 text-sm space-y-1">
            <h4 className="text-xs font-bold text-emerald-600 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Building2 size={14} /> Hospital Details
            </h4>
            <p className="font-extrabold text-slate-800">{hospital.name}</p>
            <p className="text-slate-650 text-xs flex items-start gap-1"><MapPin size={12} className="mt-0.5 shrink-0" /> {hospital.address}</p>
            {hospital.phone_number && <p className="text-xs text-slate-600">📞 {hospital.phone_number}</p>}
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={onChat}
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 rounded-xl shadow-md flex items-center justify-center gap-2 transition-all shadow-blue-200"
          >
            <MessageCircle size={16} /> Chat
          </button>
          <button
            onClick={() => setShowMap(!showMap)}
            className="bg-slate-900 hover:bg-slate-800 text-white font-semibold py-2.5 rounded-xl flex items-center justify-center gap-2 shadow-md transition-all shadow-slate-200"
          >
            <MapPin size={16} /> {showMap ? "Hide Map" : "Show Map"}
          </button>
          <button
            onClick={onSeeCase}
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-2.5 rounded-xl flex items-center justify-center gap-2 shadow-md transition-all shadow-emerald-200"
          >
            <FileText size={16} /> See Case
          </button>
          <button
            onClick={onSeePolicy}
            className="bg-indigo-600 hover:bg-indigo-750 text-white font-semibold py-2.5 rounded-xl flex items-center justify-center gap-2 shadow-md transition-all shadow-indigo-200"
          >
            <Shield size={16} /> Policy
          </button>
        </div>
      </div>

      {showMap && (
        <div className="flex-1 flex flex-col min-h-[300px] md:w-[400px]">
          <h4 className="font-bold text-slate-800 mb-2 flex items-center gap-1.5"><MapIcon size={18} className="text-indigo-600" /> Location</h4>
          {hospital?.lat && hospital?.lon ? (
            <div className="flex-1 flex flex-col space-y-3">
              <div className="rounded-2xl overflow-hidden border border-slate-200 shadow-inner flex-1 min-h-[220px]">
                <MapComponent
                  markers={[
                    ...(userLocation?.lat && userLocation?.lon ? [{ lat: parseFloat(userLocation.lat), lon: parseFloat(userLocation.lon), label: 'My Location', isUser: true }] : []),
                    { lat: parseFloat(hospital.lat), lon: parseFloat(hospital.lon), label: `${hospital.name} (Hospital)` }
                  ]}
                  zoom={11}
                />
              </div>
              {distance && (
                <div className="text-xs bg-indigo-50 border border-indigo-100 rounded-xl p-3 text-indigo-900 flex justify-between items-center">
                  <span>Distance to Hospital:</span>
                  <span className="font-extrabold text-sm text-indigo-700">{distance} km</span>
                </div>
              )}
            </div>
          ) : (
            <div className="flex-1 bg-slate-100 rounded-2xl flex flex-col items-center justify-center text-slate-400 p-4 text-center text-sm border border-dashed border-slate-350">
              <MapPin size={24} className="mb-2" />
              Coordinates not available for hospital.
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ============================================
// DOCUMENT VIEWER MODAL (with Range request sniffing)
// ============================================
const DocumentViewerModal = ({ url, filename, onClose }) => {
  const [contentType, setContentType] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!url) return;

    setLoading(true);
    setContentType(null);

    fetch(url, {
      method: 'GET',
      credentials: 'include',
      cache: 'no-store'
    })
      .then(res => {
        if (!res.ok) throw new Error('HTTP error');
        const type = res.headers.get('content-type');

        if (type?.startsWith('image/')) {
          setContentType('image');
        } else if (type?.includes('pdf')) {
          setContentType('pdf');
        } else {
          throw new Error('Unrecognized type');
        }
      })
      .catch(() => {
        const ext = filename?.split('.').pop()?.toLowerCase();

        if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext)) {
          setContentType('image');
        } else if (ext === 'pdf') {
          setContentType('pdf');
        } else {
          setContentType('other');
        }
      })
      .finally(() => {
        setLoading(false);
      });

  }, [url, filename]);


  if (loading) {
    return (
      <div
        onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex justify-center items-center z-[500] p-4 cursor-pointer"
      >
        <div className="bg-white rounded-3xl p-8 w-full max-w-4xl text-center cursor-default">Loading document preview...</div>
      </div>
    );
  }

  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex justify-center items-center z-[500] p-4 animate-fade-in cursor-pointer"
    >
      <div className="bg-white rounded-3xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl relative cursor-default">
        <div className="flex justify-between items-center p-4 border-b border-slate-200">
          <h3 className="font-bold text-slate-800 truncate">{filename || 'Document'}</h3>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 bg-slate-100 rounded-full transition-colors"><X size={20} /></button>
        </div>
        <div className="flex-1 overflow-auto p-4 bg-slate-50 flex items-center justify-center min-h-[400px]">
          {contentType === 'image' ? (
            <img src={`${url}&v=${Date.now()}`} className="max-w-full max-h-[70vh] object-contain rounded-lg" />
          ) : contentType === 'pdf' ? (
            <iframe src={`${url}&v=${Date.now()}`} className="w-full h-[70vh] rounded-lg border-0" title={filename} />
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
// CHAT PANEL
// ============================================
const ChatPanel = ({ user, onShowToast, onOpenDocumentViewer, onSeeDoctorInfo, onSeeCase }) => {
  const [assignedDoctors, setAssignedDoctors] = useState([]);
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
  const [hoverPopupOpen, setHoverPopupOpen] = useState(false);

  const receivedMsgIds = useRef(new Set());
  const popupRef = useRef(null);

  // Close doctor popup when clicking outside
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

  // ---- Inline modal state ----
  const [showDoctorModal, setShowDoctorModal] = useState(false);
  const [doctorModalData, setDoctorModalData] = useState(null);
  const [showCaseModal, setShowCaseModal] = useState(false);
  const [caseModalData, setCaseModalData] = useState(null);
  const [modalLoading, setModalLoading] = useState(false);

  const fetchAndShowDoctorInfo = async (doctorId) => {
    setModalLoading(true);
    setShowDoctorModal(true);
    try {
      const res = await api.get('/user/my-doctors/', { params: { limit: 100 } });
      const docs = res.data || [];
      const doc = docs.find(d => d.doctor_id === doctorId);
      if (doc) {
        setDoctorModalData(doc);
      } else {
        onShowToast('Doctor details not found');
        setShowDoctorModal(false);
      }
    } catch (err) {
      onShowToast('Failed to load doctor details');
      setShowDoctorModal(false);
    } finally {
      setModalLoading(false);
    }
  };

  const fetchAndShowCase = async (doctorId, doctorName) => {
    setModalLoading(true);
    setShowCaseModal(true);
    try {
      const listRes = await api.get('/user/cases', { params: { limit: 100 } });
      const allCases = listRes.data?.cases || [];
      const caseObj = allCases.find(c =>
        c.doctor_id === doctorId ||
        (c.doctor_name && doctorName && c.doctor_name.toLowerCase().includes(doctorName.toLowerCase()))
      );
      if (!caseObj) {
        onShowToast('No case found for this doctor');
        setShowCaseModal(false);
        return;
      }
      const detailRes = await api.get('/user/cases', { params: { case_id: caseObj.id } });
      const caseData = detailRes.data?.cases?.[0];
      if (caseData) {
        setCaseModalData(caseData);
      } else {
        setShowCaseModal(false);
      }
    } catch (err) {
      onShowToast('Failed to load case details');
      setShowCaseModal(false);
    } finally {
      setModalLoading(false);
    }
  };


  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type (only images and PDFs)
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
    const config = {
      method,
      url,
      params,
      headers: { 'Content-Type': 'application/json' }
    };
    if (data) config.data = data;
    const response = await api(config);
    return response;
  };

  // Helper to get partner name and online status for the selected room
  const getRoomPartner = (room) => {
    if (!room) return { name: '', isOnline: false };
    if (user.type === 'user') {
      return { name: room.doctor_name, isOnline: room.is_doctor_online };
    } else {
      return { name: room.user_name, isOnline: room.is_user_online };
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch assigned doctors (for chat sidebar)
        const myDocsRes = await api.get('/user/my-doctors/', { params: { limit: 100 } });
        setAssignedDoctors(myDocsRes.data || []);
        // Fetch chat rooms
        const roomsRes = await chatApiCall('get', '/chat/rooms');
        const roomsData = roomsRes.data.rooms || [];
        setRooms(roomsData);
      } catch (err) {
        console.error(err);
        onShowToast('Failed to load chat data');
      } finally {
        setLoadingRooms(false);
      }
    };
    fetchData();
  }, []);

  const createOrGetRoom = async (doctorId) => {
    try {
      const res = await chatApiCall('post', '/chat/room', null, { doctor_id: doctorId });
      const newRoomId = res.data.room_id;
      const roomsRes = await chatApiCall('get', '/chat/rooms');
      setRooms(roomsRes.data.rooms || []);
      const room = roomsRes.data.rooms.find(r => r.id === newRoomId);
      if (room) setSelectedRoom(room);
      return newRoomId;
    } catch (err) {
      onShowToast('Could not start conversation');
      return null;
    }
  };

  useEffect(() => {
    if (!selectedRoom) return;
    const loadMessages = async () => {
      try {
        const res = await chatApiCall('get', `/chat/messages/${selectedRoom.id}`, null, { limit: 100, chat_type: selectedRoom.chat_type || 'user_doctor' });
        setMessages(res.data.messages || []);
        scrollToBottom();
      } catch (err) { console.error(err); }
    };
    loadMessages();
  }, [selectedRoom]);

  useEffect(() => {
    if (!selectedRoom) return;
    const token = sessionStorage.getItem('access_token');
    if (!token) {
      onShowToast('Authentication token missing');
      return;
    }
    const wsUrl = `ws://localhost:8000/chat/ws?token=${token}`;
    const socket = new WebSocket(wsUrl);
    socket.onopen = () => {
      socket.send(JSON.stringify({ type: 'join_room', room_id: selectedRoom.id, chat_type: selectedRoom.chat_type || 'user_doctor' }));
    };
    socket.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.type === 'message' && msg.room_id === selectedRoom.id) {
        // Avoid duplicate messages by ID
        if (receivedMsgIds.current.has(msg.id)) return;
        receivedMsgIds.current.add(msg.id);
        setMessages(prev => [...prev, msg]);
        scrollToBottom();
      }
      // ... other message types
    };
    socket.onerror = (err) => console.error('WebSocket error', err);
    setWs(socket);
    return () => { if (socket.readyState === WebSocket.OPEN) socket.close(); };
  }, [selectedRoom]);

  const scrollToBottom = () => {
    setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
  };

  const sendMessage = async () => {
    if (!inputMessage.trim() && !selectedFile) return;
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      onShowToast('Not connected to chat server');
      return;
    }
    const file = selectedFile;
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        ws.send(JSON.stringify({
          type: 'message',
          room_id: selectedRoom.id,
          chat_type: selectedRoom.chat_type || 'user_doctor',
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
        chat_type: selectedRoom.chat_type || 'user_doctor',
        message: inputMessage,
        message_type: 'text'
      }));
      setInputMessage('');
    }
  };

  const getPartnerName = (room) => {
    if (!room) return '';
    return user.type === 'user' ? room.doctor_name : room.user_name;
  };

  if (loadingRooms) return <div className="flex justify-center items-center h-full">Loading conversations...</div>;

  return (
    <div className="flex h-full bg-white rounded-2xl overflow-hidden border border-slate-200">
      <div className="w-80 border-r border-slate-200 bg-slate-50 flex flex-col">
        <div className="p-4 border-b border-slate-200 bg-white">
          <h2 className="font-bold text-slate-800">Messages</h2>
          <p className="text-xs text-slate-500 mt-1">Chat with your doctors</p>
        </div>
        <div className="flex-1 overflow-y-auto">
          {assignedDoctors.length === 0 ? (
            <div className="p-4 text-center text-slate-500 text-sm">No assigned doctors yet.<br />Assign one from Find Doctors tab.</div>
          ) : (
            assignedDoctors.map(doc => {
              const existingRoom = rooms.find(r =>
                (user.type === 'user' && r.doctor_id === doc.doctor_id) ||
                (user.type === 'doctor' && r.user_id === doc.user_id)
              );
              const isSelected = selectedRoom && (
                (user.type === 'user' && selectedRoom.doctor_id === doc.doctor_id) ||
                (user.type === 'doctor' && selectedRoom.user_id === doc.user_id)
              );
              const partnerName = getPartnerName(existingRoom || { doctor_id: doc.doctor_id, doctor_name: doc.name, user_name: doc.name });
              const isOnline = existingRoom ? (user.type === 'user' ? existingRoom.is_doctor_online : existingRoom.is_user_online) : false;
              return (
                <div
                  key={doc.doctor_id}
                  onClick={async () => {
                    if (existingRoom) setSelectedRoom(existingRoom);
                    else await createOrGetRoom(doc.doctor_id);
                  }}
                  className={`p-4 border-b border-slate-100 cursor-pointer hover:bg-slate-100 transition-colors ${isSelected ? 'bg-blue-50 border-l-4 border-l-blue-500' : ''}`}
                >
                  <div className="flex justify-between items-center">
                    <div className="font-semibold text-slate-800">Dr. {doc.name}</div>
                    <div className={`w-2 h-2 rounded-full ${isOnline ? 'bg-green-500' : 'bg-gray-400'}`}></div>
                  </div>
                  <div className="text-xs text-slate-500 mt-1">{doc.speciality || 'Doctor'}</div>
                  {existingRoom?.last_message && <div className="text-xs text-slate-400 mt-1 truncate">{existingRoom.last_message}</div>}
                </div>
              );
            })
          )}
        </div>
      </div>

      {selectedRoom ? (
        <div className="flex-1 flex flex-col">
          <div className="p-4 border-b border-slate-200 bg-white flex justify-between items-center relative">
            {/* Doctor name – click to open action popup */}
            <div className="relative" ref={popupRef}>
              <button
                onClick={() => setHoverPopupOpen(prev => !prev)}
                className="flex items-center gap-2 group text-left"
              >
                <div>
                  <h3 className="font-bold text-slate-800 group-hover:text-blue-600 transition-colors flex items-center gap-1.5">
                    Dr. {getPartnerName(selectedRoom)}
                    {user.type === 'user' && (
                      <span className="text-[10px] bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded-full font-bold border border-blue-200">
                        ▾
                      </span>
                    )}
                  </h3>
                  <div className="flex items-center gap-1 mt-0.5">
                    <div className={`w-2 h-2 rounded-full ${(user.type === 'user' ? selectedRoom.is_doctor_online : selectedRoom.is_user_online)
                      ? 'bg-green-500' : 'bg-gray-400'
                      }`}></div>
                    <p className="text-xs text-slate-500">
                      {(user.type === 'user' ? selectedRoom.is_doctor_online : selectedRoom.is_user_online) ? 'Online' : 'Offline'}
                    </p>
                  </div>
                </div>
              </button>

              {/* Click popup for patient-doctor quick actions */}
              {hoverPopupOpen && user.type === 'user' && (
                <div className="absolute left-0 top-full mt-2 w-52 bg-slate-900 border border-slate-700 text-white rounded-2xl overflow-hidden shadow-2xl z-[200]">
                  <div className="px-3 pt-3 pb-1">
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Quick Actions</p>
                  </div>
                  <button
                    onClick={() => {
                      setHoverPopupOpen(false);
                      fetchAndShowDoctorInfo(selectedRoom.doctor_id);
                    }}
                    className="flex items-center gap-2.5 w-full px-4 py-3 text-sm font-semibold text-slate-200 hover:bg-white/10 hover:text-white transition-all text-left"
                  >
                    <User size={15} className="text-blue-400 shrink-0" />
                    See Doctor's Info
                  </button>
                  <button
                    onClick={() => {
                      setHoverPopupOpen(false);
                      fetchAndShowCase(selectedRoom.doctor_id, getPartnerName(selectedRoom));
                    }}
                    className="flex items-center gap-2.5 w-full px-4 py-3 text-sm font-semibold text-slate-200 hover:bg-white/10 hover:text-white transition-all text-left"
                  >
                    <FileText size={15} className="text-emerald-400 shrink-0" />
                    See Case
                  </button>
                  <div className="h-2"></div>
                </div>
              )}
            </div>

            {/* Close chat button (X) in upper right */}
            <button
              onClick={() => { setSelectedRoom(null); setHoverPopupOpen(false); }}
              title="Close chat"
              className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-all active:scale-95 shrink-0"
            >
              <X size={20} />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50">
            {messages.map((msg, idx) => {
              const isSent = msg.sender_id === user.id;
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
                      <button
                        onClick={() => onOpenDocumentViewer(fileUrl, fileName)}
                        className="text-sm underline flex items-center gap-1 hover:text-blue-500 transition-colors"
                      >
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
              <button
                onClick={() => {
                  setSelectedFile(null);
                  setDocType('');
                  if (fileInputRef.current) fileInputRef.current.value = '';
                }}
                className="p-1 hover:bg-blue-100 rounded-full text-blue-600 transition-colors"
              >
                <X size={16} />
              </button>
            </div>
          )}
          <div className="p-4 border-t border-slate-200 bg-white flex gap-2">
            <input
              type="text"
              value={inputMessage}
              onChange={e => setInputMessage(e.target.value)}
              onKeyPress={e => e.key === 'Enter' && sendMessage()}
              placeholder="Type a message..."
              className="flex-1 border border-slate-200 rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <label className="p-2 rounded-xl bg-slate-100 cursor-pointer hover:bg-slate-200 transition-colors">
              <Paperclip size={20} className="text-slate-600" />
              <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileChange} accept="image/jpeg,image/png,image/gif,image/webp,application/pdf" />
            </label>
            <button onClick={sendMessage} className="bg-blue-600 text-white px-4 py-2 rounded-xl hover:bg-blue-700 transition-colors">
              <Send size={18} />
            </button>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center text-slate-400">Select a doctor to start chatting</div>
      )}

      {/* ---- Doctor Info Inline Modal ---- */}
      {showDoctorModal && (
        <div
          onClick={(e) => { if (e.target === e.currentTarget) setShowDoctorModal(false); }}
          className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-[300] p-4 cursor-pointer"
        >
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden animate-fade-in cursor-default">
            {modalLoading ? (
              <div className="p-12 flex flex-col items-center justify-center gap-3">
                <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                <p className="text-slate-400 text-sm">Loading doctor info...</p>
              </div>
            ) : doctorModalData ? (
              <>
                <div className="bg-gradient-to-br from-blue-600 to-indigo-700 p-6 text-white">
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-3">
                      <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center font-extrabold text-2xl">
                        {doctorModalData.name?.charAt(0)?.toUpperCase()}
                      </div>
                      <div>
                        <h2 className="text-lg font-extrabold">Dr. {doctorModalData.name}</h2>
                        <p className="text-blue-200 text-sm font-medium">{doctorModalData.speciality || 'General'}</p>
                      </div>
                    </div>
                    <button onClick={() => setShowDoctorModal(false)} className="p-1.5 text-white/60 hover:text-white hover:bg-white/10 rounded-xl transition-all">
                      <X size={18} />
                    </button>
                  </div>
                </div>
                <div className="p-5 space-y-4">
                  <div className="bg-slate-50 rounded-2xl p-4">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Hospital</p>
                    <p className="font-semibold text-slate-800">{doctorModalData.hospital_name || doctorModalData.hospital || 'N/A'}</p>
                    {doctorModalData.hospital_address && <p className="text-xs text-slate-500 mt-0.5">{doctorModalData.hospital_address}</p>}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-3 text-center">
                      <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider mb-1">Consultation</p>
                      <p className="font-extrabold text-slate-800 text-lg">₹{doctorModalData.fees || 0}</p>
                    </div>
                    <div className="bg-blue-50 border border-blue-100 rounded-2xl p-3 text-center">
                      <p className="text-[10px] font-bold text-blue-600 uppercase tracking-wider mb-1">Appointment</p>
                      <p className="font-extrabold text-slate-800 text-lg">₹{doctorModalData.appointment_fees || doctorModalData.fees || 0}</p>
                    </div>
                  </div>
                  {(doctorModalData.registered_email || doctorModalData.email) && (
                    <p className="text-sm text-slate-600 flex items-center gap-2">
                      <span className="text-base">✉</span> {doctorModalData.registered_email || doctorModalData.email}
                    </p>
                  )}
                  {doctorModalData.phone_number && (
                    <p className="text-sm text-slate-600 flex items-center gap-2">
                      <span className="text-base">📞</span> {doctorModalData.phone_number}
                    </p>
                  )}
                  {doctorModalData.rating && (
                    <p className="text-sm text-slate-600 flex items-center gap-2">
                      <span className="text-base">⭐</span> Rating: {doctorModalData.rating}
                    </p>
                  )}
                </div>
                {/* See More footer */}
                <div className="px-5 pb-5">
                  <button
                    onClick={() => {
                      setShowDoctorModal(false);
                      onSeeDoctorInfo(doctorModalData.doctor_id);
                    }}
                    className="w-full py-2.5 rounded-2xl border-2 border-blue-200 text-blue-600 font-bold text-sm hover:bg-blue-600 hover:text-white hover:border-blue-600 transition-all flex items-center justify-center gap-2 group"
                  >
                    See Full Profile
                    <span className="group-hover:translate-x-1 transition-transform">→</span>
                  </button>
                </div>
              </>
            ) : null}
          </div>
        </div>
      )}

      {/* ---- Case Info Inline Modal ---- */}
      {showCaseModal && (
        <div
          onClick={(e) => { if (e.target === e.currentTarget) setShowCaseModal(false); }}
          className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-[300] p-4 cursor-pointer"
        >
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col overflow-hidden animate-fade-in cursor-default">
            {modalLoading ? (
              <div className="p-12 flex flex-col items-center justify-center gap-3">
                <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
                <p className="text-slate-400 text-sm">Loading case details...</p>
              </div>
            ) : caseModalData ? (
              <>
                <div className="p-5 border-b border-slate-100 flex justify-between items-start shrink-0">
                  <div>
                    <h2 className="text-xl font-extrabold text-slate-800">Case #{caseModalData.case_id}</h2>
                    <div className="flex flex-wrap items-center gap-2 mt-1.5">
                      <span className={`px-2.5 py-0.5 text-xs font-bold rounded-full ${caseModalData.status === 'OPEN' ? 'bg-emerald-100 text-emerald-700' :
                        caseModalData.status === 'CLOSED' ? 'bg-slate-100 text-slate-600' :
                          'bg-amber-100 text-amber-700'
                        }`}>{caseModalData.status}</span>
                      {caseModalData.diesease && (
                        <span className="px-2.5 py-0.5 text-xs font-bold rounded-full bg-purple-100 text-purple-700">{caseModalData.diesease}</span>
                      )}
                      <span className="text-xs text-slate-400">{new Date(caseModalData.case_opened_on).toLocaleDateString()}</span>
                    </div>
                  </div>
                  <button onClick={() => setShowCaseModal(false)} className="p-2 text-slate-400 hover:text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-full transition-all shrink-0">
                    <X size={18} />
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto p-5 space-y-5">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-slate-50 rounded-xl p-3">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Doctor</p>
                      <p className="font-semibold text-slate-800 text-sm">Dr. {caseModalData.doctor_name || 'Unassigned'}</p>
                    </div>
                    <div className="bg-emerald-50 rounded-xl p-3">
                      <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider mb-1">Cost</p>
                      <p className="font-bold text-slate-800">₹{caseModalData.cost || 0}</p>
                    </div>
                  </div>

                  {caseModalData.symptoms?.length > 0 && (
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Symptoms</p>
                      <div className="flex flex-wrap gap-2">
                        {caseModalData.symptoms.map((s, i) => (
                          <span key={i} className="px-3 py-1 bg-rose-50 text-rose-700 text-xs font-semibold rounded-full border border-rose-100">
                            {s.symptom || s.name || s}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Documents</p>
                    <div className="space-y-2">
                      {(caseModalData.documents?.user || []).map((d, i) => (
                        <div key={`u-${i}`} className="flex items-center gap-2 bg-blue-50 rounded-xl p-2.5 text-sm">
                          <FileText size={14} className="text-blue-600 shrink-0" />
                          <span className="text-slate-700 flex-1 truncate">{d.type}</span>
                          <span className="text-[10px] bg-blue-200 text-blue-800 px-1.5 py-0.5 rounded font-bold">Patient</span>
                        </div>
                      ))}
                      {(caseModalData.documents?.doctor || []).map((d, i) => (
                        <div key={`d-${i}`} className="flex items-center gap-2 bg-emerald-50 rounded-xl p-2.5 text-sm">
                          <FileText size={14} className="text-emerald-600 shrink-0" />
                          <span className="text-slate-700 flex-1 truncate">{d.type}</span>
                          <span className="text-[10px] bg-emerald-200 text-emerald-800 px-1.5 py-0.5 rounded font-bold">Doctor</span>
                        </div>
                      ))}
                      {(!caseModalData.documents?.user?.length && !caseModalData.documents?.doctor?.length) && (
                        <p className="text-slate-400 text-sm italic">No documents attached yet</p>
                      )}
                    </div>
                  </div>
                </div>
                {/* See More footer */}
                <div className="px-5 pb-5 shrink-0 border-t border-slate-100 pt-4">
                  <button
                    onClick={() => {
                      setShowCaseModal(false);
                      onSeeCase(caseModalData.id, caseModalData.doctor_name);
                    }}
                    className="w-full py-2.5 rounded-2xl border-2 border-emerald-200 text-emerald-600 font-bold text-sm hover:bg-emerald-600 hover:text-white hover:border-emerald-600 transition-all flex items-center justify-center gap-2 group"
                  >
                    See Full Case Details
                    <span className="group-hover:translate-x-1 transition-transform">→</span>
                  </button>
                </div>
              </>
            ) : null}
          </div>
        </div>
      )}

      {showDocTypeModal && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowDocTypeModal(false);
              setSelectedFile(null);
              if (fileInputRef.current) fileInputRef.current.value = '';
            }
          }}
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex justify-center items-center z-[150] p-4 cursor-pointer"
        >
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl relative cursor-default">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-slate-800">Name Your Attachment</h3>
              <button
                onClick={() => {
                  setShowDocTypeModal(false);
                  setSelectedFile(null);
                  if (fileInputRef.current) fileInputRef.current.value = '';
                }}
                className="p-1.5 text-slate-400 hover:text-slate-600 bg-slate-100 rounded-full transition-colors"
              >
                <X size={16} />
              </button>
            </div>
            <p className="text-sm text-slate-500 mb-4">
              Please provide a name/type for your document (e.g. X-Ray, Blood Report, Prescription) to save it in your records.
            </p>
            <input
              type="text"
              placeholder="E.g. X-Ray"
              value={docType}
              onChange={(e) => setDocType(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all mb-6"
              autoFocus
            />
            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowDocTypeModal(false);
                  setSelectedFile(null);
                  if (fileInputRef.current) fileInputRef.current.value = '';
                }}
                className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl font-medium hover:bg-slate-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (!docType.trim()) {
                    onShowToast('Please provide a document name');
                    return;
                  }
                  setShowDocTypeModal(false);
                }}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium shadow-sm transition-all"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ============================================
// MAIN DASHBOARD
// ============================================
const UserDashboard = () => {
  const { logout, user: authUser } = useAuth();
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
  const [filters, setFilters] = useState({ doctor_name: '', hospital_name: '', speciality: '' });
  const [caseSearch, setCaseSearch] = useState('');
  const [toastMessage, setToastMessage] = useState('');
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const [numNearbyDoctors, setNumNearbyDoctors] = useState(5);
  const [selectedDoctor, setSelectedDoctor] = useState(null);
  const [selectedHospital, setSelectedHospital] = useState(null);
  const [isMapModalOpen, setIsMapModalOpen] = useState(false);
  const [mapHospitalData, setMapHospitalData] = useState(null);
  const [confirmDialog, setConfirmDialog] = useState({ isOpen: false, title: '', message: '', onConfirm: null, isDestructive: true, confirmText: 'Confirm' });

  const [documentViewer, setDocumentViewer] = useState({ isOpen: false, url: '', filename: '' });
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

  const showConfirm = (title, message, onConfirm, confirmText = 'Delete', isDestructive = true) => {
    setConfirmDialog({ isOpen: true, title, message, onConfirm, confirmText, isDestructive });
  };
  const [pendingPolicyHospital, setPendingPolicyHospital] = useState(null);
  const [hospitalPolicies, setHospitalPolicies] = useState({});

  useEffect(() => {
    if (activeTab === 'policies' && pendingPolicyHospital) {
      handleViewHospitalPolicy(pendingPolicyHospital.id, pendingPolicyHospital.name);
      setPendingPolicyHospital(null);
    }
  }, [activeTab, pendingPolicyHospital]);

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
        const res = await api.get('/user/my-doctors/', { params: { doctor_name: filters.doctor_name || undefined, hospital_name: filters.hospital_name || undefined, page, limit: 20 } });
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
      } else if (activeTab === 'policies') {
        try {
          const res = await api.get('/user/my-doctors/', { params: { limit: 100 } });
          const myDocs = res.data || [];
          setMyDoctors(myDocs);

          const uniqueHospitalIds = Array.from(
            new Set(myDocs.map(doc => doc.hospital_id || doc.hospital).filter(Boolean))
          );

          const policiesMap = {};
          await Promise.all(
            uniqueHospitalIds.map(async (hId) => {
              try {
                const policyRes = await api.get(`/user/policy/${hId}`);
                if (policyRes.data && policyRes.data.length > 0) {
                  policiesMap[hId] = policyRes.data[0];
                }
              } catch (err) {
                console.error(`Failed to fetch policy for hospital ${hId}`, err);
              }
            })
          );
          setHospitalPolicies(policiesMap);
        } catch (e) {
          console.error("Failed to load assigned doctors for policies", e);
        }
      }
    } catch (err) { console.error('Load error:', err); }
  };

  useEffect(() => { loadData(); }, [activeTab, page, transactionFilters.type, transactionFilters.date, caseFilters.status, caseFilters.date, symptomFilters.date]);

  useEffect(() => {
    const fetchProfileOnMount = async () => {
      try {
        const res = await api.get('/user/profile');
        setProfile(res.data);
        setEditProfile({ name: res.data.name, email: res.data.email });
      } catch (err) {
        console.error('Failed to load profile on mount:', err);
      }
    };
    fetchProfileOnMount();
  }, []);

  // Actions (unchanged)
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
    const token = sessionStorage.getItem('access_token');
    window.location.href = `http://localhost:8000/auth/google?token=${token}`;
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
    } catch (err) { showToast(err.response?.data?.detail || 'Failed to assign doctor'); }
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
      setCaseUserDocs(caseData.documents?.user || []);
      setCaseDoctorDocs(caseData.documents?.doctor || []);

      // Fetch full symptom details (including severity) separately
      const symRes = await api.get('/user/symptom');
      const allUserSymptoms = symRes.data || [];
      const caseSymptomIds = caseData.symptoms?.map(s => s.id) || [];
      const enrichedSymptoms = allUserSymptoms
        .filter(s => caseSymptomIds.includes(s.id))
        .map(s => ({ id: s.id, name: s.symptom, severity: s.severity }));
      setCaseSymptoms(enrichedSymptoms);

      // Keep allSymptoms for the dropdown
      setAllSymptoms(allUserSymptoms);

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
      const myDocsRes = await api.get('/user/my-doctors/', { params: { limit: 100 } });
      const myDocsIds = myDocsRes.data?.map(d => d.doctor_id) || [];
      const res = await api.get('/user/doctors/', { params: { limit: 100 } });
      const allDocs = [];
      (res.data || []).forEach(h => {
        (h.doctors || []).forEach(d => {
          allDocs.push({
            ...d,
            hospital_name: h.hospital_name,
            hospital_address: h.hospital_address,
            hospital_phone_number: h.hospital_phone_number
          });
        });
      });
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
    } catch (err) { showToast('Booking failed: ' + (err.response?.data?.detail || err.message)); }
  };
  const cancelAppointment = async (appointmentId) => {
    showConfirm('Cancel Appointment', 'Cancel this appointment?', async () => {
      setConfirmDialog({ isOpen: false });
      try {
        await api.delete(`/user/appointment/${appointmentId}`);
        showToast('Appointment cancelled');
        loadData();
      } catch (err) { showToast('Failed to cancel: ' + (err.response?.data?.detail || err.message)); }
    });
  };
  const openDocumentViewer = (url, filename) => {
    if (!url) return;
    setDocumentViewer({ isOpen: true, url, filename });
  };
  const getUserLocation = async () => {
    if (location.lat && location.lon) return { lat: location.lat, lon: location.lon };
    try {
      const res = await api.get('/user/location');
      if (res.data.latitude && res.data.longitude) {
        setLocation({ lat: res.data.latitude, lon: res.data.longitude });
        return { lat: res.data.latitude, lon: res.data.longitude };
      }
    } catch (err) { }
    return null;
  };

  // ============================================
  // RENDER FUNCTIONS
  // ============================================

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
            {(!profile.google_email_id || profile.google_email_id === 'Google account is not connected') ? (
              <button
                onClick={connectGoogle}
                className="flex-1 bg-slate-900 hover:bg-slate-800 text-white font-semibold py-2.5 rounded-xl flex items-center justify-center gap-2 shadow-sm transition-all shadow-slate-200"
              >
                <svg className="h-4.5 w-4.5" viewBox="0 0 24 24">
                  <path
                    fill="#ffffff"
                    d="M12.24 10.285V14.4h6.887c-.648 2.41-2.519 4.114-5.136 4.114A5.99 5.99 0 0 1 8 12.5a5.99 5.99 0 0 1 5.99-6.012c1.49 0 2.845.55 3.9 1.455l3.076-3.075C19.11 3.2 16.733 2 13.99 2 8.138 2 3.39 6.748 3.39 12.6s4.748 10.6 10.6 10.6c7.045 0 10.655-4.832 10.1-10.6H12.24Z"
                  />
                </svg>
                Connect Google Account
              </button>
            ) : (
              <button
                onClick={connectGoogle}
                className="flex-1 bg-amber-600 hover:bg-amber-700 text-white font-semibold py-2.5 rounded-xl flex items-center justify-center gap-2 shadow-sm transition-all shadow-amber-200"
              >
                <svg className="h-4.5 w-4.5" viewBox="0 0 24 24">
                  <path
                    fill="#ffffff"
                    d="M12.24 10.285V14.4h6.887c-.648 2.41-2.519 4.114-5.136 4.114A5.99 5.99 0 0 1 8 12.5a5.99 5.99 0 0 1 5.99-6.012c1.49 0 2.845.55 3.9 1.455l3.076-3.075C19.11 3.2 16.733 2 13.99 2 8.138 2 3.39 6.748 3.39 12.6s4.748 10.6 10.6 10.6c7.045 0 10.655-4.832 10.1-10.6H12.24Z"
                  />
                </svg>
                Change Google Account
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

  const renderCases = () => {
    const filteredCases = cases.filter(c =>
      c.case_id.toString().includes(caseSearch) ||
      (c.diesease && c.diesease.toLowerCase().includes(caseSearch.toLowerCase())) ||
      (c.doctor_name && c.doctor_name.toLowerCase().includes(caseSearch.toLowerCase()))
    );

    return (
      <div className="animate-fade-in">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
          <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2"><FileText className="text-blue-600" /> My Cases</h2>
          <div className="flex flex-wrap gap-2">
            <select
              value={caseFilters.status}
              onChange={e => { setCaseFilters({ ...caseFilters, status: e.target.value }); setPage(1); }}
              className="bg-white border border-slate-200/80 pl-4 pr-10 py-2.5 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 appearance-none cursor-pointer transition-all font-medium text-slate-700 shadow-sm"
              style={{
                backgroundImage: `url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3E%3Cpath stroke='%2364748b' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3E%3C/svg%3E")`,
                backgroundPosition: 'right 0.75rem center',
                backgroundSize: '1.25rem',
                backgroundRepeat: 'no-repeat'
              }}
            >
              <option value="OPEN">Open</option>
              <option value="">All Statuses</option>
              <option value="REQUESTED_BY_USER">Requested By Me</option>
              <option value="REQUESTED_BY_DOCTOR">REQUESTED By Doctor</option>
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
              <select
                value={bookingDoctorId}
                onChange={e => setBookingDoctorId(e.target.value)}
                className="w-full bg-white border border-slate-200/80 pl-4 pr-10 py-3 rounded-xl text-sm outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 appearance-none cursor-pointer transition-all font-medium text-slate-700 shadow-sm"
                style={{
                  backgroundImage: `url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3E%3Cpath stroke='%2364748b' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3E%3C/svg%3E")`,
                  backgroundPosition: 'right 0.75rem center',
                  backgroundSize: '1.25rem',
                  backgroundRepeat: 'no-repeat'
                }}
                required
              >
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

      {doctors.map((hospital, idx) => (
        <div key={idx} className="mb-8">
          <h3 className="text-xl font-bold text-slate-800 mb-3 flex items-center gap-2">
            <Building2 size={20} className="text-emerald-600" /> {hospital.hospital_name}
          </h3>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {hospital.doctors.map(doctor => (
              <Card
                key={doctor.id}
                className="flex flex-col transition-all hover:shadow-lg hover:border-blue-300"
              >
                <div
                  className="cursor-pointer flex-1"
                  onClick={() => {
                    setSelectedDoctor({
                      ...doctor,
                      hospital_id: hospital.hospital_id
                    });
                    setSelectedHospital({
                      id: hospital.hospital_id,
                      name: hospital.hospital_name,
                      address: hospital.hospital_address,
                      phone_number: hospital.hospital_phone_number,
                      lat: hospital.hospital_lat,
                      lon: hospital.hospital_lon
                    });
                  }}
                >
                  <div className="flex justify-between items-start mb-4">
                    <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center font-bold text-xl">{doctor.name.charAt(0)}</div>
                    <span className="bg-emerald-100 text-emerald-700 px-2 py-1 rounded text-xs font-bold">₹{doctor.fees} / visit</span>
                  </div>
                  <h3 className="font-bold text-lg text-slate-800 mb-1">Dr. {doctor.name}</h3>
                  <p className="text-blue-600 font-medium text-sm mb-3">{doctor.speciality || 'General Physician'}</p>
                  <div className="space-y-2 text-sm text-slate-600 mb-6">
                    <p className="flex items-center gap-2"><MapPin size={14} className="text-slate-400" /> {hospital.hospital_name}</p>
                  </div>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    assignDoctor(doctor.id);
                  }}
                  className="w-full bg-blue-50 hover:bg-blue-600 text-blue-600 hover:text-white font-semibold py-2.5 rounded-xl transition-colors mt-2"
                >
                  Assign & Create Case
                </button>
              </Card>
            ))}
          </div>
        </div>
      ))}
      {(!doctors || doctors.length === 0) && <p className="text-slate-500 col-span-full">No doctors found matching criteria.</p>}

      {/* Pagination Controls */}
      <div className="flex justify-between items-center mt-8 pt-4 border-t border-slate-100">
        <button
          disabled={page === 1}
          onClick={() => setPage(page - 1)}
          className="px-4 py-2 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 font-medium disabled:opacity-50 transition-all flex items-center gap-1.5 shadow-sm text-sm"
        >
          Previous
        </button>
        <span className="text-sm font-semibold text-slate-600">Page {page}</span>
        <button
          disabled={doctors.length < 20}
          onClick={() => setPage(page + 1)}
          className="px-4 py-2 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 font-medium disabled:opacity-50 transition-all flex items-center gap-1.5 shadow-sm text-sm"
        >
          Next
        </button>
      </div>
    </div>
  );

  const renderMyDoctors = () => {
    return (
      <div className="animate-fade-in">
        <h2 className="text-2xl font-bold text-slate-800 mb-6 flex items-center gap-2"><Users className="text-indigo-500" /> My Assigned Doctors</h2>
        <Card className="mb-6">
          <div className="flex flex-wrap gap-3">
            <div className="flex-1 min-w-[200px] relative">
              <Search className="absolute left-3 top-3 text-slate-400" size={18} />
              <input placeholder="Doctor name" className="w-full bg-slate-50 border border-slate-200 pl-10 p-2.5 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500" onChange={e => setFilters({ ...filters, doctor_name: e.target.value })} />
            </div>
            <input placeholder="Hospital name" className="flex-1 min-w-[200px] bg-slate-50 border border-slate-200 p-2.5 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500" onChange={e => setFilters({ ...filters, hospital_name: e.target.value })} />
            <button onClick={() => { setPage(1); loadData(); }} className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2.5 rounded-xl font-medium transition-colors">Search</button>
          </div>
        </Card>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {myDoctors.map(d => (
            <Card
              key={d.doctor_id}
              className="border-t-4 border-t-indigo-500 flex flex-col cursor-pointer hover:shadow-lg hover:border-indigo-300 transition-all"
              onClick={() => {
                setSelectedDoctor({
                  id: d.doctor_id,
                  name: d.name || "Unknown",
                  speciality: d.speciality || "General",
                  email: d.email || "",
                  phone_number: d.phone_number || "",
                  fees: d.fees || 0,
                  appointment_fees: d.appointment_fees || 0,
                  hospital_id: d.hospital_id,
                  isMyDoctor: true
                });
                setSelectedHospital({
                  id: d.hospital_id,
                  name: d.hospital_name || d.hospital || "Hospital",
                  address: d.hospital_address || "",
                  phone_number: d.hospital_phone_number || "",
                  lat: d.hospital_lat || null,
                  lon: d.hospital_lon || null
                });
              }}
            >
              <h3 className="font-bold text-lg text-slate-800">Dr. {d.name}</h3>
              <p className="text-indigo-600 font-medium text-sm mb-3">{d.speciality || 'General'}</p>
              <div className="space-y-2 text-sm text-slate-600 mb-4 flex-1">
                <p className="flex items-center gap-2"><MapPin size={14} className="text-slate-400" /> {d.hospital_name || d.hospital}</p>
              </div>
            </Card>
          ))}
          {(!myDoctors || myDoctors.length === 0) && <p className="text-slate-500 col-span-full">No assigned doctors found.</p>}
        </div>

        {/* Pagination Controls */}
        <div className="flex justify-between items-center mt-8 pt-4 border-t border-slate-100">
          <button
            disabled={page === 1}
            onClick={() => setPage(page - 1)}
            className="px-4 py-2 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 font-medium disabled:opacity-50 transition-all flex items-center gap-1.5 shadow-sm text-sm"
          >
            Previous
          </button>
          <span className="text-sm font-semibold text-slate-600">Page {page}</span>
          <button
            disabled={myDoctors.length < 20}
            onClick={() => setPage(page + 1)}
            className="px-4 py-2 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 font-medium disabled:opacity-50 transition-all flex items-center gap-1.5 shadow-sm text-sm"
          >
            Next
          </button>
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
                <option value="TOP-UP">Top-Up</option>
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
                  <div
                    onClick={() => openDocumentViewer(d.document_url, d.document_type)}
                    className="flex items-start gap-4 flex-1 cursor-pointer"
                  >
                    <div className="p-3 bg-white text-blue-500 rounded-xl shadow-sm group-hover:bg-blue-500 group-hover:text-white transition-colors">
                      <FileText size={24} />
                    </div>
                    <div>
                      <p className="font-semibold text-slate-800 line-clamp-1">{d.document_type}</p>
                      <p className="text-xs text-slate-500 mt-1">Date Uploaded : {d.date}</p>
                      <p className="text-xs text-slate-500 mt-1">Time : {d.time}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleDeleteDocumentRequest(d.document_id)}
                    className="p-2 text-slate-400 hover:text-rose-500 bg-white rounded-full opacity-0 group-hover:opacity-100 transition-all absolute right-2 top-2 shadow-sm border border-slate-200"
                  >
                    <X size={16} />
                  </button>
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
                    <p className="text-rose-500 text-sm font-medium">{d.speciality || 'General'}</p>
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

  const renderCaseModal = () => {
    if (!selectedCase) return null;

    // Helper to get severity color
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
        <div className="bg-white rounded-3xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl relative cursor-default">
          {/* Header */}
          <div className="flex justify-between items-start p-6 border-b border-slate-200">
            <div>
              <h2 className="text-2xl font-bold text-slate-800">Case #{selectedCase.case_id}</h2>
              <div className="flex flex-wrap gap-2 mt-2">
                <StatusBadge status={selectedCase.status} />
                <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-full bg-slate-100 text-slate-600">
                  <Calendar size={12} /> {new Date(selectedCase.case_opened_on).toLocaleDateString()}
                </span>
                {selectedCase.diesease && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-full bg-purple-100 text-purple-700">
                    <Activity size={12} /> {selectedCase.diesease}
                  </span>
                )}
              </div>
            </div>
            <div className="flex gap-2">
              {selectedCase.status === 'OPEN' && (
                <button
                  onClick={() => { closeCase(selectedCase.id); setSelectedCase(null); }}
                  className="px-4 py-2 bg-rose-50 text-rose-600 font-medium rounded-xl hover:bg-rose-100 transition-colors text-sm"
                >
                  Close Case
                </button>
              )}
              {selectedCase.status === 'CLOSED' && (
                <button
                  onClick={() => { reopenCase(selectedCase.id); setSelectedCase(null); }}
                  className="px-4 py-2 bg-blue-50 text-blue-600 font-medium rounded-xl hover:bg-blue-100 transition-colors text-sm"
                >
                  Reopen Case
                </button>
              )}
              <button
                onClick={() => setSelectedCase(null)}
                className="p-2 text-slate-400 hover:text-slate-600 bg-slate-100 rounded-full transition-colors"
              >
                <X size={20} />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {/* Cost Summary */}
            <div className="bg-gradient-to-r from-emerald-50 to-white rounded-xl p-4 border border-emerald-100">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-emerald-700">Total Cost</span>
                <span className="text-2xl font-bold text-emerald-600">₹{selectedCase.cost || 0}</span>
              </div>
            </div>

            {/* Two columns */}
            <div className="grid md:grid-cols-2 gap-6">
              {/* Symptoms Section */}
              <div className="space-y-4">
                <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2">
                  <Activity className="text-rose-500" size={20} /> Symptoms
                </h3>
                <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                  <ul className="space-y-2 mb-4 max-h-60 overflow-y-auto">
                    {caseSymptoms.map(s => (
                      <li key={s.id} className="flex justify-between items-center bg-white p-3 rounded-lg border border-slate-100 shadow-sm group">
                        <div>
                          <span className="font-medium text-slate-800">{s.name}</span>
                          <span className={`ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getSeverityColor(s.severity)}`}>
                            Severity: {s.severity}
                          </span>
                        </div>
                        <button
                          onClick={() => removeSymptomFromCase(selectedCase.id, s.id)}
                          className="text-rose-400 hover:text-rose-600 p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X size={14} />
                        </button>
                      </li>
                    ))}
                    {caseSymptoms.length === 0 && (
                      <p className="text-sm text-slate-500 italic text-center py-4">No symptoms recorded.</p>
                    )}
                  </ul>
                  <div className="flex gap-2">
                    <select
                      value={selectedSymptomToAdd}
                      onChange={e => setSelectedSymptomToAdd(e.target.value)}
                      className="flex-1 bg-white border border-slate-200/80 pl-4 pr-10 py-2.5 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 appearance-none cursor-pointer transition-all font-medium text-slate-700 shadow-sm"
                      style={{
                        backgroundImage: `url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3E%3Cpath stroke='%2364748b' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3E%3C/svg%3E")`,
                        backgroundPosition: 'right 0.75rem center',
                        backgroundSize: '1.25rem',
                        backgroundRepeat: 'no-repeat'
                      }}
                    >
                      <option value="">Choose Symptom...</option>
                      {allSymptoms.map(s => (
                        <option key={s.id} value={s.id}>
                          {s.symptom} (Severity: {s.severity})
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={() => addSymptomToCase(selectedCase.id)}
                      className="bg-blue-600 text-white px-5 py-2.5 rounded-xl hover:bg-blue-700 active:scale-95 transition-all flex items-center gap-1.5 font-semibold text-sm shadow-md shadow-blue-500/10"
                    >
                      <Plus size={16} /> Add
                    </button>
                  </div>
                </div>
              </div>

              {/* Documents Section */}
              <div className="space-y-4">
                <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2">
                  <FileText className="text-blue-500" size={20} /> Documents
                </h3>
                <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 space-y-4">
                  <div>
                    <h4 className="text-sm font-semibold text-slate-600 mb-2 flex items-center gap-1">
                      <User size={14} /> From You
                    </h4>
                    <ul className="space-y-2">
                      {caseUserDocs.map(d => (
                        <li key={d.id} className="flex items-center justify-between bg-blue-50 p-2 rounded-lg group">
                          <button
                            onClick={() => openDocumentViewer(d.url, d.type)}
                            className="flex items-center gap-2 text-sm text-blue-600 hover:underline cursor-pointer"
                          >
                            <File size={14} /> {d.type}
                          </button>
                          <button
                            onClick={() => removeDocumentFromCase(selectedCase.id, d.id)}
                            className="text-blue-400 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <X size={14} />
                          </button>
                        </li>
                      ))}
                      {caseUserDocs.length === 0 && <p className="text-xs text-slate-400 italic">None</p>}
                    </ul>
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-slate-600 mb-2 flex items-center gap-1">
                      <Users size={14} /> From Doctor
                    </h4>
                    <ul className="space-y-2">
                      {caseDoctorDocs.map(d => (
                        <li key={d.id} className="flex items-center bg-emerald-50 p-2 rounded-lg">
                          <button
                            onClick={() => openDocumentViewer(d.url, d.type)}
                            className="flex items-center gap-2 text-sm text-emerald-600 hover:underline cursor-pointer"
                          >
                            <File size={14} /> {d.type}
                          </button>
                        </li>
                      ))}
                      {caseDoctorDocs.length === 0 && <p className="text-xs text-slate-400 italic">None</p>}
                    </ul>
                  </div>
                  <div className="pt-2 border-t border-slate-200">
                    <div className="flex gap-2">
                      <select
                        value={selectedDocumentToAdd}
                        onChange={e => setSelectedDocumentToAdd(e.target.value)}
                        className="flex-1 bg-white border border-slate-200/80 pl-4 pr-10 py-2.5 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 appearance-none cursor-pointer transition-all font-medium text-slate-700 shadow-sm"
                        style={{
                          backgroundImage: `url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3E%3Cpath stroke='%2364748b' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3E%3C/svg%3E")`,
                          backgroundPosition: 'right 0.75rem center',
                          backgroundSize: '1.25rem',
                          backgroundRepeat: 'no-repeat'
                        }}
                      >
                        <option value="">Attach Document...</option>
                        {allDocuments.map(d => (
                          <option key={d.document_id || d.id} value={d.document_id || d.id}>
                            {d.document_type || d.type}
                          </option>
                        ))}
                      </select>
                      <button
                        onClick={() => addDocumentToCase(selectedCase.id)}
                        className="bg-blue-600 text-white px-5 py-2.5 rounded-xl hover:bg-blue-700 active:scale-95 transition-all flex items-center gap-1.5 font-semibold text-sm shadow-md shadow-blue-500/10"
                      >
                        <Plus size={16} /> Add
                      </button>
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

  const handleSeeDoctorInfoFromChat = async (doctorId) => {
    try {
      const res = await api.get('/user/my-doctors/', { params: { limit: 100 } });
      const docs = res.data || [];
      setMyDoctors(docs);
      const doc = docs.find(d => d.doctor_id === doctorId);
      if (doc) {
        setSelectedDoctor({
          id: doc.doctor_id,
          name: doc.name || 'Unknown',
          speciality: doc.speciality || 'General',
          email: doc.email || '',
          phone_number: doc.phone_number || '',
          fees: doc.fees || 0,
          appointment_fees: doc.appointment_fees || 0,
          isMyDoctor: true
        });
        setSelectedHospital({
          name: doc.hospital_name || doc.hospital || 'Hospital',
          address: doc.hospital_address || '',
          phone_number: doc.hospital_phone_number || '',
          lat: doc.hospital_lat || null,
          lon: doc.hospital_lon || null
        });
        setActiveTab('myDoctors');
      } else {
        showToast('Doctor not found in assigned doctors');
      }
    } catch (err) {
      showToast('Failed to load doctor details');
    }
  };

  const handleSeeCaseFromChat = async (caseIdOrDoctorId, doctorName) => {
    try {
      const res = await api.get('/user/cases', { params: { limit: 100 } });
      const allCases = res.data?.cases || [];
      setCases(allCases);

      // Try to find by specific case ID first, then fallback to doctor_id or doctorName matching
      let caseObj = allCases.find(c => c.id === caseIdOrDoctorId);
      if (!caseObj) {
        caseObj = allCases.find(c =>
          c.doctor_id === caseIdOrDoctorId ||
          (c.doctor_name && doctorName && c.doctor_name.toLowerCase().includes(doctorName.toLowerCase()))
        );
      }

      if (caseObj) {
        setActiveTab('cases');
        await viewCaseDetails(caseObj.id);
      } else {
        showToast('No case found');
      }
    } catch (err) {
      showToast('Failed to load case details');
    }
  };

  const handleViewHospitalPolicy = async (hospitalId, hospitalName) => {
    showToast(`Loading policy for ${hospitalName}...`);
    try {
      const res = await api.get(`/user/policy/${hospitalId}`);
      if (res.data && res.data.length > 0) {
        setDocumentViewer({
          isOpen: true,
          url: res.data[0].url,
          filename: `${hospitalName} Policy.pdf`
        });
      } else {
        showToast('No active policy document found for this hospital.');
      }
    } catch (err) {
      showToast(err.response?.data?.detail || 'This hospital has not uploaded a policy document.');
    }
  };

  const renderPolicies = () => {
    const uniqueHospitalsMap = {};
    myDoctors.forEach(doc => {
      const hId = doc.hospital_id || doc.hospital;
      if (hId && !uniqueHospitalsMap[hId]) {
        uniqueHospitalsMap[hId] = {
          id: hId,
          name: doc.hospital_name || doc.hospital || "Hospital",
          address: doc.hospital_address || "Address not available"
        };
      }
    });
    const assignedHospitals = Object.values(uniqueHospitalsMap);

    return (
      <div className="animate-fade-in space-y-6">
        <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
          <Shield className="text-indigo-500" /> Assigned Hospital Policies
        </h2>
        <p className="text-sm text-slate-500">
          View the active policies for the hospitals where your assigned doctors practice.
        </p>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {assignedHospitals.map(h => {
            const policy = hospitalPolicies[h.id];
            return (
              <Card key={h.id} className="border-t-4 border-t-indigo-500 flex flex-col justify-between hover:shadow-lg hover:border-indigo-300 transition-all">
                <div className="space-y-4">
                  <div>
                    <h3 className="font-bold text-lg text-slate-850 mb-2">{h.name}</h3>
                    <p className="text-xs text-slate-500 flex items-center gap-1.5">
                      <MapPin size={12} className="text-slate-400" /> {h.address}
                    </p>
                  </div>
                  {policy ? (
                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 space-y-1">
                      <p className="text-xs font-bold text-indigo-500 uppercase tracking-wider">Active Policy</p>
                      <p className="text-sm text-slate-700 font-medium truncate" title={policy.file_name}>{policy.file_name}</p>
                      {policy.uploaded_at && (
                        <p className="text-[10px] text-slate-400">Uploaded: {new Date(policy.uploaded_at).toLocaleDateString()}</p>
                      )}
                    </div>
                  ) : (
                    <div className="bg-rose-50/50 p-3 rounded-xl border border-rose-100/50">
                      <p className="text-xs font-semibold text-rose-600">No policy uploaded yet</p>
                    </div>
                  )}
                </div>
                {policy ? (
                  <button
                    onClick={() => {
                      setDocumentViewer({
                        isOpen: true,
                        url: policy.url,
                        filename: `${h.name} Policy.pdf`
                      });
                    }}
                    className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2.5 rounded-xl transition-all mt-6 shadow-md shadow-indigo-100 flex items-center justify-center gap-2"
                  >
                    <FileText size={16} /> View Policy
                  </button>
                ) : (
                  <button
                    disabled
                    className="w-full bg-slate-100 text-slate-400 font-semibold py-2.5 rounded-xl mt-6 cursor-not-allowed"
                  >
                    No Policy Available
                  </button>
                )}
              </Card>
            );
          })}
          {assignedHospitals.length === 0 && (
            <p className="text-slate-500 col-span-full">You do not have any assigned hospitals yet.</p>
          )}
        </div>
      </div>
    );
  };

  const renderChat = () => {
    return (
      <div className="h-[calc(100vh-120px)]">
        <ChatPanel
          user={authUser}
          onShowToast={showToast}
          onOpenDocumentViewer={openDocumentViewer}
          onSeeDoctorInfo={handleSeeDoctorInfoFromChat}
          onSeeCase={handleSeeCaseFromChat}
        />
      </div>
    );
  };

  const tabs = [
    { id: 'overview', name: 'Overview', icon: LayoutDashboard },
    { id: 'cases', name: 'My Cases', icon: FileText },
    { id: 'symptoms', name: 'Symptoms', icon: Activity },
    { id: 'appointments', name: 'Appointments', icon: Calendar },
    { id: 'doctors', name: 'Find Doctors', icon: Search },
    { id: 'myDoctors', name: 'My Doctors', icon: Users },
    { id: 'documents', name: 'Documents', icon: File },
    { id: 'policies', name: 'Hospital Policies', icon: Shield },
    { id: 'wallet', name: 'Wallet', icon: Wallet },
    { id: 'location', name: 'Location', icon: MapIcon },
    { id: 'chat', name: 'Chat', icon: MessageCircle },
    { id: 'profile', name: 'Profile', icon: User },
  ];

  return (
    <div className="flex h-screen bg-slate-50 font-sans overflow-hidden">
      {toastMessage && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 animate-fade-in">
          <div className="bg-slate-800 text-white px-6 py-3 rounded-full shadow-2xl flex items-center gap-2 font-medium">
            <CheckCircle2 className="text-emerald-400" size={18} /> {toastMessage}
          </div>
        </div>
      )}

      {confirmDialog.isOpen && (
        <div
          onClick={(e) => { if (e.target === e.currentTarget) setConfirmDialog({ isOpen: false }); }}
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex justify-center items-center z-[100] p-4 animate-fade-in cursor-pointer"
        >
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl relative cursor-default">
            <h3 className="text-xl font-bold text-slate-800 mb-2">{confirmDialog.title}</h3>
            <p className="text-slate-600 mb-6">{confirmDialog.message}</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setConfirmDialog({ isOpen: false })} className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl font-medium hover:bg-slate-200">Cancel</button>
              <button onClick={confirmDialog.onConfirm} className={`px-4 py-2 text-white rounded-xl font-medium ${confirmDialog.isDestructive ? 'bg-rose-500 hover:bg-rose-600' : 'bg-blue-600 hover:bg-blue-700'}`}>
                {confirmDialog.confirmText}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="w-72 bg-slate-900 text-slate-300 flex flex-col border-r border-slate-800 hidden md:flex z-10 shadow-2xl">
        <Link to="/" className="p-6 border-b border-slate-800 flex items-center gap-3 hover:opacity-85 active:scale-95 transition-all">
          <div className="bg-blue-600 p-2 rounded-xl text-white"><Activity size={24} /></div>
          <h1 className="text-xl font-bold text-white tracking-tight">HealthifAI</h1>
        </Link>
        <div className="flex-1 overflow-y-auto py-6 px-4 space-y-1 custom-scrollbar">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button key={tab.id} onClick={() => { setActiveTab(tab.id); setPage(1); }}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 font-medium ${isActive ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/50' : 'hover:bg-slate-800 hover:text-white'}`}>
                <Icon size={20} className={isActive ? "text-white" : "text-slate-400"} />
                {tab.name}
              </button>
            );
          })}
        </div>
        <div className="p-4 border-t border-slate-800">
          <button onClick={logout} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-rose-500/10 text-rose-400 hover:text-rose-300 transition-colors font-medium">
            <LogOut size={20} /> Logout
          </button>
        </div>
      </div>

      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        <header className="bg-white border-b border-slate-200 px-8 py-4 flex justify-between items-center z-10 shadow-sm">
          <h2 className="text-xl font-bold text-slate-800 hidden md:block">{tabs.find(t => t.id === activeTab)?.name}</h2>
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
            {activeTab === 'policies' && renderPolicies()}
            {activeTab === 'location' && renderLocation()}
            {activeTab === 'chat' && renderChat()}
          </div>
        </main>
      </div>

      {/* Case Modal */}
      {selectedCase && renderCaseModal()}

      {/* Doctor Modal with inline Map */}
      {selectedDoctor && (
        <div
          onClick={(e) => { if (e.target === e.currentTarget) { setSelectedDoctor(null); setSelectedHospital(null); } }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm transition-all duration-300 cursor-pointer animate-fade-in p-4"
        >
          <DoctorDetailsModal
            doctor={selectedDoctor}
            hospital={selectedHospital}
            userLocation={location}
            onClose={() => { setSelectedDoctor(null); setSelectedHospital(null); }}
            onChat={() => { setSelectedDoctor(null); setActiveTab('chat'); }}
            onSeeCase={() => {
              const associatedCase = cases.find(c => c.doctor_id === selectedDoctor.id || c.doctor_name?.toLowerCase() === selectedDoctor.name?.toLowerCase());
              if (associatedCase) {
                viewCaseDetails(associatedCase.id);
                setActiveTab('cases');
                setSelectedDoctor(null);
                setSelectedHospital(null);
              } else {
                showToast("No case associated with this doctor");
              }
            }}
            onSeePolicy={() => {
              const hId = selectedHospital?.id || selectedDoctor.hospital_id;
              if (hId) {
                setSelectedDoctor(null);
                setSelectedHospital(null);
                setActiveTab('policies');
                setPendingPolicyHospital({
                  id: hId,
                  name: selectedHospital?.name || "Hospital"
                });
              } else {
                showToast("Hospital ID not found for this doctor.");
              }
            }}
          />
        </div>
      )}

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

export default UserDashboard;