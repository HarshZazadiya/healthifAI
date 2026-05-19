import { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  Activity,
  Shield,
  MessageSquare,
  MapPin,
  FileText,
  ArrowRight,
  UserPlus,
  LogIn,
  Heart,
  Sparkles,
  Search,
  CheckCircle,
  Stethoscope,
  ChevronRight,
  User,
  LogOut
} from 'lucide-react';

const Landing = () => {
  const { user, logout } = useAuth();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Close dropdown on click outside
  useEffect(() => {
    const handleOutsideClick = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

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
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans overflow-x-hidden selection:bg-blue-500 selection:text-white">

      {/* Background Decorative Elements */}
      <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-blue-500/10 rounded-full blur-[120px] pointer-events-none -z-10 animate-pulse duration-[8000ms]"></div>
      <div className="absolute top-1/3 right-1/4 w-[600px] h-[600px] bg-emerald-500/10 rounded-full blur-[140px] pointer-events-none -z-10 animate-pulse duration-[12000ms]"></div>
      <div className="absolute bottom-10 left-1/3 w-[450px] h-[450px] bg-indigo-500/10 rounded-full blur-[100px] pointer-events-none -z-10"></div>

      {/* Glassmorphic Navbar */}
      <header className="sticky top-0 z-50 w-full border-b border-slate-800/50 bg-slate-950/80 backdrop-blur-md transition-all duration-300">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3 group">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-blue-600 to-emerald-500 flex items-center justify-center shadow-lg shadow-blue-500/20 group-hover:scale-105 transition-transform duration-300">
              <Activity className="h-5 w-5 text-white" />
            </div>
            <div>
              <span className="font-extrabold text-2xl bg-clip-text text-transparent bg-gradient-to-r from-white via-slate-100 to-blue-400 tracking-tight">
                Healthif<span className="text-emerald-400">AI</span>
              </span>
              <p className="text-[10px] text-slate-500 tracking-widest uppercase font-bold">Smart Medical Portal</p>
            </div>
          </div>

          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-400">
            <a href="#features" className="hover:text-blue-400 transition-colors duration-200">Features</a>
            <a href="#workflow" className="hover:text-blue-400 transition-colors duration-200">How It Works</a>
            <a href="#about" className="hover:text-blue-400 transition-colors duration-200">Integrations</a>
          </nav>

          <div className="flex items-center gap-4" ref={dropdownRef}>
            {user ? (
              <div className="relative">
                <button
                  onClick={() => setDropdownOpen(!dropdownOpen)}
                  className="flex items-center gap-2.5 p-1.5 rounded-2xl bg-slate-900 border border-slate-800 hover:border-slate-700 transition-all duration-200 active:scale-[0.98]"
                >
                  {user.google_profile_pic ? (
                    <img src={user.google_profile_pic} alt={user.name} className="w-8 h-8 rounded-xl object-cover" />
                  ) : (
                    <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-blue-600 to-emerald-500 flex items-center justify-center font-bold text-white text-sm">
                      {user.name ? user.name.charAt(0).toUpperCase() : 'U'}
                    </div>
                  )}
                  <span className="text-slate-300 text-xs font-semibold pr-2 hidden sm:inline-block max-w-[120px] truncate">{user.name || 'Account'}</span>
                </button>

                {dropdownOpen && (
                  <div className="absolute right-0 mt-3 w-56 bg-slate-900 border border-slate-800 rounded-2xl p-2 shadow-2xl backdrop-blur-xl z-[100] animate-slide-in-right">
                    <div className="px-3 py-2 border-b border-slate-800/80 mb-1">
                      <p className="text-slate-200 text-xs font-bold truncate">{user.name}</p>
                      <p className="text-slate-500 text-[10px] truncate mt-0.5">{user.email}</p>
                    </div>
                    <Link
                      to={getDashboardLink()}
                      onClick={() => setDropdownOpen(false)}
                      className="flex items-center gap-2 w-full px-3 py-2.5 rounded-xl text-xs font-semibold text-slate-300 hover:text-white hover:bg-slate-800/60 transition-all"
                    >
                      <User className="h-4 w-4 text-blue-500" />
                      See Profile / Dashboard
                    </Link>
                    <button
                      onClick={() => { logout(); setDropdownOpen(false); }}
                      className="flex items-center gap-2 w-full px-3 py-2.5 rounded-xl text-xs font-semibold text-rose-400 hover:text-rose-350 hover:bg-rose-500/10 transition-all text-left mt-1"
                    >
                      <LogOut className="h-4 w-4" />
                      Log Out
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <>
                <Link
                  to="/login"
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-slate-800 hover:border-slate-700 bg-slate-900/50 text-sm font-semibold text-slate-200 hover:bg-slate-900 transition-all duration-200 hover:scale-[1.02]"
                >
                  <LogIn className="h-4 w-4" />
                  Sign In
                </Link>
                <Link
                  to="/register"
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-emerald-500 text-sm font-semibold text-white shadow-lg shadow-blue-500/10 hover:shadow-blue-500/20 transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
                >
                  <UserPlus className="h-4 w-4" />
                  Sign Up
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative pt-12 pb-24 md:pt-20 md:pb-32 max-w-7xl mx-auto px-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center">

          {/* Left Hero Column */}
          <div className="lg:col-span-7 flex flex-col items-start text-left space-y-6">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-blue-500/20 bg-blue-500/5 text-blue-400 text-xs font-bold uppercase tracking-wider animate-bounce duration-[3000ms]">
              <Sparkles className="h-3.5 w-3.5" />
              Next-Gen Medical Care
            </div>

            <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight leading-[1.1] text-white">
              Revolutionizing <br />
              Healthcare with <br />
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-blue-400 via-indigo-400 to-emerald-400">
                Unified Intelligence
              </span>
            </h1>

            <p className="text-lg text-slate-400 max-w-xl leading-relaxed">
              Log symptoms seamlessly, connect with doctors instantly, organize patient records, and locate nearby clinical support—all powered by a secure, real-time clinical platform.
            </p>

            {/* CTAs */}
            <div className="flex flex-wrap items-center gap-4 pt-4">
              <Link
                to="/register"
                className="group flex items-center gap-2 px-8 py-4 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-semibold shadow-lg shadow-blue-500/25 transition-all duration-200 hover:scale-[1.02] active:scale-95"
              >
                Get Started Free
                <ArrowRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
              </Link>
              <a
                href="#features"
                className="flex items-center gap-2 px-8 py-4 rounded-2xl border border-slate-800 hover:border-slate-700 bg-slate-900/30 hover:bg-slate-900/60 text-slate-300 font-semibold transition-all duration-200 hover:scale-[1.02]"
              >
                Learn More
              </a>
            </div>

            {/* Quick Metrics */}
            <div className="grid grid-cols-3 gap-6 pt-10 border-t border-slate-900 w-full max-w-lg">
              <div>
                <p className="text-3xl font-extrabold text-white">99.4%</p>
                <p className="text-xs text-slate-500 mt-1 uppercase font-bold tracking-wider">Uptime SLA</p>
              </div>
              <div>
                <p className="text-3xl font-extrabold text-white">10k+</p>
                <p className="text-xs text-slate-500 mt-1 uppercase font-bold tracking-wider">Active Scans</p>
              </div>
              <div>
                <p className="text-3xl font-extrabold text-white">0s</p>
                <p className="text-xs text-slate-500 mt-1 uppercase font-bold tracking-wider">Chat Latency</p>
              </div>
            </div>

          </div>

          {/* Right Hero Column (Dashboard Visual) */}
          <div className="lg:col-span-5 relative w-full flex items-center justify-center">
            {/* Ambient Outer Glow */}
            <div className="absolute inset-0 bg-gradient-to-tr from-blue-500/20 to-emerald-500/20 rounded-3xl blur-2xl -z-10"></div>

            {/* Interactive Looking Dashboard Card Mock */}
            <div className="w-full bg-slate-900/80 border border-slate-800 rounded-3xl p-6 shadow-2xl backdrop-blur-xl relative overflow-hidden">
              <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-6">
                <div className="flex items-center gap-2.5">
                  <div className="w-3 h-3 rounded-full bg-red-500"></div>
                  <div className="w-3 h-3 rounded-full bg-amber-500"></div>
                  <div className="w-3 h-3 rounded-full bg-emerald-500"></div>
                  <span className="text-xs text-slate-500 font-mono ml-2">healthifai_core_v1.0</span>
                </div>
                <span className="px-2 py-1 rounded bg-blue-500/10 text-blue-400 text-[10px] font-mono border border-blue-500/20">LIVE APPOINTMENTS</span>
              </div>

              {/* Mock Dashboard Widget 1: Heart Rate */}
              <div className="bg-slate-950/50 border border-slate-800/80 rounded-2xl p-4 mb-4 flex items-center justify-between hover:border-blue-500/40 transition-colors duration-300">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 bg-rose-500/10 rounded-xl flex items-center justify-center text-rose-500">
                    <Heart className="h-5 w-5 fill-rose-500/10 animate-pulse duration-1000" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-400 font-semibold">Pulse Rate</p>
                    <p className="text-lg font-bold text-white">72 <span className="text-xs text-slate-500 font-normal">BPM</span></p>
                  </div>
                </div>
                <div className="flex items-end gap-1.5 h-10 pb-1">
                  <div className="w-1.5 h-4 bg-rose-500/30 rounded-full"></div>
                  <div className="w-1.5 h-6 bg-rose-500/40 rounded-full"></div>
                  <div className="w-1.5 h-9 bg-rose-500/60 rounded-full"></div>
                  <div className="w-1.5 h-5 bg-rose-500/40 rounded-full"></div>
                  <div className="w-1.5 h-8 bg-rose-500 rounded-full animate-bounce duration-[1500ms]"></div>
                </div>
              </div>

              {/* Mock Dashboard Widget 2: Nearby Doctor */}
              <div className="bg-slate-950/50 border border-slate-800/80 rounded-2xl p-4 mb-4 hover:border-emerald-500/40 transition-colors duration-300">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-emerald-400" />
                    <span className="text-xs font-bold text-slate-300">Closest Hospital Found</span>
                  </div>
                  <span className="text-[10px] text-emerald-400 font-mono bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">0.8 miles away</span>
                </div>
                <div className="flex items-center gap-3 bg-slate-900/60 p-2.5 rounded-xl border border-slate-850">
                  <div className="h-9 w-9 bg-emerald-500/10 rounded-lg flex items-center justify-center font-bold text-emerald-400 text-sm">
                    M
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-white truncate">Metro Health Center</p>
                    <p className="text-[10px] text-slate-500 truncate">45 Ring Road, Central Sq</p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-slate-600" />
                </div>
              </div>

              {/* Mock Dashboard Widget 3: Live Doctor Consultation */}
              <div className="bg-slate-950/50 border border-slate-800/80 rounded-2xl p-4 hover:border-indigo-500/40 transition-colors duration-300">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 bg-indigo-500/10 rounded-xl flex items-center justify-center text-indigo-400 font-bold relative">
                    A
                    <div className="absolute bottom-0 right-0 h-3 w-3 bg-green-500 border-2 border-slate-900 rounded-full"></div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-bold text-slate-200 truncate">Dr. Andrew Miller</p>
                      <span className="text-[9px] text-slate-500 font-mono">11:24 AM</span>
                    </div>
                    <p className="text-[11px] text-slate-400 truncate mt-0.5">"Your lab reports look excellent. Let's keep..."</p>
                  </div>
                </div>
              </div>

            </div>
          </div>

        </div>
      </section>

      {/* Feature Showcase Grid Section */}
      <section id="features" className="py-24 bg-slate-900/40 border-y border-slate-900 relative">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center max-w-2xl mx-auto mb-16 space-y-3">
            <h2 className="text-xs font-bold text-blue-500 uppercase tracking-widest">Platform capabilities</h2>
            <p className="text-3xl sm:text-4xl font-extrabold text-white">Everything required for absolute care</p>
            <p className="text-slate-400 text-sm leading-relaxed">
              HealthifAI bridges the gap between smart clinical tracking and reliable medical services. Simple to use, safe to trust.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">

            {/* Feature 1 */}
            <div className="bg-slate-950/60 border border-slate-800/60 rounded-3xl p-8 hover:border-blue-500/30 hover:bg-slate-950 transition-all duration-300 group hover:-translate-y-1">
              <div className="h-12 w-12 rounded-2xl bg-blue-500/10 text-blue-400 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
                <Activity className="h-6 w-6" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Smart Symptom Tracker</h3>
              <p className="text-slate-400 text-sm leading-relaxed">
                Log symptoms with specific dates, set custom severity limits, and visualize historical health patterns with our clinical metrics system.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="bg-slate-950/60 border border-slate-800/60 rounded-3xl p-8 hover:border-emerald-500/30 hover:bg-slate-950 transition-all duration-300 group hover:-translate-y-1">
              <div className="h-12 w-12 rounded-2xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
                <FileText className="h-6 w-6" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Unified Case Files</h3>
              <p className="text-slate-400 text-sm leading-relaxed">
                Collect symptoms, diagnostic files, prescription documents, and corresponding physician updates under structured digital cases.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="bg-slate-950/60 border border-slate-800/60 rounded-3xl p-8 hover:border-indigo-500/30 hover:bg-slate-950 transition-all duration-300 group hover:-translate-y-1">
              <div className="h-12 w-12 rounded-2xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
                <MessageSquare className="h-6 w-6" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Secure Doctor Chat</h3>
              <p className="text-slate-400 text-sm leading-relaxed">
                Send messages and upload files like X-Rays or lab results in real-time. Keep in continuous contact with your assigned physicians.
              </p>
            </div>

            {/* Feature 4 */}
            <div className="bg-slate-950/60 border border-slate-800/60 rounded-3xl p-8 hover:border-purple-500/30 hover:bg-slate-950 transition-all duration-300 group hover:-translate-y-1">
              <div className="h-12 w-12 rounded-2xl bg-purple-500/10 text-purple-400 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
                <MapPin className="h-6 w-6" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Geographic Doctor Finder</h3>
              <p className="text-slate-400 text-sm leading-relaxed">
                Use our real-time interactive mapping tool to find registered doctors and hospitals close to your current live location.
              </p>
            </div>

            {/* Feature 5 */}
            <div className="bg-slate-950/60 border border-slate-800/60 rounded-3xl p-8 hover:border-pink-500/30 hover:bg-slate-950 transition-all duration-300 group hover:-translate-y-1">
              <div className="h-12 w-12 rounded-2xl bg-pink-500/10 text-pink-400 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
                <Shield className="h-6 w-6" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Google One-Click Authentication</h3>
              <p className="text-slate-400 text-sm leading-relaxed">
                Access your profile instantly and securely using integrated, modern Single Sign-On powered by OAuth protocols.
              </p>
            </div>

            {/* Feature 6 */}
            <div className="bg-slate-950/60 border border-slate-800/60 rounded-3xl p-8 hover:border-amber-500/30 hover:bg-slate-950 transition-all duration-300 group hover:-translate-y-1">
              <div className="h-12 w-12 rounded-2xl bg-amber-500/10 text-amber-400 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
                <Stethoscope className="h-6 w-6" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Integrated Virtual Wallet</h3>
              <p className="text-slate-400 text-sm leading-relaxed">
                Add coins, monitor medical expense transactions, and pay consulting fees directly with an absolute, simplified wallet service.
              </p>
            </div>

          </div>
        </div>
      </section>

      {/* Modern High-Aesthetic Workflow Section */}
      <section id="workflow" className="py-24 max-w-7xl mx-auto px-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">

          <div className="space-y-6">
            <span className="text-xs font-bold text-emerald-400 uppercase tracking-widest">HOW IT WORKS</span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-white">Unifying clinical workflow in 3 simple steps</h2>
            <p className="text-slate-400 leading-relaxed text-sm">
              We've crafted a seamless environment where users can create profiles, log health events, find local specialists, and pay consultation rates without complex procedures.
            </p>

            <div className="space-y-6 pt-4">
              <div className="flex gap-4">
                <div className="h-8 w-8 rounded-full bg-blue-500/10 text-blue-400 font-bold flex items-center justify-center text-xs border border-blue-500/20 shrink-0">1</div>
                <div>
                  <h4 className="font-bold text-white text-base">Quick Registration</h4>
                  <p className="text-slate-400 text-xs mt-1">Register securely as a standard patient or official medical hospital with granular permissions.</p>
                </div>
              </div>
              <div className="flex gap-4">
                <div className="h-8 w-8 rounded-full bg-emerald-500/10 text-emerald-400 font-bold flex items-center justify-center text-xs border border-emerald-500/20 shrink-0">2</div>
                <div>
                  <h4 className="font-bold text-white text-base">Interactive Maps & Consultation</h4>
                  <p className="text-slate-400 text-xs mt-1">Pinpoint your hospital coordinates, browse specialized doctors, and start private messaging panels.</p>
                </div>
              </div>
              <div className="flex gap-4">
                <div className="h-8 w-8 rounded-full bg-indigo-500/10 text-indigo-400 font-bold flex items-center justify-center text-xs border border-indigo-500/20 shrink-0">3</div>
                <div>
                  <h4 className="font-bold text-white text-base">Complete Smart Reports</h4>
                  <p className="text-slate-400 text-xs mt-1">Consolidate prescription docs, secure scans, doctor notes, and clinical milestones under simple medical folders.</p>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 relative overflow-hidden flex flex-col justify-center">
            <div className="absolute top-0 right-0 w-[200px] h-[200px] bg-emerald-500/10 rounded-full blur-[80px]"></div>

            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <Shield className="text-blue-500 h-5 w-5" /> HIPAA-Compliant Architecture
            </h3>
            <p className="text-slate-400 text-sm leading-relaxed mb-6">
              All clinical records, doctor-patient chat sessions, diagnostic report uploads, and payments conform to enterprise security baselines.
            </p>

            <ul className="space-y-3.5">
              <li className="flex items-center gap-2.5 text-xs text-slate-300">
                <CheckCircle className="h-4 w-4 text-emerald-400 shrink-0" />
                End-to-End SSL Session Encryption
              </li>
              <li className="flex items-center gap-2.5 text-xs text-slate-300">
                <CheckCircle className="h-4 w-4 text-emerald-400 shrink-0" />
                Secure Session-based Authentication Cookies
              </li>
              <li className="flex items-center gap-2.5 text-xs text-slate-300">
                <CheckCircle className="h-4 w-4 text-emerald-400 shrink-0" />
                Granular Route Protection Guarding User/Doctor dashboard
              </li>
              <li className="flex items-center gap-2.5 text-xs text-slate-300">
                <CheckCircle className="h-4 w-4 text-emerald-400 shrink-0" />
                Structured PostgreSQL Backend State Engine
              </li>
            </ul>

            <div className="mt-8 bg-slate-950/60 border border-slate-800/80 rounded-2xl p-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-emerald-500 animate-ping"></div>
                <span className="text-xs text-slate-400 font-medium">Gateway security status:</span>
              </div>
              <span className="text-xs font-mono font-bold text-emerald-400 uppercase">FULLY PROTECTED</span>
            </div>

          </div>

        </div>
      </section>

      {/* Interactive Call to Action Banner */}
      <section className="py-20 max-w-7xl mx-auto px-6">
        <div className="relative rounded-3xl overflow-hidden bg-gradient-to-r from-blue-600 via-indigo-600 to-emerald-600 p-12 md:p-16 text-center shadow-xl shadow-blue-500/10">
          {/* Accent light overlay */}
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-white/10 via-transparent to-transparent"></div>

          <div className="relative z-10 max-w-2xl mx-auto space-y-6">
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-white tracking-tight">
              Ready to automate your healthcare experience?
            </h2>
            <p className="text-blue-100 text-base leading-relaxed opacity-90 max-w-lg mx-auto">
              Join thousands of patients and clinical entities enjoying instantaneous notifications, automated billing, and secure electronic logs.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-4 pt-4">
              <Link
                to="/register"
                className="px-8 py-4 bg-white text-blue-600 hover:bg-slate-50 font-bold rounded-2xl shadow-md shadow-black/10 hover:shadow-black/20 hover:scale-[1.02] active:scale-95 transition-all"
              >
                Create Account Now
              </Link>
              <Link
                to="/login"
                className="px-8 py-4 bg-transparent hover:bg-white/10 text-white font-bold rounded-2xl border border-white/20 hover:border-white/40 hover:scale-[1.02] active:scale-95 transition-all"
              >
                Sign In
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Beautiful Premium Footer */}
      <footer id="about" className="border-t border-slate-900 bg-slate-950 py-16">
        <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 md:grid-cols-4 gap-12">

          <div className="md:col-span-2 space-y-4">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-lg bg-gradient-to-tr from-blue-600 to-emerald-500 flex items-center justify-center shadow-md">
                <Activity className="h-4 w-4 text-white" />
              </div>
              <span className="font-extrabold text-xl text-white">
                Healthif<span className="text-emerald-400">AI</span>
              </span>
            </div>
            <p className="text-slate-500 text-xs leading-relaxed max-w-sm">
              HealthifAI is an advanced web portal dedicated to facilitating instant doctor lookup, secure messaging file transfers, live symptom metrics, and unified clinical reports.
            </p>
            <p className="text-slate-600 text-xs">
              © {new Date().getFullYear()} HealthifAI. All rights reserved. Built for medical efficiency.
            </p>
          </div>

          <div className="space-y-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300">Technology</h4>
            <ul className="space-y-2.5 text-xs text-slate-500 font-medium">
              <li>React 18 & Vite</li>
              <li>FastAPI Async Server</li>
              <li>PostgreSQL DB Engine</li>
              <li>Tailwind Design Token System</li>
            </ul>
          </div>

          <div className="space-y-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300">Quick Links</h4>
            <ul className="space-y-2.5 text-xs text-slate-500 font-medium">
              <li>
                <Link to="/login" className="hover:text-blue-400 transition-colors">Sign In Portal</Link>
              </li>
              <li>
                <Link to="/register" className="hover:text-blue-400 transition-colors">Register Account</Link>
              </li>
              <li>
                <a href="#features" className="hover:text-blue-400 transition-colors">Features List</a>
              </li>
              <li>
                <a href="#workflow" className="hover:text-blue-400 transition-colors">How It Works</a>
              </li>
            </ul>
          </div>

        </div>
      </footer>

    </div>
  );
};

export default Landing;
