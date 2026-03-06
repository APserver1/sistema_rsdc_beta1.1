import React, { useState, useEffect, useRef } from 'react';
import { Send, Bot as BotIcon, MessageSquare, Plus, Loader2, Send as TelegramIcon, Mic, Square, Menu, X } from 'lucide-react';
import { aiService } from '../lib/ai-service';
import { telegramService } from '../lib/ai-telegram-service';
import { supabase } from '../lib/supabase';
import type { ChatSession, Message } from '../lib/ai-service';
import { motion, AnimatePresence } from 'framer-motion';

const BotPage: React.FC = () => {
  const [chats, setChats] = useState<ChatSession[]>([]);
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [showTelegramModal, setShowTelegramModal] = useState(false);
  const [showMobileSidebar, setShowMobileSidebar] = useState(false);
  const [linkCode, setLinkCode] = useState<string | null>(null);
  const [isLinked, setIsLinked] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recognition, setRecognition] = useState<any>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const recordingTimeoutRef = useRef<any>(null);

  useEffect(() => {
    // Initialize Speech Recognition
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      const rec = new SpeechRecognition();
      rec.continuous = true;
      rec.interimResults = true;
      rec.lang = 'es-ES'; // Spanish

      rec.onresult = (event: any) => {
        let transcript = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          transcript += event.results[i][0].transcript;
        }
        setInput(transcript);
      };

      rec.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error);
        setIsRecording(false);
      };

      rec.onend = () => {
        setIsRecording(false);
      };

      setRecognition(rec);
    }
  }, []);

  useEffect(() => {
    console.log('Bot page mounted');
    loadChats();
    checkTelegramStatus();
    
    // Start Telegram polling (Dev/Testing only - in production use webhooks)
    if (import.meta.env.DEV) {
      telegramService.startPolling();
    }
    return () => {
      if (import.meta.env.DEV) {
        telegramService.stopPolling();
      }
    };
  }, []);

  const checkTelegramStatus = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from('rsdc_telegram_users')
      .select('*')
      .eq('user_id', user.id)
      .single();
    
    setIsLinked(!!data);
  };

  const generateLinkCode = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expires = new Date(Date.now() + 10 * 60000).toISOString(); // 10 min

    await supabase
      .from('public_user')
      .update({ 
        telegram_link_code: code,
        telegram_link_expires: expires 
      })
      .eq('user_id', user.id);

    setLinkCode(code);
  };

  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;
    container.scrollTo({
      top: container.scrollHeight,
      behavior: 'smooth'
    });
  }, [messages, loading]);

  const loadChats = async () => {
    try {
      console.log('Loading chats...');
      const data = await aiService.getChats();
      console.log('Chats loaded:', data);
      setChats(data);
      if (data.length > 0 && !currentChatId) {
        selectChat(data[0]);
      }
    } catch (e) {
      console.error('Error loading chats:', e);
    }
  };

  const createNewChat = async () => {
    try {
      const newChat = await aiService.createChat();
      setChats([newChat, ...chats]);
      selectChat(newChat);
    } catch (e) {
      console.error(e);
    }
  };

  const selectChat = (chat: ChatSession) => {
    setCurrentChatId(chat.id);
    setMessages(chat.conversacion || []);
  };

  const handleSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!input.trim() || loading) return;

    // If no chat selected, create one
    let chatId = currentChatId;
    if (!chatId) {
      try {
        const newChat = await aiService.createChat();
        setChats([newChat, ...chats]);
        chatId = newChat.id;
        setCurrentChatId(chatId);
      } catch (e) {
        console.error(e);
        return;
      }
    }

    const userMsg = input.trim();
    setInput('');
    const newMessages = [...messages, { role: 'user', content: userMsg } as Message];
    setMessages(newMessages);
    setLoading(true);

    try {
      const aiResponse = await aiService.sendMessage(chatId!, userMsg, messages);
      setMessages(prev => [...prev, { role: 'assistant', content: aiResponse }]);
      loadChats(); // Refresh list order
    } catch (e) {
      console.error(e);
      setMessages(prev => [...prev, { role: 'assistant', content: 'Error al conectar con la IA.' }]);
    } finally {
      setLoading(false);
    }
  };

  const startRecording = () => {
    if (recognition && !isRecording && !loading) {
      try {
        setInput('');
        recognition.start();
        setIsRecording(true);
      } catch (e) {
        console.error('Error starting recognition:', e);
      }
    }
  };

  const stopRecording = () => {
    if (recognition && isRecording) {
      recognition.stop();
      setIsRecording(false);
      // Wait a bit for the last transcript if needed
      setTimeout(() => {
        handleSend();
      }, 500);
    }
  };

  const handleMouseDown = () => {
    if (!input.trim()) {
      recordingTimeoutRef.current = setTimeout(() => {
        startRecording();
      }, 300); // Start recording after 300ms hold
    }
  };

  const handleMouseUp = () => {
    if (recordingTimeoutRef.current) {
      clearTimeout(recordingTimeoutRef.current);
      recordingTimeoutRef.current = null;
    }
    if (isRecording) {
      stopRecording();
    }
  };

  return (
    <div className="h-full min-h-0 flex flex-col md:flex-row gap-6 overflow-hidden relative">
      {/* Mobile Sidebar Toggle */}
      <button
        onClick={() => setShowMobileSidebar(true)}
        className="md:hidden fixed bottom-24 right-6 z-40 w-12 h-12 bg-primary text-black rounded-full shadow-neon-cyan flex items-center justify-center hover:scale-110 transition-transform active:scale-95"
      >
        <MessageSquare size={24} />
      </button>

      {/* Mobile Sidebar (Drawer) */}
      <AnimatePresence>
        {showMobileSidebar && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowMobileSidebar(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] md:hidden"
            />
            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed top-0 left-0 h-full w-[85%] max-w-sm bg-[#0a0f1a] z-[110] border-r border-white/10 p-6 flex flex-col gap-6 md:hidden shadow-2xl"
            >
              <div className="flex items-center justify-between border-b border-white/5 pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center text-primary">
                    <BotIcon size={18} />
                  </div>
                  <span className="font-bold text-lg">Conversaciones</span>
                </div>
                <button 
                  onClick={() => setShowMobileSidebar(false)}
                  className="p-2 hover:bg-white/5 rounded-full transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              <button
                onClick={() => {
                  createNewChat();
                  setShowMobileSidebar(false);
                }}
                className="w-full py-4 px-6 bg-gradient-to-r from-primary/20 to-secondary/20 border border-white/10 rounded-2xl flex items-center justify-center gap-3 font-bold hover:from-primary/30 hover:to-secondary/30 transition-all group shrink-0"
              >
                <Plus className="group-hover:rotate-90 transition-transform" /> Nueva Conversación
              </button>

              <button
                onClick={() => {
                  setShowTelegramModal(true);
                  if (!isLinked) generateLinkCode();
                  setShowMobileSidebar(false);
                }}
                className={`w-full py-3 px-6 border border-white/10 rounded-2xl flex items-center justify-center gap-3 font-medium transition-all shrink-0 ${
                  isLinked ? 'bg-green-500/10 text-green-400' : 'bg-white/5 hover:bg-white/10'
                }`}
              >
                <TelegramIcon size={18} /> {isLinked ? 'Telegram Vinculado' : 'Vincular Telegram'}
              </button>

              <div className="flex-1 overflow-hidden flex flex-col bg-white/5 rounded-2xl border border-white/10">
                <div className="p-4 border-b border-white/5">
                  <h3 className="text-xs font-bold text-white/40 uppercase tracking-widest">Historial</h3>
                </div>
                <div className="flex-1 overflow-y-auto p-2 space-y-1">
                  {chats.map((chat) => (
                    <button
                      key={chat.id}
                      onClick={() => {
                        selectChat(chat);
                        setShowMobileSidebar(false);
                      }}
                      className={`w-full p-4 rounded-xl text-left flex items-center gap-3 transition-colors ${
                        currentChatId === chat.id ? 'bg-white/10 text-white' : 'hover:bg-white/5 text-white/60'
                      }`}
                    >
                      <MessageSquare size={18} />
                      <div className="flex-1 truncate text-sm font-medium">
                        {chat.conversacion && chat.conversacion.length > 0 
                          ? chat.conversacion[chat.conversacion.length - 1].content.substring(0, 40) + '...'
                          : 'Nueva Conversación'}
                      </div>
                    </button>
                  ))}
                  {chats.length === 0 && (
                    <div className="p-8 text-center text-white/20 text-sm italic">
                      No hay conversaciones
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Desktop Sidebar */}
      <div className="hidden md:flex w-80 flex-col gap-4 shrink-0 h-[calc(100vh-140px)] min-h-0">
        <button
          onClick={createNewChat}
          className="w-full py-4 px-6 bg-gradient-to-r from-primary/20 to-secondary/20 border border-white/10 rounded-2xl flex items-center justify-center gap-3 font-bold hover:from-primary/30 hover:to-secondary/30 transition-all group shrink-0"
        >
          <Plus className="group-hover:rotate-90 transition-transform" /> Nueva Conversación
        </button>

        <button
          onClick={() => {
            setShowTelegramModal(true);
            if (!isLinked) generateLinkCode();
          }}
          className={`w-full py-3 px-6 border border-white/10 rounded-2xl flex items-center justify-center gap-3 font-medium transition-all shrink-0 ${
            isLinked ? 'bg-green-500/10 text-green-400' : 'bg-white/5 hover:bg-white/10'
          }`}
        >
          <TelegramIcon size={18} /> {isLinked ? 'Telegram Vinculado' : 'Vincular Telegram'}
        </button>

        <div className="flex-1 glass-card overflow-hidden flex flex-col">
          <div className="p-4 border-b border-white/5">
            <h3 className="text-xs font-bold text-white/40 uppercase tracking-widest">Historial</h3>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {chats.map((chat) => (
              <button
                key={chat.id}
                onClick={() => selectChat(chat)}
                className={`w-full p-3 rounded-xl text-left flex items-center gap-3 transition-colors ${
                  currentChatId === chat.id ? 'bg-white/10 text-white' : 'hover:bg-white/5 text-white/60'
                }`}
              >
                <MessageSquare size={18} />
                <div className="flex-1 truncate text-sm">
                  {chat.conversacion && chat.conversacion.length > 0 
                    ? chat.conversacion[chat.conversacion.length - 1].content.substring(0, 30) + '...'
                    : 'Nueva Conversación'}
                </div>
              </button>
            ))}
            {chats.length === 0 && (
              <div className="p-8 text-center text-white/20 text-sm">
                No hay conversaciones
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 glass-card flex flex-col overflow-hidden relative h-[calc(100vh-140px)] min-h-0">
        {!currentChatId ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-8 opacity-50">
            <BotIcon size={64} className="mb-4 text-primary" />
            <h2 className="text-2xl font-bold">Asistente IA RSDC</h2>
            <p className="max-w-md mt-2">Selecciona una conversación o crea una nueva para comenzar.</p>
            <button
              onClick={() => setShowMobileSidebar(true)}
              className="md:hidden mt-6 px-6 py-3 bg-primary/20 border border-primary/30 rounded-xl text-primary font-bold flex items-center gap-2"
            >
              <MessageSquare size={18} /> Ver Conversaciones
            </button>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="p-4 border-b border-white/5 flex items-center justify-between bg-black/20 shrink-0">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setShowMobileSidebar(true)}
                  className="md:hidden p-2 -ml-2 hover:bg-white/5 rounded-lg transition-colors text-white/60"
                >
                  <Menu size={20} />
                </button>
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center shadow-neon-cyan shrink-0">
                  <BotIcon className="text-white" size={20} />
                </div>
                <div>
                  <h3 className="font-bold text-sm md:text-base truncate">Asistente Virtual</h3>
                  <p className="text-[10px] md:text-xs text-green-400 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" /> En línea
                  </p>
                </div>
              </div>
              <div className="hidden sm:flex items-center gap-2 text-[10px] text-white/40 font-bold uppercase tracking-tighter">
                <span className="w-2 h-2 rounded-full bg-primary/40" />
                Sincronizado
              </div>
            </div>

            {/* Messages */}
            <div ref={messagesContainerRef} className="flex-1 overflow-y-auto p-6 space-y-6">
              {messages.map((msg, idx) => (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex gap-4 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
                >
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                    msg.role === 'user' ? 'bg-white/10' : 'bg-primary/20 text-primary'
                  }`}>
                    {msg.role === 'user' ? <div className="w-4 h-4 bg-white rounded-full" /> : <BotIcon size={16} />}
                  </div>
                  <div className={`max-w-[80%] p-4 rounded-2xl ${
                    msg.role === 'user' 
                      ? 'bg-white text-black rounded-tr-none' 
                      : 'bg-white/5 border border-white/10 rounded-tl-none shadow-xl'
                  }`}>
                    <p className="whitespace-pre-wrap text-sm leading-relaxed">{msg.content}</p>
                  </div>
                </motion.div>
              ))}
              {loading && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex gap-4"
                >
                  <div className="w-8 h-8 rounded-full bg-primary/20 text-primary flex items-center justify-center shrink-0">
                    <BotIcon size={16} />
                  </div>
                  <div className="bg-white/5 border border-white/10 p-4 rounded-2xl rounded-tl-none flex items-center gap-2">
                    <span className="w-2 h-2 bg-white/40 rounded-full animate-bounce" />
                    <span className="w-2 h-2 bg-white/40 rounded-full animate-bounce delay-100" />
                    <span className="w-2 h-2 bg-white/40 rounded-full animate-bounce delay-200" />
                  </div>
                </motion.div>
              )}
            </div>

            {/* Input */}
            <div className="p-4 bg-black/40 border-t border-white/5 shrink-0">
              <form onSubmit={handleSend} className="relative max-w-4xl mx-auto">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder={isRecording ? "Escuchando..." : "Escribe tu mensaje..."}
                  className={`w-full bg-white/5 border ${isRecording ? 'border-primary animate-pulse shadow-[0_0_15px_rgba(34,211,238,0.2)]' : 'border-white/10'} rounded-xl py-4 pl-6 pr-14 focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all placeholder:text-white/20`}
                  disabled={loading}
                />
                <button
                  type="submit"
                  disabled={loading}
                  onMouseDown={handleMouseDown}
                  onMouseUp={handleMouseUp}
                  onMouseLeave={handleMouseUp}
                  onTouchStart={handleMouseDown}
                  onTouchEnd={handleMouseUp}
                  className={`absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg ${
                    isRecording 
                      ? 'bg-red-500 text-white animate-pulse scale-110' 
                      : input.trim() 
                        ? 'bg-primary text-black hover:bg-primary/90' 
                        : 'bg-white/10 text-white/40 hover:bg-white/20'
                  }`}
                >
                  {loading ? (
                    <Loader2 size={20} className="animate-spin" />
                  ) : isRecording ? (
                    <Square size={20} />
                  ) : input.trim() || !recognition ? (
                    <Send size={20} />
                  ) : (
                    <Mic size={20} />
                  )}
                </button>
              </form>
              <div className="flex justify-center mt-2 h-4">
                {isRecording ? (
                  <p className="text-[10px] text-primary font-bold uppercase tracking-widest animate-pulse">
                    Grabando... Suelta para enviar
                  </p>
                ) : !input.trim() && recognition && (
                  <p className="text-[10px] text-white/20 uppercase tracking-widest">
                    Mantén presionado para dictar
                  </p>
                )}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Telegram Linking Modal */}
      <AnimatePresence>
        {showTelegramModal && (
          <div className="fixed inset-0 z-[500] flex items-center justify-center p-6">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => setShowTelegramModal(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-md bg-[#0a0f1a] border border-white/10 rounded-3xl p-8 shadow-2xl overflow-hidden"
            >
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary to-secondary" />
              
              <div className="flex flex-col items-center text-center gap-6">
                <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
                  <TelegramIcon size={32} />
                </div>
                
                {isLinked ? (
                  <>
                    <h3 className="text-2xl font-bold">¡Telegram Vinculado!</h3>
                    <p className="text-white/60">Tu cuenta ya está conectada con el bot de Telegram. Puedes chatear con Alex desde cualquier lugar.</p>
                    <button
                      onClick={async () => {
                        const { data: { user } } = await supabase.auth.getUser();
                        if (user) {
                          await supabase.from('rsdc_telegram_users').delete().eq('user_id', user.id);
                          setIsLinked(false);
                          generateLinkCode();
                        }
                      }}
                      className="w-full py-4 bg-red-500/10 text-red-400 rounded-2xl font-bold hover:bg-red-500/20 transition-all"
                    >
                      Desvincular Cuenta
                    </button>
                  </>
                ) : (
                  <>
                    <h3 className="text-2xl font-bold">Vincular Telegram</h3>
                    <div className="space-y-4 text-left w-full">
                      <p className="text-sm text-white/60">Sigue estos pasos para conectar tu cuenta:</p>
                      <ol className="text-sm text-white/80 space-y-3 list-decimal pl-4">
                        <li>Abre Telegram y busca a <span className="text-primary font-bold">@alexrsdc_bot</span></li>
                        <li>Envía el comando: <code className="bg-white/5 px-2 py-1 rounded text-primary">/start {linkCode}</code></li>
                        <li>¡Listo! Alex te confirmará la vinculación.</li>
                      </ol>
                    </div>

                    <div className="w-full p-6 bg-white/5 rounded-2xl border border-white/10 flex flex-col items-center gap-2">
                      <span className="text-xs font-bold text-white/40 uppercase tracking-widest">Tu código de vinculación</span>
                      <span className="text-4xl font-mono font-bold text-primary tracking-wider">{linkCode}</span>
                      <span className="text-[10px] text-white/30 uppercase mt-2">Expira en 10 minutos</span>
                    </div>

                    <button
                      onClick={generateLinkCode}
                      className="text-sm text-white/40 hover:text-white transition-colors"
                    >
                      Generar nuevo código
                    </button>
                  </>
                )}

                <button
                  onClick={() => setShowTelegramModal(false)}
                  className="w-full py-4 bg-white/5 text-white/60 rounded-2xl font-bold hover:bg-white/10 hover:text-white transition-all"
                >
                  Cerrar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default BotPage;
