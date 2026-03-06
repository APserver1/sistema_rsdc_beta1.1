import React, { useState, useEffect } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Menu, X, Home, FileText, ClipboardList, 
  Car, Settings, ShieldCheck, LogOut, Bot as BotIcon, Calendar as CalendarIcon
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useScheduler } from '../lib/scheduler';

const DashboardLayout: React.FC = () => {
  useScheduler();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [userName, setUserName] = useState<string>('');
  const [userEmail, setUserEmail] = useState<string>('');
  const [profileImage, setProfileImage] = useState<string | null>(null);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const getProfile = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserEmail(user.email || '');
        // Primero intentamos obtener del perfil público
        const { data: profile } = await supabase
          .from('public_user')
          .select('public_username, profile_image_url')
          .eq('user_id', user.id)
          .single();

        if (profile) {
          setUserName(profile.public_username || user.user_metadata.full_name || user.email?.split('@')[0] || 'Usuario');
          setProfileImage(profile.profile_image_url);
        } else {
          setUserName(user.user_metadata.full_name || user.email?.split('@')[0] || 'Usuario');
        }
      }
    };
    getProfile();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/login');
  };

  const menuItems = [
    { path: '/', icon: <Home size={20} />, label: 'Home' },
    { path: '/oficios', icon: <FileText size={20} />, label: 'Números de Oficio' },
    { path: '/direccion', icon: <ClipboardList size={20} />, label: 'Documentos en Dirección' },
    { path: '/calendar', icon: <CalendarIcon size={20} />, label: 'Calendario' },
    { path: '/vehiculos', icon: <Car size={20} />, label: 'Registro de Vehículos' },
    { path: '/bot', icon: <BotIcon size={20} />, label: 'Asistente IA' },
    { path: '/ajustes', icon: <Settings size={20} />, label: 'Ajustes' },
    { path: '/terminos', icon: <ShieldCheck size={20} />, label: 'Términos y Condiciones' },
  ];

  const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);

  return (
    <div className="min-h-screen bg-futuristic-gradient relative overflow-hidden">
      {/* Background grid effect */}
      <div className="absolute inset-0 bg-grid pointer-events-none opacity-20" />
      
      {/* Animated background glows */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-secondary/10 rounded-full blur-[120px] pointer-events-none" />

      {/* Navbar */}
      <nav className="fixed top-0 left-0 right-0 z-50 h-16 bg-[#0b1320] border-b border-white/10 flex items-center justify-between px-6 shadow-xl">
        <div className="flex items-center">
          <button 
            onClick={toggleSidebar}
            className="p-2 hover:bg-white/5 rounded-lg transition-colors text-primary"
          >
            <Menu size={24} />
          </button>
          <div className="ml-4 flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-primary to-secondary rounded-lg flex items-center justify-center shadow-neon-cyan">
              <span className="font-bold text-white text-xs">RS</span>
            </div>
            <h1 className="text-lg font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-white/60 hidden sm:block">
              RSDC CORTÉS
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-3 pl-4 border-l border-white/10 relative">
          <div className="text-right hidden xs:block">
            <p className="text-sm font-bold leading-none">{userName}</p>
            <p className="text-[10px] text-white/40 uppercase tracking-widest mt-1">Conectado</p>
          </div>
          <button 
            onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
            className="w-10 h-10 rounded-xl overflow-hidden border border-white/10 bg-white/5 flex items-center justify-center shadow-lg hover:border-primary/50 transition-colors"
          >
            {profileImage ? (
              <img src={profileImage} alt={userName} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center text-primary font-bold">
                {userName.charAt(0).toUpperCase()}
              </div>
            )}
          </button>

          {/* Profile Dropdown Menu */}
          <AnimatePresence>
            {isProfileMenuOpen && (
              <>
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={() => setIsProfileMenuOpen(false)}
                  className="fixed inset-0 z-[60]"
                />
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: 10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: 10 }}
                  className="absolute right-0 top-full mt-2 w-72 glass-card !p-0 z-[70] shadow-2xl border border-white/10 overflow-hidden"
                >
                  <div className="p-5 border-b border-white/5 bg-gradient-to-br from-primary/5 to-secondary/5">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl overflow-hidden border border-white/10 shadow-lg">
                        {profileImage ? (
                          <img src={profileImage} alt={userName} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-white font-bold text-lg">
                            {userName.charAt(0).toUpperCase()}
                          </div>
                        )}
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className="font-bold text-white truncate">{userName}</span>
                        <span className="text-xs text-white/40 truncate">{userEmail}</span>
                      </div>
                    </div>
                  </div>
                  <div className="p-2">
                    <button 
                      onClick={handleLogout}
                      className="w-full flex items-center gap-3 p-3 rounded-lg text-red-400 hover:bg-red-400/10 transition-colors font-medium"
                    >
                      <LogOut size={18} />
                      <span>Cerrar Sesión</span>
                    </button>
                  </div>
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>
      </nav>

      {/* Sidebar Overlay */}
      <AnimatePresence>
        {isSidebarOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={toggleSidebar}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60]"
            />
            <motion.aside
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed top-0 left-0 h-full w-80 bg-[#0a0f1a]/95 backdrop-blur-2xl z-[70] border-r border-white/10 flex flex-col"
            >
              <div className="p-6 flex items-center justify-between border-b border-white/5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl overflow-hidden border border-white/10 bg-white/5 flex items-center justify-center shadow-neon-cyan">
                    {profileImage ? (
                      <img src={profileImage} alt={userName} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-white font-bold">
                        {userName.charAt(0).toUpperCase()}
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col">
                    <span className="font-bold text-lg tracking-tighter leading-none">{userName.toUpperCase()}</span>
                    <span className="text-[10px] text-white/40 uppercase tracking-widest mt-1">Región Sanitaria</span>
                  </div>
                </div>
                <button onClick={toggleSidebar} className="p-2 hover:bg-white/5 rounded-full transition-colors">
                  <X size={20} />
                </button>
              </div>

              <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
                {menuItems.map((item) => (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={() => setIsSidebarOpen(false)}
                    className={`sidebar-link ${location.pathname === item.path ? 'active' : ''}`}
                  >
                    {item.icon}
                    <span className="font-medium">{item.label}</span>
                  </Link>
                ))}
              </nav>

              <div className="p-4 border-t border-white/5">
                <button 
                  onClick={handleLogout}
                  className="w-full sidebar-link text-red-400 hover:text-red-300 hover:bg-red-400/5"
                >
                  <LogOut size={20} />
                  <span>Cerrar Sesión</span>
                </button>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <main className="fixed top-16 left-0 right-0 bottom-0 overflow-y-auto relative z-10">
        <div className="w-full max-w-7xl mx-auto px-4 md:px-6 pt-6 pb-12 min-h-full">
          <Outlet />
        </div>
      </main>
    </div>
  );
};

export default DashboardLayout;
