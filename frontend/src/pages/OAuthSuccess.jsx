import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, ArrowRight, ShieldCheck, Mail, Sparkles } from 'lucide-react';

const OAuthSuccess = () => {
  const navigate = useNavigate();
  const [countdown, setCountdown] = useState(5);

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          handleRedirect();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const handleRedirect = () => {
    try {
      const userStr = sessionStorage.getItem('user');
      const userObj = userStr ? JSON.parse(userStr) : null;
      if (userObj?.role === 'user') {
        navigate('/user');
      } else if (userObj?.role === 'doctor') {
        navigate('/doctor');
      } else if (userObj?.role === 'hospital') {
        navigate('/hospital');
      } else if (userObj?.role === 'admin') {
        navigate('/admin');
      } else {
        navigate('/user');
      }
    } catch (err) {
      navigate('/login');
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center relative px-4 overflow-hidden selection:bg-emerald-500 selection:text-white font-sans">
      
      {/* Premium Background Orbs */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-emerald-600/20 rounded-full blur-[100px] pointer-events-none"></div>
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-blue-500/15 rounded-full blur-[100px] pointer-events-none"></div>

      <div className="w-full max-w-md relative z-10 animate-fade-in">
        
        {/* Decorative Badge */}
        <div className="flex justify-center mb-6">
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-950/80 border border-emerald-800/60 rounded-full text-xs font-bold text-emerald-400 uppercase tracking-widest shadow-lg shadow-emerald-950/40 animate-pulse">
            <Sparkles size={12} />
            Integration Complete
          </div>
        </div>

        {/* Card Container */}
        <div className="bg-slate-900/65 backdrop-blur-xl border border-slate-800/80 p-8 rounded-3xl shadow-2xl text-center space-y-6">
          
          {/* Animated Success Icon */}
          <div className="flex justify-center">
            <div className="relative">
              <div className="absolute inset-0 bg-emerald-500/20 rounded-full blur-md scale-110 animate-ping"></div>
              <div className="relative bg-emerald-950/60 border border-emerald-500/30 p-4 rounded-full text-emerald-400">
                <CheckCircle2 size={48} className="animate-bounce" />
              </div>
            </div>
          </div>

          {/* Texts */}
          <div className="space-y-2">
            <h1 className="text-3xl font-extrabold text-white tracking-tight bg-gradient-to-r from-white via-slate-100 to-slate-300 bg-clip-text text-transparent">
              Google Account Connected
            </h1>
            <p className="text-sm text-slate-400 leading-relaxed font-medium">
              Your Google credentials and email services have been successfully linked to your Scanbo Profile. You can now use Google login and email features.
            </p>
          </div>

          {/* Secure Note */}
          <div className="bg-slate-950/50 border border-slate-800/80 rounded-2xl p-4 flex gap-3 text-left">
            <ShieldCheck className="text-emerald-500 shrink-0 mt-0.5" size={18} />
            <div>
              <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">Secure Connection</h4>
              <p className="text-xs text-slate-500 font-semibold mt-0.5 leading-normal">
                Credentials are fully encrypted and stored securely using OAuth 2.0 protocols.
              </p>
            </div>
          </div>

          {/* Countdown & CTA */}
          <div className="space-y-4 pt-2">
            <button
              onClick={handleRedirect}
              className="w-full flex items-center justify-center gap-2 px-5 py-3.5 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white font-bold text-sm rounded-2xl shadow-lg shadow-emerald-500/10 hover:shadow-emerald-500/20 active:scale-[0.98] transition-all"
            >
              Back to Dashboard
              <ArrowRight size={16} />
            </button>

            <p className="text-xs text-slate-500 font-bold">
              Redirecting in <span className="text-emerald-400 font-extrabold">{countdown}s</span>...
            </p>
          </div>

        </div>

        {/* Footer info */}
        <p className="mt-8 text-center text-xs text-slate-600 font-bold tracking-wider">
          SCANBO SECURE INTEGRATION GATEWAY
        </p>

      </div>
    </div>
  );
};

export default OAuthSuccess;
