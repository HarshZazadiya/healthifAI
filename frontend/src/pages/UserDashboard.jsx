import { useState, useEffect } from 'react';
import api from '../services/api';
import NotificationBell from '../components/NotificationBell';
import MapComponent from '../components/MapComponent';
import LocationPicker from '../components/LocationPicker';
import DocumentUploader from '../components/DocumentUploader';
import { useAuth } from '../context/AuthContext';

const UserDashboard = () => {
  const { logout } = useAuth();
  const [activeTab, setActiveTab] = useState('overview');
  const [profile, setProfile] = useState({});
  const [editProfile, setEditProfile] = useState({ name: '', email: '' });
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

  const [availableDoctors, setAvailableDoctors] = useState([]);
  const [showBookingForm, setShowBookingForm] = useState(false);
  const [bookingDoctorId, setBookingDoctorId] = useState('');
  const [bookingDate, setBookingDate] = useState('');
  const [bookingStatusFilter, setBookingStatusFilter] = useState('');

  const bookAppointment = async (e) => {
    e.preventDefault();
    if (!bookingDoctorId || !bookingDate) {
      alert('Please select doctor and date');
      return;
    }
    try {
      await api.post('/user/appointment', {
        doctor_id: parseInt(bookingDoctorId),
        date: new Date(bookingDate).toISOString()
      });
      alert('Appointment booked successfully');
      setShowBookingForm(false);
      setBookingDoctorId('');
      setBookingDate('');
      loadData(); // refresh appointments list
    } catch (err) {
      alert('Failed to book appointment: ' + (err.response?.data?.detail || err.message));
    }
  };

  const cancelAppointment = async (appointmentId) => {
    if (window.confirm('Cancel this appointment?')) {
      try {
        await api.delete(`/user/appointment/${appointmentId}`);
        alert('Appointment cancelled');
        loadData();
      } catch (err) {
        alert('Failed to cancel: ' + (err.response?.data?.detail || err.message));
      }
    }
  };

  const openBookingForm = async () => {
    setShowBookingForm(true);
    if (availableDoctors.length === 0) {
      try {
        const res = await api.get('/user/doctors', { params: { limit: 100 } });
        // Flatten all doctors from all hospitals
        const docs = [];
        (res.data || []).forEach(h => {
          (h.doctors || []).forEach(d => {
            docs.push({ id: d.id, name: d.name, specialty: d.specialty });
          });
        });
        setAvailableDoctors(docs);
      } catch (err) {
        console.error(err);
      }
    }
  };

  const loadData = async () => {
    try {
      if (activeTab === 'overview') {
        const casesRes = await api.get('/user/cases', { params: { page: 1, limit: 5 } });
        const aptsRes = await api.get('/user/appointment', { params: { page: 1, limit: 5 } });
        const walletRes = await api.get('/default/myWallet');
        setCases(casesRes.data.cases || []);
        setAppointments(aptsRes.data || []);
        setWallet(walletRes.data);
      } else if (activeTab === 'profile') {
        const res = await api.get('/user/profile');
        setProfile(res.data);
        setEditProfile({ name: res.data.name, email: res.data.email });
      } else if (activeTab === 'symptoms') {
        const res = await api.get('/user/symptom');
        setSymptoms(res.data);
      } else if (activeTab === 'cases') {
        const res = await api.get('/user/cases', { params: { page, limit: 5 } });
        setCases(res.data.cases || []);
        setTotalPages(Math.ceil((res.data.total || 0) / 5));
      } else if (activeTab === 'appointments') {
        const res = await api.get('/user/appointment', { params: { page, limit: 5 } });
        setAppointments(res.data || []);
      } else if (activeTab === 'doctors') {
        const res = await api.get('/user/doctors', { params: { ...filters, page, limit: 6 } });
        setDoctors(res.data || []);
      } else if (activeTab === 'myDoctors') {
        const res = await api.get('/user/my-doctors', { params: { ...filters, page, limit: 5 } });
        setMyDoctors(res.data || []);
      } else if (activeTab === 'wallet') {
        const w = await api.get('/default/myWallet');
        const t = await api.get('/user/transactions', { params: { page, limit: 10 } });
        setWallet(w.data);
        setTransactions(t.data || []);
      } else if (activeTab === 'documents') {
        try {
          const res = await api.get('/default/documents', { params: { limit: 20, offset: 0 } });
          setDocuments(res.data.documents || []);
          setAllDocuments(res.data.documents || []);
        } catch (err) {
          console.error(err);
          setDocuments([]);
        }
      } else if (activeTab === 'location') {
        const res = await api.get('/user/location');
        setLocation({ lat: res.data.latitude, lon: res.data.longitude });
      }
    } catch (err) { console.error('Load error:', err); }
  };

  useEffect(() => { loadData(); }, [activeTab, page, filters]);

  const updateProfile = async () => {
    await api.put('/user/profile', editProfile);
    alert('Profile updated');
    loadData();
  };

  const connectGoogle = () => {
    window.location.href = 'http://localhost:8000/auth/google'; // change to your backend URL
  };

  const handleTopUp = async () => {
    await api.put('/default/topUp', { amount: topUpAmount });
    alert('Wallet topped up');
    loadData();
  };

  const addSymptom = async (e) => {
    e.preventDefault();
    await api.post('/user/symptom', newSymptom);
    setNewSymptom({ symptom: '', severity: 5 });
    loadData();
  };

  const assignDoctor = async (doctorId) => {
    await api.post(`/user/assign/${doctorId}`);
    alert('Doctor assigned');
    loadData();
  };

  const closeCase = async (caseId) => {
    await api.put(`/user/cases/${caseId}`);
    alert('Closure requested');
    loadData();
  };

  const reopenCase = async (caseId) => {
    await api.put(`/user/reopen/${caseId}`);
    alert('Case reopened');
    loadData();
  };

  const addSymptomToCase = async (caseId, symptomId) => {
    await api.put(`/user/cases/${caseId}/symptoms`, { symptom_ids: [symptomId] });
    alert('Symptom added to case');
    loadData();
    // refresh modal data
    if (selectedCase) viewCaseDetails(selectedCase.id);
  };

  const addDocumentToCase = async (caseId, docId) => {
    await api.put(`/user/cases/${caseId}/documents`, { document_ids: [docId] });
    alert('Document added to case');
    loadData();
    if (selectedCase) viewCaseDetails(selectedCase.id);
  };

  const updateLocation = async (lat, lon) => {
    await api.put('/user/location', { latitude: lat, longitude: lon });
    alert('Location updated');
    loadData();
  };

  const findNearbyDoctors = async () => {
    if (!location.lat || !location.lon) {
      alert('Please set your location first (use GPS, IP, or manual entry)');
      return;
    }
    try {
      const res = await api.get(`/user/nearby-doctors/10`);
      const data = res.data.data || [];
      if (data.length === 0) {
        alert('No nearby doctors found');
      }
      setNearbyDoctors(data);
    } catch (err) {
      console.error(err);
      alert('Failed to fetch nearby doctors: ' + (err.response?.data?.detail || err.message));
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
      // fetch all symptoms for dropdown
      const symRes = await api.get('/user/symptom');
      setAllSymptoms(symRes.data || []);
      const docRes = await api.get('/default/documents');
      setAllDocuments(docRes.data.documents || []);
    } catch (err) {
      console.error(err);
      alert('Error loading case details');
    }
  };

  const renderOverview = () => (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <div className="bg-white p-6 rounded shadow"><h3 className="font-semibold">Total Cases</h3><p className="text-3xl text-blue-600">{cases.length}</p></div>
      <div className="bg-white p-6 rounded shadow"><h3 className="font-semibold">Upcoming Appointments</h3><p className="text-3xl text-green-600">{appointments.filter(a => new Date(a.date) > new Date()).length}</p></div>
      <div className="bg-white p-6 rounded shadow"><h3 className="font-semibold">Wallet Balance</h3><p className="text-3xl text-purple-600">₹{wallet.balance}</p></div>
    </div>
  );

  const renderProfile = () => (
    <div className="bg-white p-6 rounded shadow max-w-md">
      <h2 className="text-2xl font-bold mb-4">My Profile</h2>
      <div className="space-y-3">
        <div><label className="font-medium">Name</label><input value={editProfile.name} onChange={e => setEditProfile({...editProfile, name: e.target.value})} className="border p-2 w-full rounded" /></div>
        <div><label className="font-medium">Email</label><input value={editProfile.email} onChange={e => setEditProfile({...editProfile, email: e.target.value})} className="border p-2 w-full rounded" /></div>
        <div><label className="font-medium">Google Email</label><input value={profile.google_email_id || 'Not connected'} disabled className="border p-2 w-full rounded bg-gray-100" /></div>
        <button onClick={updateProfile} className="bg-blue-600 text-white px-4 py-2 rounded mr-2">Update Profile</button>
        <button onClick={connectGoogle} className="bg-red-600 text-white px-4 py-2 rounded">Connect Google Account</button>
      </div>
    </div>
  );

  const renderCases = () => (
    <div>
      <h2 className="text-2xl font-bold mb-4">My Cases</h2>
      {cases.map(c => (
        <div key={c.id} className="border rounded-lg p-4 mb-4 shadow-sm">
          <div className="flex justify-between items-start flex-wrap">
            <div><span className="font-bold">Case ID:</span> {c.case_id}<br/><span className="font-bold">Status:</span> <span className={`px-2 py-1 rounded text-sm ${c.status === 'OPEN' ? 'bg-green-100 text-green-800' : 'bg-gray-100'}`}>{c.status}</span><br/><span className="font-bold">Doctor:</span> {c.doctor_name}<br/><span className="font-bold">Hospital:</span> {c.hospital_name}</div>
            <div className="mt-2">
              {c.status === 'OPEN' && <button onClick={() => closeCase(c.id)} className="bg-red-500 text-white px-3 py-1 rounded mr-2">Request Close</button>}
              {c.status === 'CLOSED' && <button onClick={() => reopenCase(c.id)} className="bg-blue-500 text-white px-3 py-1 rounded">Reopen</button>}
              <button onClick={() => viewCaseDetails(c.id)} className="bg-gray-500 text-white px-3 py-1 rounded ml-2">View Details</button>
            </div>
          </div>
          {c.symptoms?.length > 0 && <div className="mt-2"><span className="font-bold">Symptoms:</span> {c.symptoms.map(s => s.name).join(', ')}</div>}
        </div>
      ))}
      <div className="flex justify-center space-x-2 mt-4">
        {[...Array(totalPages)].map((_, i) => <button key={i} onClick={() => setPage(i+1)} className={`px-3 py-1 rounded ${page === i+1 ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}>{i+1}</button>)}
      </div>
    </div>
  );

  const renderCaseModal = () => {
    if (!selectedCase) return null;
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
        <div className="bg-white rounded-lg p-6 max-w-3xl w-full max-h-screen overflow-auto">
          <h2 className="text-2xl font-bold mb-4">Case {selectedCase.case_id}</h2>
          <div className="mb-4"><span className="font-bold">Status:</span> {selectedCase.status}<br/><span className="font-bold">Opened:</span> {new Date(selectedCase.case_opened_on).toLocaleString()}<br/><span className="font-bold">Last Updated:</span> {new Date(selectedCase.case_updated_on).toLocaleString()}</div>
          
          <div className="mb-4"><h3 className="font-bold text-lg">Symptoms</h3>
            <ul>{caseSymptoms.map(s => <li key={s.id}>{s.name}</li>)}</ul>
            <select onChange={e => addSymptomToCase(selectedCase.id, parseInt(e.target.value))} className="border p-2 mt-2 w-full">
              <option value="">Add Symptom</option>
              {allSymptoms.map(s => <option key={s.id} value={s.id}>{s.symptom}</option>)}
            </select>
          </div>
          
          <div className="mb-4"><h3 className="font-bold text-lg">User Documents</h3>
            <ul>{caseUserDocs.map(d => <li key={d.id}><a href={d.url} target="_blank" rel="noopener noreferrer" className="text-blue-600">{d.type}</a></li>)}</ul>
          </div>
          
          <div className="mb-4"><h3 className="font-bold text-lg">Doctor Documents</h3>
            <ul>{caseDoctorDocs.map(d => <li key={d.id}><a href={d.url} target="_blank" rel="noopener noreferrer" className="text-blue-600">{d.type}</a></li>)}</ul>
          </div>
          
          <div><h3 className="font-bold text-lg">Add Existing Document</h3>
            <select onChange={e => addDocumentToCase(selectedCase.id, parseInt(e.target.value))} className="border p-2 mt-2 w-full">
              <option value="">Select Document</option>
              {allDocuments.map(d => <option key={d.id} value={d.id}>{d.type} - {new Date(d.date).toLocaleDateString()}</option>)}
            </select>
          </div>
          
          <div className="mt-4 text-right"><button onClick={() => setSelectedCase(null)} className="bg-gray-500 text-white px-4 py-2 rounded">Close</button></div>
        </div>
      </div>
    );
  };

  const renderAppointments = () => {
    // Filter appointments if status filter is set
    const filteredApps = bookingStatusFilter 
      ? appointments.filter(a => a.status === bookingStatusFilter)
      : appointments;

    return (
      <div>
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold">Appointments</h2>
          <button 
            onClick={openBookingForm} 
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
          >
            {showBookingForm ? 'Cancel' : '+ Book Appointment'}
          </button>
        </div>

        {showBookingForm && (
          <div className="bg-white p-4 rounded shadow mb-6 border">
            <h3 className="font-bold text-lg mb-3">Book New Appointment</h3>
            <form onSubmit={bookAppointment} className="space-y-3">
              <div>
                <label className="block text-sm font-medium">Select Doctor</label>
                <select 
                  value={bookingDoctorId} 
                  onChange={e => setBookingDoctorId(e.target.value)} 
                  className="border p-2 w-full rounded" 
                  required
                >
                  <option value="">-- Choose Doctor --</option>
                  {availableDoctors.map(d => (
                    <option key={d.id} value={d.id}>{d.name} - {d.specialty}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium">Date & Time</label>
                <input 
                  type="datetime-local" 
                  value={bookingDate} 
                  onChange={e => setBookingDate(e.target.value)} 
                  className="border p-2 w-full rounded" 
                  required 
                />
              </div>
              <button type="submit" className="bg-green-600 text-white px-4 py-2 rounded">Confirm Booking</button>
              <button type="button" onClick={() => setShowBookingForm(false)} className="ml-2 bg-gray-400 text-white px-4 py-2 rounded">Cancel</button>
            </form>
          </div>
        )}

        <div className="mb-4">
          <label className="mr-2">Filter by status:</label>
          <select 
            value={bookingStatusFilter} 
            onChange={e => setBookingStatusFilter(e.target.value)}
            className="border p-1 rounded"
          >
            <option value="">All</option>
            <option value="PENDING">Pending</option>
            <option value="CONFIRMED">Confirmed</option>
            <option value="CANCELLED">Cancelled</option>
            <option value="COMPLETED">Completed</option>
          </select>
        </div>

        {filteredApps.length === 0 ? (
          <p className="text-gray-500">No appointments found.</p>
        ) : (
          <div className="space-y-3">
            {filteredApps.map(a => (
              <div key={a.id} className="border p-4 rounded shadow-sm bg-white">
                <div className="flex justify-between items-start flex-wrap">
                  <div>
                    <p><span className="font-bold">Doctor:</span> {a.doctor_name}</p>
                    <p><span className="font-bold">Date:</span> {new Date(a.date).toLocaleString()}</p>
                    <p><span className="font-bold">Status:</span> 
                      <span className={`ml-2 px-2 py-1 rounded text-sm ${
                        a.status === 'CONFIRMED' ? 'bg-green-100 text-green-800' :
                        a.status === 'PENDING' ? 'bg-yellow-100 text-yellow-800' :
                        a.status === 'CANCELLED' ? 'bg-red-100 text-red-800' :
                        'bg-gray-100'
                      }`}>{a.status}</span>
                    </p>
                    {a.case_id && <p><span className="font-bold">Case ID:</span> {a.case_id}</p>}
                  </div>
                  {a.status !== 'CANCELLED' && (
                    <button 
                      onClick={() => cancelAppointment(a.id)} 
                      className="bg-red-500 text-white px-3 py-1 rounded text-sm hover:bg-red-600"
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  const renderDoctors = () => (
    <div>
      <h2 className="text-2xl font-bold mb-4">Find Doctors</h2>
      <div className="flex flex-wrap gap-2 mb-4">
        <input placeholder="Doctor name" className="border p-2 rounded" onChange={e => setFilters({...filters, doctor_name: e.target.value})} />
        <input placeholder="Hospital name" className="border p-2 rounded" onChange={e => setFilters({...filters, hospital_name: e.target.value})} />
        <input placeholder="Specialty" className="border p-2 rounded" onChange={e => setFilters({...filters, specialty: e.target.value})} />
        <button onClick={() => loadData()} className="bg-blue-600 text-white px-4 py-2 rounded">Filter</button>
      </div>
      <div className="grid md:grid-cols-2 gap-4">
        {doctors.map(h => h.doctors?.map(d => (
          <div key={d.id} className="border p-4 rounded shadow">
            <h3 className="font-bold">Dr. {d.name}</h3>
            <p>Specialty: {d.specialty}</p>
            <p>Fees: ₹{d.fees}</p>
            <p>Hospital: {h.hospital_name}</p>
            <button onClick={() => assignDoctor(d.id)} className="mt-2 bg-green-600 text-white px-4 py-1 rounded">Assign</button>
          </div>
        )))}
      </div>
    </div>
  );

  const renderMyDoctors = () => (
    <div>
      <h2 className="text-2xl font-bold mb-4">My Doctors</h2>
      <div className="grid md:grid-cols-2 gap-4">
        {myDoctors.map(d => (
          <div key={d.doctor_id} className="border p-4 rounded shadow cursor-pointer" onClick={() => alert(`Doctor: ${d.name}\nSpecialty: ${d.specialty}\nHospital: ${d.hospital}\nEmail: ${d.email}`)}>
            <h3 className="font-bold text-lg">{d.name}</h3>
            <p>Specialty: {d.specialty}</p>
            <p>Hospital: {d.hospital}</p>
            {d.case_id && <p>Active Case: {d.case_id}</p>}
          </div>
        ))}
      </div>
    </div>
  );

  const renderWallet = () => (
    <div className="bg-white p-6 rounded shadow max-w-md">
      <h2 className="text-2xl font-bold mb-4">Wallet</h2>
      <div className="text-center mb-4"><span className="text-4xl font-bold text-green-600">₹{wallet.balance}</span></div>
      <div className="flex gap-2 mb-6">
        <input type="number" placeholder="Amount" value={topUpAmount} onChange={e => setTopUpAmount(parseInt(e.target.value))} className="border p-2 flex-1 rounded" />
        <button onClick={handleTopUp} className="bg-blue-600 text-white px-4 py-2 rounded">Top Up</button>
      </div>
      <h3 className="font-bold mb-2">Transactions</h3>
      <ul className="space-y-2 max-h-80 overflow-auto">
        {transactions.map(t => <li key={t.id} className="border p-2 rounded"><span className="font-medium">₹{t.amount}</span> - {t.type} - {t.note}<br/><span className="text-xs text-gray-500">{new Date(t.date).toLocaleString()}</span></li>)}
      </ul>
    </div>
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

  const renderLocation = () => (
    <div>
      <h2 className="text-2xl font-bold mb-4">My Location & Nearby Doctors</h2>
      <div className="mb-6">
        <LocationPicker onLocationSelect={updateLocation} initialLat={location.lat} initialLon={location.lon} />
      </div>
      <button onClick={findNearbyDoctors} className="bg-blue-600 text-white px-4 py-2 rounded mb-6 hover:bg-blue-700">
        Find Nearby Doctors
      </button>
      {nearbyDoctors.length > 0 && (
        <div>
          <h3 className="text-xl font-semibold mb-3">Nearby Doctors (within ~10km)</h3>
          {nearbyDoctors.some(d => d.hospital_lat && d.hospital_lon) && (
            <MapComponent 
              markers={nearbyDoctors.filter(d => d.hospital_lat && d.hospital_lon).map(d => ({ 
                lat: parseFloat(d.hospital_lat), 
                lon: parseFloat(d.hospital_lon), 
                label: `${d.name} (${d.distance_km?.toFixed(1)} km) - ${d.hospital_name}` 
              }))} 
            />
          )}
          <div className="grid md:grid-cols-2 gap-3 mt-4">
            {nearbyDoctors.map(d => (
              <div key={d.id} className="border p-3 rounded shadow">
                <span className="font-bold text-lg">{d.name}</span>
                <p>Specialty: {d.specialty || 'N/A'}</p>
                <p>Distance: {d.distance_km ? d.distance_km.toFixed(1) : '?'} km</p>
                <p>Hospital: {d.hospital_name || 'N/A'}</p>
                <button onClick={() => assignDoctor(d.id)} className="mt-2 bg-green-600 text-white px-3 py-1 rounded text-sm hover:bg-green-700">
                  Assign Doctor
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  const tabs = ['overview', 'profile', 'symptoms', 'cases', 'appointments', 'doctors', 'myDoctors', 'wallet', 'documents', 'location'];
  const tabNames = ['Overview', 'Profile', 'Symptoms', 'Cases', 'Appointments', 'Find Doctors', 'My Doctors', 'Wallet', 'Documents', 'Location'];

  return (
    <div>
      <div className="flex justify-between items-center bg-blue-600 text-white p-4">
        <h1 className="text-xl">HealthifAI - User Dashboard</h1>
        <div className="flex items-center space-x-4">
          <NotificationBell />
          <button onClick={logout} className="bg-red-500 px-3 py-1 rounded">Logout</button>
        </div>
      </div>
      <div className="flex">
        <div className="w-64 bg-gray-800 text-white min-h-screen p-4">
          {tabs.map((tab, idx) => <button key={tab} onClick={() => { setActiveTab(tab); setPage(1); }} className={`block w-full text-left p-2 rounded mb-1 ${activeTab === tab ? 'bg-blue-600' : 'hover:bg-gray-700'}`}>{tabNames[idx]}</button>)}
        </div>
        <div className="flex-1 p-6 bg-gray-100">
          {activeTab === 'overview' && renderOverview()}
          {activeTab === 'profile' && renderProfile()}
          {activeTab === 'symptoms' && (
            <div><h2 className="text-2xl font-bold mb-4">Symptoms</h2><form onSubmit={addSymptom} className="mb-4 flex gap-2"><input value={newSymptom.symptom} onChange={e => setNewSymptom({...newSymptom, symptom: e.target.value})} placeholder="Symptom" className="border p-2 flex-1 rounded" required /><input type="number" min="0" max="10" value={newSymptom.severity} onChange={e => setNewSymptom({...newSymptom, severity: parseInt(e.target.value)})} className="border p-2 w-24 rounded" /><button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded">Add</button></form><ul>{symptoms.map(s => <li key={s.id} className="border p-2 mb-1 rounded">{s.symptom} (Severity: {s.severity}) - {new Date(s.date).toLocaleString()}</li>)}</ul></div>
          )}
          {activeTab === 'cases' && renderCases()}
          {activeTab === 'appointments' && renderAppointments()}
          {activeTab === 'doctors' && renderDoctors()}
          {activeTab === 'myDoctors' && renderMyDoctors()}
          {activeTab === 'wallet' && renderWallet()}
          {activeTab === 'documents' && renderDocuments()}
          {activeTab === 'location' && renderLocation()}
        </div>
      </div>
      {selectedCase && renderCaseModal()}
    </div>
  );
};

export default UserDashboard;