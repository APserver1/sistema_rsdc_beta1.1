import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ClipboardList, Clock, CheckCircle2, AlertCircle, 
  Plus, X, Hash, User, Calendar as CalendarIcon, 
  ChevronRight, Loader2, Paperclip, Upload,
  Camera, RefreshCw, ArrowLeft
} from 'lucide-react';
import { supabase } from '../lib/supabase';

interface Documento {
  id: string;
  titulo: string;
  numero_documento: string;
  quien_recibio: string;
  fecha_creacion: string;
  estado: 'pending' | 'approved' | 'review';
  created_at: string;
  archivo_adjunto?: string;
}

const Direccion: React.FC = () => {
  const [documents, setDocuments] = useState<Documento[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [statusPanelId, setStatusPanelId] = useState<string | null>(null);
  const [previousRecipients, setPreviousRecipients] = useState<string[]>([]);
  const [showRecipientSuggestions, setShowRecipientSuggestions] = useState(false);
  const [isStateDropdownOpen, setIsStateDropdownOpen] = useState(false);
  
  // Form state
  const [newDoc, setNewDoc] = useState({
    titulo: '',
    numero_documento: '',
    quien_recibio: '',
    fecha_creacion: new Date().toISOString().split('T')[0],
    estado: 'pending' as const,
    archivo_adjunto: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [showCamera, setShowCamera] = useState(false);
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [viewingAttachment, setViewingAttachment] = useState<string | null>(null);

  useEffect(() => {
    fetchDocuments();
    fetchPreviousRecipients();
  }, []);

  const fetchPreviousRecipients = async () => {
    try {
      const { data, error } = await supabase
        .from('rsdc_direccion_documentos')
        .select('quien_recibio')
        .order('quien_recibio');

      if (error) throw error;
      
      // Get unique names
      const uniqueNames = Array.from(new Set(data?.map(d => d.quien_recibio) || []));
      setPreviousRecipients(uniqueNames);
    } catch (err) {
      console.error('Error fetching recipients:', err);
    }
  };

  const fetchDocuments = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('rsdc_direccion_documentos')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      // Custom sorting: pending -> review -> approved
      const statusOrder = { pending: 0, review: 1, approved: 2 };
      const sortedData = (data || []).sort((a: Documento, b: Documento) => {
        const statusDiff = statusOrder[a.estado] - statusOrder[b.estado];
        if (statusDiff !== 0) return statusDiff;
        // Secondary sort by date desc
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });

      setDocuments(sortedData);
    } catch (err) {
      console.error('Error fetching documents:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, docId?: string) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsUploading(true);
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random()}.${fileExt}`;
      const filePath = `${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('direccion_documentos')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('direccion_documentos')
        .getPublicUrl(filePath);

      if (docId) {
        // Update existing document
        const { error: updateError } = await supabase
          .from('rsdc_direccion_documentos')
          .update({ archivo_adjunto: publicUrl })
          .eq('id', docId);

        if (updateError) throw updateError;
        fetchDocuments();
      } else {
        // Set for new document
        setNewDoc(prev => ({ ...prev, archivo_adjunto: publicUrl }));
      }
    } catch (err) {
      console.error('Error uploading file:', err);
      alert('Error al subir el archivo');
    } finally {
      setIsUploading(false);
    }
  };

  const resetForm = () => {
    setNewDoc({
      titulo: '',
      numero_documento: '',
      quien_recibio: '',
      fecha_creacion: new Date().toISOString().split('T')[0],
      estado: 'pending',
      archivo_adjunto: ''
    });
  };

  const startCamera = async () => {
    try {
      setShowCamera(true);
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.error('Error accessing camera:', err);
      alert('No se pudo acceder a la cámara. Por favor, verifique los permisos.');
      setShowCamera(false);
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
    setShowCamera(false);
  };

  const takePhoto = () => {
    if (videoRef.current) {
      const canvas = document.createElement('canvas');
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(videoRef.current, 0, 0);
        const dataUrl = canvas.toDataURL('image/jpeg');
        setCapturedImage(dataUrl);
        stopCamera();
        
        // Convert base64 to File object
        fetch(dataUrl)
          .then(res => res.blob())
          .then(blob => {
            const file = new File([blob], `foto_${Date.now()}.jpg`, { type: 'image/jpeg' });
            setSelectedFile(file);
          });
      }
    }
  };

  const retakePhoto = () => {
    setCapturedImage(null);
    setSelectedFile(null);
    startCamera();
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    resetForm();
    stopCamera();
    setCapturedImage(null);
    setSelectedFile(null);
  };

  const handleAddDocument = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDoc.titulo || !newDoc.numero_documento || !newDoc.quien_recibio) return;

    setIsSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No user logged in');

      let attachmentUrl = '';

      if (selectedFile) {
        const fileExt = selectedFile.name.split('.').pop();
        const fileName = `${Math.random().toString(36).substring(2)}.${fileExt}`;
        const filePath = `${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('direccion_documentos')
          .upload(filePath, selectedFile);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('direccion_documentos')
          .getPublicUrl(filePath);

        attachmentUrl = publicUrl;
      }

      const { error } = await supabase
        .from('rsdc_direccion_documentos')
        .insert([{
          ...newDoc,
          user_id: user.id,
          archivo_adjunto: attachmentUrl
        }]);

      if (error) throw error;
      
      handleCloseModal();
      fetchDocuments();
      fetchPreviousRecipients();
    } catch (err) {
      console.error('Error adding document:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateStatus = async (id: string, newStatus: 'pending' | 'approved' | 'review') => {
    try {
      const { error } = await supabase
        .from('rsdc_direccion_documentos')
        .update({ estado: newStatus })
        .eq('id', id);

      if (error) throw error;
      
      setStatusPanelId(null);
      fetchDocuments();
    } catch (err) {
      console.error('Error updating status:', err);
    }
  };

  const getStatusInfo = (status: string) => {
    switch (status) {
      case 'approved': 
        return { 
          icon: <CheckCircle2 className="text-green-400" size={20} />, 
          label: 'Aprobado',
          color: 'text-green-400',
          bg: 'bg-green-500/10',
          border: 'border-green-500/20'
        };
      case 'pending': 
        return { 
          icon: <Clock className="text-yellow-400" size={20} />, 
          label: 'Pendiente de Firma',
          color: 'text-yellow-400',
          bg: 'bg-yellow-500/10',
          border: 'border-yellow-500/20'
        };
      case 'review': 
        return { 
          icon: <AlertCircle className="text-blue-400" size={20} />, 
          label: 'En Revisión',
          color: 'text-blue-400',
          bg: 'bg-blue-500/10',
          border: 'border-blue-500/20'
        };
      default: return null;
    }
  };

  const stats = {
    pending: documents.filter(d => d.estado === 'pending').length,
    review: documents.filter(d => d.estado === 'review').length,
    approved: documents.filter(d => d.estado === 'approved').length,
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold flex items-center gap-3">
            <ClipboardList className="text-secondary" /> Documentos en Dirección
          </h2>
          <p className="text-white/50">Seguimiento de expedientes y firmas de la dirección departamental.</p>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="glass-button bg-primary/10 text-primary border-primary/20 hover:bg-primary/20 flex items-center gap-2"
        >
          <Plus size={20} /> Nueva Actividad
        </button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="glass-card p-6 border-l-4 border-yellow-400/50">
          <p className="text-sm text-white/40 font-bold uppercase tracking-wider mb-1">Pendiente de Firma</p>
          <p className="text-4xl font-bold">{stats.pending.toString().padStart(2, '0')}</p>
        </div>
        <div className="glass-card p-6 border-l-4 border-blue-400/50">
          <p className="text-sm text-white/40 font-bold uppercase tracking-wider mb-1">En Revisión</p>
          <p className="text-4xl font-bold">{stats.review.toString().padStart(2, '0')}</p>
        </div>
        <div className="glass-card p-6 border-l-4 border-green-400/50">
          <p className="text-sm text-white/40 font-bold uppercase tracking-wider mb-1">Finalizados (Aprobado)</p>
          <p className="text-4xl font-bold">{stats.approved.toString().padStart(2, '0')}</p>
        </div>
      </div>

      {/* Documents List */}
      <div className="space-y-4">
        <h3 className="text-xl font-bold">Actividad Reciente</h3>
        <div className="space-y-3">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 gap-4">
              <Loader2 className="text-primary animate-spin" size={40} />
              <p className="text-white/40 animate-pulse">Cargando documentos...</p>
            </div>
          ) : documents.length === 0 ? (
            <div className="glass-card p-12 text-center space-y-4">
              <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mx-auto">
                <ClipboardList className="text-white/20" size={32} />
              </div>
              <p className="text-white/40">No hay documentos registrados aún.</p>
            </div>
          ) : (
            documents.map((doc) => {
              const info = getStatusInfo(doc.estado);
              return (
                <motion.div 
                  key={doc.id}
                  whileHover={{ x: 5 }}
                  className="glass-card p-5 flex items-center justify-between group relative"
                >
                  <div className="flex items-center gap-4 flex-1">
                    <div className="p-3 bg-white/5 rounded-xl group-hover:bg-white/10 transition-colors hidden sm:block">
                      <ClipboardList className="text-white/40" />
                    </div>
                    <div className="space-y-1">
                      <h4 className="font-bold text-lg leading-tight">{doc.titulo}</h4>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-white/40">
                        <span className="flex items-center gap-1"><Hash size={14} /> {doc.numero_documento}</span>
                        <span className="flex items-center gap-1"><User size={14} /> {doc.quien_recibio}</span>
                        <span className="flex items-center gap-1"><CalendarIcon size={14} /> {new Date(doc.fecha_creacion).toLocaleDateString()}</span>
                        
                        {/* Attachment Logic */}
                        {doc.archivo_adjunto ? (
                          <button 
                            className="flex items-center gap-1 text-primary hover:underline cursor-pointer hover:text-primary/80 transition-colors"
                            onClick={(e) => {
                              e.stopPropagation();
                              setViewingAttachment(doc.archivo_adjunto!);
                            }}
                          >
                            <Paperclip size={14} />
                            <span>Ver adjunto</span>
                          </button>
                        ) : (
                          <label 
                            className="flex items-center gap-1 text-white/20 hover:text-white/60 cursor-pointer transition-colors"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {isUploading ? <Loader2 size={14} className="animate-spin" /> : <Paperclip size={14} />}
                            <span>Adjuntar</span>
                            <input 
                              type="file" 
                              className="hidden" 
                              onChange={(e) => handleFileUpload(e, doc.id)}
                              accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                              disabled={isUploading}
                            />
                          </label>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="relative">
                    <button 
                      onClick={() => setStatusPanelId(statusPanelId === doc.id ? null : doc.id)}
                      className={`flex items-center gap-2 px-4 py-2 ${info?.bg} ${info?.border} border rounded-xl transition-all hover:scale-105 active:scale-95`}
                    >
                      {info?.icon}
                      <span className={`text-sm font-bold ${info?.color} hidden xs:block`}>{info?.label}</span>
                    </button>

                    {/* Quick Status Change Panel */}
                    <AnimatePresence>
                      {statusPanelId === doc.id && (
                        <>
                          <motion.div 
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setStatusPanelId(null)}
                            className="fixed inset-0 z-[100]"
                          />
                          <motion.div
                            initial={{ opacity: 0, scale: 0.9, y: 10 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.9, y: 10 }}
                            className="absolute right-0 bottom-full mb-2 w-56 glass-card !p-2 z-[101] shadow-2xl border border-white/10"
                          >
                            <p className="text-[10px] font-bold text-white/30 uppercase tracking-[0.2em] px-3 py-2">Cambiar Estado</p>
                            <div className="space-y-1">
                              {[
                                { id: 'pending', ...getStatusInfo('pending') },
                                { id: 'review', ...getStatusInfo('review') },
                                { id: 'approved', ...getStatusInfo('approved') }
                              ].map((status) => (
                                <button
                                  key={status.id}
                                  onClick={() => handleUpdateStatus(doc.id, status.id as any)}
                                  className={`w-full flex items-center justify-between p-3 rounded-lg hover:bg-white/5 transition-colors group/item ${doc.estado === status.id ? 'bg-white/5' : ''}`}
                                >
                                  <div className="flex items-center gap-3">
                                    {status.icon}
                                    <span className={`text-sm font-medium ${doc.estado === status.id ? 'text-white' : 'text-white/60'}`}>
                                      {status.label}
                                    </span>
                                  </div>
                                  {doc.estado === status.id && <div className="w-1.5 h-1.5 rounded-full bg-primary shadow-neon-cyan" />}
                                </button>
                              ))}
                            </div>
                          </motion.div>
                        </>
                      )}
                    </AnimatePresence>
                  </div>
                </motion.div>
              );
            })
          )}
        </div>
      </div>

      {/* Add Document Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[200]"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="fixed inset-0 flex items-center justify-center p-4 z-[201] pointer-events-none"
            >
              <div className="glass-card w-full max-w-lg !p-0 overflow-hidden pointer-events-auto shadow-2xl border border-white/10">
                <div className="p-6 border-b border-white/5 flex items-center justify-between bg-gradient-to-r from-primary/10 to-transparent">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary/20 rounded-lg">
                      <Plus className="text-primary" size={24} />
                    </div>
                    <h3 className="text-xl font-bold">Nueva Actividad</h3>
                  </div>
                  <button 
                    onClick={() => setIsModalOpen(false)}
                    className="p-2 hover:bg-white/5 rounded-full transition-colors"
                  >
                    <X size={20} />
                  </button>
                </div>

                <form onSubmit={handleAddDocument} className="p-6 space-y-6">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-white/40 uppercase tracking-widest">Título del Documento</label>
                      <input
                        required
                        type="text"
                        placeholder="Ej: Presupuesto Trimestral Q1"
                        className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
                        value={newDoc.titulo}
                        onChange={(e) => setNewDoc({...newDoc, titulo: e.target.value})}
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-sm font-bold text-white/40 uppercase tracking-widest">N° de Documento</label>
                        <input
                          required
                          type="text"
                          placeholder="RSDC-2026-001"
                          className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
                          value={newDoc.numero_documento}
                          onChange={(e) => setNewDoc({...newDoc, numero_documento: e.target.value})}
                        />
                      </div>
                      <div className="space-y-2 relative">
                        <label className="text-sm font-bold text-white/40 uppercase tracking-widest">Recibido por</label>
                        <div className="relative">
                          <input
                            required
                            type="text"
                            placeholder="Nombre del responsable"
                            className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
                            value={newDoc.quien_recibio}
                            onChange={(e) => {
                              setNewDoc({...newDoc, quien_recibio: e.target.value});
                              setShowRecipientSuggestions(true);
                            }}
                            onFocus={() => setShowRecipientSuggestions(true)}
                          />
                          <AnimatePresence>
                            {showRecipientSuggestions && previousRecipients.length > 0 && (
                              <>
                                <div 
                                  className="fixed inset-0 z-[210]" 
                                  onClick={() => setShowRecipientSuggestions(false)}
                                />
                                <motion.div
                                  initial={{ opacity: 0, y: 5 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  exit={{ opacity: 0, y: 5 }}
                                  className="absolute left-0 right-0 top-full mt-2 bg-[#0a0f1a] border border-white/10 rounded-xl overflow-hidden z-[211] shadow-2xl max-h-40 overflow-y-auto"
                                >
                                  {previousRecipients
                                    .filter(name => name.toLowerCase().includes(newDoc.quien_recibio.toLowerCase()))
                                    .map((name, idx) => (
                                      <button
                                        key={idx}
                                        type="button"
                                        className="w-full text-left px-4 py-2 hover:bg-white/5 transition-colors text-sm text-white/70 hover:text-white"
                                        onClick={() => {
                                          setNewDoc({...newDoc, quien_recibio: name});
                                          setShowRecipientSuggestions(false);
                                        }}
                                      >
                                        {name}
                                      </button>
                                    ))}
                                </motion.div>
                              </>
                            )}
                          </AnimatePresence>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-sm font-bold text-white/40 uppercase tracking-widest">Fecha de Creación</label>
                        <input
                          required
                          type="date"
                          className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all [color-scheme:dark]"
                          value={newDoc.fecha_creacion}
                          onChange={(e) => setNewDoc({...newDoc, fecha_creacion: e.target.value})}
                        />
                      </div>
                      <div className="space-y-2 relative">
                        <label className="text-sm font-bold text-white/40 uppercase tracking-widest">Estado Inicial</label>
                        <div className="relative">
                          <button
                            type="button"
                            onClick={() => setIsStateDropdownOpen(!isStateDropdownOpen)}
                            className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all flex items-center justify-between group"
                          >
                            <div className="flex items-center gap-2">
                              {getStatusInfo(newDoc.estado)?.icon}
                              <span className="text-sm">{getStatusInfo(newDoc.estado)?.label}</span>
                            </div>
                            <ChevronRight className={`transition-transform ${isStateDropdownOpen ? 'rotate-90' : ''}`} size={18} />
                          </button>
                          
                          <AnimatePresence>
                            {isStateDropdownOpen && (
                              <>
                                <div 
                                  className="fixed inset-0 z-[210]" 
                                  onClick={() => setIsStateDropdownOpen(false)}
                                />
                                <motion.div
                                  initial={{ opacity: 0, scale: 0.95, y: 5 }}
                                  animate={{ opacity: 1, scale: 1, y: 0 }}
                                  exit={{ opacity: 0, scale: 0.95, y: 5 }}
                                  className="absolute left-0 right-0 top-full mt-2 bg-[#0a0f1a] border border-white/10 rounded-xl overflow-hidden z-[211] shadow-2xl"
                                >
                                  {[
                                    { id: 'pending', ...getStatusInfo('pending') },
                                    { id: 'review', ...getStatusInfo('review') },
                                    { id: 'approved', ...getStatusInfo('approved') }
                                  ].map((status) => (
                                    <button
                                      key={status.id}
                                      type="button"
                                      className={`w-full flex items-center gap-3 p-3 hover:bg-white/5 transition-colors ${newDoc.estado === status.id ? 'bg-white/5' : ''}`}
                                      onClick={() => {
                                        setNewDoc({...newDoc, estado: status.id as any});
                                        setIsStateDropdownOpen(false);
                                      }}
                                    >
                                      {status.icon}
                                      <span className="text-sm font-medium">{status.label}</span>
                                    </button>
                                  ))}
                                </motion.div>
                              </>
                            )}
                          </AnimatePresence>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-bold text-white/30 uppercase tracking-widest">Archivo Adjunto (Opcional)</label>
                      
                      {showCamera ? (
                        <div className="relative rounded-xl overflow-hidden bg-black aspect-video mb-2">
                          <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
                          <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-4">
                            <button
                              type="button"
                              onClick={takePhoto}
                              className="w-12 h-12 rounded-full bg-white border-4 border-white/20 flex items-center justify-center shadow-lg active:scale-95 transition-transform"
                            />
                            <button
                              type="button"
                              onClick={stopCamera}
                              className="w-12 h-12 rounded-full bg-red-500/80 text-white flex items-center justify-center shadow-lg active:scale-95 transition-transform"
                            >
                              <X size={24} />
                            </button>
                          </div>
                        </div>
                      ) : capturedImage ? (
                        <div className="relative rounded-xl overflow-hidden bg-black/20 border border-white/10 aspect-video mb-2">
                          <img src={capturedImage} alt="Captura" className="w-full h-full object-contain" />
                          <div className="absolute inset-0 bg-black/40 flex items-center justify-center gap-4 opacity-0 hover:opacity-100 transition-opacity">
                            <button
                              type="button"
                              onClick={retakePhoto}
                              className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-white text-sm font-bold flex items-center gap-2 backdrop-blur-sm"
                            >
                              <RefreshCw size={16} /> Repetir
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setCapturedImage(null);
                                setSelectedFile(null);
                              }}
                              className="px-4 py-2 bg-red-500/80 hover:bg-red-500 rounded-lg text-white text-sm font-bold flex items-center gap-2 backdrop-blur-sm"
                            >
                              <X size={16} /> Eliminar
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            className="flex-1 py-3 px-4 bg-white/5 border border-white/10 rounded-xl text-white/60 hover:text-white hover:bg-white/10 transition-all flex items-center justify-center gap-2 text-sm"
                          >
                            {selectedFile ? (
                              <span className="truncate max-w-[150px] text-white">{selectedFile.name}</span>
                            ) : (
                              <>
                                <Upload size={18} />
                                <span>Seleccionar Archivo</span>
                              </>
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={startCamera}
                            className="py-3 px-4 bg-white/5 border border-white/10 rounded-xl text-white/60 hover:text-white hover:bg-white/10 transition-all flex items-center justify-center gap-2"
                            title="Tomar foto"
                          >
                            <Camera size={20} />
                          </button>
                        </div>
                      )}
                      
                      <input
                        type="file"
                        ref={fileInputRef}
                        className="hidden"
                        onChange={(e) => {
                          if (e.target.files && e.target.files[0]) {
                            setSelectedFile(e.target.files[0]);
                            setCapturedImage(null);
                          }
                        }}
                        accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                      />
                      <p className="text-[10px] text-white/30 pl-1">
                        Formatos permitidos: PDF, Word, Imágenes
                      </p>
                    </div>
                  </div>

                  <div className="pt-4 flex gap-3">
                    <button
                      type="button"
                      onClick={() => setIsModalOpen(false)}
                      className="flex-1 py-4 px-6 rounded-xl border border-white/10 font-bold hover:bg-white/5 transition-all"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="flex-[2] py-4 px-6 rounded-xl bg-gradient-to-r from-primary to-secondary text-white font-bold shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {isSubmitting ? (
                        <Loader2 className="animate-spin" size={20} />
                      ) : (
                        <>Registrar Actividad <ChevronRight size={20} /></>
                      )}
                    </button>
                  </div>
                </form>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Attachment Viewer Modal */}
      <AnimatePresence>
        {viewingAttachment && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[300] bg-black/80 backdrop-blur-md flex flex-col"
            onClick={() => setViewingAttachment(null)}
          >
            {/* Header */}
            <div 
              className="flex items-center justify-between p-4 bg-black/40 border-b border-white/10"
              onClick={(e) => e.stopPropagation()}
            >
              <button 
                onClick={() => setViewingAttachment(null)}
                className="flex items-center gap-2 text-white/80 hover:text-white transition-colors px-4 py-2 rounded-lg hover:bg-white/10"
              >
                <ArrowLeft size={24} />
                <span className="font-bold">Volver</span>
              </button>
              <div className="flex gap-2">
                <a 
                  href={viewingAttachment} 
                  download
                  className="p-2 hover:bg-white/10 rounded-full transition-colors text-white/80 hover:text-white"
                  title="Descargar"
                >
                  <Upload className="rotate-180" size={24} />
                </a>
              </div>
            </div>

            {/* Content */}
            <div 
              className="flex-1 overflow-auto p-4 flex items-center justify-center"
              onClick={() => setViewingAttachment(null)}
            >
              <div onClick={(e) => e.stopPropagation()} className="relative max-w-full max-h-full">
                {viewingAttachment.match(/\.(jpg|jpeg|png|gif|webp)$/i) ? (
                  <img 
                    src={viewingAttachment} 
                    alt="Adjunto" 
                    className="max-w-full max-h-[85vh] object-contain rounded-lg shadow-2xl"
                  />
                ) : viewingAttachment.match(/\.pdf$/i) ? (
                  <iframe 
                    src={viewingAttachment} 
                    className="w-[90vw] h-[85vh] rounded-lg shadow-2xl bg-white"
                    title="Visor de PDF"
                  />
                ) : (
                  <div className="text-center space-y-4">
                    <div className="w-20 h-20 bg-white/10 rounded-full flex items-center justify-center mx-auto">
                      <Paperclip size={40} className="text-white/40" />
                    </div>
                    <p className="text-xl text-white font-bold">Vista previa no disponible</p>
                    <p className="text-white/40">Este tipo de archivo no se puede previsualizar.</p>
                    <a 
                      href={viewingAttachment} 
                      download
                      className="inline-block px-6 py-3 bg-primary text-white rounded-xl font-bold hover:bg-primary/80 transition-colors"
                    >
                      Descargar Archivo
                    </a>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Direccion;
