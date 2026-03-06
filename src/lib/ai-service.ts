import { supabase } from './supabase';
import { AI_CONFIG } from './AI_APY_KEYS';

export interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface ChatSession {
  id: string;
  user_id: string;
  conversacion: Message[];
  ultima_vez_usado: string;
  created_at: string;
}

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
- Si el usuario te pide actualizar el estado y no tienes el ID, primero LISTA los documentos.

CONSULTA DE OFICIOS:
- Tienes acceso a la tabla "rsdc_oficios" para buscar números de oficio correlativos.
- Si el usuario te pregunta por un oficio específico (ej: "qué dice el oficio 12?"), usa "search_oficios" con el número.
- Si el usuario te pide una lista o preguntar si existe algo (ej: "hay oficios para Salud?"), usa "search_oficios" con un término de búsqueda en la descripción o destinatario.
- Los oficios tienen: numero_oficio, descripcion, anio, destinatario_nombre, hecho_por.

GESTIÓN DE CALENDARIO Y RECORDATORIOS:
- Tienes acceso a la tabla "rsdc_calendar" para crear y listar eventos.
- Si el usuario te pide un recordatorio o agendar algo, usa "create_calendar_event".
- Si el usuario pregunta qué tiene pendiente, usa "list_calendar_events".
- Tipos de recurrencia: "none" (evento único), "daily" (todos los días).
- Formato de fecha para evento único: ISO string (YYYY-MM-DDTHH:MM:SS).
- Formato de hora para recurrente: HH:MM (24h).
- SI EL USUARIO PIDE ALGO RELATIVO (ej: "en 2 minutos", "mañana"), TÚ DEBES CALCULAR LA FECHA/HORA EXACTA USANDO LA "FECHA Y HORA ACTUAL DEL SISTEMA" Y ENVIARLA EN EL CAMPO CORRESPONDIENTE. NO ENVÍES TEXTO RELATIVO.

REGLAS DEL USUARIO:
- Siempre debes revisar y seguir las "Reglas" del usuario que se te provean en el contexto.
- Si el usuario te indica un nuevo protocolo o instrucción permanente, guárdalo o actualízalo inmediatamente en la memoria con título "Reglas".

GUARDADO PROACTIVO DE MEMORIA:
- Tu objetivo es ser una extensión de la memoria del usuario.
- Si el usuario te dice su nombre, sus preferencias, o establece una instrucción para el futuro, DEBES guardarlo usando la herramienta "save_memory".
- No esperes a que el usuario te pida guardar algo; si consideras que es un dato relevante para futuras conversaciones, guárdalo.
- Por ejemplo, si establecen que tu nombre es "Alex", guarda una memoria con título "NombreAsistente" y contenido "Alex".

INSTRUCCIONES DE MEMORIA:
1. Tienes acceso a un "Directorio" de memorias (lista de títulos).
2. Si necesitas GUARDAR información importante (ej: agenda, notas, preferencias), usa la herramienta "save_memory".
3. Si necesitas RECUPERAR información y ves un título relevante en el Directorio, usa la herramienta "read_memory".

FORMATO DE HERRAMIENTAS:
Para usar una herramienta, responde EXCLUSIVAMENTE con un bloque JSON válido como este:
{"tool": "save_memory", "title": "TituloDeLaMemoria", "content": "Contenido a guardar..."}
O
{"tool": "read_memory", "title": "TituloDeLaMemoria"}
O
{"tool": "create_document_direccion", "titulo": "...", "numero_documento": "...", "quien_recibio": "Libni/Sharon"}
O
{"tool": "list_documents_direccion"}
O
{"tool": "update_document_direccion", "id": "...", "estado": "..."}
O
{"tool": "search_oficios", "numero": 12, "anio": 2026}
O
{"tool": "search_oficios", "query": "Salud"}
O
{"tool": "create_calendar_event", "titulo": "Reunión", "descripcion": "...", "fecha": "2026-10-05T14:30:00", "recurrente": false}
O
{"tool": "create_calendar_event", "titulo": "Tomar medicina", "hora": "08:00", "recurrente": true, "patron": "daily"}
O
{"tool": "list_calendar_events"}

Si no necesitas usar herramientas, responde normalmente al usuario.
`;

export const aiService = {
  async getChats() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('No user logged in');

    await this.ensureDirectory(user.id);

    const { data, error } = await supabase
      .from('rsdc_ai_chat')
      .select('*')
      .eq('user_id', user.id)
      .order('ultima_vez_usado', { ascending: false });

    if (error) throw error;
    return data as ChatSession[];
  },

  async createChat() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('No user logged in');

    await this.ensureDirectory(user.id);

    const { data, error } = await supabase
      .from('rsdc_ai_chat')
      .insert([{
        user_id: user.id,
        conversacion: [],
        ultima_vez_usado: new Date().toISOString()
      }])
      .select()
      .single();

    if (error) throw error;
    return data as ChatSession;
  },

  async ensureDirectory(userId: string) {
    // Asegurar Directorio
    const { data: dir } = await supabase
      .from('rsdc_ai_memory')
      .select('*')
      .eq('user_id', userId)
      .eq('titulo', 'Directorio')
      .single();

    if (!dir) {
      await supabase
        .from('rsdc_ai_memory')
        .insert([{
          user_id: userId,
          titulo: 'Directorio',
          data: { titles: [] }
        }]);
    }

    // Asegurar Reglas
    const { data: rules } = await supabase
      .from('rsdc_ai_memory')
      .select('*')
      .eq('user_id', userId)
      .eq('titulo', 'Reglas')
      .single();

    if (!rules) {
      await supabase
        .from('rsdc_ai_memory')
        .insert([{
          user_id: userId,
          titulo: 'Reglas',
          data: { listado: [] }
        }]);
      await this.addToDirectory(userId, 'Reglas');
    }
  },

  async getDirectoryTitles(userId: string): Promise<string[]> {
    const { data } = await supabase
      .from('rsdc_ai_memory')
      .select('data')
      .eq('user_id', userId)
      .eq('titulo', 'Directorio')
      .single();
    
    return data?.data?.titles || [];
  },

  async addToDirectory(userId: string, title: string) {
    const titles = await this.getDirectoryTitles(userId);
    if (!titles.includes(title)) {
      const newTitles = [...titles, title];
      await supabase
        .from('rsdc_ai_memory')
        .update({ data: { titles: newTitles } })
        .eq('user_id', userId)
        .eq('titulo', 'Directorio');
    }
  },

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async saveMemory(userId: string, title: string, content: any) {
    const { data: existing } = await supabase
      .from('rsdc_ai_memory')
      .select('id')
      .eq('user_id', userId)
      .eq('titulo', title)
      .single();

    if (existing) {
      await supabase
        .from('rsdc_ai_memory')
        .update({ data: content })
        .eq('id', existing.id);
    } else {
      await supabase
        .from('rsdc_ai_memory')
        .insert([{
          user_id: userId,
          titulo: title,
          data: content
        }]);
      await this.addToDirectory(userId, title);
    }
    return `Memoria "${title}" guardada exitosamente.`;
  },

  async readMemory(userId: string, title: string) {
    const { data } = await supabase
      .from('rsdc_ai_memory')
      .select('data')
      .eq('user_id', userId)
      .eq('titulo', title)
      .single();
    
    if (!data) return `No se encontró información bajo el título "${title}".`;
    return JSON.stringify(data.data);
  },

  // Herramientas para Documentos en Dirección
  async listDocumentsDireccion(userId: string) {
    const { data, error } = await supabase
      .from('documentos_en_direccion')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    if (!data || data.length === 0) return "No hay documentos registrados en dirección.";
    return `Lista de documentos (USA ESTOS IDs REALES PARA ACTUALIZAR): ${JSON.stringify(data)}`;
  },

  async createDocumentDireccion(userId: string, titulo: string, numero: string, quien: string = 'Libni') {
    const { data, error } = await supabase
      .from('documentos_en_direccion')
      .insert([{
        user_id: userId,
        titulo,
        numero_documento: numero,
        quien_recibio: quien,
        estado: 'Pendiente de Firma',
        fecha_creacion: new Date().toISOString().split('T')[0]
      }])
      .select()
      .single();
    
    if (error) throw error;
    return `Documento "${titulo}" (N° ${numero}) registrado exitosamente. ID REAL (UUID) asignado: ${data.id}.`;
  },

  async updateDocumentDireccion(userId: string, id: string, estado: string) {
    // Validar formato UUID antes de intentar el update
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      return `Error: El ID "${id}" no es un UUID válido. Usa list_documents_direccion para obtener el ID real.`;
    }

    const { data, error } = await supabase
      .from('documentos_en_direccion')
      .update({ estado })
      .eq('id', id)
      .eq('user_id', userId)
      .select();
    
    if (error) throw error;
    if (!data || data.length === 0) {
      return `Error: No se encontró ningún documento con el ID "${id}" para tu usuario.`;
    }
    
    return `Estado del documento actualizado a "${estado}" exitosamente.`;
  },

  async searchOficios(numero?: number, anio?: number, query?: string) {
    let q = supabase.from('rsdc_oficios').select('*');
    
    if (numero) q = q.eq('numero_oficio', numero);
    if (anio) q = q.eq('anio', anio);
    if (query) {
      q = q.or(`descripcion.ilike.%${query}%,destinatario_nombre.ilike.%${query}%`);
    }
    
    const { data, error } = await q.order('created_at', { ascending: false }).limit(20);
    
    if (error) throw error;
    if (!data || data.length === 0) return "No se encontraron oficios con esos criterios.";
    return JSON.stringify(data);
  },

  async createCalendarEvent(userId: string, data: any) {
    const event = {
      user_id: userId,
      titulo: data.titulo,
      descripcion: data.descripcion || '',
      es_recurrente: data.recurrente || false,
      patron_recurrencia: data.patron || 'none',
      fecha_evento: data.recurrente ? null : data.fecha,
      hora_recordatorio: data.recurrente ? data.hora : null,
      estado: 'pendiente'
    };

    const { data: result, error } = await supabase
      .from('rsdc_calendar')
      .insert([event])
      .select()
      .single();

    if (error) throw error;
    return `Evento "${result.titulo}" agendado exitosamente.`;
  },

  async listCalendarEvents(userId: string) {
    const { data, error } = await supabase
      .from('rsdc_calendar')
      .select('*')
      .eq('user_id', userId)
      .eq('estado', 'pendiente')
      .order('created_at', { ascending: false });

    if (error) throw error;
    if (!data || data.length === 0) return "No tienes eventos pendientes.";
    return JSON.stringify(data);
  },

  async callOpenRouter(messages: Message[]) {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${AI_CONFIG.apiKey}`,
        'HTTP-Referer': 'http://localhost:5173',
        'X-Title': 'RSDC System',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: AI_CONFIG.model,
        messages: messages.map(m => ({ 
          role: m.role, 
          content: m.content 
        }))
      })
    });

    const data = await response.json();
    if (data.error) throw new Error(data.error.message || 'Error desconocido de OpenRouter');
    if (!data.choices || data.choices.length === 0) throw new Error('Respuesta vacía de OpenRouter');
    
    return data.choices[0].message;
  },

  async sendMessage(chatId: string, userMessage: string, currentHistory: Message[]) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('No user logged in');

    return await this.processMessage(user.id, userMessage, currentHistory, async (newHistory) => {
      const { error } = await supabase
        .from('rsdc_ai_chat')
        .update({ 
          conversacion: newHistory,
          ultima_vez_usado: new Date().toISOString()
        })
        .eq('id', chatId);
      if (error) throw error;
    });
  },

  // Modular message processing (used by Bot Page and Telegram)
  async processMessage(
    userId: string, 
    userMessage: string, 
    currentHistory: Message[], 
    onHistoryUpdate: (newHistory: Message[]) => Promise<any>
  ) {
    // 1. Prepare Context with Directory and Rules
    const directoryTitles = await this.getDirectoryTitles(userId);
    const rulesData = await this.readMemory(userId, 'Reglas');
    
    // Inject Current Date and Time
    const now = new Date();
    const currentDate = now.toISOString().split('T')[0];
    const currentTime = now.toTimeString().substring(0, 5);
    const currentDateTimeContext = `\nFECHA Y HORA ACTUAL DEL SISTEMA: ${currentDate} ${currentTime}\nIMPORTANTE: Usa esta fecha/hora base para calcular cualquier tiempo relativo (ej: "en 2 minutos", "mañana").`;

    const systemContent = `${SYSTEM_PROMPT_BASE}${currentDateTimeContext}\n\nMEMORIAS DISPONIBLES (DIRECTORIO): [${directoryTitles.join(', ')}]\n\nREGLAS ACTUALES DEL USUARIO: ${rulesData}`;
    
    const messagesToSend: Message[] = [
      { role: 'system', content: systemContent },
      ...currentHistory,
      { role: 'user', content: userMessage }
    ];

    let finalContent = '';
    let newMessages: Message[] = [];

    // 2. Call AI (First Pass)
    try {
      const aiResponse = await this.callOpenRouter(messagesToSend);
      finalContent = aiResponse.content;
      newMessages.push({ role: 'assistant', content: finalContent });

      // 3. Tool Loop (Check if AI wants to use a tool)
      const jsonMatch = finalContent.match(/\{[\s\S]*?"tool"[\s\S]*?\}/);
      if (jsonMatch) {
        try {
          const cleanedJson = jsonMatch[0].replace(/[\u0000-\u001F\u007F-\u009F]/g, ""); // Remove control chars
          const toolCall = JSON.parse(cleanedJson);
          let toolResult = '';

          if (toolCall.tool === 'save_memory') {
            toolResult = await this.saveMemory(userId, toolCall.title, toolCall.content);
          } else if (toolCall.tool === 'read_memory') {
            toolResult = await this.readMemory(userId, toolCall.title);
          } else if (toolCall.tool === 'create_document_direccion') {
            toolResult = await this.createDocumentDireccion(userId, toolCall.titulo, toolCall.numero_documento, toolCall.quien_recibio);
          } else if (toolCall.tool === 'list_documents_direccion') {
            toolResult = await this.listDocumentsDireccion(userId);
          } else if (toolCall.tool === 'update_document_direccion') {
            toolResult = await this.updateDocumentDireccion(userId, toolCall.id, toolCall.estado);
          } else if (toolCall.tool === 'search_oficios') {
            toolResult = await this.searchOficios(toolCall.numero, toolCall.anio, toolCall.query);
          } else if (toolCall.tool === 'create_calendar_event') {
            toolResult = await this.createCalendarEvent(userId, {
              titulo: toolCall.titulo,
              descripcion: toolCall.descripcion,
              recurrente: toolCall.recurrente,
              patron: toolCall.patron,
              fecha: toolCall.fecha,
              hora: toolCall.hora
            });
          } else if (toolCall.tool === 'list_calendar_events') {
            toolResult = await this.listCalendarEvents(userId);
          }

          if (toolResult) {
            const toolMessage: Message = {
              role: 'system',
              content: `Resultado de la herramienta ${toolCall.tool}: ${toolResult}`
            };
            const followUpMessages: Message[] = [
              ...messagesToSend, 
              { role: 'assistant', content: finalContent } as Message, 
              toolMessage
            ];
            const secondResponse = await this.callOpenRouter(followUpMessages);
            finalContent = secondResponse.content;
            newMessages = [{ role: 'assistant', content: finalContent }];
          }
        } catch (e) {
          console.warn('Tool execution failed:', e);
        }
      }
    } catch (error) {
      console.error('AI Service Error:', error);
      finalContent = "Lo siento, hubo un error al procesar tu solicitud con la IA.";
      newMessages.push({ role: 'assistant', content: finalContent });
    }

    // 4. Update History
    const updatedHistory: Message[] = [
      ...currentHistory, 
      { role: 'user', content: userMessage } as Message,
      ...newMessages
    ];
    
    await onHistoryUpdate(updatedHistory);
    return finalContent;
  }
};
