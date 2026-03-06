import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const TELEGRAM_TOKEN = Deno.env.get("TELEGRAM_TOKEN")
const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY")
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")

const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!)

const SYSTEM_PROMPT_BASE = `
Eres una IA asistente avanzada integrada en el sistema RSDC.
Tienes acceso a un sistema de Memoria Persistente para recordar información importante sobre el usuario y sus protocolos.

GESTIÓN DE DOCUMENTOS EN DIRECCIÓN:
- Tienes acceso a la tabla "documentos_en_direccion".
- Puedes LISTAR, CREAR y ACTUALIZAR documentos.
- Estados válidos: "Pendiente de Firma", "En Revision", "Aprovado".
- Receptores válidos: "Libni", "Sharon". Por defecto "Libni".
- IMPORTANTE: Para ACTUALIZAR un documento (ej: aprobarlo), primero DEBES usar "list_documents_direccion" para obtener su ID real (UUID). NUNCA adivines el ID.
- Si el usuario te pide crear un documento, usa "create_document_direccion".
- Si el usuario te pide ver qué hay en dirección, usa "list_documents_direccion".
- Si el usuario te pide aprobar un documento, busca su ID en la lista y usa "update_document_direccion".

CONSULTA DE OFICIOS:
- Tienes acceso a la tabla "rsdc_oficios" para buscar números de oficio correlativos.
- Si el usuario te pregunta por un oficio específico, usa "search_oficios" con el número.
- Si el usuario te pide una lista o preguntar si existe algo, usa "search_oficios" con un término de búsqueda.

REGLAS DEL USUARIO:
- Siempre debes revisar y seguir las "Reglas" del usuario.
- Si el usuario te indica un nuevo protocolo, guárdalo en la memoria con título "Reglas".

GUARDADO PROACTIVO DE MEMORIA:
- Si el usuario te dice su nombre, preferencias, o establece una instrucción, DEBES guardarlo usando "save_memory".
- Por ejemplo, si establecen que tu nombre es "Alex", guarda una memoria con título "NombreAsistente" y contenido "Alex".

GESTIÓN DE RECORDATORIOS:
- Tipos de recurrencia: "none" (evento único), "daily" (todos los días).
- Formato de fecha para evento único: ISO string (YYYY-MM-DDTHH:MM:SS).
- Formato de hora para recurrente: HH:MM (24h).
- SI EL USUARIO PIDE ALGO RELATIVO (ej: "en 2 minutos", "mañana"), TÚ DEBES CALCULAR LA FECHA/HORA EXACTA USANDO LA "FECHA Y HORA ACTUAL DEL SISTEMA" Y ENVIARLA EN EL CAMPO CORRESPONDIENTE. NO ENVÍES TEXTO RELATIVO.

FORMATO DE HERRAMIENTAS (JSON):
{"tool": "save_memory", "title": "...", "content": "..."}
{"tool": "read_memory", "title": "..."}
{"tool": "create_document_direccion", "titulo": "...", "numero_documento": "...", "quien_recibio": "Libni/Sharon"}
{"tool": "list_documents_direccion"}
{"tool": "update_document_direccion", "id": "...", "estado": "..."}
{"tool": "search_oficios", "numero": 12, "anio": 2026}
{"tool": "search_oficios", "query": "Salud"}
`;

serve(async (req) => {
  try {
    const { message } = await req.json()
    if (!message) return new Response("OK")

    const chatId = message.chat.id
    let text = message.text

    // Handle Voice Messages
    if (message.voice) {
      await sendAction(chatId, 'typing');
      await sendTelegram(chatId, "_Transcribiendo audio..._");
      try {
        text = await transcribeVoice(message.voice.file_id);
      } catch (e) {
        console.error("Transcription error:", e);
        await sendTelegram(chatId, "Lo siento, no pude transcribir el audio.");
        return new Response("OK");
      }
    }

    if (!text) return new Response("OK")

    // 1. Get Linked User
    const { data: link } = await supabase
      .from('rsdc_telegram_users')
      .select('user_id')
      .eq('telegram_chat_id', chatId)
      .single()

    if (!link) {
      if (text.startsWith('/start')) {
        const code = text.split(' ')[1]
        if (code) {
          const { data: user } = await supabase
            .from('public_user')
            .select('user_id')
            .eq('telegram_link_code', code)
            .gt('telegram_link_expires', new Date().toISOString())
            .single()

          if (user) {
            await supabase.from('rsdc_telegram_users').insert([{ telegram_chat_id: chatId, user_id: user.user_id }])
            await supabase.from('public_user').update({ telegram_link_code: null, telegram_link_expires: null }).eq('user_id', user.user_id)
            await sendTelegram(chatId, "¡Cuenta vinculada con éxito! Soy Alex, tu asistente virtual.")
            return new Response("OK")
          }
        }
      }
      await sendTelegram(chatId, "Hola! Soy Alex. Para comenzar, vincula tu cuenta en el sistema RSDC (Página del Bot) usando el comando /start [codigo].")
      return new Response("OK")
    }

    const userId = link.user_id;

    // 2. Get AI Context
    const { data: chat } = await supabase
      .from('rsdc_ai_chat')
      .select('*')
      .eq('user_id', userId)
      .eq('metadata->>type', 'telegram')
      .order('ultima_vez_usado', { ascending: false })
      .limit(1)
      .single();

    let history = chat?.conversacion || [];
    let currentChatId = chat?.id;

    if (!currentChatId) {
      const { data: newChat } = await supabase
        .from('rsdc_ai_chat')
        .insert([{ user_id: userId, conversacion: [], metadata: { type: 'telegram' } }])
        .select().single();
      currentChatId = newChat.id;
    }

    // Get Directory and Rules
    const { data: dir } = await supabase.from('rsdc_ai_memory').select('data').eq('user_id', userId).eq('titulo', 'Directorio').single();
    const { data: rules } = await supabase.from('rsdc_ai_memory').select('data').eq('user_id', userId).eq('titulo', 'Reglas').single();
    
    // Inject Current Date and Time
    const now = new Date();
    const currentDate = now.toISOString().split('T')[0];
    const currentTime = now.toTimeString().substring(0, 5);
    const currentDateTimeContext = `\nFECHA Y HORA ACTUAL DEL SISTEMA: ${currentDate} ${currentTime}\nIMPORTANTE: Usa esta fecha/hora base para calcular cualquier tiempo relativo (ej: "en 2 minutos", "mañana").`;

    const directoryTitles = dir?.data?.titles || [];
    const rulesContent = rules?.data ? JSON.stringify(rules.data) : "Sin reglas definidas.";

    const systemPrompt = `${SYSTEM_PROMPT_BASE}${currentDateTimeContext}\n\nDIRECTORIO: [${directoryTitles.join(', ')}]\n\nREGLAS: ${rulesContent}`;

    // 3. Call OpenRouter
    await sendAction(chatId, 'typing');
    
    const aiResponse = await callAI([
      { role: 'system', content: systemPrompt },
      ...history,
      { role: 'user', content: text }
    ]);

    let finalContent = aiResponse.content;

    // 4. Tool Execution (One pass)
    const jsonMatch = finalContent.match(/\{[\s\S]*?"tool"[\s\S]*?\}/);
    if (jsonMatch) {
      try {
        const toolCall = JSON.parse(jsonMatch[0].replace(/[\u0000-\u001F\u007F-\u009F]/g, ""));
        let toolResult = "";

        if (toolCall.tool === 'save_memory') {
          const { data: existing } = await supabase.from('rsdc_ai_memory').select('id').eq('user_id', userId).eq('titulo', toolCall.title).single();
          if (existing) {
            await supabase.from('rsdc_ai_memory').update({ data: toolCall.content }).eq('id', existing.id);
          } else {
            await supabase.from('rsdc_ai_memory').insert([{ user_id: userId, titulo: toolCall.title, data: toolCall.content }]);
            const newTitles = [...directoryTitles, toolCall.title];
            await supabase.from('rsdc_ai_memory').update({ data: { titles: newTitles } }).eq('user_id', userId).eq('titulo', 'Directorio');
          }
          toolResult = `Memoria "${toolCall.title}" guardada.`;
        } else if (toolCall.tool === 'read_memory') {
          const { data: mem } = await supabase.from('rsdc_ai_memory').select('data').eq('user_id', userId).eq('titulo', toolCall.title).single();
          toolResult = mem ? JSON.stringify(mem.data) : "No encontrada.";
        } else if (toolCall.tool === 'list_documents_direccion') {
          const { data } = await supabase.from('documentos_en_direccion').select('*').eq('user_id', userId).limit(10);
          toolResult = data ? JSON.stringify(data) : "Sin documentos.";
        } else if (toolCall.tool === 'update_document_direccion') {
          await supabase.from('documentos_en_direccion').update({ estado: toolCall.estado }).eq('id', toolCall.id).eq('user_id', userId);
          toolResult = "Estado actualizado.";
        } else if (toolCall.tool === 'search_oficios') {
            let q = supabase.from('rsdc_oficios').select('*');
            if (toolCall.numero) q = q.eq('numero_oficio', toolCall.numero);
            if (toolCall.query) q = q.or(`descripcion.ilike.%${toolCall.query}%,destinatario_nombre.ilike.%${toolCall.query}%`);
            const { data } = await q.limit(5);
            toolResult = data ? JSON.stringify(data) : "No encontrado.";
          } else if (toolCall.tool === 'create_calendar_event') {
            const event = {
              user_id: userId,
              titulo: toolCall.titulo,
              descripcion: toolCall.descripcion || '',
              es_recurrente: toolCall.recurrente || false,
              patron_recurrencia: toolCall.patron || 'none',
              fecha_evento: toolCall.recurrente ? null : toolCall.fecha,
              hora_recordatorio: toolCall.recurrente ? toolCall.hora : null,
              estado: 'pendiente'
            };
            await supabase.from('rsdc_calendar').insert([event]);
            toolResult = `Evento "${toolCall.titulo}" agendado.`;
          } else if (toolCall.tool === 'list_calendar_events') {
            const { data } = await supabase.from('rsdc_calendar').select('*').eq('user_id', userId).eq('estado', 'pendiente').limit(10);
            toolResult = data ? JSON.stringify(data) : "Sin eventos.";
          }

          if (toolResult) {
          const secondResponse = await callAI([
            { role: 'system', content: systemPrompt },
            ...history,
            { role: 'user', content: text },
            { role: 'assistant', content: finalContent },
            { role: 'system', content: `Resultado: ${toolResult}` }
          ]);
          finalContent = secondResponse.content;
        }
      } catch (e) {
        console.error("Tool error:", e);
      }
    }

    // 5. Update History and Send
    const newHistory = [...history, { role: 'user', content: text }, { role: 'assistant', content: finalContent }];
    await supabase.from('rsdc_ai_chat').update({ conversacion: newHistory, ultima_vez_usado: new Date().toISOString() }).eq('id', currentChatId);

    await sendTelegram(chatId, finalContent);

    return new Response("OK")
  } catch (e) {
    console.error(e)
    return new Response("Error", { status: 500 })
  }
})

async function transcribeVoice(fileId: string) {
  // 1. Get file path from Telegram
  const fileRes = await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/getFile?file_id=${fileId}`);
  const fileData = await fileRes.json();
  if (!fileData.ok) throw new Error("Telegram getFile failed");
  
  const filePath = fileData.result.file_path;
  const downloadUrl = `https://api.telegram.org/file/bot${TELEGRAM_TOKEN}/${filePath}`;
  
  // 2. Download audio file
  const audioRes = await fetch(downloadUrl);
  const audioBuffer = await audioRes.arrayBuffer();
  
  // Convert to Base64 in a way compatible with Deno/Edge Functions
  const uint8 = new Uint8Array(audioBuffer);
  let binary = '';
  for (let i = 0; i < uint8.length; i++) {
    binary += String.fromCharCode(uint8[i]);
  }
  const base64Audio = btoa(binary);

  // 3. Transcribe with OpenRouter (using Gemini 2.0 Flash)
  // Gemini supports .ogg natively (Telegram uses .oga which is ogg)
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
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

async function callAI(messages: any[]) {
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'arcee-ai/trinity-large-preview:free',
      messages
    })
  });
  const data = await res.json();
  return data.choices[0].message;
}

async function sendTelegram(chatId: number, text: string) {
  await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'Markdown' })
  })
}

async function sendAction(chatId: number, action: string) {
  await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendChatAction`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, action })
  })
}
