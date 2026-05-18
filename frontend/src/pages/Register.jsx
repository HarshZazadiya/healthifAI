import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';

const Register = () => {
  const [type, setType] = useState('user');
  const [form, setForm] = useState({
    username: '', email: '', password: '', phone: '',
    address: '', city: '', state: '', zip: ''
  });
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (type === 'user') {
        await api.post('/auth/user', {
          username: form.username,
          email: form.email,
          password: form.password,
          phone: form.phone
        });
      } else {
        await api.post('/auth/hospital', {
          name: form.username,
          email: form.email,
          password: form.password,
          phone: form.phone,
          address: form.address,
          city: form.city,
          state: form.state,
          zip: form.zip
        });
      }
      navigate('/login');
    } catch (err) {
      setError(err.response?.data?.detail || 'Registration failed');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="bg-white p-8 rounded shadow-md w-full max-w-md">
        <h1 className="text-2xl font-bold mb-6 text-center">Register as</h1>
        <div className="flex mb-4">
          <button onClick={() => setType('user')} className={`flex-1 py-2 ${type === 'user' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}>User</button>
          <button onClick={() => setType('hospital')} className={`flex-1 py-2 ${type === 'hospital' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}>Hospital</button>
        </div>
        <form onSubmit={handleSubmit}>
          <input name="username" placeholder="Full Name" value={form.username} onChange={handleChange} className="w-full p-2 border rounded mb-3" required />
          <input name="email" type="email" placeholder="Email" value={form.email} onChange={handleChange} className="w-full p-2 border rounded mb-3" required />
          <input name="password" type="password" placeholder="Password" value={form.password} onChange={handleChange} className="w-full p-2 border rounded mb-3" required />
          <input name="phone" placeholder="Phone Number" value={form.phone} onChange={handleChange} className="w-full p-2 border rounded mb-3" required />
          {type === 'hospital' && (
            <>
              <input name="address" placeholder="Address" value={form.address} onChange={handleChange} className="w-full p-2 border rounded mb-3" />
              <input name="city" placeholder="City" value={form.city} onChange={handleChange} className="w-full p-2 border rounded mb-3" />
              <input name="state" placeholder="State" value={form.state} onChange={handleChange} className="w-full p-2 border rounded mb-3" />
              <input name="zip" placeholder="ZIP Code" value={form.zip} onChange={handleChange} className="w-full p-2 border rounded mb-3" />
            </>
          )}
          {error && <p className="text-red-500 mb-2">{error}</p>}
          <button type="submit" className="w-full bg-blue-600 text-white py-2 rounded">Register</button>
        </form>
      </div>
    </div>
  );
};

export default Register;