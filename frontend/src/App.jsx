import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './pages/Login';
import Register from './pages/Register';
import Landing from './pages/Landing';
import UserDashboard from './pages/UserDashboard';
import DoctorDashboard from './pages/DoctorDashboard';
import HospitalDashboard from './pages/HospitalDashboard';
import AdminDashboard from './pages/AdminDashboard';
import OAuthSuccess from './pages/OAuthSuccess';
import ChatbotSettings from './pages/ChatbotSettings';

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/oauth-success" element={<OAuthSuccess />} />
          <Route path="/user" element={<ProtectedRoute allowedRoles={['user']}><UserDashboard /></ProtectedRoute>} />
          <Route path="/doctor" element={<ProtectedRoute allowedRoles={['doctor']}><DoctorDashboard /></ProtectedRoute>} />
          <Route path="/hospital" element={<ProtectedRoute allowedRoles={['hospital']}><HospitalDashboard /></ProtectedRoute>} />
          <Route path="/admin" element={<ProtectedRoute allowedRoles={['admin']}><AdminDashboard /></ProtectedRoute>} />
          <Route path="/chatbot-settings" element={<ProtectedRoute allowedRoles={['user', 'doctor', 'hospital', 'admin']}><ChatbotSettings /></ProtectedRoute>} />
          <Route path="/" element={<Landing />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;