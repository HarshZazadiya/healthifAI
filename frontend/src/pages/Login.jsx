import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { 
  Activity, 
  Mail, 
  Lock, 
  LogIn, 
  AlertCircle,
  ArrowRight
} from 'lucide-react';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const user = await login(email, password);
      if (user.role === 'admin') navigate('/admin');
      else if (user.role === 'user') navigate('/user');
      else if (user.role === 'doctor') navigate('/doctor');
      else if (user.role === 'hospital') navigate('/hospital');
      else navigate('/');
    } catch (err) {
      setError('Invalid email or password');
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center relative px-4 overflow-hidden selection:bg-blue-500 selection:text-white font-sans">
      
      {/* Background Orbs */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-blue-600/20 rounded-full blur-[100px] pointer-events-none"></div>
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-emerald-500/15 rounded-full blur-[100px] pointer-events-none"></div>

      <div className="w-full max-w-md relative z-10">
        
        {/* Logo/Brand Icon */}
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

        {/* Login Card */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-8 shadow-2xl backdrop-blur-xl">
          
          <div className="mb-6 text-center">
            <h1 className="text-2xl font-extrabold text-white tracking-tight">Welcome Back</h1>
            <p className="text-slate-400 text-xs mt-1.5">Enter your credentials to access your clinical dashboard</p>
          </div>

          {error && (
            <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 p-3.5 rounded-xl text-xs font-semibold flex items-center gap-2 mb-5 animate-slide-in-right">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            
            {/* Email Field */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Email Address</label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-slate-500">
                  <Mail className="h-4.5 w-4.5" />
                </span>
                <input 
                  type="email" 
                  placeholder="name@example.com" 
                  value={email} 
                  onChange={(e) => setEmail(e.target.value)} 
                  className="w-full bg-slate-950/60 border border-slate-800 text-slate-200 placeholder:text-slate-600 pl-11 pr-4 py-3 rounded-xl focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 outline-none transition-all text-sm font-medium" 
                  required 
                />
              </div>
            </div>

            {/* Password Field */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Password</label>
              </div>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-slate-500">
                  <Lock className="h-4.5 w-4.5" />
                </span>
                <input 
                  type="password" 
                  placeholder="••••••••" 
                  value={password} 
                  onChange={(e) => setPassword(e.target.value)} 
                  className="w-full bg-slate-950/60 border border-slate-800 text-slate-200 placeholder:text-slate-600 pl-11 pr-4 py-3 rounded-xl focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 outline-none transition-all text-sm font-medium" 
                  required 
                />
              </div>
            </div>

            {/* Submit Button */}
            <button 
              type="submit" 
              className="group w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-semibold py-3.5 rounded-xl shadow-lg shadow-blue-600/10 hover:shadow-blue-600/20 hover:scale-[1.02] active:scale-[0.98] transition-all text-sm mt-6"
            >
              <LogIn className="h-4 w-4" />
              Sign In
              <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
            </button>

          </form>

          {/* Register Callout */}
          <p className="mt-8 text-center text-xs text-slate-500 font-medium">
            Don't have an account yet?{' '}
            <Link to="/register" className="text-blue-400 hover:text-blue-300 font-bold transition-colors">
              Create Account
            </Link>
          </p>

        </div>
      </div>
    </div>
  );
};

export default Login;