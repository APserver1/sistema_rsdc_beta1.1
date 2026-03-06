import { supabase } from './supabase';
import { AI_CONFIG } from './AI_APY_KEYS';
import { aiService, type Message } from './ai-service';

const TELEGRAM_API = `https://api.telegram.org/bot${AI_CONFIG.telegramToken}`;

export const telegramService = {
  lastUpdateId: 0,
  isPolling: false,
  processedUpdates: new Set<number>(),

  async startPolling() {
    if (this.isPolling) {
      console.log('Telegram Bot is already polling.');
      return;
    }
    
    this.isPolling = true;
    console.log('Telegram Bot Polling started...');
    
    while (this.isPolling) {
      try {
        const response = await fetch(`${TELEGRAM_API}/getUpdates?offset=${this.lastUpdateId + 1}&timeout=30`);
        if (!this.isPolling) break; // Check if we stopped while waiting for fetch
        
        const data = await response.json();

        if (data.ok && data.result.length > 0) {
          for (const update of data.result) {
            // Check if we already processed this specific update_id in this session
            if (this.processedUpdates.has(update.update_id)) continue;
            
            this.lastUpdateId = update.update_id;
            this.processedUpdates.add(update.update_id);
            
            // Limit the size of the set to avoid memory issues
            if (this.processedUpdates.size > 100) {
              const oldest = Array.from(this.processedUpdates)[0];
              this.processedUpdates.delete(oldest);
            }

            if (update.message) {
              await this.handleMessage(update.message);
            }
          }
        }
      } catch (e) {
        if (this.isPolling) {
          console.error('Telegram Polling Error:', e);
          await new Promise(resolve => setTimeout(resolve, 5000));
        }
      }
    }
  },

  stopPolling() {
    console.log('Telegram Bot Polling stopped.');
    this.isPolling = false;
  },

  async handleMessage(message: any) {
    const chatId = message.chat.id;
    let text = message.text;

    // Handle Voice Messages
    if (message.voice) {
      await this.sendTelegramAction(chatId, 'typing');
      await this.sendTelegramMessage(chatId, "_Transcribiendo audio..._");
      try {
        text = await this.transcribeVoice(message.voice.file_id);
      } catch (e) {
        console.error("Transcription error:", e);
        await this.sendTelegramMessage(chatId, "Lo siento, no pude transcribir el audio.");
        return;
      }
    }

    if (!text) return;

    // 1. Check if linked
    const { data: linkedUser } = await supabase
      .from('rsdc_telegram_users')
      .select('user_id')
      .eq('telegram_chat_id', chatId)
      .single();

    if (!linkedUser) {
      if (text.startsWith('/start')) {
        const code = text.split(' ')[1];
        if (code) {
          return this.linkAccount(chatId, code);
        }
      }
      return this.sendTelegramMessage(chatId, "Hola! Soy Alex, tu asistente de RSDC. Para comenzar, necesito vincular tu cuenta. Ve a la página del Bot en el sistema y genera un código de vinculación.");
    }

    // 2. Process with AI
    await this.sendTelegramAction(chatId, 'typing');
    
    try {
      // Get some history from a "Telegram" chat session for this user
      const { data: chat } = await supabase
        .from('rsdc_ai_chat')
        .select('*')
        .eq('user_id', linkedUser.user_id)
        .eq('metadata->>type', 'telegram') 
        .order('ultima_vez_usado', { ascending: false })
        .limit(1)
        .single();

      let currentChatId = chat?.id;
      let history: Message[] = chat?.conversacion || [];

      if (!currentChatId) {
        // Create a new Telegram chat session if none exists
        const { data: newChat } = await supabase
          .from('rsdc_ai_chat')
          .insert([{
            user_id: linkedUser.user_id,
            conversacion: [],
            ultima_vez_usado: new Date().toISOString(),
            metadata: { type: 'telegram' }
          }])
          .select()
          .single();
        currentChatId = newChat.id;
      }

      const responseText = await aiService.processMessage(
        linkedUser.user_id,
        text,
        history,
        async (newHistory) => {
          await supabase
            .from('rsdc_ai_chat')
            .update({ 
              conversacion: newHistory,
              ultima_vez_usado: new Date().toISOString()
            })
            .eq('id', currentChatId);
        }
      );

      await this.sendTelegramMessage(chatId, responseText);
    } catch (e) {
      console.error('Error in handleMessage:', e);
      await this.sendTelegramMessage(chatId, "Lo siento, tuve un problema al procesar tu mensaje.");
    }
  },

  async linkAccount(chatId: number, code: string) {
    const { data: user, error } = await supabase
      .from('public_user')
      .select('user_id')
      .eq('telegram_link_code', code)
      .gt('telegram_link_expires', new Date().toISOString())
      .single();

    if (error || !user) {
      return this.sendTelegramMessage(chatId, "El código de vinculación es inválido o ha expirado.");
    }

    // Link
    const { error: linkError } = await supabase
      .from('rsdc_telegram_users')
      .insert([{ telegram_chat_id: chatId, user_id: user.user_id }]);

    if (linkError) {
      return this.sendTelegramMessage(chatId, "Error al vincular: Puede que esta cuenta ya esté vinculada.");
    }

    // Clear code
    await supabase
      .from('public_user')
      .update({ telegram_link_code: null, telegram_link_expires: null })
      .eq('user_id', user.user_id);

    return this.sendTelegramMessage(chatId, "¡Cuenta vinculada con éxito! Ahora puedes usarme desde aquí.");
  },

  async sendTelegramMessage(chatId: number, text: string) {
    await fetch(`${TELEGRAM_API}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'Markdown' })
    });
  },

  async sendTelegramAction(chatId: number, action: string) {
    await fetch(`${TELEGRAM_API}/sendChatAction`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, action })
    });
  },

  async transcribeVoice(fileId: string) {
    // 1. Get file path from Telegram
    const fileRes = await fetch(`${TELEGRAM_API}/getFile?file_id=${fileId}`);
    const fileData = await fileRes.json();
    if (!fileData.ok) throw new Error("Telegram getFile failed");
    
    const filePath = fileData.result.file_path;
    const downloadUrl = `https://api.telegram.org/file/bot${AI_CONFIG.telegramToken}/${filePath}`;
    
    // 2. Download audio file
    const audioRes = await fetch(downloadUrl);
    const audioBuffer = await audioRes.arrayBuffer();
    
    // Convert to Base64 (Browser compatible)
    const uint8 = new Uint8Array(audioBuffer);
    let binary = '';
    for (let i = 0; i < uint8.length; i++) {
      binary += String.fromCharCode(uint8[i]);
    }
    const base64Audio = btoa(binary);

    // 3. Transcribe with OpenRouter (using Gemini 2.0 Flash)
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${AI_CONFIG.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'google/gemini-2.0-flash-001',
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: 'Transcribe este audio a texto en español. Solo devuelve la transcripción literal, sin comentarios ni introducciones.' },
              { 
                type: 'input_audio', 
                input_audio: { 
                  data: base64Audio, 
                  format: 'ogg' 
                } 
              }
            ]
          }
        ]
      })
    });
    
    const data = await res.json();
    if (data.error) throw new Error(data.error.message);
    return data.choices[0].message.content;
  }
};
