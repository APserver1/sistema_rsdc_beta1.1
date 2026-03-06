import { useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { aiService } from '../lib/ai-service';
import { telegramService } from '../lib/ai-telegram-service';
import { format } from 'date-fns';

export const useScheduler = () => {
  useEffect(() => {
    // Check every minute
    const interval = setInterval(checkReminders, 60000);
    // Initial check
    checkReminders();

    return () => clearInterval(interval);
  }, []);

  const checkReminders = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const now = new Date();
      const currentDateStr = format(now, 'yyyy-MM-dd');
      const currentTimeStr = format(now, 'HH:mm');

      // 1. Get pending events that match criteria
      const { data: events, error } = await supabase
        .from('rsdc_calendar')
        .select('*')
        .eq('user_id', user.id)
        .or(`estado.eq.pendiente,estado.eq.notificado`);

      if (error || !events) return;

      for (const event of events) {
        let shouldNotify = false;

        if (event.es_recurrente && event.patron_recurrencia === 'daily') {
          // Check if time matches current minute (approx) and hasn't been notified today
          if (event.hora_recordatorio?.substring(0, 5) === currentTimeStr) {
            const lastNotified = event.ultimo_aviso ? new Date(event.ultimo_aviso) : null;
            const lastNotifiedDate = lastNotified ? format(lastNotified, 'yyyy-MM-dd') : null;
            
            if (lastNotifiedDate !== currentDateStr) {
              shouldNotify = true;
            }
          }
        } else {
          // One-time event
          if (event.estado === 'pendiente' && event.fecha_evento) {
            const eventDate = new Date(event.fecha_evento);
            if (eventDate <= now) {
              shouldNotify = true;
            }
          }
        }

        if (shouldNotify) {
          await sendNotification(user.id, event);
        }
      }

    } catch (e) {
      console.error('Scheduler error:', e);
    }
  };

  const sendNotification = async (userId: string, event: any) => {
    const message = `🔔 RECORDATORIO: ${event.titulo}\n${event.descripcion || ''}`;
    
    // 1. Send to Web Chat (via DB insert only, to avoid triggering AI response loop immediately if not needed)
    // Actually, we want it to appear in the chat history.
    // We can insert a system message or an assistant message.
    
    // Find latest chat
    const { data: chat } = await supabase
      .from('rsdc_ai_chat')
      .select('id, conversacion')
      .eq('user_id', userId)
      .order('ultima_vez_usado', { ascending: false })
      .limit(1)
      .single();

    if (chat) {
      const newHistory = [...chat.conversacion, { role: 'assistant', content: message }];
      await supabase
        .from('rsdc_ai_chat')
        .update({ 
          conversacion: newHistory,
          ultima_vez_usado: new Date().toISOString()
        })
        .eq('id', chat.id);
    }

    // 2. Send to Telegram (if linked)
    const { data: linkedUser } = await supabase
      .from('rsdc_telegram_users')
      .select('telegram_chat_id')
      .eq('user_id', userId)
      .single();

    if (linkedUser) {
      await telegramService.sendTelegramMessage(linkedUser.telegram_chat_id, message);
    }

    // 3. Update Event Status
    if (event.es_recurrente) {
      await supabase
        .from('rsdc_calendar')
        .update({ 
          ultimo_aviso: new Date().toISOString(),
          estado: 'notificado' 
        })
        .eq('id', event.id);
    } else {
      await supabase
        .from('rsdc_calendar')
        .update({ 
          ultimo_aviso: new Date().toISOString(),
          estado: 'notificado' // Mark as notified so we don't spam. User can delete or mark done later.
        })
        .eq('id', event.id);
    }
  };
};
