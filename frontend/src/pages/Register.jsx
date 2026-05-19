import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../services/api';
import { 
  Activity, 
  User, 
  Building2, 
  Mail, 
  Lock, 
  Phone, 
  MapPin, 
  Hash, 
  UserPlus, 
  AlertCircle,
  ArrowRight
} from 'lucide-react';

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
    <div className="min-h-screen bg-slate-950 flex items-center justify-center relative px-4 py-12 overflow-hidden selection:bg-blue-500 selection:text-white font-sans">
      
      {/* Background Orbs */}
      <div className="absolute -top-40 -right-40 w-96 h-96 bg-blue-600/20 rounded-full blur-[100px] pointer-events-none"></div>
      <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-emerald-500/15 rounded-full blur-[100px] pointer-events-none"></div>

      <div className="w-full max-w-lg relative z-10">
        
        {/* Brand/Logo Header */}
        <div className="flex flex-col items-center mb-8">
          <Link to="/" className="flex items-center gap-2.5 group">
            <div className="h-11 w-11 rounded-2xl bg-gradient-to-tr from-blue-600 to-emerald-500 flex items-center justify-center shadow-lg shadow-blue-500/20 group-hover:scale-105 transition-transform duration-300">
              <Activity className="h-5 w-5 text-white" />
            </div>
            <div>
              <span className="font-extrabold text-2xl bg-clip-text text-transparent bg-gradient-to-r from-white via-slate-100 to-blue-400 tracking-tight">
                Healthif<span className="text-emerald-400">AI</span>
              </span>
              <p className="text-[10px] text-slate-500 tracking-widest uppercase font-bold text-center">Smart Portal</p>
            </div>
          </Link>
        </div>

        {/* Register Card */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-8 shadow-2xl backdrop-blur-xl">
          
          <div className="mb-6 text-center">
            <h1 className="text-2xl font-extrabold text-white tracking-tight">Create Account</h1>
            <p className="text-slate-400 text-xs mt-1.5">Join the network and simplify your clinical logs today</p>
          </div>

          {/* Type / Role Selection Tabs */}
          <div className="flex bg-slate-950 p-1.5 rounded-2xl border border-slate-800/80 mb-6">
            <button 
              type="button"
              onClick={() => setType('user')} 
              className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-bold transition-all ${type === 'user' ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/10' : 'text-slate-400 hover:text-slate-200'}`}
            >
              <User className="h-4 w-4" />
              Patient Account
            </button>
            <button 
              type="button"
              onClick={() => setType('hospital')} 
              className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-bold transition-all ${type === 'hospital' ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/10' : 'text-slate-400 hover:text-slate-200'}`}
            >
              <Building2 className="h-4 w-4" />
              Hospital Entity
            </button>
          </div>

          {error && (
            <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 p-3.5 rounded-xl text-xs font-semibold flex items-center gap-2 mb-5 animate-slide-in-right">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            
            {/* Common fields grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              
              {/* Full Name */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                  {type === 'user' ? 'Full Name' : 'Hospital Name'}
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-slate-500">
                    {type === 'user' ? <User className="h-4.5 w-4.5" /> : <Building2 className="h-4.5 w-4.5" />}
                  </span>
                  <input 
                    name="username" 
                    placeholder={type === 'user' ? 'John Doe' : 'General Hospital'} 
                    value={form.username} 
                    onChange={handleChange} 
                    className="w-full bg-slate-950/60 border border-slate-800 text-slate-200 placeholder:text-slate-600 pl-11 pr-4 py-3 rounded-xl focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 outline-none transition-all text-sm font-medium" 
                    required 
                  />
                </div>
              </div>

              {/* Email */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Email Address</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-slate-500">
                    <Mail className="h-4.5 w-4.5" />
                  </span>
                  <input 
                    name="email" 
                    type="email" 
                    placeholder="name@example.com" 
                    value={form.email} 
                    onChange={handleChange} 
                    className="w-full bg-slate-950/60 border border-slate-800 text-slate-200 placeholder:text-slate-600 pl-11 pr-4 py-3 rounded-xl focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 outline-none transition-all text-sm font-medium" 
                    required 
                  />
                </div>
              </div>

              {/* Password */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Password</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-slate-500">
                    <Lock className="h-4.5 w-4.5" />
                  </span>
                  <input 
                    name="password" 
                    type="password" 
                    placeholder="••••••••" 
                    value={form.password} 
                    onChange={handleChange} 
                    className="w-full bg-slate-950/60 border border-slate-800 text-slate-200 placeholder:text-slate-600 pl-11 pr-4 py-3 rounded-xl focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 outline-none transition-all text-sm font-medium" 
                    required 
                  />
                </div>
              </div>

              {/* Phone Number */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Phone Number</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-slate-500">
                    <Phone className="h-4.5 w-4.5" />
                  </span>
                  <input 
                    name="phone" 
                    placeholder="+1 (555) 000-0000" 
                    value={form.phone} 
                    onChange={handleChange} 
                    className="w-full bg-slate-950/60 border border-slate-800 text-slate-200 placeholder:text-slate-600 pl-11 pr-4 py-3 rounded-xl focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 outline-none transition-all text-sm font-medium" 
                    required 
                  />
                </div>
              </div>

            </div>

            {/* Additional Hospital fields */}
            {type === 'hospital' && (
              <div className="border-t border-slate-800/80 pt-5 mt-5 space-y-4 animate-slide-in-right">
                
                <div className="mb-2">
                  <h3 className="text-xs font-bold text-blue-400 uppercase tracking-widest flex items-center gap-1.5">
                    <Building2 className="h-3.5 w-3.5" /> Hospital Coordinates & Address
                  </h3>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Street Address</label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-slate-500">
                      <MapPin className="h-4.5 w-4.5" />
                    </span>
                    <input 
                      name="address" 
                      placeholder="123 Care Street" 
                      value={form.address} 
                      onChange={handleChange} 
                      className="w-full bg-slate-950/60 border border-slate-800 text-slate-200 placeholder:text-slate-600 pl-11 pr-4 py-3 rounded-xl focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 outline-none transition-all text-sm font-medium" 
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  
                  {/* City */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">City</label>
                    <input 
                      name="city" 
                      placeholder="New York" 
                      value={form.city} 
                      onChange={handleChange} 
                      className="w-full bg-slate-950/60 border border-slate-800 text-slate-200 placeholder:text-slate-600 px-4 py-3 rounded-xl focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 outline-none transition-all text-sm font-medium" 
                    />
                  </div>

                  {/* State */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">State</label>
                    <input 
                      name="state" 
                      placeholder="NY" 
                      value={form.state} 
                      onChange={handleChange} 
                      className="w-full bg-slate-950/60 border border-slate-800 text-slate-200 placeholder:text-slate-600 px-4 py-3 rounded-xl focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 outline-none transition-all text-sm font-medium" 
                    />
                  </div>

                  {/* Zip Code */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">ZIP Code</label>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-slate-600">
                        <Hash className="h-3.5 w-3.5" />
                      </span>
                      <input 
                        name="zip" 
                        placeholder="10001" 
                        value={form.zip} 
                        onChange={handleChange} 
                        className="w-full bg-slate-950/60 border border-slate-800 text-slate-200 placeholder:text-slate-600 pl-8 pr-4 py-3 rounded-xl focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 outline-none transition-all text-sm font-medium" 
                      />
                    </div>
                  </div>

                </div>

              </div>
            )}

            {/* Submit Button */}
            <button 
              type="submit" 
              className="group w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-semibold py-3.5 rounded-xl shadow-lg shadow-blue-600/10 hover:shadow-blue-600/20 hover:scale-[1.02] active:scale-[0.98] transition-all text-sm mt-6"
            >
              <UserPlus className="h-4 w-4" />
              Register Account
              <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
            </button>

          </form>

          {/* Login Callout */}
          <p className="mt-8 text-center text-xs text-slate-500 font-medium">
            Already have an account?{' '}
            <Link to="/login" className="text-blue-400 hover:text-blue-300 font-bold transition-colors">
              Sign In
            </Link>
          </p>

        </div>
      </div>
    </div>
  );
};

export default Register;