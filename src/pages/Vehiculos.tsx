import React, { useState, useEffect } from 'react';
import { Car, Calendar as CalendarIcon, Plus, X, Save, AlertCircle, ArrowLeft } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { motion, AnimatePresence } from 'framer-motion';

interface VehiculoRecord {
  id?: number;
  fecha: string;
  hora: string;
  nombre: string;
  personal_que_acompana: string;
  destino: string;
  hora_de_regreso: string;
}

const MONTHS = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

const Vehiculos: React.FC = () => {
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null);
  const [records, setRecords] = useState<VehiculoRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [newRecords, setNewRecords] = useState<VehiculoRecord[]>([]);
  const [saving, setSaving] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Suggestions
  const [nombresUsados, setNombresUsados] = useState<string[]>([]);
  const [personalUsado, setPersonalUsado] = useState<string[]>([]);

  useEffect(() => {
    fetchSuggestions();
  }, []);

  useEffect(() => {
    if (selectedMonth !== null) {
      fetchRecordsForMonth(selectedYear, selectedMonth);
    }
  }, [selectedYear, selectedMonth]);

  const fetchSuggestions = async () => {
    try {
      const { data: nombresData } = await supabase.from('control_de_vehiculos').select('nombre');
      const { data: personalData } = await supabase.from('control_de_vehiculos').select('personal_que_acompana');
      
      if (nombresData) {
        const uniqueNombres = Array.from(new Set(nombresData.map(r => r.nombre).filter(Boolean)));
        setNombresUsados(uniqueNombres);
      }
      if (personalData) {
        const uniquePersonal = Array.from(new Set(personalData.map(r => r.personal_que_acompana).filter(Boolean)));
        setPersonalUsado(uniquePersonal);
      }
    } catch (e) {
      console.error("Error fetching suggestions:", e);
    }
  };

  const fetchRecordsForMonth = async (year: number, monthIndex: number) => {
    setLoading(true);
    try {
      const startDate = new Date(year, monthIndex, 1).toISOString().split('T')[0];
      const endDate = new Date(year, monthIndex + 1, 0).toISOString().split('T')[0];

      const { data, error } = await supabase
        .from('control_de_vehiculos')
        .select('*')
        .gte('fecha', startDate)
        .lte('fecha', endDate)
        .order('fecha', { ascending: true })
        .order('hora', { ascending: true });

      if (error) throw error;
      setRecords(data || []);
    } catch (e) {
      console.error("Error fetching records:", e);
    } finally {
      setLoading(false);
    }
  };

  const openModal = () => {
    // 15 empty rows
    setNewRecords(Array.from({ length: 15 }, () => ({
      fecha: '', hora: '', nombre: '', personal_que_acompana: '', destino: '', hora_de_regreso: ''
    })));
    setErrorMsg(null);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setNewRecords([]);
  };

  const handleFieldChange = (index: number, field: keyof VehiculoRecord, value: string) => {
    const updated = [...newRecords];
    updated[index] = { ...updated[index], [field]: value };

    // Auto-fill dates below
    if (field === 'fecha') {
      for (let i = index + 1; i < updated.length; i++) {
        updated[i].fecha = value;
      }
    }

    setNewRecords(updated);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, rowIndex: number, colIndex: number) => {
    const target = e.target as HTMLInputElement;
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      document.getElementById(`cell-${rowIndex - 1}-${colIndex}`)?.focus();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      document.getElementById(`cell-${rowIndex + 1}-${colIndex}`)?.focus();
    } else if (e.key === 'ArrowLeft') {
      if (target.type === 'text' && target.selectionStart !== 0) return;
      e.preventDefault();
      const prev = document.getElementById(`cell-${rowIndex}-${colIndex - 1}`);
      if (prev) prev.focus();
      else document.getElementById(`cell-${rowIndex - 1}-5`)?.focus();
    } else if (e.key === 'ArrowRight') {
      if (target.type === 'text' && target.selectionEnd !== target.value.length) return;
      e.preventDefault();
      const next = document.getElementById(`cell-${rowIndex}-${colIndex + 1}`);
      if (next) next.focus();
      else document.getElementById(`cell-${rowIndex + 1}-0`)?.focus();
    }
  };

  const handleSave = async () => {
    setErrorMsg(null);
    // Filter rows that have at least one field filled (ignoring if ONLY fecha is filled)
    const rowsWithData = newRecords.filter(r => 
      r.hora || r.nombre || r.personal_que_acompana || r.destino || r.hora_de_regreso
    );

    if (rowsWithData.length === 0) {
      closeModal();
      return;
    }

    // Validate required fields (all except hora_de_regreso)
    const isValid = rowsWithData.every(r => 
      r.fecha && r.hora && r.nombre && r.personal_que_acompana && r.destino
    );

    if (!isValid) {
      setErrorMsg("Información faltante: Por favor llena todos los campos obligatorios en las filas que estás usando (Hora de regreso es opcional).");
      return;
    }

    setSaving(true);
    try {
      // Map to db format, handle empty hora_de_regreso as null
      const recordsToInsert = rowsWithData.map(r => ({
        fecha: r.fecha,
        hora: r.hora + (r.hora.length === 5 ? ':00' : ''), // ensure HH:MM:SS
        nombre: r.nombre,
        personal_que_acompana: r.personal_que_acompana,
        destino: r.destino,
        hora_de_regreso: r.hora_de_regreso ? (r.hora_de_regreso + (r.hora_de_regreso.length === 5 ? ':00' : '')) : null
      }));

      const { error } = await supabase.from('control_de_vehiculos').insert(recordsToInsert);
      
      if (error) throw error;
      
      // Refresh current view if applicable
      if (selectedMonth !== null) {
        fetchRecordsForMonth(selectedYear, selectedMonth);
      }
      fetchSuggestions(); // update suggestions with new names
      closeModal();
    } catch (e) {
      console.error("Error saving records:", e);
      setErrorMsg(e instanceof Error ? e.message : "Hubo un error al guardar los registros.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-8 relative">
      <datalist id="nombres-list">
        {nombresUsados.map((n, idx) => <option key={idx} value={n} />)}
      </datalist>
      <datalist id="personal-list">
        {personalUsado.map((p, idx) => <option key={idx} value={p} />)}
      </datalist>

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold flex items-center gap-3">
            <Car className="text-green-400" /> Registro de Vehículos
          </h2>
          <p className="text-white/50">Control de flota, pases de salida y mantenimiento.</p>
        </div>
        <div className="flex items-center gap-4">
          <select 
            className="bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white focus:outline-none focus:border-green-400/50 transition-colors"
            value={selectedYear}
            onChange={(e) => {
              setSelectedYear(parseInt(e.target.value));
              setSelectedMonth(null);
            }}
          >
            {Array.from({ length: 10 }, (_, i) => new Date().getFullYear() - 5 + i).map(year => (
              <option key={year} value={year} className="bg-[#0F172A] text-white">{year}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Main Content Area */}
      {selectedMonth === null ? (
        // Months Grid
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {MONTHS.map((month, index) => (
            <button
              key={month}
              onClick={() => setSelectedMonth(index)}
              className="flex flex-col items-center justify-center p-6 bg-white/5 hover:bg-white/10 border border-white/5 hover:border-green-400/30 rounded-2xl transition-all group"
            >
              <CalendarIcon className="text-white/20 group-hover:text-green-400 mb-3 transition-colors" size={32} />
              <span className="font-medium text-lg">{month}</span>
            </button>
          ))}
        </div>
      ) : (
        // Records Table for Selected Month
        <div className="space-y-4">
          <button 
            onClick={() => setSelectedMonth(null)}
            className="flex items-center gap-2 text-white/50 hover:text-white transition-colors"
          >
            <ArrowLeft size={20} /> Volver a los meses
          </button>
          
          <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
            <div className="p-4 border-b border-white/10 flex justify-between items-center bg-white/5">
              <h3 className="font-semibold text-lg flex items-center gap-2">
                <CalendarIcon className="text-green-400" size={20} />
                Registros de {MONTHS[selectedMonth]} {selectedYear}
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-white/5 border-b border-white/10 text-white/50 text-sm">
                  <tr>
                    <th className="p-4 font-medium whitespace-nowrap">Fecha</th>
                    <th className="p-4 font-medium whitespace-nowrap">Hora</th>
                    <th className="p-4 font-medium whitespace-nowrap">Nombre</th>
                    <th className="p-4 font-medium whitespace-nowrap">Personal que Acompaña</th>
                    <th className="p-4 font-medium whitespace-nowrap">Destino</th>
                    <th className="p-4 font-medium whitespace-nowrap">Hora de Regreso</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {loading ? (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-white/50">Cargando registros...</td>
                    </tr>
                  ) : records.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-white/50">No hay registros en este mes.</td>
                    </tr>
                  ) : (
                    records.map((r, i) => (
                      <tr key={r.id || i} className="hover:bg-white/5 transition-colors">
                        <td className="p-4 whitespace-nowrap">{r.fecha}</td>
                        <td className="p-4 whitespace-nowrap">{r.hora?.slice(0,5)}</td>
                        <td className="p-4">{r.nombre}</td>
                        <td className="p-4">{r.personal_que_acompana}</td>
                        <td className="p-4">{r.destino}</td>
                        <td className="p-4 whitespace-nowrap">{r.hora_de_regreso ? r.hora_de_regreso.slice(0,5) : '-'}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Floating Add Button */}
      <button
        onClick={openModal}
        className="fixed bottom-8 right-8 w-14 h-14 bg-green-500 hover:bg-green-400 text-white rounded-full shadow-lg hover:shadow-green-500/25 flex items-center justify-center transition-all z-40 group"
      >
        <Plus size={28} className="group-hover:scale-110 transition-transform" />
      </button>

      {/* Add Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={closeModal}
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative bg-[#0F172A] border border-white/10 rounded-2xl shadow-2xl w-full max-w-6xl max-h-[90vh] flex flex-col"
            >
              <div className="p-6 border-b border-white/10 flex items-center justify-between bg-white/5">
                <h3 className="text-xl font-bold flex items-center gap-2">
                  <Plus className="text-green-400" /> Nuevos Registros
                </h3>
                <button
                  onClick={closeModal}
                  className="p-2 hover:bg-white/10 rounded-lg text-white/50 hover:text-white transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="p-6 overflow-y-auto flex-1">
                {errorMsg && (
                  <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 flex items-start gap-3">
                    <AlertCircle className="shrink-0 mt-0.5" size={20} />
                    <p>{errorMsg}</p>
                  </div>
                )}
                
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="text-white/50 text-sm border-b border-white/10">
                        <th className="pb-3 pr-2 font-medium min-w-[140px]">Fecha *</th>
                        <th className="pb-3 px-2 font-medium min-w-[100px]">Hora *</th>
                        <th className="pb-3 px-2 font-medium min-w-[180px]">Nombre *</th>
                        <th className="pb-3 px-2 font-medium min-w-[180px]">Personal *</th>
                        <th className="pb-3 px-2 font-medium min-w-[180px]">Destino *</th>
                        <th className="pb-3 pl-2 font-medium min-w-[100px]">Regreso</th>
                      </tr>
                    </thead>
                    <tbody>
                      {newRecords.map((record, index) => (
                        <tr key={index} className="border-b border-white/5">
                          <td className="py-2 pr-2">
                            <input
                              id={`cell-${index}-0`}
                              type="date"
                              value={record.fecha}
                              onChange={(e) => handleFieldChange(index, 'fecha', e.target.value)}
                              onKeyDown={(e) => handleKeyDown(e, index, 0)}
                              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-green-400/50"
                            />
                          </td>
                          <td className="py-2 px-2">
                            <input
                              id={`cell-${index}-1`}
                              type="time"
                              value={record.hora}
                              onChange={(e) => handleFieldChange(index, 'hora', e.target.value)}
                              onKeyDown={(e) => handleKeyDown(e, index, 1)}
                              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-green-400/50"
                            />
                          </td>
                          <td className="py-2 px-2">
                            <input
                              id={`cell-${index}-2`}
                              type="text"
                              list="nombres-list"
                              value={record.nombre}
                              onChange={(e) => handleFieldChange(index, 'nombre', e.target.value)}
                              onKeyDown={(e) => handleKeyDown(e, index, 2)}
                              placeholder="Nombre..."
                              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-green-400/50"
                            />
                          </td>
                          <td className="py-2 px-2">
                            <input
                              id={`cell-${index}-3`}
                              type="text"
                              list="personal-list"
                              value={record.personal_que_acompana}
                              onChange={(e) => handleFieldChange(index, 'personal_que_acompana', e.target.value)}
                              onKeyDown={(e) => handleKeyDown(e, index, 3)}
                              placeholder="Acompañantes..."
                              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-green-400/50"
                            />
                          </td>
                          <td className="py-2 px-2">
                            <input
                              id={`cell-${index}-4`}
                              type="text"
                              value={record.destino}
                              onChange={(e) => handleFieldChange(index, 'destino', e.target.value)}
                              onKeyDown={(e) => handleKeyDown(e, index, 4)}
                              placeholder="Destino..."
                              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-green-400/50"
                            />
                          </td>
                          <td className="py-2 pl-2">
                            <input
                              id={`cell-${index}-5`}
                              type="time"
                              value={record.hora_de_regreso}
                              onChange={(e) => handleFieldChange(index, 'hora_de_regreso', e.target.value)}
                              onKeyDown={(e) => handleKeyDown(e, index, 5)}
                              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-green-400/50"
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="p-6 border-t border-white/10 bg-white/5 flex justify-end gap-3">
                <button
                  onClick={closeModal}
                  className="px-6 py-2 rounded-xl text-white hover:bg-white/10 font-medium transition-colors"
                  disabled={saving}
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="px-6 py-2 bg-green-500 hover:bg-green-400 text-white rounded-xl font-medium shadow-lg shadow-green-500/20 flex items-center gap-2 transition-all disabled:opacity-50"
                >
                  {saving ? (
                    <>Guardando...</>
                  ) : (
                    <>
                      <Save size={20} /> Guardar Registros
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Vehiculos;
