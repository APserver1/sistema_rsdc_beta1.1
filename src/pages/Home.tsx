import React from 'react';
import { motion } from 'framer-motion';
import { FileText, ClipboardList, Car, ArrowRight, Bot as BotIcon } from 'lucide-react';
import { Link } from 'react-router-dom';

const Home: React.FC = () => {
  const stats = [
    { label: 'Oficios Generados', value: '124', icon: <FileText className="text-primary" /> },
    { label: 'Documentos Pendientes', value: '12', icon: <ClipboardList className="text-secondary" /> },
    { label: 'Vehículos en Ruta', value: '5', icon: <Car className="text-green-400" /> },
  ];

  const tools = [
    {
      title: 'Números de Oficio',
      description: 'Gestión y control correlativo de la correspondencia externa de la región.',
      icon: <FileText size={32} />,
      link: '/oficios',
      color: 'from-blue-500/20 to-cyan-500/20',
      borderColor: 'border-cyan-500/30'
    },
    {
      title: 'Documentos en Dirección',
      description: 'Seguimiento en tiempo real de los expedientes y procesos administrativos.',
      icon: <ClipboardList size={32} />,
      link: '/direccion',
      color: 'from-purple-500/20 to-pink-500/20',
      borderColor: 'border-purple-500/30'
    },
    {
      title: 'Registro de Vehículos',
      description: 'Control de pases de salida, kilometraje y asignación de unidades.',
      icon: <Car size={32} />,
      link: '/vehiculos',
      color: 'from-green-500/20 to-emerald-500/20',
      borderColor: 'border-emerald-500/30'
    },
    {
      title: 'Asistente IA',
      description: 'IA de asistencia avanzada con memoria persistente para tu trabajo.',
      icon: <BotIcon size={32} />,
      link: '/bot',
      color: 'from-primary/20 to-secondary/20',
      borderColor: 'border-primary/30'
    }
  ];

  return (
    <div className="space-y-12">
      {/* Hero Section */}
      <section className="relative">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-3xl"
        >
          <h2 className="text-5xl font-extrabold tracking-tight mb-4">
            Sistema de Gestión <span className="text-primary">Inteligente</span>
          </h2>
          <p className="text-xl text-white/60 leading-relaxed">
            Optimización y control de procesos administrativos para la Región Sanitaria Departamental de Cortés. 
            Herramientas digitales diseñadas para la eficiencia institucional.
          </p>
        </motion.div>
      </section>

      {/* Stats Grid */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {stats.map((stat, index) => (
          <motion.div
            key={index}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: index * 0.1 }}
            className="glass-card p-6 flex items-center gap-4"
          >
            <div className="p-3 bg-white/5 rounded-xl">
              {stat.icon}
            </div>
            <div>
              <p className="text-sm text-white/40 font-medium uppercase tracking-wider">{stat.label}</p>
              <p className="text-3xl font-bold">{stat.value}</p>
            </div>
          </motion.div>
        ))}
      </section>

      {/* Tools Section */}
      <section className="space-y-6">
        <h3 className="text-2xl font-bold">Herramientas Principales</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {tools.map((tool, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 + index * 0.1 }}
              whileHover={{ y: -5 }}
              className={`group glass-card p-8 border-t-4 ${tool.borderColor} bg-gradient-to-b ${tool.color} flex flex-col h-full`}
            >
              <div className="mb-6 p-4 bg-white/5 rounded-2xl w-fit group-hover:bg-white/10 transition-colors">
                {tool.icon}
              </div>
              <h4 className="text-xl font-bold mb-3">{tool.title}</h4>
              <p className="text-white/50 mb-8 flex-1">{tool.description}</p>
              <Link 
                to={tool.link}
                className="flex items-center gap-2 text-primary font-bold group-hover:translate-x-2 transition-transform"
              >
                Acceder <ArrowRight size={18} />
              </Link>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Footer Image Placeholder */}
      <section className="relative h-[400px] rounded-3xl overflow-hidden glass-card">
        <div className="absolute inset-0 bg-gradient-to-t from-[#05070a] via-transparent to-transparent z-10" />
        <img 
          src="https://images.unsplash.com/photo-1517048676732-d65bc937f952?auto=format&fit=crop&q=80&w=2070" 
          alt="Modern Office" 
          className="w-full h-full object-cover opacity-50 grayscale hover:grayscale-0 transition-all duration-700"
        />
        <div className="absolute bottom-12 left-12 z-20">
          <p className="text-sm font-bold text-primary mb-2 tracking-[0.2em] uppercase">Misión Institucional</p>
          <h4 className="text-3xl font-bold max-w-lg">Garantizar la salud y el bienestar de la población de Cortés.</h4>
        </div>
      </section>
    </div>
  );
};

export default Home;
