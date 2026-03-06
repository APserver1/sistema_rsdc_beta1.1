import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import DashboardLayout from './layouts/DashboardLayout';
import ProtectedRoute from './components/ProtectedRoute';
import Home from './pages/Home';
import Oficios from './pages/Oficios';
import Direccion from './pages/Direccion';
import Vehiculos from './pages/Vehiculos';
import Ajustes from './pages/Ajustes';
import Terminos from './pages/Terminos';
import Login from './pages/Login';
import Registro from './pages/Registro';
import Editor from './pages/Editor';
import BotPage from './pages/Bot';
import CalendarPage from './pages/Calendar';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/registro" element={<Registro />} />
        
        <Route element={<ProtectedRoute />}>
          <Route element={<DashboardLayout />}>
            <Route path="/" element={<Home />} />
            <Route path="/oficios" element={<Oficios />} />
            <Route path="/direccion" element={<Direccion />} />
            <Route path="/calendar" element={<CalendarPage />} />
            <Route path="/vehiculos" element={<Vehiculos />} />
            <Route path="/bot" element={<BotPage />} />
            <Route path="/ajustes" element={<Ajustes />} />
            <Route path="/terminos" element={<Terminos />} />
          </Route>
          <Route path="/editor/:id" element={<Editor />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}

export default App;
