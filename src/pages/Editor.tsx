import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import ReactQuill from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';
import { ChevronLeft, Save, Loader2, Calendar, Type, FileText, Download, Printer, Share2, Users, Building2, User } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface DestinatarioHistory {
  destinatario_tipo: string;
  destinatario_nombre: string;
  destinatario_cargo: string;
  destinatario_institucion: string;
}

interface FirmanteHistory {
  firmante_nombre: string;
  firmante_cargo: string;
  firmante_institucion: string;
}

// Custom toolbar component
const CustomToolbar = () => (
  <div id="toolbar" className="flex flex-wrap items-center gap-1 p-2 bg-[#1a1f2e] border-b border-white/10 sticky top-0 z-10">
    <select className="ql-font bg-white/5 border-none text-white text-xs rounded px-2 py-1 outline-none">
      <option value="arial" selected>Arial</option>
      <option value="serif">Serif</option>
      <option value="monospace">Monospace</option>
    </select>
    <select className="ql-size bg-white/5 border-none text-white text-xs rounded px-2 py-1 outline-none">
      <option value="small">10</option>
      <option value="normal" selected>12</option>
      <option value="large">14</option>
      <option value="huge">18</option>
    </select>
    <div className="w-px h-4 bg-white/10 mx-1" />
    <button className="ql-bold p-1 hover:bg-white/5 rounded text-white" />
    <button className="ql-italic p-1 hover:bg-white/5 rounded text-white" />
    <button className="ql-underline p-1 hover:bg-white/5 rounded text-white" />
    <button className="ql-strike p-1 hover:bg-white/5 rounded text-white" />
    <div className="w-px h-4 bg-white/10 mx-1" />
    <button className="ql-list p-1 hover:bg-white/5 rounded text-white" value="ordered" />
    <button className="ql-list p-1 hover:bg-white/5 rounded text-white" value="bullet" />
    <div className="w-px h-4 bg-white/10 mx-1" />
    <select className="ql-align bg-white/5 border-none text-white text-xs rounded px-2 py-1 outline-none">
      <option value=""></option>
      <option value="center"></option>
      <option value="right"></option>
      <option value="justify"></option>
    </select>
    <div className="w-px h-4 bg-white/10 mx-1" />
    <button className="ql-clean p-1 hover:bg-white/5 rounded text-white" />
  </div>
);

const Editor: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [content, setContent] = useState('');
  const [oficio, setOficio] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [customDate, setCustomDate] = useState('');
  const [topMargin, setTopMargin] = useState(0);
  const [headerSpacing, setHeaderSpacing] = useState(2);
  const [greetingSpacing, setGreetingSpacing] = useState(2);
  const [signatureSpacing, setSignatureSpacing] = useState(4);
  const [destinatario, setDestinatario] = useState<DestinatarioHistory>({
    destinatario_tipo: 'persona',
    destinatario_nombre: '',
    destinatario_cargo: '',
    destinatario_institucion: ''
  });
  const [firmante, setFirmante] = useState<FirmanteHistory>({
    firmante_nombre: 'Mtr. Jose Rene Hernandez Jiménez',
    firmante_cargo: 'Administrador',
    firmante_institucion: 'Region Sanitaria Deptal. De Cortes'
  });
  const [history, setHistory] = useState<DestinatarioHistory[]>([]);
  const [firmanteHistory, setFirmanteHistory] = useState<FirmanteHistory[]>([]);
  const [showHistory, setShowHistory] = useState<string | null>(null);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchHistory = async () => {
    try {
      // Fetch Destinatarios
      const { data: destData, error: destError } = await supabase
        .from('rsdc_oficios')
        .select('destinatario_tipo, destinatario_nombre, destinatario_cargo, destinatario_institucion')
        .not('destinatario_nombre', 'eq', '')
        .order('created_at', { ascending: false });

      if (destError) throw destError;

      const uniqueDest = destData.reduce((acc: DestinatarioHistory[], curr) => {
        const exists = acc.find(h => 
          h.destinatario_nombre.toLowerCase() === curr.destinatario_nombre.toLowerCase() &&
          h.destinatario_tipo === curr.destinatario_tipo
        );
        if (!exists) acc.push(curr);
        return acc;
      }, []);

      setHistory(uniqueDest);

      // Fetch Firmantes
      const { data: firmData, error: firmError } = await supabase
        .from('rsdc_oficios')
        .select('firmante_nombre, firmante_cargo, firmante_institucion')
        .not('firmante_nombre', 'eq', '')
        .order('created_at', { ascending: false });

      if (firmError) throw firmError;

      const uniqueFirm = firmData.reduce((acc: FirmanteHistory[], curr) => {
        const exists = acc.find(h => 
          h.firmante_nombre.toLowerCase() === curr.firmante_nombre.toLowerCase()
        );
        if (!exists) acc.push(curr);
        return acc;
      }, []);

      setFirmanteHistory(uniqueFirm);
    } catch (err) {
      console.error('Error fetching history:', err);
    }
  };

  const fetchOficio = useCallback(async () => {
    if (!id) return;
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('rsdc_oficios')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      setOficio(data);
      setContent(data.contenido_editor || '');
      setCustomDate(data.fecha_creacion.split('T')[0]);
      setTopMargin(data.margen_superior || 0);
      setHeaderSpacing(data.espaciado_cabecera_destinatario ?? 2);
      setGreetingSpacing(data.espaciado_destinatario_saludo ?? 2);
      setSignatureSpacing(data.espaciado_firma ?? 4);
      setDestinatario({
        destinatario_tipo: data.destinatario_tipo || 'persona',
        destinatario_nombre: data.destinatario_nombre || '',
        destinatario_cargo: data.destinatario_cargo || '',
        destinatario_institucion: data.destinatario_institucion || ''
      });
      setFirmante({
        firmante_nombre: data.firmante_nombre || 'Mtr. Jose Rene Hernandez Jiménez',
        firmante_cargo: data.firmante_cargo || 'Administrador',
        firmante_institucion: data.firmante_institucion || 'Region Sanitaria Deptal. De Cortes'
      });
      fetchHistory();
    } catch (err) {
      console.error('Error fetching oficio:', err);
      navigate('/oficios');
    } finally {
      setLoading(false);
    }
  }, [id, navigate]);

  useEffect(() => {
    fetchOficio();
  }, [fetchOficio]);

  // Click outside listener for history dropdown
  useEffect(() => {
    const handleClickOutside = () => setShowHistory(null);
    window.addEventListener('click', handleClickOutside);
    return () => window.removeEventListener('click', handleClickOutside);
  }, []);

  const saveContent = useCallback(async (
    newContent: string, 
    margin?: number, 
    dest?: DestinatarioHistory, 
    hSpacing?: number, 
    gSpacing?: number,
    firm?: FirmanteHistory,
    sSpacing?: number
  ) => {
    if (!id) return;
    setSaving(true);
    const d = dest || destinatario;
    const f = firm || firmante;
    try {
      const { error } = await supabase
        .from('rsdc_oficios')
        .update({ 
          contenido_editor: newContent,
          fecha_creacion: customDate,
          margen_superior: margin !== undefined ? margin : topMargin,
          espaciado_cabecera_destinatario: hSpacing !== undefined ? hSpacing : headerSpacing,
          espaciado_destinatario_saludo: gSpacing !== undefined ? gSpacing : greetingSpacing,
          espaciado_firma: sSpacing !== undefined ? sSpacing : signatureSpacing,
          destinatario_tipo: d.destinatario_tipo,
          destinatario_nombre: d.destinatario_nombre,
          destinatario_cargo: d.destinatario_cargo,
          destinatario_institucion: d.destinatario_institucion,
          firmante_nombre: f.firmante_nombre,
          firmante_cargo: f.firmante_cargo,
          firmante_institucion: f.firmante_institucion
        })
        .eq('id', id);

      if (error) throw error;
    } catch (err) {
      console.error('Error auto-saving:', err);
    } finally {
      setSaving(false);
    }
  }, [id, customDate, topMargin, headerSpacing, greetingSpacing, destinatario, firmante]);

  const handleContentChange = (value: string) => {
    setContent(value);
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      saveContent(value);
    }, 2000); // Auto-save after 2 seconds of inactivity
  };

  const handleDateChange = (newDate: string) => {
    setCustomDate(newDate);
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      saveContent(content);
    }, 1000);
  };

  const handleMarginChange = (newMargin: number) => {
    setTopMargin(newMargin);
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      saveContent(content, newMargin);
    }, 1000);
  };

  const handleHeaderSpacingChange = (newSpacing: number) => {
    setHeaderSpacing(newSpacing);
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      saveContent(content, topMargin, destinatario, newSpacing);
    }, 1000);
  };

  const handleGreetingSpacingChange = (newSpacing: number) => {
    setGreetingSpacing(newSpacing);
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      saveContent(content, topMargin, destinatario, headerSpacing, newSpacing);
    }, 1000);
  };

  const handleSignatureSpacingChange = (newSpacing: number) => {
    setSignatureSpacing(newSpacing);
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      saveContent(content, topMargin, destinatario, headerSpacing, greetingSpacing, firmante, newSpacing);
    }, 1000);
  };

  const handleDestChange = (field: keyof DestinatarioHistory, value: string) => {
    const updated = { ...destinatario, [field]: value };
    
    setDestinatario(updated);
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      saveContent(content, topMargin, updated);
    }, 1500);
  };

  const handleFirmChange = (field: keyof FirmanteHistory, value: string) => {
    const updated = { ...firmante, [field]: value };
    setFirmante(updated);
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      saveContent(content, topMargin, destinatario, headerSpacing, greetingSpacing, updated);
    }, 1500);
  };

  const selectFromHistory = (item: DestinatarioHistory) => {
    setDestinatario(item);
    setShowHistory(null);
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      saveContent(content, topMargin, item);
    }, 500);
  };

  const selectFirmFromHistory = (item: FirmanteHistory) => {
    setFirmante(item);
    setShowHistory(null);
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      saveContent(content, topMargin, destinatario, headerSpacing, greetingSpacing, item);
    }, 500);
  };

  const formatDateString = (dateStr: string) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const months = [
      'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
      'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
    ];
    return `San Pedro Sula ${date.getDate() + 1} de ${months[date.getMonth()]} del ${date.getFullYear()}`;
  };

  if (loading) {
    return (
      <div className="h-[calc(100vh-64px)] flex flex-col items-center justify-center gap-4 bg-[#05070a]">
        <Loader2 className="text-primary animate-spin" size={48} />
        <p className="text-white/40 font-bold tracking-widest uppercase animate-pulse">Cargando Editor...</p>
      </div>
    );
  }

  const modules = {
    toolbar: {
      container: "#toolbar",
    }
  };

  const formats = [
    'font', 'size', 'bold', 'italic', 'underline', 'strike',
    'list', 'bullet', 'align', 'clean'
  ];

  return (
    <div className="h-[calc(100vh-64px)] flex flex-col bg-[#05070a] overflow-hidden">
      {/* Editor Header / Sub-nav */}
      <div className="h-14 bg-[#0a0f1a] border-b border-white/5 flex items-center justify-between px-6 shrink-0">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate('/oficios')}
            className="p-2 hover:bg-white/5 rounded-lg transition-colors text-white/60 hover:text-white"
          >
            <ChevronLeft size={20} />
          </button>
          <div className="flex flex-col">
            <h3 className="font-bold text-sm leading-tight">Editor de Oficios</h3>
            <p className="text-[10px] text-white/30 uppercase tracking-widest">
              Oficio No. {oficio?.numero_oficio}/ADMON/RSDC No.5
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-[10px] font-bold text-white/30 uppercase tracking-widest bg-white/5 px-3 py-1.5 rounded-full">
            {saving ? (
              <><Loader2 size={12} className="animate-spin" /> Guardando...</>
            ) : (
              <><Save size={12} /> Autoguardado Activo</>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button className="p-2 hover:bg-white/5 rounded-lg text-white/60 hover:text-white transition-colors" title="Descargar">
              <Download size={18} />
            </button>
            <button className="p-2 hover:bg-white/5 rounded-lg text-white/60 hover:text-white transition-colors" title="Imprimir">
              <Printer size={18} />
            </button>
            <button className="p-2 hover:bg-white/5 rounded-lg text-white/60 hover:text-white transition-colors" title="Compartir">
              <Share2 size={18} />
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Left Side: Word-like Editor */}
        <div className="flex-1 flex flex-col bg-[#0d1117] overflow-hidden border-r border-white/5">
          <CustomToolbar />
          
          <div className="flex-1 overflow-y-auto p-8 flex flex-col items-center bg-[#161b22] scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
            {/* The "Page" */}
            <div className="w-[816px] min-h-[1056px] bg-white shadow-2xl pt-[80px] px-[80px] pb-[180px] text-black font-['Arial'] relative mb-12">
              {/* Membrete Background */}
              <div 
                className="absolute inset-0 z-0 pointer-events-none opacity-50"
                style={{
                  backgroundImage: 'url(/membrete1.png)',
                  backgroundSize: '100% 100%',
                  backgroundPosition: 'center',
                  backgroundRepeat: 'no-repeat'
                }}
              />
              
              {/* Content Wrapper to sit above background */}
              <div className="relative z-10">
                {/* Oficio Header */}
                <div 
                  className="flex justify-between text-sm font-bold pb-4"
                  style={{ marginTop: `${topMargin * 24}px` }}
                >
                  <span>Oficio No. {oficio?.numero_oficio}/ADMON/RSDC No.5</span>
                  <span>{formatDateString(customDate)}</span>
                </div>

                {/* Destinatario Section */}
                <div 
                  className="space-y-0.5 relative group/dest"
                  style={{ marginTop: `${headerSpacing * 24}px` }}
                >
                  <div className="flex flex-col uppercase font-bold text-sm">
                    {destinatario.destinatario_tipo === 'empresa' && (
                      <div className="mt-1">SEÑORES</div>
                    )}
                    <div className="relative">
                      <input
                        type="text"
                        value={destinatario.destinatario_nombre}
                        onChange={(e) => handleDestChange('destinatario_nombre', e.target.value)}
                        onFocus={() => setShowHistory('nombre')}
                        className="bg-transparent border-none p-0 focus:ring-0 w-full cursor-text hover:bg-black/5 rounded transition-colors"
                        placeholder="NOMBRE COMPLETO"
                      />
                      {showHistory === 'nombre' && history.length > 0 && (
                        <div className="absolute left-0 top-full mt-1 w-full bg-white shadow-xl border border-black/10 rounded-xl z-[100] py-2 max-h-60 overflow-y-auto">
                          {history.map((h, i) => (
                            <button
                              key={i}
                              onClick={() => selectFromHistory(h)}
                              className="w-full text-left px-4 py-2 hover:bg-black/5 flex flex-col"
                            >
                              <span className="font-bold text-xs">{h.destinatario_nombre}</span>
                              <span className="text-[10px] opacity-50">{h.destinatario_cargo} - {h.destinatario_institucion}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    {destinatario.destinatario_tipo === 'persona' && (
                      <div className="relative">
                        <input
                          type="text"
                          value={destinatario.destinatario_cargo}
                          onChange={(e) => handleDestChange('destinatario_cargo', e.target.value)}
                          className="bg-transparent border-none p-0 focus:ring-0 w-full cursor-text hover:bg-black/5 rounded transition-colors"
                          placeholder="CARGO"
                        />
                      </div>
                    )}
                    <div className="relative">
                      <input
                        type="text"
                        value={destinatario.destinatario_institucion}
                        onChange={(e) => handleDestChange('destinatario_institucion', e.target.value)}
                        className="bg-transparent border-none p-0 focus:ring-0 w-full cursor-text hover:bg-black/5 rounded transition-colors"
                        placeholder="INSTITUCION O LUGAR"
                      />
                    </div>
                    <div className="mt-1">PRESENTE</div>
                  </div>
                </div>

                {/* Saludo Section */}
                <div 
                  className="font-bold text-sm mb-8"
                  style={{ marginTop: `${greetingSpacing * 24}px` }}
                >
                  Estimado {destinatario.destinatario_nombre.split(' ')[0] || '________'},
                </div>

                <ReactQuill
                  theme="snow"
                  value={content}
                  onChange={handleContentChange}
                  modules={modules}
                  formats={formats}
                  placeholder="Empiece a escribir su oficio aquí..."
                  className="quill-word-editor"
                />

                {/* Signature Section */}
                <div 
                  className="space-y-12"
                  style={{ marginTop: `${signatureSpacing * 24}px` }}
                >
                  <div className="text-sm">Atentamente,</div>
                  
                  <div className="space-y-0.5">
                    <div className="w-64 border-t border-black mb-2" />
                    <div className="font-bold text-sm">
                      <input
                        type="text"
                        value={firmante.firmante_nombre}
                        onChange={(e) => handleFirmChange('firmante_nombre', e.target.value)}
                        onFocus={() => setShowHistory('firmante_nombre')}
                        className="bg-transparent border-none p-0 focus:ring-0 w-full cursor-text hover:bg-black/5 rounded transition-colors"
                        placeholder="NOMBRE DEL FIRMANTE"
                      />
                      {showHistory === 'firmante_nombre' && firmanteHistory.length > 0 && (
                        <div className="absolute left-0 mt-1 w-64 bg-white shadow-xl border border-black/10 rounded-xl z-[100] py-2 max-h-60 overflow-y-auto">
                          {firmanteHistory.map((h, i) => (
                            <button
                              key={i}
                              onClick={() => selectFirmFromHistory(h)}
                              className="w-full text-left px-4 py-2 hover:bg-black/5 flex flex-col"
                            >
                              <span className="font-bold text-xs">{h.firmante_nombre}</span>
                              <span className="text-[10px] opacity-50">{h.firmante_cargo}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="text-sm">
                      <input
                        type="text"
                        value={firmante.firmante_cargo}
                        onChange={(e) => handleFirmChange('firmante_cargo', e.target.value)}
                        className="bg-transparent border-none p-0 focus:ring-0 w-full cursor-text hover:bg-black/5 rounded transition-colors"
                        placeholder="CARGO"
                      />
                    </div>
                    <div className="text-sm">
                      <input
                        type="text"
                        value={firmante.firmante_institucion}
                        onChange={(e) => handleFirmChange('firmante_institucion', e.target.value)}
                        className="bg-transparent border-none p-0 focus:ring-0 w-full cursor-text hover:bg-black/5 rounded transition-colors"
                        placeholder="INSTITUCION"
                      />
                    </div>
                  </div>

                  <div className="text-[10px] font-bold text-black/60 pt-8">
                    CC.ARCHIVO
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Side: Settings / Info */}
        <div className="w-80 bg-[#0a0f1a] flex flex-col p-6 space-y-8 shrink-0 overflow-y-auto">
          <div className="space-y-4">
            <h4 className="text-xs font-bold text-primary uppercase tracking-[0.2em] flex items-center gap-2">
              <Calendar size={14} /> Ajustes del Documento
            </h4>
            
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-white/30 uppercase tracking-widest">Fecha del Oficio</label>
                <input 
                  type="date" 
                  value={customDate}
                  onChange={(e) => handleDateChange(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all [color-scheme:dark] text-sm"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-bold text-white/30 uppercase tracking-widest">Número Correlativo</label>
                <div className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 text-white/40 text-sm font-mono">
                  {oficio?.numero_oficio}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-bold text-white/30 uppercase tracking-widest">Año</label>
                <div className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 text-white/40 text-sm font-mono">
                  {oficio?.anio}
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <label className="text-[10px] font-bold text-white/30 uppercase tracking-widest">Margen Superior</label>
                  <span className="text-[10px] font-bold text-primary">{topMargin} renglones</span>
                </div>
                <input 
                  type="range" 
                  min="0" 
                  max="20" 
                  value={topMargin}
                  onChange={(e) => handleMarginChange(parseInt(e.target.value))}
                  className="w-full h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-primary"
                />
              </div>

              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <label className="text-[10px] font-bold text-white/30 uppercase tracking-widest">Espacio Cabecera → Dest.</label>
                  <span className="text-[10px] font-bold text-primary">{headerSpacing} renglones</span>
                </div>
                <input 
                  type="range" 
                  min="0" 
                  max="10" 
                  value={headerSpacing}
                  onChange={(e) => handleHeaderSpacingChange(parseInt(e.target.value))}
                  className="w-full h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-primary"
                />
              </div>

              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <label className="text-[10px] font-bold text-white/30 uppercase tracking-widest">Espacio Dest. → Saludo</label>
                  <span className="text-[10px] font-bold text-primary">{greetingSpacing} renglones</span>
                </div>
                <input 
                  type="range" 
                  min="0" 
                  max="10" 
                  value={greetingSpacing}
                  onChange={(e) => handleGreetingSpacingChange(parseInt(e.target.value))}
                  className="w-full h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-primary"
                />
              </div>

              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <label className="text-[10px] font-bold text-white/30 uppercase tracking-widest">Espacio Firma</label>
                  <span className="text-[10px] font-bold text-primary">{signatureSpacing} renglones</span>
                </div>
                <input 
                  type="range" 
                  min="0" 
                  max="10" 
                  value={signatureSpacing}
                  onChange={(e) => handleSignatureSpacingChange(parseInt(e.target.value))}
                  className="w-full h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-primary"
                />
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <h4 className="text-xs font-bold text-primary uppercase tracking-[0.2em] flex items-center gap-2">
              <Users size={14} /> Destinatario
            </h4>
            
            <div className="space-y-4">
              <div className="flex bg-white/5 p-1 rounded-xl">
                <button
                  onClick={() => handleDestChange('destinatario_tipo', 'persona')}
                  className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-[10px] font-bold uppercase transition-all ${destinatario.destinatario_tipo === 'persona' ? 'bg-primary text-white shadow-lg' : 'text-white/40 hover:text-white'}`}
                >
                  <User size={12} /> Persona
                </button>
                <button
                  onClick={() => handleDestChange('destinatario_tipo', 'empresa')}
                  className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-[10px] font-bold uppercase transition-all ${destinatario.destinatario_tipo === 'empresa' ? 'bg-primary text-white shadow-lg' : 'text-white/40 hover:text-white'}`}
                >
                  <Building2 size={12} /> Empresa
                </button>
              </div>

              <div className="space-y-3">
                <div className="space-y-1 relative">
                  <label className="text-[10px] font-bold text-white/30 uppercase tracking-widest">Nombre / Empresa</label>
                  <input 
                    type="text" 
                    value={destinatario.destinatario_nombre}
                    onChange={(e) => handleDestChange('destinatario_nombre', e.target.value)}
                    onFocus={(e) => {
                      e.stopPropagation();
                      setShowHistory('panel');
                    }}
                    onClick={(e) => e.stopPropagation()}
                    className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all text-sm"
                    placeholder="Escriba para buscar..."
                  />
                  {showHistory === 'panel' && history.length > 0 && (
                    <div className="absolute left-0 top-full mt-1 w-full bg-[#1a1f2e] shadow-2xl border border-white/10 rounded-xl z-[100] py-2 max-h-60 overflow-y-auto scrollbar-thin scrollbar-thumb-white/10">
                      {history.map((h, i) => (
                        <button
                          key={i}
                          onClick={(e) => {
                            e.stopPropagation();
                            selectFromHistory(h);
                          }}
                          className="w-full text-left px-4 py-2 hover:bg-white/5 flex flex-col transition-colors border-b border-white/5 last:border-none"
                        >
                          <span className="font-bold text-xs text-white">{h.destinatario_nombre}</span>
                          <span className="text-[10px] text-white/40">{h.destinatario_cargo} - {h.destinatario_institucion}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {destinatario.destinatario_tipo === 'persona' && (
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-white/30 uppercase tracking-widest">Cargo</label>
                    <input 
                      type="text" 
                      value={destinatario.destinatario_cargo}
                      onChange={(e) => handleDestChange('destinatario_cargo', e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all text-sm"
                    />
                  </div>
                )}

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-white/30 uppercase tracking-widest">Institución / Lugar</label>
                  <input 
                    type="text" 
                    value={destinatario.destinatario_institucion}
                    onChange={(e) => handleDestChange('destinatario_institucion', e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all text-sm"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <h4 className="text-xs font-bold text-primary uppercase tracking-[0.2em] flex items-center gap-2">
              <User size={14} /> Firmante
            </h4>
            
            <div className="space-y-4">
              <div className="space-y-3">
                <div className="space-y-1 relative">
                  <label className="text-[10px] font-bold text-white/30 uppercase tracking-widest">Nombre del Firmante</label>
                  <input 
                    type="text" 
                    value={firmante.firmante_nombre}
                    onChange={(e) => handleFirmChange('firmante_nombre', e.target.value)}
                    onFocus={(e) => {
                      e.stopPropagation();
                      setShowHistory('firmante_panel');
                    }}
                    onClick={(e) => e.stopPropagation()}
                    className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all text-sm"
                    placeholder="Escriba para buscar..."
                  />
                  {showHistory === 'firmante_panel' && firmanteHistory.length > 0 && (
                    <div className="absolute left-0 top-full mt-1 w-full bg-[#1a1f2e] shadow-2xl border border-white/10 rounded-xl z-[100] py-2 max-h-60 overflow-y-auto scrollbar-thin scrollbar-thumb-white/10">
                      {firmanteHistory.map((h, i) => (
                        <button
                          key={i}
                          onClick={(e) => {
                            e.stopPropagation();
                            selectFirmFromHistory(h);
                          }}
                          className="w-full text-left px-4 py-2 hover:bg-white/5 flex flex-col transition-colors border-b border-white/5 last:border-none"
                        >
                          <span className="font-bold text-xs text-white">{h.firmante_nombre}</span>
                          <span className="text-[10px] text-white/40">{h.firmante_cargo}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-white/30 uppercase tracking-widest">Cargo</label>
                  <input 
                    type="text" 
                    value={firmante.firmante_cargo}
                    onChange={(e) => handleFirmChange('firmante_cargo', e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all text-sm"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-white/30 uppercase tracking-widest">Institución / Lugar</label>
                  <input 
                    type="text" 
                    value={firmante.firmante_institucion}
                    onChange={(e) => handleFirmChange('firmante_institucion', e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all text-sm"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <h4 className="text-xs font-bold text-secondary uppercase tracking-[0.2em] flex items-center gap-2">
              <Type size={14} /> Información
            </h4>
            <div className="glass-card !bg-white/5 !p-4 space-y-3">
              <div className="flex items-center gap-3 text-sm">
                <div className="p-2 bg-secondary/20 rounded-lg text-secondary">
                  <FileText size={16} />
                </div>
                <div>
                  <p className="font-bold text-white leading-none">Formato A4</p>
                  <p className="text-[10px] text-white/30 uppercase tracking-tighter mt-1">210mm x 297mm</p>
                </div>
              </div>
              <p className="text-xs text-white/50 leading-relaxed italic">
                "Este documento cumple con los estándares institucionales de la Región Sanitaria."
              </p>
            </div>
          </div>

          <div className="mt-auto pt-6 border-t border-white/5">
            <button 
              onClick={() => navigate('/oficios')}
              className="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-primary to-secondary text-white font-bold shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all uppercase tracking-widest text-[10px]"
            >
              Finalizar Edición
            </button>
          </div>
        </div>
      </div>

      <style>{`
        .quill-word-editor .ql-container.ql-snow {
          border: none !important;
          font-family: 'Arial', sans-serif !important;
          font-size: 12pt !important;
        }
        .quill-word-editor .ql-editor {
          padding: 0 !important;
          line-height: 1.5 !important;
          min-height: 800px !important;
        }
        .quill-word-editor .ql-editor p {
          margin-bottom: 1rem !important;
        }
        #toolbar {
          border: none !important;
          border-bottom: 1px solid rgba(255,255,255,0.1) !important;
        }
        .ql-snow .ql-stroke {
          stroke: rgba(255,255,255,0.6) !important;
        }
        .ql-snow .ql-fill {
          fill: rgba(255,255,255,0.6) !important;
        }
        .ql-snow .ql-picker {
          color: rgba(255,255,255,0.6) !important;
        }
        .ql-snow.ql-toolbar button:hover .ql-stroke,
        .ql-snow .ql-toolbar button:hover .ql-stroke {
          stroke: #00f2ff !important;
        }
        .ql-snow.ql-toolbar button:hover .ql-fill,
        .ql-snow .ql-toolbar button:hover .ql-fill {
          fill: #00f2ff !important;
        }
        .ql-snow.ql-toolbar button.ql-active .ql-stroke {
          stroke: #00f2ff !important;
        }
      `}</style>
    </div>
  );
};

export default Editor;
