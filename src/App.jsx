import React, { useState, useMemo, useRef, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://nzxxvmkbsmsvntyxpnlk.supabase.co';
const supabaseKey = 'sb_publishable_O8V7iQJifrDhutb8m5BNpA_VeU-e5d0';
const supabase = createClient(supabaseUrl, supabaseKey);
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
  Eye,
  Bell,
  ArrowRight,
  UserCheck,
  Hammer
} from 'lucide-react';

import { motion, AnimatePresence } from 'framer-motion';
import html2canvas from 'html2canvas';
import * as XLSX from 'xlsx';

// Title Case utility — normalizes all text input
const toTitleCase = (str) => str ? str.replace(/\w\S*/g, (w) => w.charAt(0).toUpperCase() + w.substr(1).toLowerCase()) : '';

const getVehicleType = (seats) => {
  if (seats <= 4) return 'Sedan';
  if (seats <= 8) return 'SUV/Van';
  if (seats <= 15) return 'Minibus';
  return 'Large Bus';
};

const TRANSLATIONS = {
  en: {
    title: 'Transport Allocation',
    ownerSuffix: "'s Car",
    minibus: 'Minibus',
    destination: 'Destination',
    phone: 'Phone',
    tariff: 'Tariff',
    passengers: 'Passengers',
    seatsRemaining: 'Seats Remaining',
    footer: 'SUGU TRASIT COORDINATION',
    walking: 'Walking Student',
    carOwner: 'Car Owner'
  },
  am: {
    title: 'የትራንስፖርት ድልድል',
    ownerPrefix: 'የ',
    ownerSuffix: ' መኪና',
    minibus: 'ሚኒባስ',
    destination: 'መድረሻ (Destination)',
    phone: 'ስልክ (Phone)',
    tariff: 'ታሪፍ',
    passengers: 'ተሳፋሪዎች',
    seatsRemaining: 'ቀሪ ወንበሮች',
    footer: 'የሱባኤ ጉባኤ የትራንስፖርት አስተባባሪ',
    walking: 'እግረኛ ተማሪ',
    carOwner: 'ባለ መኪና'
  }
};

const translateText = async (text, targetLang = 'am') => {
  if (!text) return '';
  // Check localStorage cache first
  const cacheKey = `tr_${text}_${targetLang}`;
  const cached = localStorage.getItem(cacheKey);
  if (cached) return cached;

  try {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${targetLang}&dt=t&q=${encodeURIComponent(text)}`;
    const res = await fetch(url);
    const data = await res.json();
    const result = data[0][0][0];
    localStorage.setItem(cacheKey, result);
    return result;
  } catch (err) {
    console.error('Translation error:', err);
    return text;
  }
};


// App Component
const App = () => {
  const [view, setView] = useState('overview'); // overview | cars | minibuses | allocations
  const [students, setStudents] = useState([]);
  const [cars, setCars] = useState([]);
  const [buses, setBuses] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch data on load
  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const { data: studentsData, error: sError } = await supabase.from('students').select('*');
        const { data: vehiclesData, error: vError } = await supabase.from('vehicles').select('*');
        
        if (sError || vError) throw sError || vError;

        // Map data back to app format
        const mappedStudents = studentsData.map(s => ({
          ...s,
          assignedTo: s.assigned_vehicle_id
        }));

        setStudents(mappedStudents);
        
        const vData = vehiclesData || [];
        const mappedCars = vData.filter(v => v.type === 'car').map(c => ({
          id: c.id,
          ownerId: c.owner_id,
          destination: c.destination,
          totalSeats: c.total_seats,
          phone: c.phone,
          occupied: mappedStudents.filter(s => s.assignedTo === c.id).length
        }));
        setCars(mappedCars);

        const mappedBuses = vData.filter(v => v.type === 'bus').map(b => ({
          id: b.id,
          destination: b.destination,
          totalSeats: b.total_seats,
          tariff: b.tariff,
          occupied: mappedStudents.filter(s => s.assignedTo === b.id).length
        }));
        setBuses(mappedBuses);

      } catch (err) {
        console.error('Fetch error:', err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, []);


  // Sync state helpers
  const syncStudentToDb = async (student) => {
    const { assignedTo, ...rest } = student;
    await supabase.from('students').upsert({
      ...rest,
      assigned_vehicle_id: assignedTo
    });
  };

  const syncVehicleToDb = async (vehicle, type) => {
    const { ownerId, totalSeats, occupied, ...rest } = vehicle;
    await supabase.from('vehicles').upsert({
      ...rest,
      type,
      owner_id: ownerId,
      owner_name: vehicle.ownerName, // Added owner_name
      total_seats: totalSeats
    });
  };

  const [selectingFor, setSelectingFor] = useState(null);
  const [studentType, setStudentType] = useState('walking');
  const [addingVehicle, setAddingVehicle] = useState(null); // null | 'car' | 'bus'
  const [pendingAssignments, setPendingAssignments] = useState(null); // { studentIds }
  const [dismissedAlertIds, setDismissedAlertIds] = useState([]); // Array of alert IDs or stable keys
  const [editingVehicle, setEditingVehicle] = useState(null); // null | vehicle object
  const [addingStudent, setAddingStudent] = useState(false);
  const [editingStudent, setEditingStudent] = useState(null);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [sharingLang, setSharingLang] = useState('en'); // 'en' | 'am'
  const [translationCache, setTranslationCache] = useState({});
  const [isTranslating, setIsTranslating] = useState(false);

  useEffect(() => {
    if (sharingLang === 'am') {
      const namesToTranslate = students
        .filter(s => !translationCache[s.name])
        .map(s => s.name);
      
      if (namesToTranslate.length > 0) {
        setIsTranslating(true);
        const translateAll = async () => {
          const newCache = { ...translationCache };
          for (const name of namesToTranslate) {
            newCache[name] = await translateText(name);
          }
          setTranslationCache(newCache);
          setIsTranslating(false);
        };
        translateAll();
      }
    }
  }, [sharingLang, students, translationCache]);

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
  const uniqueDestinations = [...new Set(students.map(s => s.destination))].length;

  // Re-calculate occupied dynamically to ensure reactive UI
  const updatedCars = useMemo(() => cars.map(c => ({
    ...c,
    occupied: students.filter(s => s.assignedTo === c.id).length
  })), [cars, students]);

  const updatedBuses = useMemo(() => buses.map(b => ({
    ...b,
    occupied: students.filter(s => s.assignedTo === b.id).length
  })), [buses, students]);

  const carAssignedCount = students.filter(s => s.assignedTo && updatedCars.find(c => c.id === s.assignedTo)).length;
  // Simplified counts for performance/safety
  const totalAssigned = students.filter(s => s.assignedTo).length;

  // New state for modal form sync
  const [tempSeats, setTempSeats] = useState(4);
  useEffect(() => {
    if (editingVehicle) setTempSeats(editingVehicle.totalSeats);
    else if (addingVehicle === 'bus') setTempSeats(15);
    else setTempSeats(4);
  }, [editingVehicle, addingVehicle]);

  // Assignment Logic
  const assignStudent = async (studentId, vehicleId) => {
    const student = students.find(s => s.id === studentId);
    const vehicle = [...updatedCars, ...updatedBuses].find(v => v.id === vehicleId);

    if (vehicle && vehicle.occupied >= vehicle.totalSeats) {
      alert("⚠️ This vehicle is already full.");
      return;
    }

    const updatedStudent = { ...student, assignedTo: vehicleId };
    setStudents(prev => prev.map(s => s.id === studentId ? updatedStudent : s));
    await syncStudentToDb(updatedStudent);
  };

  const unassignStudent = async (studentId) => {
    const student = students.find(s => s.id === studentId);
    if (!student || !student.assignedTo) return;

    const updatedStudent = { ...student, assignedTo: null };
    setStudents(prev => prev.map(s => s.id === studentId ? updatedStudent : s));
    await syncStudentToDb(updatedStudent);
  };

  const handleApplyAssignment = async (studentIds, vehicleId, actionType = 'assign', alertId = null) => {
    // Optimistic: Dismiss alert immediately
    if (alertId) {
      setDismissedAlertIds(prev => [...prev, alertId]);
    }

    // Handle delete action FIRST - before studentIds guard, since delete alerts have no studentIds
    if (actionType === 'delete') {
      const targetId = vehicleId;
      if (targetId) {
        handleDeleteVehicle(targetId, true);
      }
      return;
    }

    if (!studentIds || (studentIds.length === 0 && actionType === 'assign')) return;

    if (actionType === 'add_bus') {
      const targetStudentId = studentIds[0];
      const targetStudent = students.find(s => s.id === targetStudentId);
      const alert = actionNeeded.find(a => 
        (a.recom?.studentIds && a.recom.studentIds.includes(targetStudentId)) || 
        (a.students && targetStudent && a.students.includes(targetStudent.name))
      );
      
      setPendingAssignments({ studentIds, destination: alert?.dest || targetStudent?.destination || '' });
      setTempSeats(14); 
      setAddingVehicle('bus');
      return;
    }

    // Capacity Check for bulk assignment
    const targetVehicle = [...updatedCars, ...updatedBuses].find(v => v.id === vehicleId);
    if (targetVehicle) {
      const freeSeats = targetVehicle.totalSeats - targetVehicle.occupied;
      if (studentIds.length > freeSeats) {
        alert(`❌ Cannot assign ${studentIds.length} students. Only ${freeSeats} seats available.`);
        return;
      }
    }

    // Optimistic UI update
    setStudents(prev => prev.map(s => 
      studentIds.includes(s.id) ? { ...s, assignedTo: vehicleId } : s
    ));
    
    // Sync to DB using update().in() for reliability with partial data
    const { error } = await supabase
      .from('students')
      .update({ assigned_vehicle_id: vehicleId })
      .in('id', studentIds);

    if (error) {
      console.error("Error applying assignment:", error);
      alert("Failed to sync assignment to database: " + error.message);
      // Revert local state on failure
      const { data: refreshed } = await supabase.from('students').select('*');
      if (refreshed) {
        setStudents(refreshed.map(s => ({ ...s, assignedTo: s.assigned_vehicle_id })));
      }
    }
  };

  // Detailed Action Needed Analysis (Logic moved here for scoping)
  const actionNeeded = useMemo(() => {
    const alerts = [];
    if (students.length === 0 || (updatedCars.length === 0 && updatedBuses.length === 0)) return alerts;

    const unassignedStudents = students.filter(s => !s.assignedTo);
    const unassignedWalkers = unassignedStudents.filter(s => s.type === 'walking');

    // Helper: Path Matching
    const getPathSegments = (dest) => (dest || '').split(',').map(d => d.trim().toLowerCase()).filter(Boolean);
    const isCompatible = (vDest, sDest) => {
      const vSegments = getPathSegments(vDest);
      const sSegments = getPathSegments(sDest);
      const shared = sSegments.filter(seg => vSegments.includes(seg) && seg !== 'mexico');
      return shared.length > 0;
    };

    // --- RED ALERT PRIORITY 1: Unassigned walker + Matching Car ---
    const matchedWalkerIds = new Set();
    updatedCars.filter(c => c.totalSeats - c.occupied > 0).forEach(car => {
      let freeSeats = car.totalSeats - car.occupied;
      const candidates = unassignedWalkers
        .filter(s => !matchedWalkerIds.has(s.id) && isCompatible(car.destination, s.destination))
        .sort((a, b) => {
          const aS = getPathSegments(a.destination);
          const bS = getPathSegments(b.destination);
          const vS = getPathSegments(car.destination);
          
          const aShared = aS.filter(seg => vS.includes(seg) && seg !== 'mexico').length;
          const bShared = bS.filter(seg => vS.includes(seg) && seg !== 'mexico').length;
          
          // Bonus for matching final destination
          const aExact = aS[aS.length - 1] === vS[vS.length - 1] ? 2 : 0;
          const bExact = bS[bS.length - 1] === vS[vS.length - 1] ? 2 : 0;
          
          return (bShared + bExact) - (aShared + aExact);
        });

      if (candidates.length > 0) {
        const toAssign = candidates.slice(0, freeSeats);
        const alertId = `match-car-${car.id}-${toAssign.map(s => s.id).sort().join('-')}`;
        if (!dismissedAlertIds.includes(alertId)) {
          alerts.push({
            id: alertId,
            priority: 'high',
            type: 'walker_match',
            ownerName: car.ownerName || students.find(s => s.id === car.ownerId)?.name || 'Private',
            students: toAssign.map(s => s.name),
            dest: car.destination,
            recom: {
              title: `Assign to ${car.ownerName || students.find(s => s.id === car.ownerId)?.name || 'Private'}'s Car`,
              actionType: 'assign',
              studentIds: toAssign.map(s => s.id),
              vehicleId: car.id,
              details: `Priority 1: Fill car seats first. ${toAssign.length} student(s) match ${car.destination} route.`
            }
          });
          toAssign.forEach(s => matchedWalkerIds.add(s.id));
        }
      }
    });

    // --- RED ALERT PRIORITY 2: Underused Minibus (< 3 students) ---
    updatedBuses.filter(bus => bus.occupied < 3).forEach(bus => {
      const alertId = `underused-bus-${bus.id}`;
      if (!dismissedAlertIds.includes(alertId)) {
        alerts.push({
          id: alertId,
          priority: 'high',
          type: 'underused_bus',
          dest: bus.destination,
          issues: [`Underused: Minibus only has ${bus.occupied} student(s) (threshold: 3).`],
          recom: {
            title: "Release & Reassign",
            actionType: 'delete',
            vehicleId: bus.id,
            details: "Priority 2: Release this minibus to save costs and reassign its students."
          }
        });
      }
    });

    // --- RED ALERT PRIORITY 3: Unserved Cluster (> 3 students) ---
    const remainingUnassigned = unassignedWalkers.filter(s => !matchedWalkerIds.has(s.id));
    const grouped = {};
    remainingUnassigned.forEach(s => {
      const mainPath = s.destination.split(',')[0].trim();
      if (!grouped[mainPath]) grouped[mainPath] = [];
      grouped[mainPath].push(s);
    });

    Object.entries(grouped).forEach(([dest, group]) => {
      if (group.length > 3) {
        // Only if no car can take them
        const hasCarMatch = updatedCars.some(c => c.totalSeats - c.occupied > 0 && isCompatible(c.destination, dest));
        if (!hasCarMatch) {
          const alertId = `cluster-${dest}`;
          if (!dismissedAlertIds.includes(alertId)) {
            alerts.push({
              id: alertId,
              priority: 'high',
              type: 'unserved_cluster',
              dest: dest,
              issues: [`Cluster: ${group.length} unassigned students detected with no car coverage.`],
              recom: {
                title: "Rent New Minibus",
                actionType: 'add_bus',
                studentIds: group.map(s => s.id),
                details: `Priority 3: Meaningful cluster on ${dest} route requires mass transit.`
              }
            });
          }
        }
      }
    });

    // --- YELLOW ALERT PRIORITY 1: One or two students have no ride ---
    const finalUnassigned = unassignedWalkers.filter(s => !matchedWalkerIds.has(s.id));
    if (finalUnassigned.length > 0 && finalUnassigned.length <= 2) {
      const alertId = `stranded-${finalUnassigned.map(s => s.id).sort().join('-')}`;
      if (!dismissedAlertIds.includes(alertId)) {
        alerts.push({
          id: alertId,
          priority: 'medium',
          type: 'stranded_students',
          issues: [`Stranded: ${finalUnassigned.length} student(s) remain without any assignment.`],
          recom: {
            title: "Assign to Any Available Seat",
            studentIds: finalUnassigned.map(s => s.id),
            details: "Yellow P1: Attempt to place in any car or minibus (at least to Taxi Station)."
          }
        });
      }
    }

    // --- YELLOW ALERT PRIORITY 2: Car has free seat but no walker assigned ---
    updatedCars.filter(c => c.totalSeats - c.occupied > 0).forEach(car => {
      const alertId = `opti-${car.id}`;
      // Only if not already suggested as a primary match in this run
      const alreadyHandled = alerts.some(a => a.recom?.vehicleId === car.id);
      if (!alreadyHandled && !dismissedAlertIds.includes(alertId)) {
        alerts.push({
          id: alertId,
          priority: 'medium',
          type: 'optimization',
          ownerName: students.find(s => s.id === car.ownerId)?.name,
          issues: [`Unused: This car still has ${car.totalSeats - car.occupied} free seats.`],
          suggestions: ["Offer Taxi Station Drop", "Transport teachers", "Nearby walker segments"],
          recom: null
        });
      }
    });

    return alerts.sort((a, b) => {
      const getRank = (type) => {
        if (type === 'walker_match') return 1;
        if (type === 'underused_bus') return 2;
        if (type === 'unserved_cluster') return 3;
        if (type === 'stranded_students') return 4;
        return 5;
      };
      return getRank(a.type) - getRank(b.type);
    });
  }, [students, updatedCars, updatedBuses, dismissedAlertIds]);


  // Student CRUD Handlers
  const handleAddStudent = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const name = toTitleCase(fd.get('name').trim());
    if (!name) return;

    const phone = fd.get('phone').trim();
    const destination = toTitleCase(fd.get('destination').trim());
    const type = fd.get('type');
    const seats = type === 'walking' ? 0 : parseInt(fd.get('seats') || '0');

    if (editingStudent) {
      const updated = { ...editingStudent, name, phone, destination, type };
      setStudents(prev => prev.map(s => s.id === editingStudent.id ? updated : s));
      await syncStudentToDb(updated);
      
      if (type === 'car_owner') {
        const existingCar = cars.find(c => c.ownerId === editingStudent.id);
        if (existingCar) {
          const updatedCar = { ...existingCar, destination, phone, ownerName: name, totalSeats: seats || existingCar.totalSeats };
          setCars(prev => prev.map(c => c.ownerId === editingStudent.id ? updatedCar : c));
          await syncVehicleToDb(updatedCar, 'car');
        } else {
          const newCar = { id: crypto.randomUUID(), ownerId: editingStudent.id, ownerName: name, destination, phone, totalSeats: seats || 4, occupied: 0 };
          setCars(prev => [...prev, newCar]);
          await syncVehicleToDb(newCar, 'car');
        }
      }
      setEditingStudent(null);
    } else {
      const newStudent = { id: crypto.randomUUID(), name, phone, destination, type, assignedTo: null };
      setStudents(prev => [...prev, newStudent]);
      await syncStudentToDb(newStudent);
      
      if (type === 'car_owner') {
        const newCar = { id: crypto.randomUUID(), ownerId: newStudent.id, ownerName: name, destination, phone, totalSeats: seats || 4, occupied: 0 };
        setCars(prev => [...prev, newCar]);
        await syncVehicleToDb(newCar, 'car');
      }
    }
    setAddingStudent(false);
    setEditingStudent(null);
    setStudentType('walking');
  };

  const handleDeleteStudent = async (studentId) => {
    if (!window.confirm('Delete this student? They will be unassigned from any vehicle.')) return;
    const student = students.find(s => s.id === studentId);
    
    // Optimistic UI
    setStudents(prev => prev.filter(s => s.id !== studentId));
    if (student?.type === 'car_owner') {
      setCars(prev => prev.filter(c => c.ownerId !== studentId));
    }
    
    await supabase.from('students').delete().eq('id', studentId);
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
        
        let type = 'walking';
        if (seats > 8) type = 'minibus';
        else if (seats > 0) type = 'car_owner';
        
        return { name, phone, destination, seats: type === 'walking' ? 0 : seats, type };
      }).filter(r => r.name || r.type === 'minibus');
      setImportPreview(parsed);

    };
    reader.readAsArrayBuffer(file);
    e.target.value = ''; // reset input
  };

  const confirmImport = async () => {
    if (!importPreview) return;
    setIsLoading(true);

    try {
      const newStudents = importPreview
        .filter(r => r.name && r.type !== 'minibus')
        .map((row) => ({
          id: crypto.randomUUID(),
          name: row.name,
          phone: row.phone,
          destination: row.destination,
          type: row.type,
          seats: row.type === 'walking' ? 0 : (row.seats || 0),
          assignedTo: null
        }));

    const newVehicles = [];
    
    // Add car owners
    importPreview.filter(r => r.type === 'car_owner').forEach(row => {
      const student = newStudents.find(s => s.name === row.name);
      if (student) {
        newVehicles.push({
          id: crypto.randomUUID(),
          type: 'car',
          ownerId: student.id,
          destination: row.destination,
          phone: row.phone,
          totalSeats: row.seats || 4,
          occupied: 0
        });
      }
    });

    // Add minibuses
    importPreview.filter(r => r.type === 'minibus').forEach(row => {
      newVehicles.push({
        id: crypto.randomUUID(),
        type: 'bus',
        destination: row.destination,
        totalSeats: row.seats || 15,
        occupied: 0,
        tariff: 'Unspecified'
      });
    });

    // Update local state
    setStudents(prev => [...prev, ...newStudents]);
    setCars(prev => [...prev, ...newVehicles.filter(v => v.type === 'car')]);
    setBuses(prev => [...prev, ...newVehicles.filter(v => v.type === 'bus')]);

    // Sync to DB
    const studentUpdates = newStudents.map(s => ({
      id: s.id,
      name: s.name,
      phone: s.phone,
      destination: s.destination,
      type: s.type
    }));
    const vehicleUpdates = newVehicles.map(v => ({
      id: v.id,
      type: v.type,
      owner_id: v.ownerId,
      destination: v.destination,
      total_seats: v.totalSeats,
      tariff: v.tariff,
      phone: v.phone
    }));

    const { error: sError } = await supabase.from('students').insert(studentUpdates);
    const { error: vError } = await supabase.from('vehicles').insert(vehicleUpdates);

    if (sError || vError) {
      console.error("Import sync error:", sError || vError);
      alert("Failed to import to database: " + (sError?.message || vError?.message));
    } else {
      // Only clear preview if successful
      setImportPreview(null);
    }
    } catch (err) {
      console.error("Import error:", err);
      alert("An unexpected error occurred during import.");
    } finally {
      setIsLoading(false);
    }
  };

  // Vehicle Addition/Edition Handlers
  const handleAddCar = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const ownerId = formData.get('ownerId'); // UUID
    
      const ownerName = formData.get('ownerName');
      const carOwner = students.find(s => s.name.toLowerCase() === ownerName.toLowerCase());
      
      if (editingVehicle) {
        const updated = { 
          ...editingVehicle, 
          ownerId: carOwner?.id || null, 
          ownerName,
          totalSeats: parseInt(formData.get('seats')), 
          phone: formData.get('phone'),
          destination: formData.get('destination') || carOwner?.destination || '' 
        };
        setCars(prev => prev.map(c => c.id === editingVehicle.id ? updated : c));
        await syncVehicleToDb(updated, 'car');
        setEditingVehicle(null);
      } else {
        const newCar = {
          id: crypto.randomUUID(),
          ownerId: carOwner?.id || null,
          ownerName,
          phone: formData.get('phone'),
          destination: formData.get('destination') || carOwner?.destination || '',
          totalSeats: parseInt(formData.get('seats')),
          occupied: 0
        };
        setCars(prev => [...prev, newCar]);
        await syncVehicleToDb(newCar, 'car');
      }
    setAddingVehicle(null);
  };

  const handleAddBus = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    
    if (editingVehicle) {
      const updated = { 
        ...editingVehicle, 
        destination: formData.get('destination'), 
        totalSeats: parseInt(formData.get('seats')), 
        tariff: formData.get('tariff') 
      };
      setBuses(prev => prev.map(b => b.id === editingVehicle.id ? updated : b));
      await syncVehicleToDb(updated, 'bus');
      setEditingVehicle(null);
    } else {
      const newBus = {
        id: crypto.randomUUID(),
        destination: formData.get('destination'),
        totalSeats: parseInt(formData.get('seats')),
        occupied: 0,
        tariff: formData.get('tariff')
      };
      setBuses(prev => [...prev, newBus]);
      await syncVehicleToDb(newBus, 'bus');
      
      // Auto-assign pending students if this bus was created via alert
      if (pendingAssignments) {
        await handleApplyAssignment(pendingAssignments.studentIds, newBus.id);
        setPendingAssignments(null);
      }
    }
    setAddingVehicle(null);
  };

  const handleDeleteVehicle = async (id, skipConfirm = false) => {
    if (!skipConfirm && !window.confirm("Are you sure you want to delete this vehicle? All assigned students will be unassigned.")) return;

    // Unassign students locally
    setStudents(prev => prev.map(s => s.assignedTo === id ? { ...s, assignedTo: null } : s));
    
    if (cars.find(c => c.id === id)) {
      setCars(prev => prev.filter(c => c.id !== id));
    } else {
      setBuses(prev => prev.filter(b => b.id !== id));
    }

    // Sync DB: Explicitly unassign students first to ensure state consistency
    await supabase.from('students').update({ assigned_vehicle_id: null }).eq('assigned_vehicle_id', id);
    // Sync DB: Delete the vehicle
    await supabase.from('vehicles').delete().eq('id', id);
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
    if (!addingVehicle && !editingVehicle) return null;
    
    // Uses lifted state tempSeats
    const vehicleClass = getVehicleType(tempSeats);
    const isMinibus = tempSeats > 8;

    return (
      <motion.div 
        initial={{ opacity: 0 }} animate={{ opacity: 1 }}
        style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(24,19,68,0.95)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}
      >
        <div className="premium-card" style={{ width: '100%', maxWidth: '400px', background: 'white' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <h2 style={{ fontSize: '1.25rem' }}>
                {isEditing ? `Edit ${isMinibus ? 'Minibus' : 'Car'}` : (isMinibus ? 'Add Minibus' : 'Register New Car')}
              </h2>
              <div style={{ background: isMinibus ? 'var(--secondary)' : 'var(--primary)', color: 'white', padding: '0.2rem 0.5rem', borderRadius: '0.4rem', fontSize: '0.5rem', fontWeight: 700, textTransform: 'uppercase' }}>
                {vehicleClass}
              </div>
            </div>
            <button onClick={() => { setAddingVehicle(null); setEditingVehicle(null); }} style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'rgba(0,0,0,0.05)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
              <X size={16} color="var(--on-surface-variant)" />
            </button>
          </div>
          
          <form onSubmit={isMinibus ? handleAddBus : handleAddCar}>
            <div style={{ marginBottom: '1rem' }}>
              <label className="label-metadata">Total Seats</label>
              <input name="seats" type="number" required defaultValue={tempSeats} onChange={(e) => setTempSeats(parseInt(e.target.value) || 0)} min="1" style={{ width: '100%', padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid var(--surface-high)' }} />
              <p style={{ fontSize: '0.6rem', color: 'var(--on-surface-variant)', marginTop: '0.25rem' }}>
                {isMinibus ? 'Admin: Pricing (Tariff) required for mass transit.' : 'Private vehicle owned by a student/parent.'}
              </p>
            </div>

            {!isMinibus ? (
              <>
                <div style={{ marginBottom: '1rem' }}>
                  <label className="label-metadata">Owner Name</label>
                  <input name="ownerName" required defaultValue={editingVehicle?.ownerName || (editingVehicle?.ownerId ? students.find(s => s.id === editingVehicle.ownerId)?.name : '')} placeholder="e.g. Alazar Kebede" style={{ width: '100%', padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid var(--surface-high)' }} />
                </div>
                <div style={{ marginBottom: '1rem' }}>
                  <label className="label-metadata">Owner Phone</label>
                  <input name="phone" required defaultValue={editingVehicle?.phone} placeholder="e.g. +251 9xx..." style={{ width: '100%', padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid var(--surface-high)' }} />
                </div>
                <div style={{ marginBottom: '1rem' }}>
                  <label className="label-metadata">Route Destination</label>
                  <input name="destination" required defaultValue={editingVehicle?.destination || carOwners.find(s => s.id === editingVehicle?.ownerId)?.destination} placeholder="e.g. Mexico, Jemo" style={{ width: '100%', padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid var(--surface-high)' }} />
                </div>
              </>
            ) : (
              <>
                <div style={{ marginBottom: '1rem' }}>
                  <label className="label-metadata">Route Destination</label>
                  <input name="destination" required defaultValue={editingVehicle?.destination} placeholder="e.g. Mexico, Jemo" style={{ width: '100%', padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid var(--surface-high)' }} />
                </div>
                <div style={{ marginBottom: '1rem' }}>
                  <label className="label-metadata">Tariff / Pricing</label>
                  <input name="tariff" required defaultValue={editingVehicle?.tariff} placeholder="e.g. 50 Birr" style={{ width: '100%', padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid var(--surface-high)' }} />
                </div>
              </>
            )}

            <div style={{ display: 'flex', gap: '1rem', marginTop: '2rem' }}>
              <button type="button" onClick={() => { setAddingVehicle(null); setEditingVehicle(null); }} style={{ flex: 1, padding: '0.75rem', background: 'none', border: 'none', fontWeight: 600 }}>Cancel</button>
              <button type="submit" className="btn-primary" style={{ flex: 1, padding: '0.75rem' }}>{isEditing ? 'Save Changes' : (isMinibus ? 'Add Minibus' : 'Register Car')}</button>
            </div>
          </form>
        </div>
      </motion.div>
    );
  };


  const NotificationDrawer = ({ isOpen, onClose, alerts, onApply, onDismiss, setView, setStudentFilter }) => {
    return (
      <AnimatePresence>
        {isOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={onClose}
              style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(24,19,68,0.4)', backdropFilter: 'blur(4px)', zIndex: 110 }}
            />
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              style={{
                position: 'fixed', top: 0, right: 0, width: '100%', maxWidth: '480px', height: '100vh',
                background: 'rgba(255, 255, 255, 0.85)', backdropFilter: 'blur(20px)', boxShadow: '-10px 0 40px rgba(0,0,0,0.1)',
                zIndex: 111, display: 'flex', flexDirection: 'column', borderLeft: '1px solid rgba(255, 255, 255, 0.3)',
                WebkitBackdropFilter: 'blur(20px)'
              }}
            >
              <div style={{ padding: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
                <div>
                  <h2 style={{ fontSize: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.25rem' }}>
                    <Bell size={24} color="var(--primary)" /> Notifications
                  </h2>
                  <p className="label-metadata" style={{ textTransform: 'none', color: 'var(--on-surface-variant)' }}>
                    {alerts.length} action items require your attention
                  </p>
                </div>
                <button onClick={onClose} style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'var(--surface-high)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                  <X size={20} color="var(--on-surface-variant)" />
                </button>
              </div>

              <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem' }}>
                {alerts.length === 0 ? (
                  <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', opacity: 0.5, textAlign: 'center' }}>
                    <CheckCircle2 size={64} color="#2e7d32" style={{ marginBottom: '1.5rem', opacity: 0.2 }} />
                    <p style={{ fontSize: '1.1rem', fontWeight: 500 }}>System Synchronized</p>
                    <p style={{ fontSize: '0.85rem' }}>No pending transit gaps detected.</p>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                    {alerts.map((alert, i) => {
                      const isHigh = alert.priority === 'high';
                      return (
                        <motion.div key={i} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className="premium-card" style={{ padding: '1.25rem', background: 'white', borderLeft: `4px solid ${isHigh ? '#ff4d4d' : '#f1c40f'}`, boxShadow: '0 4px 15px rgba(0,0,0,0.05)' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                            <span style={{ fontSize: '0.65rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: isHigh ? '#ff4d4d' : '#b7950b', background: isHigh ? 'rgba(255,77,77,0.1)' : 'rgba(241,196,15,0.1)', padding: '0.2rem 0.5rem', borderRadius: '4px' }}>
                              {alert.type === 'walker_match' ? 'Priority 1: Car Match' : 
                               alert.type === 'underused_bus' ? 'Priority 2: Underused' :
                               alert.type === 'unserved_cluster' ? 'Priority 3: Cluster' :
                               isHigh ? 'High Priority' : 'Optimization'}
                            </span>
                          </div>
                          <h4 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--primary)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            {alert.type === 'walker_match' ? <UserCheck size={18} /> : <MapPin size={18} />}
                            {alert.dest || (alert.ownerName ? `${alert.ownerName}'s Car` : 'Route Alert')}
                          </h4>
                          <div style={{ marginBottom: '1rem' }}>
                            {alert.issues?.map((issue, idx) => (
                              <p key={idx} style={{ fontSize: '0.85rem', color: 'var(--on-surface-variant)', marginBottom: '0.4rem', lineWeight: 1.4 }}>• {issue}</p>
                            ))}
                            {alert.students && (<p style={{ fontSize: '0.75rem', color: 'rgba(0,0,0,0.4)', marginTop: '0.5rem' }}><strong>Affected:</strong> {alert.students.join(', ')}</p>)}
                          </div>
                          {alert.suggestions && (
                            <div style={{ background: 'var(--surface-lowest)', padding: '0.75rem', borderRadius: '0.75rem', marginBottom: '1.25rem', border: '1px dashed var(--surface-high)' }}>
                              <p style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--primary)', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Matches Detected</p>
                              {alert.suggestions.map((sug, idx) => (
                                <div key={idx} style={{ fontSize: '0.8rem', color: 'var(--on-surface-variant)', display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                                  <ArrowRight size={12} color="var(--secondary)" /> {sug}
                                </div>
                              ))}
                            </div>
                          )}
                          {alert.recom ? (
                             <div style={{ display: 'flex', gap: '0.75rem' }}>
                               <button 
                                 className="btn-primary" 
                                 style={{ flex: 1.5, padding: '0.8rem', fontSize: '0.85rem', background: '#2e7d32', color: 'white', borderRadius: '0.75rem', fontWeight: 700, border: 'none', cursor: 'pointer', boxShadow: '0 4px 12px rgba(46,125,50,0.2)' }}
                                 onClick={() => {
                                   onApply(alert.recom.studentIds, alert.recom.vehicleId, alert.recom.actionType, alert.id);
                                   onClose();
                                 }}
                               >
                                 {alert.recom.title}
                               </button>
                               <button 
                                 className="btn-minimal" 
                                 style={{ 
                                   flex: 1, padding: '0.8rem', fontSize: '0.85rem', 
                                   color: 'rgba(0,0,0,0.5)', background: 'transparent', 
                                   borderRadius: '0.75rem', border: '1px solid rgba(0,0,0,0.1)', 
                                   fontWeight: 600, cursor: 'pointer',
                                   transition: 'all 0.2s ease'
                                 }}
                                 onMouseOver={(e) => {
                                   e.currentTarget.style.background = 'rgba(0,0,0,0.03)';
                                   e.currentTarget.style.borderColor = 'rgba(0,0,0,0.2)';
                                 }}
                                 onMouseOut={(e) => {
                                   e.currentTarget.style.background = 'transparent';
                                   e.currentTarget.style.borderColor = 'rgba(0,0,0,0.1)';
                                 }}
                                 onClick={(e) => {
                                   e.stopPropagation();
                                   onDismiss(alert.id);
                                 }}
                               >
                                 Dismiss
                               </button>
                             </div>
                           ) : (
                             <button 
                               className="btn-primary" 
                               style={{ width: '100%', padding: '0.6rem', fontSize: '0.8rem' }}
                               onClick={() => {
                                 onClose();
                                 if (alert.type === 'walker_match') {
                                   setView('overview');
                                   setStudentFilter('unassigned');
                                 } else {
                                   setView('overview');
                                 }
                               }}
                             >
                               Resolve Now
                             </button>
                           )}
                        </motion.div>
                      );
                    })}
                  </div>
                )}
              </div>
              <div style={{ padding: '1.5rem', borderTop: '1px solid rgba(0,0,0,0.05)', display: 'flex', gap: '1rem' }}>
                <button onClick={onClose} className="btn-minimal" style={{ flex: 1, padding: '0.75rem', color: 'var(--on-surface-variant)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                  <X size={18} /> Close
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    );
  };

  const AssignmentModal = () => {

    if (!selectingFor) return null;
    const target = (selectingFor.type === 'car' ? updatedCars : updatedBuses).find(v => v.id === selectingFor.id);
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
           <button onClick={() => setSelectingFor(null)} style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'rgba(0,0,0,0.05)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
             <X size={20} color="var(--on-surface-variant)" />
           </button>
        </div>

        <div className="surface-card" style={{ marginBottom: '2rem', background: 'var(--primary)', color: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
           <div>
             <p className="label-metadata" style={{ color: 'rgba(255,255,255,0.6)' }}>Assigning to</p>
             <p style={{ fontSize: '1.25rem', fontWeight: 600 }}>{selectingFor.type === 'car' ? 'Car' : 'Minibus'} ({target.destination})</p>
           </div>
           <div style={{ textAlign: 'right' }}>
             <p style={{ fontSize: '1.5rem', fontWeight: 800 }}>{target.occupied}<span style={{ opacity: 0.6, fontSize: '1rem' }}>/{target.totalSeats}</span></p>
             <p className="label-metadata" style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.6rem' }}>Seats Occupied</p>
           </div>
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
                style={{ 
                  marginBottom: '0.75rem', 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center',
                  opacity: target.occupied >= target.totalSeats ? 0.5 : 1,
                  cursor: target.occupied >= target.totalSeats ? 'not-allowed' : 'pointer',
                  border: target.occupied >= target.totalSeats ? 'none' : '1px solid var(--surface-high)'
                }}
                onClick={() => {
                  if (target.occupied < target.totalSeats) {
                    assignStudent(student.id, target.id);
                  }
                }}
              >
                <div>
                  <span style={{ fontWeight: 600 }}>{student.name}</span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.75rem', color: 'var(--on-surface-variant)', marginTop: '0.15rem' }}>
                    <MapPin size={10} /> Final: {getFinalDest(student.destination)}
                  </span>
                </div>
                {target.occupied >= target.totalSeats ? (
                  <span className="label-metadata" style={{ color: '#ff4d4d', fontSize: '0.6rem' }}>FULL</span>
                ) : (
                  <Plus size={18} style={{ color: 'var(--secondary)' }} />
                )}
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
      <header className="section-gap" style={{ marginTop: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <p className="label-metadata">SUGU Coordination</p>
          <h1 style={{ fontSize: '2.25rem', marginBottom: '0.5rem' }}>Transportation Dashboard</h1>
        </div>
        {(() => {
          const highCount = actionNeeded.filter(a => a.priority === 'high').length;
          const medCount = actionNeeded.filter(a => a.priority === 'medium').length;
          return (
            <motion.button 
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setNotificationsOpen(true)}
              style={{
                position: 'relative',
                width: '52px',
                height: '52px',
                borderRadius: '1.25rem',
                border: '1px solid rgba(255, 255, 255, 0.4)',
                background: 'rgba(255, 255, 255, 0.65)',
                backdropFilter: 'blur(12px)',
                boxShadow: '0 8px 32px rgba(31, 38, 135, 0.08)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                WebkitBackdropFilter: 'blur(12px)'
              }}
            >
              <motion.div
                animate={highCount > 0 ? {
                  rotate: [0, -10, 10, -10, 10, 0],
                  transition: { repeat: Infinity, duration: 2.5, repeatDelay: 2 }
                } : {}}
              >
                <Bell size={26} color={highCount > 0 ? '#ff4d4d' : 'var(--primary)'} fill={highCount > 0 ? 'rgba(255,77,77,0.1)' : 'transparent'} />
              </motion.div>
              
              <div style={{ position: 'absolute', top: '-8px', right: '-8px', display: 'flex', flexDirection: 'column', gap: '3px', alignItems: 'center' }}>
                <AnimatePresence>
                  {highCount > 0 && (
                     <motion.span 
                       initial={{ scale: 0, opacity: 0 }}
                       animate={{ scale: 1, opacity: 1 }}
                       exit={{ scale: 0, opacity: 0 }}
                       style={{ 
                         background: '#ff4d4d', 
                         color: 'white', 
                         minWidth: '22px', 
                         height: '22px', 
                         display: 'flex', 
                         alignItems: 'center', 
                         justifyContent: 'center',
                         fontSize: '0.7rem', 
                         fontWeight: 900, 
                         borderRadius: '11px', 
                         border: '2.5px solid white',
                         boxShadow: '0 4px 12px rgba(255,77,77,0.3)',
                         zIndex: 2
                       }}
                     >
                       {highCount}
                     </motion.span>
                  )}
                  {medCount > 0 && (
                     <motion.span 
                       initial={{ scale: 0, opacity: 0 }}
                       animate={{ scale: 1, opacity: 1 }}
                       exit={{ scale: 0, opacity: 0 }}
                       style={{ 
                         background: '#f1c40f', 
                         color: '#181344', 
                         minWidth: '20px', 
                         height: '20px', 
                         display: 'flex', 
                         alignItems: 'center', 
                         justifyContent: 'center',
                         fontSize: '0.65rem', 
                         fontWeight: 900, 
                         borderRadius: '10px', 
                         border: '2.5px solid white',
                         boxShadow: '0 4px 10px rgba(241,196,15,0.3)',
                         zIndex: 1,
                         marginTop: highCount > 0 ? '-6px' : '0'
                       }}
                     >
                       {medCount}
                     </motion.span>
                  )}
                </AnimatePresence>
              </div>
            </motion.button>
          );
        })()}
      </header>




      {/* Hero Stats */}
      {(() => {
        const totalCarSeats = cars.reduce((a, c) => a + c.totalSeats, 0);
        const occupiedCarSeats = cars.reduce((a, c) => a + c.occupied, 0);
        const totalBusSeats = buses.reduce((a, c) => a + c.totalSeats, 0);
        const occupiedBusSeats = buses.reduce((a, c) => a + c.occupied, 0);
        const assignedCars = cars.filter(c => c.occupied > 0).length;
        const assignedBuses = buses.filter(b => b.occupied > 0).length;
        
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
        <button className="btn-minimal" style={{ flexShrink: 0, padding: '0.6rem 1rem' }} onClick={() => { setStudentType('walking'); setAddingStudent(true); }}>
          <UserPlus size={14} /> Add Student
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
                  <button className="icon-btn" onClick={() => { setStudentType(student.type); setEditingStudent(student); setAddingStudent(true); }}><Pencil size={14} color="var(--primary)" /></button>
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
    const filteredCars = q ? updatedCars.filter(car => {
      const ownerName = students.find(s => s.id === car.ownerId)?.name || '';
      return ownerName.toLowerCase().includes(q) || car.destination.toLowerCase().includes(q) || car.phone?.toLowerCase().includes(q);
    }) : updatedCars;
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
                <h3 style={{ fontSize: '1.5rem', marginBottom: '0.25rem' }}>{car.ownerName || students.find(s => s.id === car.ownerId)?.name || 'Private'} Car</h3>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--on-surface-variant)' }}>
                  <div className="type-badge car-owner" style={{ fontSize: '0.5rem', padding: '0.1rem 0.3rem' }}>{getVehicleType(car.totalSeats)}</div>
                  <MapPin size={10} />
                  <span className="label-metadata" style={{ textTransform: 'none', fontSize: '0.65rem' }}>{car.destination}</span>
                  <span style={{ opacity: 0.2 }}>•</span>
                  <Phone size={10} />
                  <span className="label-metadata" style={{ textTransform: 'none', fontSize: '0.65rem' }}>{car.phone}</span>
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
    );
  };

  const MinibusView = () => {
    const q = busSearch.toLowerCase();
    const filteredBuses = q ? updatedBuses.filter(bus =>
      bus.destination.toLowerCase().includes(q) || bus.tariff?.toLowerCase().includes(q)
    ) : updatedBuses;
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
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.2rem' }}>
                <h3 style={{ fontSize: '1.25rem' }}>Minibus</h3>
                <div style={{ background: 'var(--secondary)', color: 'white', padding: '0.1rem 0.3rem', borderRadius: '0.3rem', fontSize: '0.5rem', fontWeight: 700 }}>{getVehicleType(bus.totalSeats)}</div>
              </div>
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
    );
  };

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
            const owner = item.type === 'car' ? students.find(s => s.id === item.ownerId) : null;
            const ownerName = (sharingLang === 'am' && translationCache[owner?.name]) ? translationCache[owner.name] : (owner?.name || 'Minibus');
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
                  <p className="label-metadata" style={{ fontSize: '0.6rem', color: 'var(--primary)', marginBottom: '0.25rem', letterSpacing: '0.15em' }}>
                    {TRANSLATIONS[sharingLang].title}
                  </p>
                  <h3 style={{ fontSize: '1.5rem', marginBottom: '0.35rem' }}>
                    {item.type === 'car' 
                      ? (sharingLang === 'am' ? `${TRANSLATIONS.am.ownerPrefix}${ownerName}${TRANSLATIONS.am.ownerSuffix}` : `${ownerName}${TRANSLATIONS.en.ownerSuffix}`)
                      : TRANSLATIONS[sharingLang].minibus}
                  </h3>
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
                      {TRANSLATIONS[sharingLang].tariff}: {item.tariff}
                    </p>
                  )}
                </div>

                {/* Passenger list - single column, scales cleanly */}
                <div style={{ background: 'var(--surface-low)', borderRadius: '0.75rem', padding: '1rem' }}>
                  <p style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--on-surface-variant)', marginBottom: '0.5rem', paddingBottom: '0.4rem', borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
                    {TRANSLATIONS[sharingLang].passengers} ({assignedPassengers.length}/{item.totalSeats})
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                    {assignedPassengers.map((s, i) => (
                      <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', padding: '0.25rem 0' }}>
                        <span style={{ width: '20px', height: '20px', borderRadius: '50%', background: 'var(--primary)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.65rem', fontWeight: 700, flexShrink: 0 }}>{i + 1}</span>
                        <span style={{ fontWeight: 500 }}>{sharingLang === 'am' && translationCache[s.name] ? translationCache[s.name] : s.name}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Footer branding */}
                <div style={{ marginTop: '1rem', textAlign: 'center' }}>
                  <p style={{ fontSize: '0.6rem', textTransform: 'uppercase', letterSpacing: '0.1em', opacity: 0.35 }}>
                    {TRANSLATIONS[sharingLang].footer} © 2026
                  </p>
                </div>
              </div>

              {/* Share button - NOT part of the exported card */}
              <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid var(--surface-high)', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ display: 'flex', background: 'var(--surface-high)', padding: '0.25rem', borderRadius: '0.75rem', gap: '0.25rem' }}>
                  <button 
                    onClick={() => setSharingLang('en')}
                    style={{ flex: 1, padding: '0.5rem', borderRadius: '0.5rem', border: 'none', background: sharingLang === 'en' ? 'white' : 'transparent', color: sharingLang === 'en' ? 'var(--primary)' : 'var(--on-surface-variant)', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s' }}
                  >
                    English
                  </button>
                  <button 
                    onClick={() => setSharingLang('am')}
                    disabled={isTranslating}
                    style={{ flex: 1, padding: '0.5rem', borderRadius: '0.5rem', border: 'none', background: sharingLang === 'am' ? 'white' : 'transparent', color: sharingLang === 'am' ? 'var(--primary)' : 'var(--on-surface-variant)', fontSize: '0.75rem', fontWeight: 700, cursor: isTranslating ? 'wait' : 'pointer', transition: 'all 0.2s' }}
                  >
                    {isTranslating ? 'Translating...' : 'አማርኛ'}
                  </button>
                </div>
                <button 
                  className="btn-primary" 
                  onClick={() => handleShare(item.id)}
                  style={{ width: '100%', padding: '0.75rem' }}
                >
                  <Share2 size={18} /> Share Allocation
                </button>
              </div>
            </div>
            );
          })
        )}
      </motion.div>
    );
  };

  return (
    <div style={{ minHeight: '100vh', paddingBottom: '80px' }}>
      <AssignmentModal />
      <AddVehicleModal />
      <NotificationDrawer 
        isOpen={notificationsOpen} 
        onClose={() => setNotificationsOpen(false)} 
        alerts={actionNeeded} 
        onApply={(studentIds, vehicleId, type, alertId) => handleApplyAssignment(studentIds, vehicleId, type, alertId)}
        onDismiss={(id) => setDismissedAlertIds(prev => [...prev, id])}
        setView={setView}
        setStudentFilter={setStudentFilter}
      />


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
                <button onClick={() => setViewingStudent(null)} style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'rgba(0,0,0,0.05)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                  <X size={20} color="var(--on-surface-variant)" />
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <div className="surface-card" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Phone size={16} color="var(--primary)" />
                  <div>
                    <p className="label-metadata" style={{ fontSize: '0.6rem' }}>Phone</p>
                    <p style={{ fontWeight: 600, fontSize: '0.9rem' }}>{s.phone || 'Not provided'}</p>
                  </div>
                </div>

                <div className="surface-card" style={{ background: 'var(--surface-low)', border: '1px solid var(--primary)', borderRadius: '1rem', padding: '1.25rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
                    <MapPin size={22} color="var(--primary)" />
                    <p className="label-metadata" style={{ fontSize: '0.7rem', color: 'var(--primary)', fontWeight: 800 }}>{s.destination.includes(',') ? 'ROUTE PATH' : 'DESTINATION'}</p>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                    {s.destination.split(',').map((d, i, arr) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <span style={{ 
                          width: '24px', height: '24px', borderRadius: '50%', 
                          background: i === arr.length - 1 ? 'var(--primary)' : 'rgba(24,19,68,0.1)', 
                          color: i === arr.length - 1 ? 'white' : 'var(--primary)', 
                          display: 'flex', alignItems: 'center', justifyContent: 'center', 
                          fontSize: '0.75rem', fontWeight: 900, flexShrink: 0 
                        }}>
                          {i + 1}
                        </span>
                        <span style={{ fontWeight: 700, fontSize: '1.1rem', color: 'var(--primary)' }}>{d.trim()}</span>
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
                <button onClick={() => setViewingStudent(null)} className="btn-primary" style={{ flex: 1, padding: '0.75rem' }}>Done</button>
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
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h2 style={{ marginBottom: 0 }}>{editingStudent ? 'Edit Student' : 'Add Student'}</h2>
              <button onClick={() => { setAddingStudent(false); setEditingStudent(null); }} style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'rgba(0,0,0,0.05)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                <X size={16} color="var(--on-surface-variant)" />
              </button>
            </div>
            <form onSubmit={handleAddStudent}>
              <div style={{ marginBottom: '1rem' }}>
                <input 
                  name="name" required defaultValue={editingStudent?.name} placeholder="e.g. John Doe" 
                  style={{ width: '100%', padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid var(--surface-high)' }} 
                />
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
                <select 
                  name="type" 
                  value={studentType} 
                  onChange={(e) => setStudentType(e.target.value)}
                  style={{ width: '100%', padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid var(--surface-high)' }}
                >
                  <option value="walking">Walking Student</option>
                  <option value="car_owner">Car Owner</option>
                </select>
              </div>
              <div style={{ marginBottom: '1rem', opacity: studentType === 'walking' ? 0.6 : 1 }}>
                <label className="label-metadata">Seats Capacity</label>
                <input 
                  name="seats" 
                  type="number" 
                  disabled={studentType === 'walking'}
                  value={studentType === 'walking' ? 0 : undefined}
                  defaultValue={editingStudent?.type === 'car_owner' ? (cars.find(c => c.ownerId === editingStudent?.id)?.totalSeats || 4) : 4} 
                  min="1" 
                  style={{ width: '100%', padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid var(--surface-high)', background: studentType === 'walking' ? 'var(--surface-low)' : 'white' }} 
                />
                {studentType === 'walking' && <p style={{ fontSize: '0.55rem', marginTop: '0.25rem', color: 'var(--on-surface-variant)' }}>Walking students do not provide transport seats.</p>}
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
              <h2 style={{ color: 'white', fontFamily: 'NokiaPureheadline' }}>Import Preview</h2>
              <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.8rem' }}>{importPreview.length} rows found</p>
            </div>
            <button onClick={() => setImportPreview(null)} style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'rgba(255,255,255,0.1)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
              <X size={24} color="rgba(255,255,255,0.7)" />
            </button>
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

      {isLoading ? (
        <div style={{ height: '80vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'var(--surface)', gap: '1.5rem' }}>
          <div style={{ width: '40px', height: '40px', border: '3px solid var(--surface-high)', borderTopColor: 'var(--primary)', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
          <p className="label-metadata" style={{ letterSpacing: '0.2rem' }}>Synchronizing Dataset...</p>
          <style>{`
            @keyframes spin { to { transform: rotate(360deg); } }
          `}</style>
        </div>
      ) : (
        <>
          {view === 'overview' && OverviewView()}
          {view === 'cars' && CarFleetView()}
          {view === 'minibuses' && MinibusView()}
          {view === 'allocations' && AllocationsView()}
        </>
      )}

      {/* Navigation */}
      <nav className="glass-nav" style={{ position: 'fixed', top: 'auto', bottom: 0, width: '100%', display: 'flex', justifyContent: 'space-around', borderTop: '1px solid rgba(0,0,0,0.05)', borderBottom: 'none', zIndex: 10 }}>
        <button 
          onClick={() => setView('overview')}
          style={{ background: 'none', border: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.25rem', color: view === 'overview' ? 'var(--primary)' : 'var(--on-surface-variant)' }}
        >
          <Users size={24} />
          <span className="label-metadata" style={{ fontSize: '0.7rem', fontWeight: 800 }}>Overview</span>
        </button>
        <button 
          onClick={() => setView('cars')}
          style={{ background: 'none', border: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.25rem', color: view === 'cars' ? 'var(--primary)' : 'var(--on-surface-variant)' }}
        >
          <Car size={24} />
          <span className="label-metadata" style={{ fontSize: '0.7rem', fontWeight: 800 }}>Fleet</span>
        </button>
        <button 
          onClick={() => setView('minibuses')}
          style={{ background: 'none', border: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.25rem', color: view === 'minibuses' ? 'var(--primary)' : 'var(--on-surface-variant)' }}
        >
          <Bus size={24} />
          <span className="label-metadata" style={{ fontSize: '0.7rem', fontWeight: 800 }}>Buses</span>
        </button>
        <button 
          onClick={() => setView('allocations')}
          style={{ background: 'none', border: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.25rem', color: view === 'allocations' ? 'var(--primary)' : 'var(--on-surface-variant)' }}
        >
          <Share2 size={24} />
          <span className="label-metadata" style={{ fontSize: '0.7rem', fontWeight: 800 }}>Sharing</span>
        </button>
      </nav>
    </div>
  );
};

export default App;
