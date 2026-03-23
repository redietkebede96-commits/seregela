import React, { useState, useMemo, useRef } from 'react';
import { 
  Users, 
  Car, 
  Bus, 
  ChevronRight, 
  MapPin, 
  MoreHorizontal, 
  Search,
  Plus,
  CheckCircle2,
  AlertCircle,
  Share2,
  Download,
  Pencil,
  Trash2,
  Phone,
  Upload,
  FileSpreadsheet,
  X,
  UserPlus,
  Eye
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import html2canvas from 'html2canvas';
import * as XLSX from 'xlsx';

// Title Case utility — normalizes all text input
const toTitleCase = (str) => str ? str.replace(/\w\S*/g, (w) => w.charAt(0).toUpperCase() + w.substr(1).toLowerCase()) : '';

// Mock Data
const INITIAL_STUDENTS = [
  // Lives in Mexico
  { id: 1, name: 'Abebe Kebede', destination: 'Mexico', type: 'walking', assignedTo: null, phone: '+251 911 123 456' },
  { id: 2, name: 'Hana Girma', destination: 'Mexico', type: 'walking', assignedTo: null, phone: '+251 912 234 567' },
  { id: 3, name: 'Dawit Tadesse', destination: 'Mexico', type: 'walking', assignedTo: null, phone: '+251 913 345 678' },
  // Lives in Jemo, passes through Mexico
  { id: 4, name: 'Meron Hailu', destination: 'Mexico, Jemo', type: 'walking', assignedTo: null, phone: '+251 914 456 789' },
  { id: 5, name: 'Yonas Bekele', destination: 'Mexico, Jemo', type: 'walking', assignedTo: null, phone: '+251 915 567 890' },
  { id: 6, name: 'Tigist Alemu', destination: 'Mexico, Jemo', type: 'walking', assignedTo: null, phone: '+251 916 678 901' },
  // Lives in Sebeta, passes through Jemo and Mexico
  { id: 7, name: 'Kidus Worku', destination: 'Mexico, Jemo, Sebeta', type: 'walking', assignedTo: null, phone: '+251 917 789 012' },
  { id: 8, name: 'Liya Tesfaye', destination: 'Mexico, Jemo, Sebeta', type: 'walking', assignedTo: null, phone: '+251 918 890 123' },
  { id: 9, name: 'Samuel Desta', destination: 'Mexico, Jemo, Sebeta', type: 'walking', assignedTo: null, phone: '+251 919 901 234' },
  { id: 10, name: 'Bethlehem Assefa', destination: 'Mexico, Jemo, Sebeta', type: 'walking', assignedTo: null, phone: '+251 920 012 345' },
  // Car owners in Sebeta — covering all routes
  { id: 11, name: 'Fikadu Mengistu', destination: 'Mexico, Jemo, Sebeta', type: 'car_owner', assignedTo: null, phone: '+251 921 111 222' },
  { id: 12, name: 'Selam Berhane', destination: 'Mexico, Jemo, Sebeta', type: 'car_owner', assignedTo: null, phone: '+251 922 333 444' },
  { id: 13, name: 'Yared Gebre', destination: 'Mexico, Jemo', type: 'car_owner', assignedTo: null, phone: '+251 923 555 666' },
  // More students
  { id: 14, name: 'Eden Mulugeta', destination: 'Jemo', type: 'walking', assignedTo: null, phone: '+251 924 777 888' },
  { id: 15, name: 'Natnael Solomon', destination: 'Jemo, Sebeta', type: 'walking', assignedTo: null, phone: '+251 925 999 000' },
];

const INITIAL_CARS = [
  { id: 'c1', ownerId: 11, destination: 'Mexico, Jemo, Sebeta', totalSeats: 4, occupied: 0, phone: '+251 921 111 222' },
  { id: 'c2', ownerId: 12, destination: 'Mexico, Jemo, Sebeta', totalSeats: 5, occupied: 0, phone: '+251 922 333 444' },
  { id: 'c3', ownerId: 13, destination: 'Mexico, Jemo', totalSeats: 4, occupied: 0, phone: '+251 923 555 666' },
];

const INITIAL_BUSES = [
  { id: 'b1', destination: 'Mexico, Jemo, Sebeta', totalSeats: 20, occupied: 0, tariff: '50 Birr' },
  { id: 'b2', destination: 'Mexico, Jemo', totalSeats: 15, occupied: 0, tariff: '30 Birr' },
];

const App = () => {
  const [view, setView] = useState('overview'); // overview | cars | minibuses | allocations
  const [students, setStudents] = useState(INITIAL_STUDENTS);
  const [cars, setCars] = useState(INITIAL_CARS);
  const [buses, setBuses] = useState(INITIAL_BUSES);
  const [selectingFor, setSelectingFor] = useState(null);
  const [addingVehicle, setAddingVehicle] = useState(null); // null | 'car' | 'bus'
  const [editingVehicle, setEditingVehicle] = useState(null); // null | vehicle object
  const [addingStudent, setAddingStudent] = useState(false);
  const [editingStudent, setEditingStudent] = useState(null);
  const [importPreview, setImportPreview] = useState(null); // parsed rows for preview
  const [studentFilter, setStudentFilter] = useState('all');
  const [studentSearch, setStudentSearch] = useState('');
  const [viewingStudent, setViewingStudent] = useState(null);
  const [carSearch, setCarSearch] = useState('');
  const [busSearch, setBusSearch] = useState('');
  const [allocationSearch, setAllocationSearch] = useState('');

  const shareCardRef = useRef({});
  const fileInputRef = useRef(null);

  // Computed State
  const unassignedStudents = students.filter(s => s.assignedTo === null && s.type === 'walking');
  const carOwners = students.filter(s => s.type === 'car_owner');
  const carAssignedCount = students.filter(s => s.assignedTo?.startsWith('c')).length;
  const busAssignedCount = students.filter(s => s.assignedTo?.startsWith('b')).length;
  const uniqueDestinations = [...new Set(students.map(s => s.destination))].length;

  // Assignment Logic
  const assignStudent = (studentId, vehicleId) => {
    setStudents(prev => prev.map(s => 
      s.id === studentId ? { ...s, assignedTo: vehicleId } : s
    ));
    
    if (vehicleId.startsWith('c')) {
      setCars(prev => prev.map(c => 
        c.id === vehicleId ? { ...c, occupied: c.occupied + 1 } : c
      ));
    } else {
      setBuses(prev => prev.map(b => 
        b.id === vehicleId ? { ...b, occupied: b.occupied + 1 } : b
      ));
    }
  };

  const unassignStudent = (studentId) => {
    const student = students.find(s => s.id === studentId);
    if (!student || !student.assignedTo) return;

    const vehicleId = student.assignedTo;
    
    setStudents(prev => prev.map(s => 
      s.id === studentId ? { ...s, assignedTo: null } : s
    ));

    if (vehicleId.startsWith('c')) {
      setCars(prev => prev.map(c => 
        c.id === vehicleId ? { ...c, occupied: c.occupied - 1 } : c
      ));
    } else {
      setBuses(prev => prev.map(b => 
        b.id === vehicleId ? { ...b, occupied: b.occupied - 1 } : b
      ));
    }
  };

  // Student CRUD Handlers
  const handleAddStudent = (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const name = toTitleCase(fd.get('name').trim());
    const phone = fd.get('phone').trim();
    const destination = toTitleCase(fd.get('destination').trim());
    const type = fd.get('type');
    const seats = parseInt(fd.get('seats') || '0');
    if (!name) return;

    if (editingStudent) {
      setStudents(prev => prev.map(s =>
        s.id === editingStudent.id
          ? { ...s, name, phone, destination, type, ...(type === 'car_owner' ? {} : {}) }
          : s
      ));
      // Update car if car_owner
      if (type === 'car_owner') {
        setCars(prev => {
          const existing = prev.find(c => c.ownerId === editingStudent.id);
          if (existing) {
            return prev.map(c => c.ownerId === editingStudent.id ? { ...c, destination, phone, totalSeats: seats || c.totalSeats } : c);
          } else {
            return [...prev, { id: `c${Date.now()}`, ownerId: editingStudent.id, destination, phone, totalSeats: seats || 4, occupied: 0 }];
          }
        });
      }
      setEditingStudent(null);
    } else {
      const newId = Date.now();
      const newStudent = { id: newId, name, phone, destination, type, assignedTo: null };
      setStudents(prev => [...prev, newStudent]);
      // Auto-create car entry for car owners
      if (type === 'car_owner') {
        setCars(prev => [...prev, { id: `c${newId}`, ownerId: newId, destination, phone, totalSeats: seats || 4, occupied: 0 }]);
      }
    }
    setAddingStudent(false);
  };

  const handleDeleteStudent = (studentId) => {
    if (!window.confirm('Delete this student? They will be unassigned from any vehicle.')) return;
    const student = students.find(s => s.id === studentId);
    if (student?.assignedTo) unassignStudent(studentId);
    setStudents(prev => prev.filter(s => s.id !== studentId));
    // Remove associated car if car_owner
    if (student?.type === 'car_owner') {
      setCars(prev => prev.filter(c => c.ownerId !== studentId));
    }
  };

  // Spreadsheet Import
  const handleFileImport = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const data = evt.target.result;
      const workbook = XLSX.read(data, { type: 'array' });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });
      // Normalize column names (case-insensitive)
      const parsed = rows.map(row => {
        const keys = Object.keys(row);
        const find = (patterns) => keys.find(k => patterns.some(p => k.toLowerCase().includes(p)));
        const nameKey = find(['name', 'full name', 'student']);
        const phoneKey = find(['phone', 'tel', 'mobile', 'contact']);
        const destKey = find(['destination', 'dest', 'location', 'direction']);
        const seatsKey = find(['seat', 'capacity', 'car']);
        const name = nameKey ? toTitleCase(String(row[nameKey]).trim()) : '';
        const phone = phoneKey ? String(row[phoneKey]).trim() : '';
        const destination = destKey ? toTitleCase(String(row[destKey]).trim()) : '';
        const seats = seatsKey ? parseInt(row[seatsKey]) || 0 : 0;
        return { name, phone, destination, seats, type: seats > 0 ? 'car_owner' : 'walking' };
      }).filter(r => r.name);
      setImportPreview(parsed);
    };
    reader.readAsArrayBuffer(file);
    e.target.value = ''; // reset input
  };

  const confirmImport = () => {
    if (!importPreview) return;
    const newStudents = importPreview.map((row, i) => ({
      id: Date.now() + i,
      name: row.name,
      phone: row.phone,
      destination: row.destination,
      type: row.type,
      assignedTo: null
    }));
    const newCars = importPreview
      .filter(r => r.type === 'car_owner')
      .map((row, i) => {
        const studentId = newStudents.find(s => s.name === row.name)?.id;
        return {
          id: `c${Date.now() + i + 1000}`,
          ownerId: studentId,
          destination: row.destination,
          phone: row.phone,
          totalSeats: row.seats || 4,
          occupied: 0
        };
      });
    setStudents(prev => [...prev, ...newStudents]);
    setCars(prev => [...prev, ...newCars]);
    setImportPreview(null);
  };

  // Vehicle Addition/Edition Handlers
  const handleAddCar = (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const ownerId = parseInt(formData.get('ownerId'));
    
    if (editingVehicle) {
      setCars(prev => prev.map(c => 
        c.id === editingVehicle.id 
          ? { 
              ...c, 
              ownerId, 
              totalSeats: parseInt(formData.get('seats')), 
              phone: formData.get('phone'),
              destination: students.find(s => s.id === ownerId).destination 
            }
          : c
      ));
      setEditingVehicle(null);
    } else {
      const newCar = {
        id: `c${Date.now()}`,
        ownerId,
        phone: formData.get('phone'),
        destination: students.find(s => s.id === ownerId).destination,
        totalSeats: parseInt(formData.get('seats')),
        occupied: 0
      };
      setCars([...cars, newCar]);
    }
    setAddingVehicle(null);
  };

  const handleAddBus = (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    
    if (editingVehicle) {
      setBuses(prev => prev.map(b => 
        b.id === editingVehicle.id 
          ? { 
              ...b, 
              destination: formData.get('destination'), 
              totalSeats: parseInt(formData.get('seats')), 
              tariff: formData.get('tariff') 
            }
          : b
      ));
      setEditingVehicle(null);
    } else {
      const newBus = {
        id: `b${Date.now()}`,
        destination: formData.get('destination'),
        totalSeats: parseInt(formData.get('seats')),
        occupied: 0,
        tariff: formData.get('tariff')
      };
      setBuses([...buses, newBus]);
    }
    setAddingVehicle(null);
  };

  const handleDeleteVehicle = (id) => {
    if (!window.confirm("Are you sure you want to delete this vehicle? All assigned students will be unassigned.")) return;

    // Unassign students
    setStudents(prev => prev.map(s => s.assignedTo === id ? { ...s, assignedTo: null } : s));
    
    if (id.startsWith('c')) {
      setCars(prev => prev.filter(c => c.id !== id));
    } else {
      setBuses(prev => prev.filter(b => b.id !== id));
    }
  };

  const handleShare = async (id) => {
    const element = shareCardRef.current[id];
    if (!element) return;

    // Clone into a fixed-width offscreen container for consistent export
    const wrapper = document.createElement('div');
    wrapper.style.position = 'fixed';
    wrapper.style.left = '-9999px';
    wrapper.style.top = '0';
    wrapper.style.width = '400px';
    wrapper.style.background = '#f9f9fe';
    wrapper.style.fontFamily = getComputedStyle(document.body).fontFamily;
    const clone = element.cloneNode(true);
    clone.style.width = '400px';
    clone.style.maxWidth = '400px';
    clone.style.minWidth = '400px';
    wrapper.appendChild(clone);
    document.body.appendChild(wrapper);

    try {
      const canvas = await html2canvas(wrapper, {
        backgroundColor: '#f9f9fe',
        scale: 2,
        width: 400,
        windowWidth: 400,
      });
      const image = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.href = image;
      link.download = `sugu-allocation-${id}.png`;
      link.click();
    } finally {
      document.body.removeChild(wrapper);
    }
  };

  // Modals
  const AddVehicleModal = () => {
    const isEditing = !!editingVehicle;
    const type = addingVehicle || (editingVehicle?.id.startsWith('c') ? 'car' : 'bus');
    if (!addingVehicle && !editingVehicle) return null;

    return (
      <motion.div 
        initial={{ opacity: 0 }} animate={{ opacity: 1 }}
        style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(24,19,68,0.95)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}
      >
        <div className="premium-card" style={{ width: '100%', maxWidth: '400px', background: 'white' }}>
          <h2 style={{ marginBottom: '1.5rem' }}>
            {isEditing ? `Edit ${type === 'car' ? 'Car' : 'Minibus'}` : (type === 'car' ? 'Register New Car' : 'Add Minibus')}
          </h2>
          
          <form onSubmit={type === 'car' ? handleAddCar : handleAddBus}>
            {type === 'car' ? (
              <>
                <div style={{ marginBottom: '1rem' }}>
                  <label className="label-metadata">Owner</label>
                  <select name="ownerId" required defaultValue={editingVehicle?.ownerId} style={{ width: '100%', padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid var(--surface-high)' }}>
                    {carOwners.map(s => <option key={s.id} value={s.id}>{s.name} ({s.destination})</option>)}
                  </select>
                </div>
                <div style={{ marginBottom: '1rem' }}>
                  <label className="label-metadata">Owner Phone</label>
                  <input name="phone" required defaultValue={editingVehicle?.phone} placeholder="e.g. +1 555 0123" style={{ width: '100%', padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid var(--surface-high)' }} />
                </div>
                <div style={{ marginBottom: '1rem' }}>
                  <label className="label-metadata">Total Seats</label>
                  <input name="seats" type="number" defaultValue={editingVehicle?.totalSeats || "4"} required style={{ width: '100%', padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid var(--surface-high)' }} />
                </div>
              </>
            ) : (
              <>
                <div style={{ marginBottom: '1rem' }}>
                  <label className="label-metadata">Destination</label>
                  <input name="destination" required defaultValue={editingVehicle?.destination} placeholder="e.g. Downtown" style={{ width: '100%', padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid var(--surface-high)' }} />
                </div>
                <div style={{ marginBottom: '1rem' }}>
                  <label className="label-metadata">Total Seats</label>
                  <input name="seats" type="number" defaultValue={editingVehicle?.totalSeats || "20"} required style={{ width: '100%', padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid var(--surface-high)' }} />
                </div>
                <div style={{ marginBottom: '1rem' }}>
                  <label className="label-metadata">Tariff</label>
                  <input name="tariff" required defaultValue={editingVehicle?.tariff} placeholder="e.g. $8.00" style={{ width: '100%', padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid var(--surface-high)' }} />
                </div>
              </>
            )}

            <div style={{ display: 'flex', gap: '1rem', marginTop: '2rem' }}>
              <button type="button" onClick={() => { setAddingVehicle(null); setEditingVehicle(null); }} style={{ flex: 1, padding: '0.75rem', background: 'none', border: 'none', fontWeight: 600 }}>Cancel</button>
              <button type="submit" className="btn-primary" style={{ flex: 1, padding: '0.75rem' }}>{isEditing ? 'Save Changes' : 'Create'}</button>
            </div>
          </form>
        </div>
      </motion.div>
    );
  };

  const AssignmentModal = () => {
    if (!selectingFor) return null;
    const target = selectingFor.type === 'car' ? cars.find(c => c.id === selectingFor.id) : buses.find(b => b.id === selectingFor.id);
    const eligibleStudents = unassignedStudents.filter(s => {
      if (s.type === 'car_owner') return false; // car owners drive, don't ride
      const vehicleStops = target.destination.split(',').map(d => d.trim().toLowerCase());
      const studentStops = s.destination.split(',').map(d => d.trim().toLowerCase());
      return studentStops.some(stop => vehicleStops.includes(stop));
    });
    const getFinalDest = (dest) => { const stops = dest.split(','); return stops[stops.length - 1].trim(); };

    return (
      <motion.div 
        initial={{ y: '100%' }} 
        animate={{ y: 0 }} 
        className="glass-nav" 
        style={{ position: 'fixed', top: 0, bottom: 0, left: 0, right: 0, height: '100vh', display: 'flex', flexDirection: 'column', padding: '2rem', zIndex: 100 }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
           <h2 style={{ fontSize: '1.75rem' }}>Assign Students</h2>
           <button onClick={() => setSelectingFor(null)} className="label-metadata" style={{ background: 'none', border: 'none' }}>Close</button>
        </div>

        <div className="surface-card" style={{ marginBottom: '2rem', background: 'var(--primary)', color: 'white' }}>
           <p className="label-metadata" style={{ color: 'rgba(255,255,255,0.6)' }}>Assigning to</p>
           <p style={{ fontSize: '1.25rem', fontWeight: 600 }}>{selectingFor.type === 'car' ? 'Car' : 'Minibus'} ({target.destination})</p>
        </div>

        <div style={{ flex: 1, overflowY: 'auto' }}>
          <p className="label-metadata" style={{ marginBottom: '1rem' }}>Available for this route</p>
          {eligibleStudents.length === 0 ? (
            <p style={{ opacity: 0.5 }}>No unassigned students for this destination.</p>
          ) : (
            eligibleStudents.map(student => (
              <div 
                key={student.id} 
                className="surface-card" 
                style={{ marginBottom: '0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                onClick={() => {
                  assignStudent(student.id, target.id);
                  setSelectingFor(null);
                }}
              >
                <div>
                  <span style={{ fontWeight: 600 }}>{student.name}</span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.75rem', color: 'var(--on-surface-variant)', marginTop: '0.15rem' }}>
                    <MapPin size={10} /> Final: {getFinalDest(student.destination)}
                  </span>
                </div>
                <Plus size={18} style={{ color: 'var(--secondary)' }} />
              </div>
            ))
          )}
        </div>
      </motion.div>
    );
  };

  // Filtered Student List
  const filteredStudents = useMemo(() => {
    let list = students;
    if (studentFilter === 'walking') list = list.filter(s => s.type === 'walking');
    else if (studentFilter === 'car_owner') list = list.filter(s => s.type === 'car_owner');
    else if (studentFilter === 'assigned') list = list.filter(s => s.assignedTo !== null);
    else if (studentFilter === 'unassigned') list = list.filter(s => s.assignedTo === null && s.type === 'walking');
    if (studentSearch) {
      const q = studentSearch.toLowerCase();
      list = list.filter(s => s.name.toLowerCase().includes(q) || s.destination.toLowerCase().includes(q) || s.phone?.toLowerCase().includes(q));
    }
    return list;
  }, [students, studentFilter, studentSearch]);

  // Views
  const OverviewView = () => (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="container">
      <header className="section-gap" style={{ marginTop: '2rem' }}>
        <p className="label-metadata">SUGU Coordination</p>
        <h1 style={{ fontSize: '2.25rem', marginBottom: '1rem' }}>Transportation Dashboard</h1>
      </header>

      {/* Hero Stats */}
      {(() => {
        const totalCarSeats = cars.reduce((a, c) => a + c.totalSeats, 0);
        const occupiedCarSeats = cars.reduce((a, c) => a + c.occupied, 0);
        const totalBusSeats = buses.reduce((a, c) => a + c.totalSeats, 0);
        const occupiedBusSeats = buses.reduce((a, c) => a + c.occupied, 0);
        const assignedCars = cars.filter(c => c.occupied > 0).length;
        const assignedBuses = buses.filter(b => b.occupied > 0).length;
        
        // Calculate overcrowded routes
        const allDestinations = new Set();
        students.forEach(s => s.destination.split(',').forEach(d => allDestinations.add(d.trim())));
        const routeAnalysis = [...allDestinations].map(dest => {
          const studentsOnRoute = students.filter(s => s.destination.split(',').some(d => d.trim() === dest)).length;
          const carSeatsOnRoute = cars.filter(c => c.destination.split(',').some(d => d.trim() === dest)).reduce((a, c) => a + c.totalSeats, 0);
          const busSeatsOnRoute = buses.filter(b => b.destination.split(',').some(d => d.trim() === dest)).reduce((a, b2) => a + b2.totalSeats, 0);
          const totalSeatsOnRoute = carSeatsOnRoute + busSeatsOnRoute;
          return { dest, students: studentsOnRoute, seats: totalSeatsOnRoute, overcrowded: studentsOnRoute > totalSeatsOnRoute };
        });
        const overcrowdedRoutes = routeAnalysis.filter(r => r.overcrowded);

        return (<>
          <div className="premium-card" style={{ background: 'var(--primary)', color: 'white', padding: '1.5rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
              <div>
                <p className="label-metadata" style={{ color: 'rgba(255,255,255,0.5)' }}>Students</p>
                <p className="display-metric" style={{ color: 'white', fontSize: '2rem' }}>{students.filter(s => s.assignedTo).length}<span style={{ opacity: 0.4, fontSize: '1rem' }}>/{students.length}</span></p>
                <p style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.4)', marginTop: '0.15rem' }}>assigned / total</p>
              </div>
              <div>
                <p className="label-metadata" style={{ color: 'rgba(255,255,255,0.5)' }}>Unassigned</p>
                <p className="display-metric" style={{ color: 'var(--secondary)', fontSize: '2rem' }}>{unassignedStudents.length}</p>
                <p style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.4)', marginTop: '0.15rem' }}>need transport</p>
              </div>
              <div>
                <p className="label-metadata" style={{ color: 'rgba(255,255,255,0.5)' }}>Cars</p>
                <p className="display-metric" style={{ color: 'white', fontSize: '2rem' }}>{assignedCars}<span style={{ opacity: 0.4, fontSize: '1rem' }}>/{cars.length}</span></p>
                <p style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.4)', marginTop: '0.15rem' }}>active / total</p>
              </div>
              <div>
                <p className="label-metadata" style={{ color: 'rgba(255,255,255,0.5)' }}>Buses</p>
                <p className="display-metric" style={{ color: 'white', fontSize: '2rem' }}>{assignedBuses}<span style={{ opacity: 0.4, fontSize: '1rem' }}>/{buses.length}</span></p>
                <p style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.4)', marginTop: '0.15rem' }}>active / total</p>
              </div>
            </div>
          </div>

          {/* Seat Details */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div className="premium-card" style={{ padding: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.5rem' }}>
                <Car size={16} color="var(--primary)" />
                <p className="label-metadata" style={{ fontSize: '0.6rem' }}>Car Seats</p>
              </div>
              <p style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--primary)' }}>{occupiedCarSeats}<span style={{ opacity: 0.3, fontSize: '0.9rem' }}>/{totalCarSeats}</span></p>
              <div style={{ marginTop: '0.4rem', height: '4px', background: 'var(--surface-high)', borderRadius: '2px', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${totalCarSeats ? (occupiedCarSeats / totalCarSeats * 100) : 0}%`, background: occupiedCarSeats >= totalCarSeats ? '#ff4d4d' : 'var(--primary)', borderRadius: '2px', transition: 'width 0.5s' }} />
              </div>
            </div>
            <div className="premium-card" style={{ padding: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.5rem' }}>
                <Bus size={16} color="var(--primary)" />
                <p className="label-metadata" style={{ fontSize: '0.6rem' }}>Bus Seats</p>
              </div>
              <p style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--primary)' }}>{occupiedBusSeats}<span style={{ opacity: 0.3, fontSize: '0.9rem' }}>/{totalBusSeats}</span></p>
              <div style={{ marginTop: '0.4rem', height: '4px', background: 'var(--surface-high)', borderRadius: '2px', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${totalBusSeats ? (occupiedBusSeats / totalBusSeats * 100) : 0}%`, background: occupiedBusSeats >= totalBusSeats ? '#ff4d4d' : 'var(--primary)', borderRadius: '2px', transition: 'width 0.5s' }} />
              </div>
            </div>
          </div>

          {/* Overcrowded Routes Warning */}
          {overcrowdedRoutes.length > 0 && (
            <div className="premium-card" style={{ padding: '1rem', border: '1px solid rgba(255,77,77,0.3)', background: 'rgba(255,77,77,0.04)' }}>
              <p className="label-metadata" style={{ color: '#ff4d4d', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                <AlertCircle size={14} /> Overcrowded Routes
              </p>
              {overcrowdedRoutes.map(r => (
                <div key={r.dest} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.4rem 0', borderBottom: '1px solid rgba(255,77,77,0.1)' }}>
                  <span style={{ fontWeight: 600, fontSize: '0.85rem', color: '#ff4d4d' }}>{r.dest}</span>
                  <span style={{ fontSize: '0.75rem', color: '#ff4d4d' }}>{r.students} students / {r.seats} seats</span>
                </div>
              ))}
            </div>
          )}

          {/* Detailed Stats Grid */}
          <div className="stat-grid">
            <div className="stat-cell">
              <p className="stat-value">{carOwners.length}</p>
              <p className="label-metadata" style={{ fontSize: '0.6rem', marginTop: '0.25rem' }}>Car Owners</p>
            </div>
            <div className="stat-cell">
              <p className="stat-value">{students.filter(s => s.type === 'walking').length}</p>
              <p className="label-metadata" style={{ fontSize: '0.6rem', marginTop: '0.25rem' }}>Walking</p>
            </div>
            <div className="stat-cell">
              <p className="stat-value">{uniqueDestinations}</p>
              <p className="label-metadata" style={{ fontSize: '0.6rem', marginTop: '0.25rem' }}>Destinations</p>
            </div>
            <div className="stat-cell">
              <p className="stat-value">{totalCarSeats + totalBusSeats}</p>
              <p className="label-metadata" style={{ fontSize: '0.6rem', marginTop: '0.25rem' }}>Total Seats</p>
            </div>
            <div className="stat-cell">
              <p className="stat-value">{occupiedCarSeats + occupiedBusSeats}</p>
              <p className="label-metadata" style={{ fontSize: '0.6rem', marginTop: '0.25rem' }}>Filled</p>
            </div>
            <div className="stat-cell">
              <p className="stat-value">{(totalCarSeats + totalBusSeats) - (occupiedCarSeats + occupiedBusSeats)}</p>
              <p className="label-metadata" style={{ fontSize: '0.6rem', marginTop: '0.25rem' }}>Available</p>
            </div>
          </div>
        </>);
      })()}

      {/* Import & Add Actions */}
      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.5rem' }}>
        <input type="file" ref={fileInputRef} accept=".csv,.xlsx,.xls" onChange={handleFileImport} style={{ display: 'none' }} />
        <button className="btn-import" style={{ flex: 1 }} onClick={() => fileInputRef.current?.click()}>
          <Upload size={16} /> Import Spreadsheet
        </button>
        <button className="btn-minimal" style={{ flexShrink: 0, padding: '0.6rem 1rem' }} onClick={() => setAddingStudent(true)}>
          <UserPlus size={14} /> Add
        </button>
      </div>

      {/* Search & Filter */}
      <section>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h2 style={{ fontSize: '1.5rem' }}>Student Directory</h2>
          <span className="label-metadata">{filteredStudents.length} found</span>
        </div>

        <div style={{ position: 'relative', marginBottom: '0.75rem' }}>
          <Search size={16} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--on-surface-variant)' }} />
          <input className="search-input" placeholder="Search by name, phone, or destination..." value={studentSearch} onChange={e => setStudentSearch(e.target.value)} />
        </div>

        <div className="filter-tabs">
          {[['all','All'], ['walking','Walking'], ['car_owner','Car Owners'], ['assigned','Assigned'], ['unassigned','Unassigned']].map(([key, label]) => (
            <button key={key} className={`filter-tab ${studentFilter === key ? 'active' : ''}`} onClick={() => setStudentFilter(key)}>{label}</button>
          ))}
        </div>

        {/* Student List */}
        <div className="premium-card" style={{ padding: '0.5rem 1rem' }}>
          {filteredStudents.length === 0 ? (
            <div style={{ padding: '2rem', textAlign: 'center', opacity: 0.5 }}>
              <p>No students match this filter.</p>
            </div>
          ) : (
            filteredStudents.map(student => (
              <div key={student.id} className="student-row">
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>{student.name}</span>
                    <span className={`type-badge ${student.type === 'car_owner' ? 'car-owner' : 'walking'}`}>
                      {student.type === 'car_owner' ? 'Car Owner' : 'Walking'}
                    </span>
                    {student.assignedTo && <span className="type-badge assigned">Assigned</span>}
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.15rem', fontSize: '0.7rem', color: 'var(--on-surface-variant)', flexWrap: 'wrap', alignItems: 'center' }}>
                    <MapPin size={10} style={{ flexShrink: 0 }} />
                    {student.destination.split(',').map((d, i, arr) => (
                      <span key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                        <span>{d.trim()}</span>
                        {i < arr.length - 1 && <span style={{ color: 'var(--secondary)', fontWeight: 700 }}>→</span>}
                      </span>
                    ))}
                    {student.phone && <span style={{ display: 'flex', alignItems: 'center', gap: '0.2rem', marginLeft: '0.25rem' }}>| <Phone size={10} /> {student.phone}</span>}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '0.25rem', flexShrink: 0 }}>
                  {student.phone && <a href={`tel:${student.phone}`} className="icon-btn" style={{ textDecoration: 'none' }}><Phone size={14} color="#2e7d32" /></a>}
                  <button className="icon-btn" onClick={() => setViewingStudent(student)}><Eye size={14} color="var(--on-surface-variant)" /></button>
                  <button className="icon-btn" onClick={() => { setEditingStudent(student); setAddingStudent(true); }}><Pencil size={14} color="var(--primary)" /></button>
                  <button className="icon-btn" onClick={() => handleDeleteStudent(student.id)}><Trash2 size={14} color="#ff4d4d" /></button>
                </div>
              </div>
            ))
          )}
        </div>
      </section>
    </motion.div>
  );

  const CarFleetView = () => {
    const q = carSearch.toLowerCase();
    const filteredCars = q ? cars.filter(car => {
      const ownerName = students.find(s => s.id === car.ownerId)?.name || '';
      return ownerName.toLowerCase().includes(q) || car.destination.toLowerCase().includes(q) || car.phone?.toLowerCase().includes(q);
    }) : cars;
    return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="container">
      <header className="section-gap" style={{ marginTop: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <p className="label-metadata">The Collective Fleet</p>
          <h2 style={{ fontSize: '2rem' }}>Car Assignments</h2>
        </div>
        <button className="btn-minimal" onClick={() => setAddingVehicle('car')}>
          <Plus size={16} /> Car
        </button>
      </header>

      <div style={{ position: 'relative', marginBottom: '1.25rem' }}>
        <Search size={16} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--on-surface-variant)' }} />
        <input className="search-input" placeholder="Search by owner, destination, or phone..." value={carSearch} onChange={e => setCarSearch(e.target.value)} />
      </div>

      {filteredCars.length === 0 ? (
        <div className="surface-card" style={{ padding: '2rem', textAlign: 'center', opacity: 0.5 }}><p>No cars match your search.</p></div>
      ) : filteredCars.map(car => (
        <div key={car.id} className="premium-card" style={{ padding: '0', overflow: 'hidden', marginBottom: '1.5rem' }}>
          <div style={{ padding: '1.75rem' }}>
             <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <h3 style={{ fontSize: '1.5rem', marginBottom: '0.25rem' }}>{students.find(s => s.id === car.ownerId)?.name}'s Car</h3>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--on-surface-variant)' }}>
                  <MapPin size={14} />
                  <span className="label-metadata" style={{ textTransform: 'none' }}>{car.destination}</span>
                  <span style={{ opacity: 0.2 }}>•</span>
                  <Phone size={14} />
                  <span className="label-metadata" style={{ textTransform: 'none' }}>{car.phone}</span>
                </div>
              </div>
              <div style={{ textAlign: 'right', display: 'flex', gap: '1rem' }}>
                <div style={{ textAlign: 'right' }}>
                  <p className="display-metric" style={{ fontSize: '2rem' }}>{car.occupied}<span style={{ opacity: 0.3, fontSize: '1.2rem' }}>/{car.totalSeats}</span></p>
                  <p className="label-metadata">Occupied</p>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                   <button onClick={() => setEditingVehicle(car)} style={{ background: 'none', border: 'none', color: 'var(--primary)', opacity: 0.6 }}><Pencil size={18} /></button>
                   <button onClick={() => handleDeleteVehicle(car.id)} style={{ background: 'none', border: 'none', color: '#ff4d4d', opacity: 0.6 }}><Trash2 size={18} /></button>
                </div>
              </div>
            </div>
            
            <div style={{ margin: '1.5rem 0', height: '120px', background: 'var(--surface-low)', borderRadius: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
               <img src="/car.png" alt="Tesla" style={{ height: '100px', objectFit: 'contain' }} />
            </div>

            <div className="section-gap">
              <p className="label-metadata" style={{ marginBottom: '1rem' }}>Passengers</p>
              {students.filter(s => s.assignedTo === car.id).map(s => (
                <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0', borderBottom: '1px solid var(--surface-high)' }}>
                  <span>{s.name}</span>
                  <button onClick={() => unassignStudent(s.id)} style={{ background: 'none', border: 'none', color: '#ff4d4d', fontSize: '0.8rem', cursor: 'pointer' }}>Remove</button>
                </div>
              ))}
              {car.occupied === car.totalSeats ? (
                <p style={{ opacity: 0.5, fontStyle: 'italic', fontSize: '0.9rem', marginTop: '1rem' }}>Vehicle Full</p>
              ) : (
                <button 
                  className="btn-primary" 
                  style={{ marginTop: '1rem', padding: '0.75rem' }}
                  onClick={() => setSelectingFor({ type: 'car', id: car.id })}
                >
                  <Plus size={18} /> Assign Student
                </button>
              )}
            </div>
          </div>
        </div>
      ))}
    </motion.div>
  )};

  const MinibusView = () => {
    const q = busSearch.toLowerCase();
    const filteredBuses = q ? buses.filter(bus =>
      bus.destination.toLowerCase().includes(q) || bus.tariff?.toLowerCase().includes(q)
    ) : buses;
    return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="container">
      <header className="section-gap" style={{ marginTop: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <p className="label-metadata">Mass Transit</p>
          <h2 style={{ fontSize: '2rem' }}>Minibus Logistics</h2>
        </div>
        <button className="btn-minimal" onClick={() => setAddingVehicle('bus')}>
          <Plus size={16} /> Bus
        </button>
      </header>

      <div style={{ position: 'relative', marginBottom: '1.25rem' }}>
        <Search size={16} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--on-surface-variant)' }} />
        <input className="search-input" placeholder="Search by destination or tariff..." value={busSearch} onChange={e => setBusSearch(e.target.value)} />
      </div>

      {filteredBuses.length === 0 ? (
        <div className="surface-card" style={{ padding: '2rem', textAlign: 'center', opacity: 0.5 }}><p>No buses match your search.</p></div>
      ) : filteredBuses.map(bus => (
        <div key={bus.id} className="premium-card" style={{ marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', gap: '1.5rem', marginBottom: '1.5rem' }}>
            <div style={{ width: '80px', height: '80px', background: 'var(--surface-low)', borderRadius: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <img src="/minibus.png" alt="Bus" style={{ width: '60px' }} />
            </div>
            <div style={{ flex: 1, position: 'relative' }}>
              <div style={{ position: 'absolute', right: 0, top: 0, display: 'flex', gap: '0.5rem' }}>
                <button onClick={() => setEditingVehicle(bus)} style={{ background: 'none', border: 'none', color: 'var(--primary)', opacity: 0.6 }}><Pencil size={16} /></button>
                <button onClick={() => handleDeleteVehicle(bus.id)} style={{ background: 'none', border: 'none', color: '#ff4d4d', opacity: 0.6 }}><Trash2 size={16} /></button>
              </div>
              <h3 style={{ fontSize: '1.25rem' }}>Minibus</h3>
              <p className="label-metadata">{bus.destination}</p>
              <div style={{ marginTop: '0.5rem', display: 'flex', gap: '1rem' }}>
                <div>
                   <span className="label-metadata" style={{ display: 'block' }}>Seats</span>
                   <span style={{ fontWeight: 600 }}>{bus.totalSeats - bus.occupied} Left</span>
                </div>
                <div>
                   <span className="label-metadata" style={{ display: 'block' }}>Tariff</span>
                   <span style={{ fontWeight: 600 }}>{bus.tariff}</span>
                </div>
              </div>
            </div>
          </div>

          <button 
            className="btn-primary" 
            style={{ marginBottom: '1rem' }}
            onClick={() => setSelectingFor({ type: 'bus', id: bus.id })}
          >
            Manage Assignments
          </button>

          <AnimatePresence>
            {students.filter(s => s.assignedTo === bus.id).length > 0 && (
              <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} className="surface-card" style={{ overflow: 'hidden' }}>
                <p className="label-metadata" style={{ marginBottom: '0.5rem' }}>Assigned Students</p>
                {students.filter(s => s.assignedTo === bus.id).map(s => (
                  <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.25rem 0' }}>
                    <span style={{ fontSize: '0.9rem' }}>{s.name}</span>
                    <button onClick={() => unassignStudent(s.id)} style={{ background: 'none', border: 'none', color: '#ff4d4d', fontSize: '0.8rem' }}>×</button>
                  </div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      ))}
    </motion.div>
  )};

  const AllocationsView = () => {
    const q = allocationSearch.toLowerCase();
    let allAllocations = [
      ...cars.filter(c => c.occupied > 0).map(c => ({ ...c, type: 'car' })),
      ...buses.filter(b => b.occupied > 0).map(b => ({ ...b, type: 'bus' }))
    ];
    if (q) {
      allAllocations = allAllocations.filter(item => {
        const ownerName = item.type === 'car' ? (students.find(s => s.id === item.ownerId)?.name || '') : 'Minibus';
        return ownerName.toLowerCase().includes(q) || item.destination.toLowerCase().includes(q);
      });
    }

    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="container">
        <header className="section-gap" style={{ marginTop: '2rem' }}>
          <p className="label-metadata">Public Rosters</p>
          <h2 style={{ fontSize: '2rem' }}>Daily Allocations</h2>
        </header>

        <div style={{ position: 'relative', marginBottom: '1.25rem' }}>
          <Search size={16} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--on-surface-variant)' }} />
          <input className="search-input" placeholder="Search by owner or destination..." value={allocationSearch} onChange={e => setAllocationSearch(e.target.value)} />
        </div>

        {allAllocations.length === 0 ? (
          <div className="surface-card" style={{ padding: '4rem', textAlign: 'center', opacity: 0.5 }}>
            <p>No active allocations to display.</p>
          </div>
        ) : (
          allAllocations.map(item => {
            const assignedPassengers = students.filter(s => s.assignedTo === item.id);
            const ownerName = item.type === 'car' ? students.find(s => s.id === item.ownerId)?.name : null;
            return (
            <div key={item.id} className="premium-card" style={{ padding: '0', overflow: 'hidden', marginBottom: '2.5rem' }}>
              <div 
                ref={el => shareCardRef.current[item.id] = el}
                style={{ padding: '1.5rem', background: 'var(--surface-lowest)', maxWidth: '400px', margin: '0 auto', boxSizing: 'border-box' }}
              >
                {/* Vehicle image - fixed size */}
                <div style={{ textAlign: 'center', marginBottom: '1rem' }}>
                  <img 
                    src={item.type === 'car' ? '/car.png' : '/minibus.png'} 
                    alt="Vehicle" 
                    style={{ width: '160px', height: '100px', objectFit: 'contain', margin: '0 auto', display: 'block' }} 
                  />
                </div>

                {/* Title & metadata */}
                <div style={{ textAlign: 'center', marginBottom: '1rem' }}>
                  <h3 style={{ fontSize: '1.5rem', marginBottom: '0.35rem' }}>{item.type === 'car' ? `${ownerName}'s Car` : 'Minibus'}</h3>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', color: 'var(--primary)', fontSize: '0.9rem' }}>
                    <MapPin size={16} />
                    <span style={{ fontWeight: 600 }}>{item.destination}</span>
                  </div>
                  {item.type === 'car' && item.phone && (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', color: 'var(--on-surface-variant)', fontSize: '0.85rem', marginTop: '0.25rem' }}>
                      <Phone size={14} />
                      <span>{item.phone}</span>
                    </div>
                  )}
                  {item.tariff && (
                    <p style={{ marginTop: '0.35rem', color: 'var(--secondary)', fontWeight: 'bold', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Tariff: {item.tariff}
                    </p>
                  )}
                </div>

                {/* Passenger list - single column, scales cleanly */}
                <div style={{ background: 'var(--surface-low)', borderRadius: '0.75rem', padding: '1rem' }}>
                  <p style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--on-surface-variant)', marginBottom: '0.5rem', paddingBottom: '0.4rem', borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
                    Passengers ({assignedPassengers.length}/{item.totalSeats})
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                    {assignedPassengers.map((s, i) => (
                      <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', padding: '0.25rem 0' }}>
                        <span style={{ width: '20px', height: '20px', borderRadius: '50%', background: 'var(--primary)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.65rem', fontWeight: 700, flexShrink: 0 }}>{i + 1}</span>
                        <span style={{ fontWeight: 500 }}>{s.name}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Footer branding */}
                <div style={{ marginTop: '1rem', textAlign: 'center' }}>
                  <p style={{ fontSize: '0.6rem', textTransform: 'uppercase', letterSpacing: '0.1em', opacity: 0.35 }}>SUGU Transport Coordination © 2026</p>
                </div>
              </div>

              {/* Share button - NOT part of the exported card */}
              <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid var(--surface-high)', display: 'flex', gap: '1rem' }}>
                <button 
                  className="btn-primary" 
                  onClick={() => handleShare(item.id)}
                  style={{ flex: 1, padding: '0.75rem' }}
                >
                  <Share2 size={18} /> Share Allocation
                </button>
              </div>
            </div>
          )})
        )}
      </motion.div>
    );
  };

  return (
    <div style={{ minHeight: '100vh', paddingBottom: '80px' }}>
      <AssignmentModal />
      <AddVehicleModal />

      {/* Student Detail Modal */}
      {viewingStudent && (() => {
        const s = viewingStudent;
        const assignedVehicle = s.assignedTo
          ? (s.assignedTo.startsWith('c') ? cars.find(c => c.id === s.assignedTo) : buses.find(b => b.id === s.assignedTo))
          : null;
        const ownedCar = s.type === 'car_owner' ? cars.find(c => c.ownerId === s.id) : null;
        return (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(24,19,68,0.95)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}
          >
            <div className="premium-card" style={{ width: '100%', maxWidth: '400px', background: 'white' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
                <div>
                  <h2 style={{ marginBottom: '0.25rem' }}>{s.name}</h2>
                  <span className={`type-badge ${s.type === 'car_owner' ? 'car-owner' : 'walking'}`}>
                    {s.type === 'car_owner' ? 'Car Owner' : 'Walking Student'}
                  </span>
                </div>
                <button onClick={() => setViewingStudent(null)} style={{ background: 'none', border: 'none' }}><X size={20} color="var(--on-surface-variant)" /></button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <div className="surface-card" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Phone size={16} color="var(--primary)" />
                  <div>
                    <p className="label-metadata" style={{ fontSize: '0.6rem' }}>Phone</p>
                    <p style={{ fontWeight: 600, fontSize: '0.9rem' }}>{s.phone || 'Not provided'}</p>
                  </div>
                </div>

                <div className="surface-card">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                    <MapPin size={16} color="var(--primary)" />
                    <p className="label-metadata" style={{ fontSize: '0.6rem' }}>{s.destination.includes(',') ? 'Route Path' : 'Destination'}</p>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', paddingLeft: '0.25rem' }}>
                    {s.destination.split(',').map((d, i, arr) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ width: '18px', height: '18px', borderRadius: '50%', background: i === arr.length - 1 ? 'var(--primary)' : 'var(--surface-high)', color: i === arr.length - 1 ? 'white' : 'var(--on-surface-variant)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.55rem', fontWeight: 700, flexShrink: 0 }}>{i + 1}</span>
                        <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>{d.trim()}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Assignment Status */}
                <div className="surface-card" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  {s.assignedTo ? <CheckCircle2 size={16} color="#2e7d32" /> : <AlertCircle size={16} color="var(--secondary)" />}
                  <div>
                    <p className="label-metadata" style={{ fontSize: '0.6rem' }}>Assignment</p>
                    <p style={{ fontWeight: 600, fontSize: '0.9rem' }}>
                      {s.assignedTo
                        ? `Assigned to ${assignedVehicle ? (s.assignedTo.startsWith('c') ? `${students.find(st => st.id === assignedVehicle.ownerId)?.name}'s Car` : `Minibus (${assignedVehicle.destination})`) : 'Vehicle'}`
                        : 'Not assigned'}
                    </p>
                  </div>
                </div>

                {/* Car details for car owners */}
                {ownedCar && (
                  <div className="surface-card" style={{ background: 'var(--primary)', color: 'white' }}>
                    <p className="label-metadata" style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.6rem' }}>Owned Vehicle</p>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.35rem' }}>
                      <span style={{ fontWeight: 600 }}>{ownedCar.totalSeats} seats</span>
                      <span style={{ opacity: 0.7, fontSize: '0.85rem' }}>{ownedCar.occupied}/{ownedCar.totalSeats} occupied</span>
                    </div>
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem' }}>
                <button onClick={() => setViewingStudent(null)} className="btn-primary" style={{ flex: 1, padding: '0.75rem' }}>Close</button>
              </div>
            </div>
          </motion.div>
        );
      })()}

      {/* Student Add/Edit Modal */}
      {addingStudent && (
        <motion.div 
          initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(24,19,68,0.95)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}
        >
          <div className="premium-card" style={{ width: '100%', maxWidth: '400px', background: 'white' }}>
            <h2 style={{ marginBottom: '1.5rem' }}>{editingStudent ? 'Edit Student' : 'Add Student'}</h2>
            <form onSubmit={handleAddStudent}>
              <div style={{ marginBottom: '1rem' }}>
                <label className="label-metadata">Full Name</label>
                <input name="name" required defaultValue={editingStudent?.name} placeholder="e.g. John Doe" style={{ width: '100%', padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid var(--surface-high)' }} />
              </div>
              <div style={{ marginBottom: '1rem' }}>
                <label className="label-metadata">Phone</label>
                <input name="phone" defaultValue={editingStudent?.phone} placeholder="e.g. +1 555 0123" style={{ width: '100%', padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid var(--surface-high)' }} />
              </div>
              <div style={{ marginBottom: '1rem' }}>
                <label className="label-metadata">Destination(s)</label>
                <input name="destination" required defaultValue={editingStudent?.destination} placeholder="e.g. North Campus, Downtown, East Wing" style={{ width: '100%', padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid var(--surface-high)' }} />
                <p style={{ fontSize: '0.6rem', color: 'var(--on-surface-variant)', marginTop: '0.25rem' }}>Separate multiple stops with commas</p>
              </div>
              <div style={{ marginBottom: '1rem' }}>
                <label className="label-metadata">Type</label>
                <select name="type" defaultValue={editingStudent?.type || 'walking'} style={{ width: '100%', padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid var(--surface-high)' }}>
                  <option value="walking">Walking Student</option>
                  <option value="car_owner">Car Owner</option>
                </select>
              </div>
              <div style={{ marginBottom: '1rem' }}>
                <label className="label-metadata">Seats (if car owner)</label>
                <input name="seats" type="number" defaultValue={editingStudent?.type === 'car_owner' ? (cars.find(c => c.ownerId === editingStudent?.id)?.totalSeats || 4) : 4} min="1" style={{ width: '100%', padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid var(--surface-high)' }} />
              </div>
              <div style={{ display: 'flex', gap: '1rem', marginTop: '2rem' }}>
                <button type="button" onClick={() => { setAddingStudent(false); setEditingStudent(null); }} style={{ flex: 1, padding: '0.75rem', background: 'none', border: 'none', fontWeight: 600 }}>Cancel</button>
                <button type="submit" className="btn-primary" style={{ flex: 1, padding: '0.75rem' }}>{editingStudent ? 'Save Changes' : 'Add Student'}</button>
              </div>
            </form>
          </div>
        </motion.div>
      )}

      {/* Import Preview Overlay */}
      {importPreview && (
        <div className="import-preview-overlay">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
            <div>
              <h2 style={{ color: 'white', fontFamily: 'Newsreader, serif' }}>Import Preview</h2>
              <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.8rem' }}>{importPreview.length} rows found</p>
            </div>
            <button onClick={() => setImportPreview(null)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)' }}><X size={24} /></button>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', marginBottom: '1rem' }}>
            <table className="import-preview-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Phone</th>
                  <th>Destination</th>
                  <th>Type</th>
                  <th>Seats</th>
                </tr>
              </thead>
              <tbody>
                {importPreview.map((row, i) => (
                  <tr key={i}>
                    <td>{row.name}</td>
                    <td>{row.phone}</td>
                    <td>{row.destination}</td>
                    <td><span className={`type-badge ${row.type === 'car_owner' ? 'car-owner' : 'walking'}`}>{row.type === 'car_owner' ? 'Car Owner' : 'Walking'}</span></td>
                    <td>{row.seats || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ display: 'flex', gap: '1rem' }}>
            <button onClick={() => setImportPreview(null)} style={{ flex: 1, padding: '0.75rem', background: 'none', border: '1px solid rgba(255,255,255,0.2)', color: 'white', borderRadius: '0.75rem', fontWeight: 600 }}>Cancel</button>
            <button onClick={confirmImport} className="btn-gold" style={{ flex: 1, padding: '0.75rem', borderRadius: '0.75rem' }}>Import {importPreview.length} Students</button>
          </div>
        </div>
      )}

      {view === 'overview' && OverviewView()}
      {view === 'cars' && CarFleetView()}
      {view === 'minibuses' && MinibusView()}
      {view === 'allocations' && AllocationsView()}

      {/* Navigation */}
      <nav className="glass-nav" style={{ position: 'fixed', top: 'auto', bottom: 0, width: '100%', display: 'flex', justifyContent: 'space-around', borderTop: '1px solid rgba(0,0,0,0.05)', borderBottom: 'none', zIndex: 10 }}>
        <button 
          onClick={() => setView('overview')}
          style={{ background: 'none', border: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.25rem', color: view === 'overview' ? 'var(--primary)' : 'var(--on-surface-variant)' }}
        >
          <Users size={24} />
          <span className="label-metadata" style={{ fontSize: '0.6rem' }}>Overview</span>
        </button>
        <button 
          onClick={() => setView('cars')}
          style={{ background: 'none', border: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.25rem', color: view === 'cars' ? 'var(--primary)' : 'var(--on-surface-variant)' }}
        >
          <Car size={24} />
          <span className="label-metadata" style={{ fontSize: '0.6rem' }}>Fleet</span>
        </button>
        <button 
          onClick={() => setView('minibuses')}
          style={{ background: 'none', border: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.25rem', color: view === 'minibuses' ? 'var(--primary)' : 'var(--on-surface-variant)' }}
        >
          <Bus size={24} />
          <span className="label-metadata" style={{ fontSize: '0.6rem' }}>Buses</span>
        </button>
        <button 
          onClick={() => setView('allocations')}
          style={{ background: 'none', border: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.25rem', color: view === 'allocations' ? 'var(--primary)' : 'var(--on-surface-variant)' }}
        >
          <Share2 size={24} />
          <span className="label-metadata" style={{ fontSize: '0.6rem' }}>Sharing</span>
        </button>
      </nav>
    </div>
  );
};

export default App;
