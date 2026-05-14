import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const Navbar = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const getDashboardLink = () => {
    switch (user?.role) {
      case 'admin': return '/admin';
      case 'user': return '/user';
      case 'doctor': return '/doctor';
      case 'hospital': return '/hospital';
      default: return '/';
    }
  };

  return (
    <nav className="bg-blue-600 text-white p-4 flex justify-between items-center">
      <Link to={getDashboardLink()} className="text-xl font-bold">HealthifAI</Link>
      <div className="flex items-center space-x-4">
        <span>Welcome, {user?.name}</span>
        <button onClick={logout} className="bg-red-500 px-3 py-1 rounded">Logout</button>
      </div>
    </nav>
  );
};

export default Navbar;