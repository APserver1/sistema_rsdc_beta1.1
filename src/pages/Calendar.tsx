import React, { useState, useEffect } from 'react';
import Calendar from 'react-calendar';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { supabase } from '../lib/supabase';
import { Calendar as CalendarIcon, Clock, Repeat, CheckCircle2, Loader2, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import 'react-calendar/dist/Calendar.css';

interface CalendarEvent {
  id: string;
  titulo: string;
  descripcion: string;
  fecha_evento: string | null;
  hora_recordatorio: string | null;
  es_recurrente: boolean;
  patron_recurrencia: string;
  estado: string;
  created_at: string;
}

const CalendarPage: React.FC = () => {
  const [value, setValue] = useState<Date>(new Date());
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDateEvents, setSelectedDateEvents] = useState<CalendarEvent[]>([]);

  useEffect(() => {
    fetchEvents();
  }, []);

  useEffect(() => {
    filterEventsForDate(value);
  }, [value, events]);

  const fetchEvents = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('rsdc_calendar')
        .select('*')
        .eq('user_id', user.id)
        .or(`estado.eq.pendiente,estado.eq.notificado`)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setEvents(data || []);
    } catch (err) {
      console.error('Error fetching events:', err);
    } finally {
      setLoading(false);
    }
  };

  const filterEventsForDate = (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    
    const filtered = events.filter(event => {
      if (event.es_recurrente && event.patron_recurrencia === 'daily') {
        return true; // Show daily events every day
      }
      if (event.fecha_evento) {
        return event.fecha_evento.startsWith(dateStr);
      }
      return false;
    });
    
    setSelectedDateEvents(filtered);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar este recordatorio?')) return;
    try {
      await supabase.from('rsdc_calendar').delete().eq('id', id);
      fetchEvents();
    } catch (e) {
      console.error(e);
    }
  };

  const tileClassName = ({ date, view }: { date: Date, view: string }) => {
    if (view === 'month') {
      const dateStr = format(date, 'yyyy-MM-dd');
      const hasEvent = events.some(e => !e.es_recurrente && e.fecha_evento?.startsWith(dateStr));
      if (hasEvent) return 'has-event';
    }
    return null;
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h2 className="text-3xl font-bold flex items-center gap-3">
          <CalendarIcon className="text-secondary" /> Calendario y Recordatorios
        </h2>
        <p className="text-white/50">Gestiona tus eventos y recordatorios programados con la IA.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Calendar View */}
        <div className="lg:col-span-1">
          <div className="glass-card p-6">
            <style>{`
              .react-calendar { 
                background: transparent; 
                border: none; 
                width: 100%; 
                font-family: inherit;
                color: white;
              }
              .react-calendar__tile {
                color: white;
                padding: 1rem 0.5rem;
                border-radius: 0.5rem;
              }
              .react-calendar__tile:enabled:hover,
              .react-calendar__tile:enabled:focus {
                background-color: rgba(255, 255, 255, 0.1);
              }
              .react-calendar__tile--now {
                background: rgba(var(--color-primary), 0.2);
                color: var(--color-primary);
              }
              .react-calendar__tile--active {
                background: var(--color-primary) !important;
                color: black !important;
              }
              .react-calendar__navigation button {
                color: white;
                font-size: 1.2rem;
              }
              .react-calendar__navigation button:enabled:hover,
              .react-calendar__navigation button:enabled:focus {
                background-color: rgba(255, 255, 255, 0.1);
              }
              .react-calendar__month-view__days__day--weekend {
                color: #ff6b6b;
              }
              .has-event {
                position: relative;
                background-color: rgba(59, 130, 246, 0.2) !important; /* Blue background for event days */
                color: #60a5fa !important;
              }
            `}</style>
            <Calendar
              onChange={(d) => setValue(d as Date)}
              value={value}
              tileClassName={tileClassName}
              locale="es-ES"
            />
          </div>
        </div>

        {/* Details View */}
        <div className="lg:col-span-2">
          <div className="glass-card p-6 min-h-[500px] flex flex-col">
            <div className="flex items-center justify-between mb-6 pb-4 border-b border-white/10">
              <h3 className="text-xl font-bold capitalize">
                {format(value, "EEEE, d 'de' MMMM 'de' yyyy", { locale: es })}
              </h3>
              <span className="text-sm text-white/40 bg-white/5 px-3 py-1 rounded-full">
                {selectedDateEvents.length} eventos
              </span>
            </div>

            <div className="flex-1 space-y-4 overflow-y-auto">
              {loading ? (
                <div className="flex items-center justify-center h-40">
                  <Loader2 className="animate-spin text-primary" size={32} />
                </div>
              ) : selectedDateEvents.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-white/20 gap-4">
                  <CalendarIcon size={48} />
                  <p>No hay eventos para este día.</p>
                </div>
              ) : (
                <AnimatePresence>
                  {selectedDateEvents.map((event) => (
                    <motion.div
                      key={event.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, x: -10 }}
                      className="bg-white/5 border border-white/10 p-4 rounded-xl flex items-center justify-between group"
                    >
                      <div className="flex items-center gap-4">
                        <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                          event.es_recurrente ? 'bg-purple-500/10 text-purple-400' : 'bg-blue-500/10 text-blue-400'
                        }`}>
                          {event.es_recurrente ? <Repeat size={20} /> : <Clock size={20} />}
                        </div>
                        <div>
                          <h4 className="font-bold text-lg">{event.titulo}</h4>
                          {event.descripcion && (
                            <p className="text-sm text-white/60">{event.descripcion}</p>
                          )}
                          <div className="flex items-center gap-3 mt-1 text-xs text-white/40">
                            {event.es_recurrente ? (
                              <span className="bg-purple-500/10 px-2 py-0.5 rounded text-purple-300">
                                Diario a las {event.hora_recordatorio?.substring(0, 5)}
                              </span>
                            ) : (
                              <span className="bg-blue-500/10 px-2 py-0.5 rounded text-blue-300">
                                {event.fecha_evento ? format(new Date(event.fecha_evento), 'HH:mm') : 'Todo el día'}
                              </span>
                            )}
                            {event.estado === 'notificado' && (
                              <span className="flex items-center gap-1 text-green-400">
                                <CheckCircle2 size={12} /> Notificado
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      
                      <button
                        onClick={() => handleDelete(event.id)}
                        className="p-2 text-white/20 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                        title="Eliminar"
                      >
                        <Trash2 size={20} />
                      </button>
                    </motion.div>
                  ))}
                </AnimatePresence>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CalendarPage;
