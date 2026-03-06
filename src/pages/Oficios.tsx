import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  FileText, Plus, Search, X, Loader2, Save, 
  PenTool, ChevronDown, Upload, File, Eye, Download,
  CheckCircle2, AlertCircle
} from 'lucide-react';
import { supabase } from '../lib/supabase';

interface Oficio {
  id: string;
  numero_oficio: number;
  descripcion: string;
  fecha_creacion: string;
  hecho_por: string;
  anio: number;
  file_url: string | null;
  file_name: string | null;
  created_at: string;
}

const Oficios: React.FC = () => {
  const navigate = useNavigate();
  const [oficios, setOficios] = useState<Oficio[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedOficio, setSelectedOficio] = useState<Oficio | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [userName, setUserName] = useState('');
  
  // Form state
  const [isSaving, setIsSaving] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [savedOficioId, setSavedOficioId] = useState<string | null>(null);
  const [savedOficioNumber, setSavedOficioNumber] = useState<number | null>(null);
  const [nextNumber, setNextNumber] = useState(1);
  const [isEditing, setIsEditing] = useState(false);
  const [editFormData, setEditFormData] = useState({
    descripcion: '',
    fecha_creacion: '',
  });
  const [formData, setFormData] = useState({
    descripcion: '',
    fecha_creacion: new Date().toISOString().split('T')[0],
  });
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const editFileInputRef = useRef<HTMLInputElement>(null);
  const detailsFileInputRef = useRef<HTMLInputElement>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const years = Array.from({ length: 10 }, (_, i) => new Date().getFullYear() - i);

  const clearCloseTimer = () => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  };

  const fetchOficios = useCallback(async () => {
    try {
      setLoading(true);
      console.log('Fetching oficios for year:', selectedYear);
      const { data, error } = await supabase
        .from('rsdc_oficios')
        .select('*')
        .eq('anio', selectedYear)
        .order('numero_oficio', { ascending: false });

      if (error) {
        console.error('Supabase error:', error);
        throw error;
      }
      
      console.log('Oficios fetched:', data?.length || 0, 'rows');
      setOficios(data || []);
      
      // Calculate next number
      const maxNum = data && data.length > 0 ? Math.max(...data.map(o => o.numero_oficio)) : 0;
      setNextNumber(maxNum + 1);
    } catch (err) {
      console.error('Error fetching oficios:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedYear]);

  useEffect(() => {
    fetchOficios();
  }, [fetchOficios]);

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from('public_user')
          .select('public_username')
          .eq('user_id', user.id)
          .single();
        setUserName(profile?.public_username || user.user_metadata.full_name || user.email?.split('@')[0] || 'Usuario');
      }
    };
    getUser();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No user logged in');

      const { data, error } = await supabase
        .from('rsdc_oficios')
        .insert([{
          numero_oficio: nextNumber,
          descripcion: formData.descripcion,
          fecha_creacion: formData.fecha_creacion,
          hecho_por: userName,
          anio: selectedYear,
          user_id: user.id
        }])
        .select()
        .single();

      if (error) throw error;
      
      setIsSaved(true);
      setSavedOficioId(data.id);
      setSavedOficioNumber(data.numero_oficio);
      fetchOficios();

      // Close modal after 8 seconds, but save ref to clear if needed
      clearCloseTimer();
      closeTimerRef.current = setTimeout(() => {
        closeNewOficioModal();
      }, 8000);

    } catch (err) {
      console.error('Error saving oficio:', err);
      alert('Error al guardar el oficio. Posiblemente el número ya existe para este año.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>, oficioId?: string) => {
    const file = event.target.files?.[0];
    const targetId = oficioId || savedOficioId;
    if (!file || !targetId) return;

    // Clear timer when user starts selecting/uploading
    clearCloseTimer();

    // Validate file type
    const allowedTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    if (!allowedTypes.includes(file.type)) {
      alert('Solo se permiten archivos PDF o Word.');
      return;
    }

    try {
      setUploading(true);
      const fileExt = file.name.split('.').pop();
      const fileName = `${targetId}-${Math.random()}.${fileExt}`;
      const filePath = `documents/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('oficios')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('oficios')
        .getPublicUrl(filePath);

      const { error: updateError } = await supabase
        .from('rsdc_oficios')
        .update({ 
          file_url: publicUrl,
          file_name: file.name
        })
        .eq('id', targetId);

      if (updateError) throw updateError;

      fetchOficios();
      
      // If we are in the post-save state of a new oficio, restart the timer
      if (isSaved) {
        clearCloseTimer();
        closeTimerRef.current = setTimeout(() => {
          closeNewOficioModal();
        }, 8000);
      }

      // If we are in the details modal, update the local state
      if (selectedOficio && selectedOficio.id === targetId) {
        setSelectedOficio({
          ...selectedOficio,
          file_url: publicUrl,
          file_name: file.name
        });
      }
    } catch (err) {
      console.error('Error uploading file:', err);
      alert('Error al subir el archivo. El sistema intentó crear el bucket "oficios", si el error persiste, contacte al administrador.');
    } finally {
      setUploading(false);
    }
  };

  const handleUpdateOficio = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOficio) return;
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('rsdc_oficios')
        .update({
          descripcion: editFormData.descripcion,
          fecha_creacion: editFormData.fecha_creacion,
        })
        .eq('id', selectedOficio.id);

      if (error) throw error;

      setSelectedOficio({
        ...selectedOficio,
        descripcion: editFormData.descripcion,
        fecha_creacion: editFormData.fecha_creacion,
      });
      setIsEditing(false);
      fetchOficios();
    } catch (err) {
      console.error('Error updating oficio:', err);
      alert('Error al actualizar el oficio.');
    } finally {
      setIsSaving(false);
    }
  };

  const startEditing = () => {
    if (!selectedOficio) return;
    setEditFormData({
      descripcion: selectedOficio.descripcion,
      fecha_creacion: selectedOficio.fecha_creacion.split('T')[0],
    });
    setIsEditing(true);
  };

  const getFileViewUrl = (url: string) => {
    if (!url) return '';
    const extension = url.split('.').pop()?.toLowerCase();
    
    // Si es PDF, el navegador lo abre nativamente.
    // Si es Word (doc/docx), usamos el visor de Microsoft Office Online para que se vea en el navegador.
    if (extension === 'doc' || extension === 'docx') {
      return `https://view.officeapps.live.com/op/view.aspx?src=${encodeURIComponent(url)}`;
    }
    
    return url;
  };

  // Close on ESC
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isModalOpen) {
          closeNewOficioModal();
        }
        if (selectedOficio) {
          setSelectedOficio(null);
        }
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isModalOpen, selectedOficio]);

  const closeNewOficioModal = () => {
    clearCloseTimer();
    setIsModalOpen(false);
    setIsSaved(false);
    setSavedOficioId(null);
    setSavedOficioNumber(null);
    setFormData({ descripcion: '', fecha_creacion: new Date().toISOString().split('T')[0] });
  };

  const openNewOficioModal = () => {
    clearCloseTimer();
    setIsSaved(false);
    setSavedOficioId(null);
    setSavedOficioNumber(null);
    setFormData({
      descripcion: '',
      fecha_creacion: new Date().toISOString().split('T')[0],
    });
    setIsModalOpen(true);
  };

  const filteredOficios = oficios.filter(o => 
    o.descripcion.toLowerCase().includes(searchQuery.toLowerCase()) ||
    o.numero_oficio.toString().includes(searchQuery) ||
    o.hecho_por.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-8">
      {/* Header & Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold flex items-center gap-3">
            <FileText className="text-primary" /> Números de Oficio
          </h2>
          <p className="text-white/50">Gestión correlativa de correspondencia por año.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative group">
            <select 
              value={selectedYear}
              onChange={(e) => setSelectedYear(parseInt(e.target.value))}
              className="appearance-none bg-white/5 border border-white/10 rounded-xl py-2 pl-4 pr-10 focus:outline-none focus:ring-2 focus:ring-primary/50 cursor-pointer font-bold text-primary"
            >
              {years.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 pointer-events-none group-hover:text-primary transition-colors" size={16} />
          </div>
          <button 
            onClick={openNewOficioModal}
            className="glass-button bg-primary/10 text-primary border-primary/20 hover:bg-primary/20 flex items-center gap-2"
          >
            <Plus size={20} /> Nuevo Oficio
          </button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30" size={20} />
        <input 
          type="text" 
          placeholder="Buscar oficio por número, descripción o autor..." 
          className="w-full bg-white/5 border border-white/10 rounded-xl py-4 pl-12 pr-4 focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {/* Grid of Numbers */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <Loader2 className="text-primary animate-spin" size={40} />
          <p className="text-white/40 animate-pulse font-bold tracking-widest uppercase text-xs">Sincronizando Archivos...</p>
        </div>
      ) : filteredOficios.length === 0 ? (
        <div className="glass-card p-20 text-center space-y-4">
          <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mx-auto border border-white/5">
            <FileText className="text-white/10" size={40} />
          </div>
          <p className="text-white/30 font-medium">No hay oficios registrados para el año {selectedYear}.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-10 gap-4">
          <AnimatePresence mode="popLayout">
            {filteredOficios.map((oficio) => (
              <motion.div
                key={oficio.id}
                layout
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                whileHover={{ y: -5, scale: 1.05 }}
                className="group relative"
                onClick={() => setSelectedOficio(oficio)}
              >
                <div className="glass-card aspect-square flex flex-col items-center justify-center p-2 border border-white/10 group-hover:border-primary/50 transition-all cursor-pointer shadow-lg group-hover:shadow-primary/20">
                  <span className="text-3xl font-black text-white/80 group-hover:text-primary transition-colors">
                    {oficio.numero_oficio}
                  </span>
                  <div className="flex flex-col items-center">
                    <span className="text-[10px] text-white/30 uppercase font-bold tracking-tighter group-hover:text-white/50 transition-colors">
                      Oficio
                    </span>
                    {oficio.file_url && <File size={12} className="text-primary mt-1" />}
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* New Oficio Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => !isSaving && closeNewOficioModal()}
              className="fixed inset-0 bg-black/80 backdrop-blur-md z-[200]"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="fixed inset-0 flex items-center justify-center p-4 z-[201] pointer-events-none"
            >
              <div className="glass-card w-full max-w-3xl !p-0 overflow-hidden pointer-events-auto shadow-2xl border border-white/10 max-h-[90vh] flex flex-col">
                <div className="p-8 border-b border-white/5 flex items-center justify-between bg-gradient-to-r from-primary/10 to-transparent shrink-0">
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 bg-primary/20 rounded-2xl flex items-center justify-center border border-primary/30">
                      <span className="text-3xl font-black text-primary">
                        {isSaved ? savedOficioNumber : nextNumber}
                      </span>
                    </div>
                    <div>
                      <h3 className="text-2xl font-bold">{isSaved ? 'Oficio Guardado' : 'Nuevo Oficio'}</h3>
                      <p className="text-sm text-white/40 font-mono">Año Fiscal: {selectedYear}</p>
                    </div>
                  </div>
                  {!isSaving && !isSaved && (
                    <button 
                      onClick={closeNewOficioModal}
                      className="p-2 hover:bg-white/5 rounded-full transition-colors"
                    >
                      <X size={24} />
                    </button>
                  )}
                </div>

                <form onSubmit={handleSave} className="p-8 space-y-8 overflow-y-auto">
                  <div className="space-y-6">
                    <div className="space-y-3">
                      <label className="text-xs font-bold text-white/40 uppercase tracking-[0.2em]">Descripción del Oficio</label>
                      <textarea
                        required
                        disabled={isSaved}
                        placeholder="Escriba el asunto o destinatario del oficio..."
                        rows={3}
                        className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 px-5 focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all resize-none disabled:opacity-50"
                        value={formData.descripcion}
                        onChange={(e) => setFormData({...formData, descripcion: e.target.value})}
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-3">
                        <label className="text-xs font-bold text-white/40 uppercase tracking-[0.2em]">Fecha de Creación</label>
                        <input
                          required
                          disabled={isSaved}
                          type="date"
                          className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 px-5 focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all [color-scheme:dark] disabled:opacity-50"
                          value={formData.fecha_creacion}
                          onChange={(e) => setFormData({...formData, fecha_creacion: e.target.value})}
                        />
                      </div>
                      <div className="space-y-3">
                        <label className="text-xs font-bold text-white/40 uppercase tracking-[0.2em]">Elaborado por</label>
                        <div className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 px-5 text-white/60 font-medium flex items-center gap-3">
                          <div className="w-2 h-2 rounded-full bg-green-400 shadow-[0_0_10px_rgba(74,222,128,0.5)]" />
                          {userName}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="pt-6 flex flex-col gap-4">
                    {isSaved && (
                      <motion.div 
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="bg-green-500/10 border border-green-500/20 text-green-400 p-4 rounded-2xl text-center font-bold text-sm"
                      >
                        ✓ Oficio guardado correctamente. Se cerrará en unos segundos... (Presione ESC para salir)
                      </motion.div>
                    )}
                    
                    <div className="flex gap-4">
                      {!isSaved ? (
                        <>
                          <button
                            type="button"
                            onClick={closeNewOficioModal}
                            className="flex-1 py-4 px-6 rounded-2xl border border-white/10 font-bold hover:bg-white/5 transition-all uppercase tracking-widest text-xs"
                          >
                            Cancelar
                          </button>
                          <button
                            type="submit"
                            disabled={isSaving}
                            className="flex-[2] py-4 px-6 rounded-2xl bg-gradient-to-r from-primary to-secondary text-white font-bold shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-2 uppercase tracking-widest text-xs"
                          >
                            {isSaving ? <Loader2 className="animate-spin" size={20} /> : <><Save size={20} /> Guardar Oficio</>}
                          </button>
                        </>
                      ) : (
                        <div className="w-full grid grid-cols-2 gap-4">
                          <button
                            type="button"
                            onClick={() => {
                              if (savedOficioId) {
                                clearCloseTimer();
                                navigate(`/editor/${savedOficioId}`);
                              }
                            }}
                            className="py-4 px-6 rounded-2xl bg-white text-black font-black shadow-2xl hover:bg-white/90 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-3 uppercase tracking-widest text-xs"
                          >
                            <PenTool size={20} /> Redactar
                          </button>
                          <input 
                            type="file" 
                            ref={fileInputRef} 
                            className="hidden" 
                            accept=".pdf,.doc,.docx"
                            onChange={handleFileUpload}
                          />
                          <button
                            type="button"
                            onClick={() => {
                              clearCloseTimer();
                              fileInputRef.current?.click();
                            }}
                            disabled={uploading}
                            className="py-4 px-6 rounded-2xl bg-primary text-white font-black shadow-2xl hover:bg-primary/90 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-3 uppercase tracking-widest text-xs disabled:opacity-50"
                          >
                            {uploading ? <Loader2 className="animate-spin" size={20} /> : <><Upload size={20} /> Subir Archivo</>}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </form>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Oficio Details Modal */}
      <AnimatePresence>
        {selectedOficio && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedOficio(null)}
              className="fixed inset-0 bg-black/80 backdrop-blur-md z-[200]"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="fixed inset-0 flex items-center justify-center p-4 z-[201] pointer-events-none"
            >
              <div className="glass-card w-full max-w-3xl !p-0 overflow-hidden pointer-events-auto shadow-2xl border border-white/10 max-h-[90vh] flex flex-col">
                <div className="p-8 border-b border-white/5 flex items-center justify-between bg-gradient-to-r from-secondary/10 to-transparent shrink-0">
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 bg-secondary/20 rounded-2xl flex items-center justify-center border border-secondary/30">
                      <span className="text-3xl font-black text-secondary">{selectedOficio.numero_oficio}</span>
                    </div>
                    <div>
                      <h3 className="text-2xl font-bold">{isEditing ? 'Editar Oficio' : 'Detalles del Oficio'}</h3>
                      <p className="text-sm text-white/40 font-mono">Registro {selectedOficio.anio}</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => {
                      setSelectedOficio(null);
                      setIsEditing(false);
                    }}
                    className="p-2 hover:bg-white/5 rounded-full transition-colors"
                  >
                    <X size={24} />
                  </button>
                </div>

                <div className="p-8 space-y-8 overflow-y-auto">
                  {isEditing ? (
                    <form onSubmit={handleUpdateOficio} className="space-y-6">
                      <div className="space-y-3">
                        <label className="text-[10px] font-bold text-white/30 uppercase tracking-[0.2em]">Descripción / Asunto</label>
                        <textarea
                          required
                          rows={3}
                          className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 px-5 focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all resize-none"
                          value={editFormData.descripcion}
                          onChange={(e) => setEditFormData({...editFormData, descripcion: e.target.value})}
                        />
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-3">
                          <label className="text-[10px] font-bold text-white/30 uppercase tracking-[0.2em]">Fecha de Creación</label>
                          <input
                            required
                            type="date"
                            className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 px-5 focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all [color-scheme:dark]"
                            value={editFormData.fecha_creacion}
                            onChange={(e) => setEditFormData({...editFormData, fecha_creacion: e.target.value})}
                          />
                        </div>
                        <div className="space-y-3">
                          <label className="text-[10px] font-bold text-white/30 uppercase tracking-[0.2em]">Documento</label>
                          <input 
                            type="file" 
                            ref={editFileInputRef} 
                            className="hidden" 
                            accept=".pdf,.doc,.docx"
                            onChange={(e) => handleFileUpload(e, selectedOficio.id)}
                          />
                          <button
                            type="button"
                            onClick={() => editFileInputRef.current?.click()}
                            disabled={uploading}
                            className="w-full py-4 px-6 rounded-2xl bg-white/5 border border-white/10 text-white font-bold hover:bg-white/10 transition-all flex items-center justify-center gap-2 text-xs uppercase tracking-widest disabled:opacity-50"
                          >
                            {uploading ? <Loader2 className="animate-spin" size={16} /> : <><Upload size={16} /> {selectedOficio.file_url ? 'Cambiar Archivo' : 'Subir Archivo'}</>}
                          </button>
                        </div>
                      </div>
                      <div className="flex gap-3 pt-4">
                        <button
                          type="button"
                          onClick={() => setIsEditing(false)}
                          className="flex-1 py-4 px-6 rounded-2xl border border-white/10 font-bold hover:bg-white/5 transition-all uppercase tracking-widest text-xs"
                        >
                          Cancelar
                        </button>
                        <button
                          type="submit"
                          disabled={isSaving}
                          className="flex-[2] py-4 px-6 rounded-2xl bg-gradient-to-r from-primary to-secondary text-white font-bold shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-2 uppercase tracking-widest text-xs"
                        >
                          {isSaving ? <Loader2 className="animate-spin" size={20} /> : <><Save size={20} /> Guardar Cambios</>}
                        </button>
                      </div>
                    </form>
                  ) : (
                    <>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="space-y-2">
                          <label className="text-[10px] font-bold text-white/30 uppercase tracking-[0.2em]">Fecha</label>
                          <p className="text-white font-medium flex items-center gap-2">
                            <CheckCircle2 size={16} className="text-green-400" />
                            {new Date(selectedOficio.fecha_creacion).toLocaleDateString()}
                          </p>
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-bold text-white/30 uppercase tracking-[0.2em]">Elaborado por</label>
                          <p className="text-white font-medium flex items-center gap-2">
                            <AlertCircle size={16} className="text-primary" />
                            {selectedOficio.hecho_por}
                          </p>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label className="text-[10px] font-bold text-white/30 uppercase tracking-[0.2em]">Descripción / Asunto</label>
                        <div className="p-5 bg-white/5 rounded-2xl border border-white/5 text-white/80 leading-relaxed">
                          {selectedOficio.descripcion}
                        </div>
                      </div>

                      <div className="space-y-4">
                        <label className="text-[10px] font-bold text-white/30 uppercase tracking-[0.2em]">Documentos Adjuntos</label>
                        <input 
                          type="file" 
                          ref={detailsFileInputRef} 
                          className="hidden" 
                          accept=".pdf,.doc,.docx"
                          onChange={(e) => handleFileUpload(e, selectedOficio.id)}
                        />
                        {selectedOficio.file_url ? (
                          <div className="glass-card p-4 flex items-center justify-between group/file hover:border-primary/30 transition-all">
                            <div className="flex items-center gap-4">
                              <div className="p-3 bg-primary/10 rounded-xl text-primary">
                                <File size={24} />
                              </div>
                              <div className="flex flex-col">
                                <span className="text-sm font-bold text-white truncate max-w-[200px]">
                                  {selectedOficio.file_name || 'Documento Adjunto'}
                                </span>
                                <span className="text-[10px] text-white/40 uppercase font-bold tracking-tighter">
                                  {selectedOficio.file_url.split('.').pop()?.toUpperCase()}
                                </span>
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <button
                                onClick={() => detailsFileInputRef.current?.click()}
                                disabled={uploading}
                                className="p-3 hover:bg-white/10 rounded-xl text-white/60 transition-all hover:scale-110 active:scale-90"
                                title="Cambiar Archivo"
                              >
                                {uploading ? <Loader2 className="animate-spin" size={20} /> : <Upload size={20} />}
                              </button>
                              <a 
                                href={getFileViewUrl(selectedOficio.file_url)} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="p-3 hover:bg-primary/20 rounded-xl text-primary transition-all hover:scale-110 active:scale-90"
                              >
                                <Eye size={20} />
                              </a>
                              <a 
                                href={selectedOficio.file_url} 
                                download={selectedOficio.file_name || `Oficio-${selectedOficio.numero_oficio}.pdf`}
                                className="p-3 hover:bg-green-500/20 rounded-xl text-green-400 transition-all hover:scale-110 active:scale-90"
                              >
                                <Download size={20} />
                              </a>
                            </div>
                          </div>
                        ) : (
                          <div className="p-8 border-2 border-dashed border-white/5 rounded-2xl flex flex-col items-center gap-4">
                            <p className="text-white/20 text-sm font-medium">No hay documentos adjuntos a este oficio.</p>
                            <div className="flex gap-3 w-full">
                              <button
                                type="button"
                                onClick={() => navigate(`/editor/${selectedOficio.id}`)}
                                className="flex-1 py-3 px-4 rounded-xl bg-white text-black font-bold shadow-lg hover:bg-white/90 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2 uppercase tracking-widest text-[10px]"
                              >
                                <PenTool size={16} /> Redactar
                              </button>
                              <button
                                type="button"
                                onClick={() => detailsFileInputRef.current?.click()}
                                disabled={uploading}
                                className="flex-1 py-3 px-4 rounded-xl bg-primary text-white font-bold shadow-lg hover:bg-primary/90 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2 uppercase tracking-widest text-[10px] disabled:opacity-50"
                              >
                                {uploading ? <Loader2 className="animate-spin" size={16} /> : <><Upload size={16} /> Subir Archivo</>}
                              </button>
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="flex gap-3 pt-4">
                        <button
                          onClick={() => setSelectedOficio(null)}
                          className="flex-1 py-4 px-6 rounded-2xl border border-white/10 font-bold hover:bg-white/5 transition-all uppercase tracking-widest text-xs"
                        >
                          Cerrar
                        </button>
                        <button
                          onClick={startEditing}
                          className="flex-1 py-4 px-6 rounded-2xl bg-white/5 border border-white/10 font-bold hover:bg-white/10 transition-all flex items-center justify-center gap-2 uppercase tracking-widest text-xs"
                        >
                          <PenTool size={18} /> Editar Oficio
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Oficios;
