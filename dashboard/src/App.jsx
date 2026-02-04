import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  Users, Wallet, Clock, Zap, Bell, Megaphone, Settings,
  Search, Edit3, Trash2, CheckCircle, AlertCircle, MapPin,
  ChevronRight, Plus, LogOut, LayoutDashboard, CreditCard,
  UserPlus, UserMinus, Camera
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, AreaChart, Area
} from 'recharts';
import { motion, AnimatePresence } from 'framer-motion';
import './App.css';

// Configure Axios Base URL for Production
const API_BASE_URL = import.meta.env.VITE_API_URL || '';
axios.defaults.baseURL = API_BASE_URL;

const getFullUrl = (path) => path.startsWith('http') ? path : `${API_BASE_URL}${path}`;

const App = () => {
  const [tenants, setTenants] = useState([]);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [selectedTenant, setSelectedTenant] = useState(null);
  const [ebForm, setEbForm] = useState({ room: '', amount: '' });
  const [announceForm, setAnnounceForm] = useState('');
  const [editData, setEditData] = useState({});
  const [searchQuery, setSearchQuery] = useState('');
  const [currentLocation, setCurrentLocation] = useState('All');
  const [loadingPdf, setLoadingPdf] = useState(false);
  const [toast, setToast] = useState(null); // { message, type: 'success'|'error' }
  const [actionPanel, setActionPanel] = useState(null); // { type, title, message, data, input, input2 }

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };


  useEffect(() => {
    fetchData();
  }, []);

  const handleEditChange = (key, val) => {
    setEditData({ ...editData, [key]: val });
  };

  const handleSave = async () => {
    try {
      let targetPhone = '';

      if (selectedTenant) {
        // --- EDIT MODE ---
        const payload = {
          oldPhone: selectedTenant.Phone,
          oldName: selectedTenant.Name,
          newPhone: editData.Phone !== undefined ? editData.Phone : selectedTenant.Phone,
          name: editData.Name !== undefined ? editData.Name : selectedTenant.Name,
          rent: editData['Monthly Rent'] !== undefined ? editData['Monthly Rent'] : selectedTenant['Monthly Rent'],
          eb: (editData['EB Amount'] !== undefined ? editData['EB Amount'] : selectedTenant['EB Amount']) || '0',
          sharingType: editData['Sharing Type'] !== undefined ? editData['Sharing Type'] : selectedTenant['Sharing Type'],
          location: editData.Location !== undefined ? editData.Location : selectedTenant.Location
        };
        await axios.post('/api/update-and-notify', payload);
        targetPhone = payload.newPhone;
      } else {
        // --- ADD MODE ---
        if (!editData.Phone || !editData.Name) return alert("Name and Phone are required");

        await axios.post('/api/add-tenant', {
          name: editData.Name,
          phone: editData.Phone,
          room: editData.Room || 'Unassigned',
          rent: editData['Monthly Rent'] || '0',
          eb: '0',
          sharingType: editData['Sharing Type'] || 'Unknown',
          location: editData.Location || 'Main Branch'
        });
        targetPhone = editData.Phone;
      }

      // --- Aadhaar Upload (Common) ---
      if (editData.aadhaarFile && targetPhone) {
        const formData = new FormData();
        formData.append('aadhaar', editData.aadhaarFile);
        formData.append('phone', targetPhone);
        await axios.post('/api/upload-aadhaar', formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
      }

      showToast(selectedTenant ? 'Resident updated successfully!' : 'New Resident added successfully!');
      setShowModal(false);
      setEditData({});
      fetchData();
    } catch (err) {
      console.error(err);
      showToast('Failed to save: ' + (err.response?.data?.error || err.message), 'error');
    }
  };

  const handleNotifyIndividual = async (tenant) => {
    try {
      await axios.post('/api/notify-tenant', { phone: tenant.Phone, name: tenant.Name });
      showToast(`Notification sent to ${tenant.Name}`, 'success');
    } catch (err) {
      console.error('Notify Error:', err);
      showToast('Failed to send: ' + (err.response?.data?.error || err.message), 'error');
    }
  };

  const handleDelete = async (tenant) => {
    setActionPanel({
      type: 'confirm',
      title: 'Confirm Deletion',
      message: `Are you sure you want to remove ${tenant.Name}? This cannot be undone.`,
      onConfirm: async () => {
        try {
          await axios.post('/api/delete-tenant', { phone: tenant.Phone, name: tenant.Name });
          showToast('Resident removed successfully', 'success');
          setActionPanel(null);
          fetchData();
        } catch (err) {
          showToast('Failed to delete', 'error');
        }
      }
    });
  };

  const handleRecordPayment = (tenant) => {
    setActionPanel({
      type: 'payment',
      title: 'Record Payment',
      data: tenant,
      input: tenant['Total Amount'] || 0,
      input2: 'UPI',
      onConfirm: async (amount, mode) => {
        try {
          await axios.post('/api/mark-paid', {
            phone: tenant.Phone,
            name: tenant.Name,
            amount: amount,
            mode: mode
          });
          showToast('Payment Recorded & Receipt Sent!', 'success');
          setActionPanel(null);
          fetchData();
        } catch (err) {
          showToast('Failed to record payment', 'error');
        }
      }
    });
  };

  const handleDownloadReceipt = async (tenant) => {
    try {
      setLoadingPdf(true);
      const res = await axios.post('/api/generate-invoice', { phone: tenant.Phone, name: tenant.Name });
      window.open(getFullUrl(res.data.url), '_blank');
      setLoadingPdf(false);
    } catch (err) {
      setLoadingPdf(false);
      showToast('Failed to generate receipt: ' + (err.response?.data?.error || err.message), 'error');
    }
  };

  const fetchData = async () => {
    try {
      const res = await axios.get('/api/tenants');
      setTenants(res.data);
      setLoading(false);
    } catch (err) {
      console.error('Error fetching tenants:', err);
      setLoading(false);
    }
  };

  // Stats Logic
  const locations = ['All', ...new Set(tenants.map(t => t.Location).filter(Boolean))];
  const filteredData = currentLocation === 'All' ? tenants : tenants.filter(t => t.Location === currentLocation);

  const activeTenants = filteredData.filter(t => t.Status !== 'VACATED');
  const paidCount = activeTenants.filter(t => t.Status === 'PAID').length;
  const pendingCount = activeTenants.length - paidCount;
  const totalRevenue = filteredData.filter(t => t.Status === 'PAID').reduce((sum, t) => sum + parseFloat(t['Total Amount'] || 0), 0);

  const totalBeds = activeTenants.reduce((sum, t) => {
    const type = t['Sharing Type'] || '';
    if (type.includes('One')) return sum + 1;
    if (type.includes('Two')) return sum + 2;
    if (type.includes('Three')) return sum + 3;
    if (type.includes('Four')) return sum + 4;
    return sum + 1;
  }, 0);
  const vacantBeds = totalBeds - activeTenants.length;

  const stats = [
    { label: 'Residents', value: activeTenants.length, icon: Users, color: '#6366f1', bg: 'rgba(99, 102, 241, 0.1)' },
    { label: 'Collection', value: `₹${totalRevenue.toLocaleString()}`, icon: Wallet, color: '#10b981', bg: 'rgba(16, 185, 129, 0.1)' },
    { label: 'Pending', value: pendingCount, icon: Clock, color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.1)' },
    { label: 'Vacant Beds', value: vacantBeds > 0 ? vacantBeds : 'Full', icon: MapPin, color: '#f43f5e', bg: 'rgba(244, 63, 94, 0.1)' },
  ];

  const chartData = [
    { name: 'Paid', value: paidCount },
    { name: 'Pending', value: pendingCount },
  ];
  const COLORS = ['#10b981', '#f59e0b'];

  // Handlers
  const handleNotifyAll = () => {
    setActionPanel({
      type: 'confirm',
      title: 'Send Mass Reminder',
      message: 'Send rent reminders and updated invoices to all active tenants via WhatsApp?',
      onConfirm: async () => {
        try {
          await axios.post('/api/trigger-notifications');
          showToast('Reminders sent to everyone!');
          setActionPanel(null);
        } catch (err) {
          showToast('Failed to send mass reminders', 'error');
        }
      }
    });
  };

  const handleUpdateEB = async () => {
    if (!ebForm.room || !ebForm.amount) return showToast('Fill all fields', 'error');
    try {
      // Process EB Split for Room
      await axios.post('/api/update-eb', {
        room: ebForm.room,
        totalEB: ebForm.amount
      });
      fetchData();
      setEbForm({ room: '', amount: '' });
      showToast('EB Split updated & sent!');
    } catch (err) { showToast('Update failed', 'error'); }
  };

  const handleAnnounce = async () => {
    if (!announceForm) return;
    try {
      await axios.post('/api/broadcast', { message: announceForm });
      showToast('Announcement broadcasted to WhatsApp!');
      setAnnounceForm('');
    } catch (err) {
      const errorMsg = err.response?.data?.error || err.message;
      showToast(`Broadcast failed: ${errorMsg}`, 'error');
    }
  };

  const renderDashboard = () => (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4 }}>
      <div className="stats-grid">
        {stats.map((stat, idx) => (
          <div key={idx} className="stat-card">
            <div className="stat-icon-wrap" style={{ backgroundColor: stat.bg, color: stat.color }}>
              <stat.icon size={22} />
            </div>
            <p className="stat-label">{stat.label}</p>
            <p className="stat-value">{stat.value}</p>
          </div>
        ))}
      </div>

      <div className="content-grid">
        <div className="panel">
          <div className="panel-header">
            <h3 className="panel-title">Recent Activity</h3>
            <button className="btn btn-glass btn-small" onClick={handleNotifyAll}>
              <Bell size={16} /> Notify All
            </button>
          </div>
          <div className="table-scroll">
            <table className="custom-table">
              <thead>
                <tr>
                  <th>Resident</th>
                  <th>Room</th>
                  <th>Rent/EB</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {activeTenants.slice(0, 6).map((t, i) => (
                  <tr key={i} className="table-row">
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>{t.Name[0]}</div>
                        <span style={{ fontWeight: 600 }}>{t.Name}</span>
                      </div>
                    </td>
                    <td>{t.Room}</td>
                    <td>₹{t['Monthly Rent']} / ₹{t['EB Amount']}</td>
                    <td>
                      <span className={`status-badge ${t.Status.toLowerCase()}`}>
                        {t.Status === 'PAID' ? <CheckCircle size={12} /> : <Clock size={12} />}
                        {t.Status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="panel" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <h3 className="panel-title" style={{ alignSelf: 'flex-start', marginBottom: 30 }}>Payment Status</h3>
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie
                data={chartData}
                innerRadius={60}
                outerRadius={90}
                paddingAngle={5}
                dataKey="value"
              >
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
          <div style={{ display: 'flex', gap: 20, marginTop: 20 }}>
            {chartData.map((d, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: COLORS[i] }}></div>
                <span style={{ color: 'var(--text-dim)', fontSize: '0.8rem', fontWeight: 600 }}>{d.name}: {d.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </motion.div>
  );

  const renderTenants = () => {
    const filteredTenants = tenants.filter(t =>
      t.Name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.Room.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.Phone.includes(searchQuery)
    );

    return (
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="panel">
        <div className="panel-header" style={{ flexWrap: 'wrap', gap: 16 }}>
          <h3 className="panel-title">Resident Directory</h3>
          <div style={{ display: 'flex', gap: 12, flex: 1, justifyContent: 'flex-end' }}>
            <div className="input-group" style={{ marginBottom: 0, width: '100%', maxWidth: 300 }}>
              <div style={{ position: 'relative' }}>
                <Search size={18} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-dim)' }} />
                <input
                  type="text"
                  placeholder="Search name, room, phone..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{ paddingLeft: 40, width: '100%' }}
                />
              </div>
            </div>
            <button className="btn btn-primary" onClick={() => setShowModal(true)}>
              <Plus size={18} /> New Registration
            </button>
          </div>
        </div>
        <div className="table-scroll">
          <table className="custom-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Phone</th>
                <th>Room</th>
                <th>Rent / EB</th>
                <th>Join Date</th>
                <th>Status</th>
                <th>Aadhaar</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredData.filter(t =>
                t.Name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                t.Room.toLowerCase().includes(searchQuery.toLowerCase()) ||
                t.Phone.includes(searchQuery)
              ).map((t, i) => (
                <tr key={i} className="table-row">
                  <td><span style={{ fontWeight: 600 }}>{t.Name}</span></td>
                  <td>{t.Phone}</td>
                  <td>{t.Room}</td>
                  <td>₹{t['Monthly Rent']} / ₹{t['EB Amount']}</td>
                  <td>{t['Join Date'] || 'N/A'}</td>
                  <td>
                    <span className={`status-badge ${t.Status.toLowerCase()}`}>
                      {t.Status === 'PAID' ? <CheckCircle size={12} /> : <Clock size={12} />}
                      {t.Status}
                    </span>
                  </td>
                  <td>
                    {t['Aadhaar Image'] ? (
                      <button
                        className="btn btn-glass btn-small"
                        onClick={() => window.open(getFullUrl(`/api/media/${t['Aadhaar Image']}`), '_blank')}
                        title="View Document"
                      >
                        <Camera size={14} /> View
                      </button>
                    ) : 'N/A'}
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        className="btn btn-glass btn-small"
                        onClick={() => handleDownloadReceipt(t)}
                        title="Download PDF Receipt"
                        style={{ color: 'var(--secondary)' }}
                      >
                        <CreditCard size={14} />
                      </button>
                      <button
                        className="btn btn-glass btn-small"
                        onClick={() => handleNotifyIndividual(t)}
                        title="Send Bill to WhatsApp"
                      >
                        <Bell size={14} />
                      </button>
                      {t.Status !== 'PAID' && (
                        <button
                          className="btn btn-glass btn-small"
                          onClick={() => handleRecordPayment(t)}
                          title="Mark as Paid"
                          style={{ color: 'var(--secondary)' }}
                        >
                          <CheckCircle size={14} />
                        </button>
                      )}
                      <button className="btn btn-glass btn-small" onClick={() => { setSelectedTenant(t); setShowModal(true); }}><Edit3 size={14} /></button>
                      <button className="btn btn-glass btn-small" style={{ color: 'var(--accent)' }} onClick={() => handleDelete(t)}><Trash2 size={14} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </motion.div>
    );
  };

  // Helper to extract capacity
  const getCapacity = (sharingType) => {
    if (!sharingType) return 1;
    const lower = sharingType.toLowerCase();
    if (lower.includes('1') || lower.includes('one')) return 1;
    if (lower.includes('2') || lower.includes('two')) return 2;
    if (lower.includes('3') || lower.includes('three')) return 3;
    if (lower.includes('4') || lower.includes('four')) return 4;
    return 1; // Default
  };

  const renderMap = () => {
    // Filter by location first
    const propertyTenants = currentLocation === 'All' ? tenants : tenants.filter(t => t.Location === currentLocation);

    // Group by Floor -> Then by Room
    const floorMap = {};
    const unassignedRooms = {};

    propertyTenants.forEach(t => {
      // Infer Floor if not explicit: 101 -> 1st Floor, 201 -> 2nd Floor, G1 -> Ground
      let floor = t.Floor;
      if (!floor) {
        if (t.Room.startsWith('G')) floor = 'Ground Floor';
        else if (t.Room.length === 3) floor = `${t.Room[0]}st Floor`; // e.g. 101 -> 1st
        else floor = 'Other Floors';
      }

      if (!floorMap[floor]) floorMap[floor] = {};

      const uniqueRoomKey = t.Room; // Just room number
      if (!floorMap[floor][uniqueRoomKey]) {
        floorMap[floor][uniqueRoomKey] = {
          details: t, // Keep one tenant ref for room meta (sharing type, etc)
          occupants: []
        };
      }
      floorMap[floor][uniqueRoomKey].occupants.push(t);
    });

    const sortedFloors = Object.keys(floorMap).sort();

    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <h3 className="panel-title">Live Room Mapping</h3>
          <div style={{ display: 'flex', gap: 16 }}>
            <div className="status-badge" style={{ background: 'var(--bg-card)', color: 'var(--text-main)', border: '1px solid var(--glass-border)' }}>Total: {propertyTenants.length} Residents</div>
          </div>
        </div>

        {sortedFloors.map(floor => {
          const rooms = floorMap[floor];
          return (
            <div key={floor} className="floor-section" style={{ marginBottom: 40 }}>
              <h4 style={{ color: 'var(--secondary)', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8, textTransform: 'uppercase', letterSpacing: '1px' }}>
                <LayoutDashboard size={18} /> {floor}
              </h4>
              <div className="kanban-board" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '20px' }}>
                {Object.keys(rooms).sort().map(roomNum => {
                  const roomData = rooms[roomNum];
                  const occupants = roomData.occupants;
                  const capacity = getCapacity(roomData.details['Sharing Type']);
                  const vacancy = capacity - occupants.length;

                  // Generate Visual Dots
                  const dots = [];
                  for (let i = 0; i < capacity; i++) {
                    if (i < occupants.length) {
                      // Occupied
                      const occ = occupants[i];
                      dots.push(
                        <div key={i} title={occ.Name} style={{
                          width: 12, height: 12, borderRadius: '50%',
                          background: occ.Status === 'PAID' ? 'var(--secondary)' : 'var(--accent)',
                          border: '2px solid rgba(0,0,0,0.2)'
                        }}></div>
                      );
                    } else {
                      // Vacant
                      dots.push(
                        <div key={i} title="Vacant" style={{
                          width: 12, height: 12, borderRadius: '50%',
                          background: 'transparent',
                          border: '2px dashed var(--text-dim)'
                        }}></div>
                      );
                    }
                  }

                  return (
                    <div key={roomNum} className="room-card" style={{ minWidth: 'unset', borderTop: vacancy > 0 ? '3px solid var(--secondary)' : '1px solid var(--glass-border)' }}>
                      <div className="room-header" style={{ marginBottom: 8 }}>
                        <span className="room-number" style={{ fontSize: '1.2rem' }}>{roomNum}</span>
                        <div style={{ display: 'flex', gap: 4 }}>{dots}</div>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-dim)', marginBottom: 12 }}>
                        <span>{roomData.details['Sharing Type']}</span>
                        <span style={{ color: vacancy > 0 ? 'var(--secondary)' : 'var(--text-dim)', fontWeight: 700 }}>
                          {vacancy > 0 ? `${vacancy} VACANT` : 'FULL'}
                        </span>
                      </div>
                      <div className="resident-list">
                        {occupants.map((occ, idx) => (
                          <div key={idx} className="resident-tag" style={{
                            display: 'flex', justifyContent: 'space-between',
                            borderLeft: `3px solid ${occ.Status === 'PAID' ? 'var(--secondary)' : 'var(--accent)'}`,
                            background: occ.Status === 'PAID' ? 'rgba(16, 185, 129, 0.05)' : 'rgba(244, 63, 94, 0.05)'
                          }}>
                            <span>{occ.Name}</span>
                            <span style={{ fontSize: '0.65rem', opacity: 0.7 }}>{occ.Status}</span>
                          </div>
                        ))}
                        {vacancy > 0 && Array(vacancy).fill(0).map((_, i) => (
                          <div key={`vacant-${i}`} style={{ padding: '4px 8px', borderRadius: 6, border: '1px dashed var(--glass-border)', color: 'var(--text-dim)', fontSize: '0.75rem', textAlign: 'center' }}>
                            <i>Empty Bed</i>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
        {propertyTenants.length === 0 && (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-dim)' }}>
            No rooms found for this location.
          </div>
        )}
      </motion.div>
    );
  };

  const renderTools = () => (
    <div className="content-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
      <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="panel">
        <h3 className="panel-title" style={{ marginBottom: 20 }}><Zap size={18} /> EB Auto Split Tool</h3>
        <p style={{ color: 'var(--text-dim)', fontSize: '0.9rem', marginBottom: 24 }}>Calculate and split electricity bills for a specific room automatically.</p>
        <div className="input-group">
          <label>Room Number</label>
          <input type="text" placeholder="e.g. G1" value={ebForm.room} onChange={e => setEbForm({ ...ebForm, room: e.target.value })} />
        </div>
        <div className="input-group">
          <label>Units Consumed</label>
          <input type="number" placeholder="100" value={ebForm.amount} onChange={e => setEbForm({ ...ebForm, amount: e.target.value })} />
        </div>
        <button className="btn btn-primary" style={{ width: '100%' }} onClick={handleUpdateEB}>Calculate (x15) & Notify Residents</button>
      </motion.div>

      <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="panel">
        <h3 className="panel-title" style={{ marginBottom: 20 }}><Megaphone size={18} /> Smart Announcements</h3>
        <p style={{ color: 'var(--text-dim)', fontSize: '0.9rem', marginBottom: 24 }}>Broadcast important updates to all active residents on WhatsApp.</p>
        <div className="input-group">
          <label>Message</label>
          <textarea rows="5" placeholder="Type your announcement here..." value={announceForm} onChange={e => setAnnounceForm(e.target.value)} style={{ width: '100%', borderRadius: 12, border: '1px solid var(--glass-border)', background: 'rgba(255,255,255,0.03)', color: 'white', padding: 12 }} />
        </div>
        <button className="btn btn-success" style={{ width: '100%', background: 'var(--secondary)' }} onClick={handleAnnounce}>Send WhatsApp Broadcast</button>
      </motion.div>
    </div>
  );

  const renderLocations = () => {
    // Get unique locations from tenants
    const uniqueLocations = [...new Set(tenants.map(t => t.Location || 'Main Branch'))];

    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="locations-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '24px' }}>
        {uniqueLocations.map((loc, idx) => {
          const locTenants = tenants.filter(t => (t.Location || 'Main Branch') === loc);
          const activeLocTenants = locTenants.filter(t => t.Status !== 'VACATED');
          const totalRooms = new Set(locTenants.map(t => t.Room)).size;

          // Sharing Stats
          let sharingCounts = { '1 Sharing': 0, '2 Sharing': 0, '3 Sharing': 0, '4 Sharing': 0 };
          activeLocTenants.forEach(t => {
            let type = t['Sharing Type'] || 'Unknown';
            if (type.includes('1') || type.toLowerCase().includes('one')) sharingCounts['1 Sharing']++;
            else if (type.includes('2') || type.toLowerCase().includes('two')) sharingCounts['2 Sharing']++;
            else if (type.includes('3') || type.toLowerCase().includes('three')) sharingCounts['3 Sharing']++;
            else if (type.includes('4') || type.toLowerCase().includes('four')) sharingCounts['4 Sharing']++;
          });

          // Determine Display Names
          const displayName = loc === 'Main Branch' ? 'Kavitha PG' : loc;
          const areaName = loc === 'Main Branch' ? 'Ekkatuthangal, Chennai' : 'Chennai, Tamil Nadu';
          const searchQuery = loc === 'Main Branch' ? 'Kavitha PG Ekkatuthangal Chennai' : `${loc} Chennai`;

          return (
            <div key={idx} className="panel">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
                <div>
                  <h3 className="panel-title" style={{ fontSize: '1.2rem', marginBottom: 4 }}>
                    <MapPin size={18} style={{ marginRight: 8, color: 'var(--primary)' }} />
                    {displayName}
                  </h3>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-dim)', marginLeft: 26 }}>{areaName}</p>
                </div>
                <span className="status-badge paid">{activeLocTenants.length} Active</span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
                <div style={{ background: 'rgba(255,255,255,0.03)', padding: 12, borderRadius: 12 }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginBottom: 4 }}>TOTAL ROOMS</div>
                  <div style={{ fontSize: '1.2rem', fontWeight: 800 }}>{totalRooms}</div>
                </div>
                <div style={{ background: 'rgba(255,255,255,0.03)', padding: 12, borderRadius: 12 }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginBottom: 4 }}>OCCUPANCY</div>
                  <div style={{ fontSize: '1.2rem', fontWeight: 800 }}>{Math.round((activeLocTenants.length / (totalRooms * 2)) * 100) || 0}%</div>
                </div>
              </div>

              <div style={{ borderTop: '1px solid var(--glass-border)', paddingTop: 16 }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '1px' }}>Sharing Breakdown</div>
                {Object.keys(sharingCounts).map(key => (
                  <div key={key} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: '0.85rem' }}>
                    <span>{key}</span>
                    <span style={{ fontWeight: 600 }}>{sharingCounts[key]}</span>
                  </div>
                ))}
              </div>

              <div style={{ marginTop: 20, borderRadius: 12, overflow: 'hidden', border: '1px solid var(--glass-border)', position: 'relative' }}>
                <div style={{ position: 'absolute', top: 10, left: 10, background: 'rgba(0,0,0,0.6)', padding: '4px 8px', borderRadius: 4, fontSize: '0.7rem', color: 'white', zIndex: 10 }}>{areaName}</div>
                <iframe
                  width="100%"
                  height="160"
                  frameBorder="0"
                  scrolling="no"
                  marginHeight="0"
                  marginWidth="0"
                  title="Location Map"
                  src={`https://maps.google.com/maps?q=${encodeURIComponent(searchQuery)}&t=&z=14&ie=UTF8&iwloc=&output=embed`}
                  style={{ filter: 'invert(90%) hue-rotate(180deg)' }}
                ></iframe>
              </div>
            </div>
          );
        })}
      </motion.div>
    );
  };

  const renderActionPanel = () => (
    <AnimatePresence>
      {actionPanel && (
        <div className="modal-backdrop" onClick={() => setActionPanel(null)} style={{ justifyContent: 'flex-end', padding: 0, zIndex: 10000 }}>
          <motion.div
            initial={{ x: '100%', opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: '100%', opacity: 0 }}
            className="panel"
            onClick={e => e.stopPropagation()}
            style={{
              width: '100%', maxWidth: 400, height: '100vh',
              borderRadius: 0, margin: 0, display: 'flex', flexDirection: 'column',
              borderLeft: '1px solid var(--glass-border)',
              background: 'rgba(15, 23, 42, 0.98)', backdropFilter: 'blur(20px)',
              position: 'relative'
            }}
          >
            <div className="panel-header" style={{ marginBottom: 30, padding: '24px 24px 0' }}>
              <h3 className="panel-title">{actionPanel.title}</h3>
              <button className="btn btn-glass btn-small" onClick={() => setActionPanel(null)}><LogOut size={16} /></button>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '0 24px' }}>
              {actionPanel.type === 'confirm' && (
                <div style={{ padding: '20px 0', textAlign: 'center' }}>
                  <div style={{ width: 60, height: 60, borderRadius: '50%', background: 'rgba(244, 63, 94, 0.1)', color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
                    <AlertCircle size={30} />
                  </div>
                  <p style={{ color: 'var(--text-main)', fontSize: '1rem', lineHeight: 1.6 }}>{actionPanel.message}</p>
                </div>
              )}

              {actionPanel.type === 'payment' && (
                <div style={{ padding: '20px 0' }}>
                  <div className="input-group">
                    <label>Amount Received (₹)</label>
                    <input
                      type="number"
                      value={actionPanel.input}
                      onChange={e => setActionPanel({ ...actionPanel, input: e.target.value })}
                      autoFocus
                      style={{ width: '100%', padding: '12px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--glass-border)', borderRadius: '12px', color: 'white' }}
                    />
                  </div>
                  <div className="input-group" style={{ marginTop: 24 }}>
                    <label>Payment Mode</label>
                    <select
                      className="custom-select"
                      value={actionPanel.input2}
                      onChange={e => setActionPanel({ ...actionPanel, input2: e.target.value })}
                      style={{ width: '100%', padding: 12, borderRadius: 12, background: 'rgba(255,255,255,0.05)', color: 'white', border: '1px solid var(--glass-border)' }}
                    >
                      <option value="UPI">UPI Payment</option>
                      <option value="CASH">Cash Payment</option>
                      <option value="BANK">Bank Transfer</option>
                    </select>
                  </div>
                  <div style={{ marginTop: 30, background: 'rgba(255,255,255,0.03)', padding: 16, borderRadius: 12, border: '1px solid var(--glass-border)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: '0.85rem' }}>
                      <span style={{ color: 'var(--text-dim)' }}>Resident:</span>
                      <span style={{ fontWeight: 600 }}>{actionPanel.data?.Name}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                      <span style={{ color: 'var(--text-dim)' }}>Room:</span>
                      <span style={{ fontWeight: 600 }}>{actionPanel.data?.Room}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div style={{ padding: 24, display: 'flex', gap: 12, borderTop: '1px solid var(--glass-border)', background: 'rgba(255,255,255,0.02)' }}>
              <button
                className={`btn ${actionPanel.title.includes('Delete') ? 'btn-accent' : 'btn-primary'}`}
                style={{ flex: 2, background: actionPanel.title.includes('Delete') ? 'var(--accent)' : 'var(--secondary)', color: 'white', height: '48px', fontWeight: 600 }}
                onClick={() => actionPanel.onConfirm(actionPanel.input, actionPanel.input2)}
              >
                Confirm
              </button>
              <button className="btn btn-glass" style={{ flex: 1, height: '48px' }} onClick={() => setActionPanel(null)}>Cancel</button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );

  return (
    <div className="dashboard-container">
      <div className="sidebar">
        <div className="logo-section">
          <div className="logo-blob"><Zap fill="currentColor" size={20} /></div>
          <span className="logo-text">StayFlow</span>
        </div>
        <nav className="nav-links">
          <div className={`nav-link ${activeTab === 'dashboard' ? 'active' : ''}`} onClick={() => setActiveTab('dashboard')}><LayoutDashboard size={20} /> Dashboard</div>
          <div className={`nav-link ${activeTab === 'tenants' ? 'active' : ''}`} onClick={() => setActiveTab('tenants')}><Users size={20} /> Members</div>
          <div className={`nav-link ${activeTab === 'map' ? 'active' : ''}`} onClick={() => setActiveTab('map')}><MapPin size={20} /> Room Map</div>
          <div className={`nav-link ${activeTab === 'locations' ? 'active' : ''}`} onClick={() => setActiveTab('locations')}><MapPin size={20} /> Locations</div>
          <div className={`nav-link ${activeTab === 'tools' ? 'active' : ''}`} onClick={() => setActiveTab('tools')}><Zap size={20} /> Auto-Tools</div>
          <div className={`nav-link ${activeTab === 'settings' ? 'active' : ''}`} onClick={() => setActiveTab('settings')}><Settings size={20} /> App Settings</div>
        </nav>
        <div style={{ marginTop: 'auto', padding: '20px', background: 'rgba(255,255,255,0.02)', borderRadius: 20, border: '1px solid var(--glass-border)' }}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#10b981' }}></div>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--secondary)' }}>SERVER ACTIVE</span>
          </div>
          <p style={{ fontSize: '0.7rem', color: 'var(--text-dim)', marginTop: 4 }}>Last sync: moments ago</p>
        </div>
      </div>

      <main className="main-viewport">
        <header>
          <div className="header-meta">
            <h1>{activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}</h1>
            <p>Welcome back, Owner. Here's what's happening at StayFlow.</p>
          </div>
          <div className="header-actions">
            <select
              className="location-select"
              value={currentLocation}
              onChange={(e) => setCurrentLocation(e.target.value)}
            >
              {locations.map(loc => <option key={loc} value={loc}>{loc}</option>)}
            </select>
            <div style={{ position: 'relative' }}>
              <Search style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-dim)' }} size={16} />
              <input type="text" placeholder="Search anything..." style={{ padding: '10px 10px 10px 38px', borderRadius: 12, border: '1px solid var(--glass-border)', background: 'rgba(255,255,255,0.05)', color: 'white', fontSize: '0.85rem' }} />
            </div>
            <button className="btn btn-primary"><Bell size={18} /></button>
          </div>
          {/* Toast Notification Overlay */}
          {toast && (
            <div style={{
              position: 'fixed', top: 30, right: 30, zIndex: 9999,
              background: toast.type === 'error' ? 'var(--accent)' : '#10b981',
              color: '#fff', padding: '10px 20px', borderRadius: 8,
              boxShadow: '0 5px 15px rgba(0,0,0,0.3)',
              display: 'flex', alignItems: 'center', gap: 10,
              fontSize: '0.9rem', fontWeight: 500,
              animation: 'slideIn 0.3s ease-out'
            }}>
              {toast.type === 'error' ? <AlertCircle size={18} /> : <CheckCircle size={18} />}
              {toast.message}
            </div>
          )}
        </header>

        {loading ? (
          <div style={{ height: '50vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div className="logo-blob animated" style={{ width: 60, height: 60 }}>
              <Zap size={30} />
            </div>
          </div>
        ) : (
          <>
            {activeTab === 'dashboard' && renderDashboard()}
            {activeTab === 'tenants' && renderTenants()}
            {activeTab === 'map' && renderMap()}
            {activeTab === 'locations' && renderLocations()}
            {activeTab === 'tools' && renderTools()}
          </>
        )}
        {renderActionPanel()}
      </main>

      {showModal && (
        <div className="modal-backdrop">
          <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="modal-content">
            <h2 className="modal-title">{selectedTenant ? 'Edit Resident' : 'Add New Resident'}</h2>
            <div className="input-group">
              <label>Full Name</label>
              <input
                type="text"
                defaultValue={selectedTenant?.Name}
                onChange={(e) => handleEditChange('Name', e.target.value)}
              />
            </div>
            <div className="input-group">
              <label>Phone Number</label>
              <input
                type="text"
                defaultValue={selectedTenant?.Phone}
                onChange={(e) => handleEditChange('Phone', e.target.value)}
              />
            </div>

            {/* Aadhaar Upload Section */}
            <div className="input-group">
              <label>Aadhaar Card Upload</label>
              <div style={{ display: 'flex', gap: 10 }}>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setEditData({ ...editData, aadhaarFile: e.target.files[0] })}
                />
              </div>
            </div>

            <div className="input-group">
              <label>Room Number</label>
              <input
                type="text"
                defaultValue={selectedTenant?.Room}
                onChange={(e) => handleEditChange('Room', e.target.value)}
                placeholder="Assign a room (e.g. 101)"
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div className="input-group">
                <label>Sharing Type</label>
                <select
                  className="custom-select"
                  defaultValue={selectedTenant?.['Sharing Type'] || '1 Sharing'}
                  onChange={(e) => handleEditChange('Sharing Type', e.target.value)}
                  style={{ width: '100%', padding: 12, borderRadius: 12, background: 'rgba(255,255,255,0.05)', color: 'white', border: '1px solid var(--glass-border)' }}
                >
                  <option value="1 Sharing">1 Sharing</option>
                  <option value="2 Sharing">2 Sharing</option>
                  <option value="3 Sharing">3 Sharing</option>
                  <option value="4 Sharing">4 Sharing</option>
                </select>
              </div>
              <div className="input-group">
                <label>PG Location</label>
                <input
                  type="text"
                  defaultValue={selectedTenant?.Location}
                  onChange={(e) => handleEditChange('Location', e.target.value)}
                  placeholder="e.g. Main Branch"
                />
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div className="input-group">
                <label>Rent (₹)</label>
                <input
                  type="number"
                  defaultValue={selectedTenant?.['Monthly Rent']}
                  onChange={(e) => handleEditChange('Monthly Rent', e.target.value)}
                />
              </div>
              <div className="input-group">
                <label>EB Bill (₹)</label>
                <input
                  type="number"
                  defaultValue={selectedTenant?.['EB Amount']}
                  onChange={(e) => handleEditChange('EB Amount', e.target.value)}
                />
              </div>
            </div>
            <div className="input-group">
              <label>Join Date</label>
              <input type="text" defaultValue={selectedTenant?.['Join Date']} disabled />
            </div>
            <div style={{ display: 'flex', gap: 12, marginTop: 10 }}>
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleSave}>Save Details</button>
              <button className="btn btn-glass" onClick={() => { setShowModal(false); setEditData({}); }}>Cancel</button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
};

export default App;
