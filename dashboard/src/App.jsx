import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  Users, Wallet, Clock, Zap, Bell, Megaphone, Settings,
  Search, Edit3, Trash2, CheckCircle, AlertCircle, MapPin,
  ChevronRight, Plus, LogOut, LayoutDashboard, CreditCard,
  UserPlus, UserMinus, Camera, Send, Save, FileText, RefreshCw,
  Menu, X
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, AreaChart, Area
} from 'recharts';
import { motion, AnimatePresence, useMotionValue, useMotionTemplate } from 'framer-motion';
import './App.css';

// --- ReactBits Inspired Premium Components ---

const SpotlightCard = ({ children, className = "", style = {} }) => {
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  function handleMouseMove({ currentTarget, clientX, clientY }) {
    let { left, top } = currentTarget.getBoundingClientRect();
    mouseX.set(clientX - left);
    mouseY.set(clientY - top);
  }

  return (
    <motion.div
      onMouseMove={handleMouseMove}
      className={`stat-card group ${className}`}
      style={{ ...style, position: 'relative' }}
    >
      <motion.div
        className="pointer-events-none absolute -inset-px rounded-24 opacity-0 transition duration-500 group-hover:opacity-100"
        style={{
          zIndex: 0,
          background: useMotionTemplate`
            radial-gradient(
              400px circle at ${mouseX}px ${mouseY}px,
              rgba(99, 102, 241, 0.15),
              transparent 80%
            )
          `,
        }}
      />
      <div style={{ position: 'relative', zIndex: 1 }}>
        {children}
      </div>
    </motion.div>
  );
};

const SplitText = ({ text, delay = 0 }) => {
  const characters = text.split("");
  return (
    <motion.span
      initial="hidden"
      animate="visible"
      variants={{
        visible: {
          transition: {
            staggerChildren: 0.03,
            delayChildren: delay,
          },
        },
      }}
    >
      {characters.map((char, i) => (
        <motion.span
          key={i}
          variants={{
            hidden: { opacity: 0, y: 15, filter: 'blur(4px)' },
            visible: { opacity: 1, y: 0, filter: 'blur(0px)' },
          }}
          transition={{ duration: 0.5, ease: [0.2, 0.8, 0.2, 1] }}
          style={{ display: "inline-block" }}
        >
          {char === " " ? "\u00A0" : char}
        </motion.span>
      ))}
    </motion.span>
  );
};

const InteractiveGrid = () => {
  return (
    <div className="interactive-grid-bg">
      <div className="grid-overlay"></div>
    </div>
  );
};

const ShinyButton = ({ children, onClick, className = "", style = {} }) => {
  return (
    <motion.button
      whileHover={{ scale: 1.02, y: -2 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className={`shiny-btn ${className}`}
      style={style}
    >
      <span className="shiny-btn-inner">
        {children}
      </span>
      <div className="shiny-sweep"></div>
    </motion.button>
  );
};

// Configure Axios Base URL for Production
const API_BASE_URL = import.meta.env.VITE_API_URL ||
  (window.location.hostname.includes('vercel.app')
    ? 'https://stayflow-tkto.onrender.com'
    : '');

axios.defaults.baseURL = API_BASE_URL;
const ADMIN_API_KEY = import.meta.env.VITE_ADMIN_API_KEY || 'stayflow_dev_key_123';
axios.defaults.headers.common['X-API-Key'] = ADMIN_API_KEY;

const getFullUrl = (path) => {
  if (!path) return '';
  if (path.startsWith('http')) return path;
  return `${API_BASE_URL.replace(/\/$/, '')}${path.startsWith('/') ? '' : '/'}${path}`;
};

const App = () => {
  const [tenants, setTenants] = useState([]);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [selectedTenant, setSelectedTenant] = useState(null);
  const [ebForm, setEbForm] = useState({ room: '', amount: '' });
  const [announceForm, setAnnounceForm] = useState('');
  const [announceFile, setAnnounceFile] = useState(null);
  const [editData, setEditData] = useState({});
  const [searchQuery, setSearchQuery] = useState('');
  const [currentLocation, setCurrentLocation] = useState('All');
  const [loadingPdf, setLoadingPdf] = useState(false);
  const [toast, setToast] = useState(null); // { message, type: 'success'|'error' }
  const [actionPanel, setActionPanel] = useState(null); // { type, title, message, data, input, input2 }
  const [archivedTenants, setArchivedTenants] = useState([]);
  const [syncing, setSyncing] = useState(false);
  const [configData, setConfigData] = useState(null);
  const [locationsData, setLocationsData] = useState([]);
  const [bulkEB, setBulkEB] = useState({});  // { phone: newEBValue }
  const [billingLoading, setBillingLoading] = useState(false);
  const [billingProgress, setBillingProgress] = useState({ current: 0, total: 0, status: '' });
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };


  useEffect(() => {
    fetchData();
    fetchArchivedData();
    fetchConfig();
    fetchLocations();
  }, []);

  const fetchLocations = async () => {
    try {
      const res = await axios.get('/api/locations');
      setLocationsData(res.data);
    } catch (err) {
      console.error('Error fetching locations:', err);
    }
  };

  const fetchConfig = async () => {
    try {
      const res = await axios.get('/api/config');
      setConfigData(res.data);
    } catch (err) {
      console.error('Error fetching config:', err);
    }
  };

  const handleEditChange = (key, val) => {
    setEditData({ ...editData, [key]: val });
  };

  const handleSave = async () => {
    try {
      let targetPhone = '';

      if (selectedTenant) {
        // --- EDIT MODE ---
        const newStatus = editData.Status !== undefined ? editData.Status : selectedTenant.Status;
        const oldStatus = selectedTenant.Status;
        const paymentMode = editData['Payment Mode'] !== undefined ? editData['Payment Mode'] : (selectedTenant['Payment Mode'] || 'CASH');
        const resolvedName = editData.Name !== undefined ? editData.Name : selectedTenant.Name;
        const resolvedPhone = editData.Phone !== undefined ? editData.Phone : selectedTenant.Phone;
        const resolvedRent = editData['Monthly Rent'] !== undefined ? editData['Monthly Rent'] : selectedTenant['Monthly Rent'];
        const resolvedEB = (editData['EB Amount'] !== undefined ? editData['EB Amount'] : selectedTenant['EB Amount']) || '0';

        const payload = {
          oldPhone: selectedTenant.Phone,
          oldName: selectedTenant.Name,
          newPhone: resolvedPhone,
          name: resolvedName,
          rent: resolvedRent,
          eb: resolvedEB,
          sharingType: editData['Sharing Type'] !== undefined ? editData['Sharing Type'] : selectedTenant['Sharing Type'],
          location: editData.Location !== undefined ? editData.Location : selectedTenant.Location,
          room: editData.Room !== undefined ? editData.Room : selectedTenant.Room,
          status: newStatus,
        };
        await axios.post('/api/update-and-notify', payload);
        targetPhone = payload.newPhone;

        // If status changed to PAID/VALID from non-paid, call mark-paid for proper payment recording
        const wasPaid = oldStatus === 'PAID' || oldStatus === 'VALID';
        const nowPaid = newStatus === 'PAID' || newStatus === 'VALID';
        if (nowPaid && !wasPaid) {
          const totalAmount = parseFloat(resolvedRent || 0) + parseFloat(resolvedEB || 0);
          await axios.post('/api/mark-paid', {
            phone: resolvedPhone,
            name: resolvedName,
            amount: totalAmount.toString(),
            mode: paymentMode,
          });
        }
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
      setSelectedTenant(null);
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
      console.log('Fetching data from:', axios.defaults.baseURL || 'relative');
      const res = await axios.get('/api/tenants');
      if (Array.isArray(res.data)) {
        setTenants(res.data);
      } else {
        console.error('Expected array but got:', res.data);
        setTenants([]);
      }
      setLoading(false);
    } catch (err) {
      console.error('Error fetching tenants:', err);
      setLoading(false);
      showToast('Connection failed: ' + (err.response?.statusText || err.message), 'error');
    }
  };

  const fetchArchivedData = async () => {
    try {
      const res = await axios.get('/api/archived-tenants');
      setArchivedTenants(res.data);
    } catch (err) {
      console.error('Error fetching archived tenants:', err);
    }
  };

  const handleSyncToMongo = async () => {
    try {
      setSyncing(true);
      const res = await axios.post('/api/sync-to-mongo');
      showToast(`Successfully synced ${res.data.count} tenants to MongoDB!`);
      fetchArchivedData();
      setSyncing(false);
    } catch (err) {
      setSyncing(false);
      showToast('Sync failed: ' + err.message, 'error');
    }
  };

  // Stats Logic
  const locations = ['All', ...new Set(tenants.map(t => t.Location).filter(Boolean))];
  const filteredData = currentLocation === 'All' ? tenants : tenants.filter(t => t.Location === currentLocation);

  const activeTenants = filteredData.filter(t => t.Status !== 'VACATED');
  const paidCount = activeTenants.filter(t => t.Status === 'PAID' || t.Status === 'VALID').length;
  const pendingCount = activeTenants.filter(t => t.Status === 'PENDING').length;
  const unpaidCount = activeTenants.filter(t => t.Status === 'ACTIVE' || !t.Status).length;
  const totalRevenue = filteredData.filter(t => t.Status === 'PAID' || t.Status === 'VALID').reduce((sum, t) => sum + parseFloat(t['Total Amount'] || 0), 0);

  const _targetLocations = currentLocation === 'All' 
    ? locationsData 
    : locationsData.filter(l => l.name === currentLocation);
  
  const totalBeds = _targetLocations.reduce((sum, l) => sum + parseInt(l.totalBeds || 0), 0);
  const occupiedBeds = _targetLocations.reduce((sum, l) => sum + parseInt(l.occupiedBeds || 0), 0);
  const vacantBeds = Math.max(0, totalBeds - occupiedBeds);

  const uniqueRooms = [...new Set(tenants.map(t => t.Room).filter(Boolean))];
  const stats = [
    { label: 'Residents', value: activeTenants.length, icon: Users, color: '#6366f1', bg: 'rgba(99, 102, 241, 0.08)' },
    { label: 'Collection', value: `₹${totalRevenue.toLocaleString()}`, icon: Wallet, color: '#10b981', bg: 'rgba(16, 185, 129, 0.08)' },
    { label: 'Pending Verif', value: pendingCount, icon: Clock, color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.08)' },
    { label: 'Unpaid', value: unpaidCount, icon: AlertCircle, color: '#f43f5e', bg: 'rgba(244, 63, 94, 0.08)' },
    { label: 'Vacant Beds', value: vacantBeds > 0 ? vacantBeds : 'Full', icon: MapPin, color: '#10b981', bg: 'rgba(16, 185, 129, 0.08)' },
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

  // ========== MONTHLY BILLING: Save All EB & Notify All ==========
  const handleBulkSaveAndNotify = () => {
    const modifiedCount = Object.keys(bulkEB).length;
    const unpaidTenants = activeTenants.filter(t => t.Status !== 'PAID' && t.Status !== 'VALID' && t.Status !== 'VACATED');

    setActionPanel({
      type: 'confirm',
      title: '💡 Save EB & Send Invoices',
      message: modifiedCount > 0
        ? `You've updated EB for ${modifiedCount} tenant(s). This will:\n\n1. Save all EB amounts to the sheet\n2. Generate invoices for ALL active tenants\n3. Send WhatsApp notifications with payment links\n\nProceed?`
        : `No EB changes detected. This will:\n\n1. Generate invoices for ALL active tenants\n2. Send WhatsApp notifications with payment links\n\nProceed?`,
      onConfirm: async () => {
        setActionPanel(null);
        setBillingLoading(true);
        setBillingProgress({ current: 0, total: 0, status: 'Saving EB bills...' });

        try {
          // Step 1: Save all modified EB amounts
          if (modifiedCount > 0) {
            const updates = Object.entries(bulkEB).map(([phone, eb]) => {
              const tenant = tenants.find(t => t.Phone === phone);
              return { phone, name: tenant?.Name, eb: eb.toString() };
            });

            await axios.post('/api/bulk-update-eb', { updates });
            setBillingProgress({ current: 0, total: 0, status: `✅ ${modifiedCount} EB bills saved!` });
            await new Promise(r => setTimeout(r, 800));
          }

          // Step 2: Trigger notifications for all tenants
          setBillingProgress({ current: 0, total: 0, status: 'Sending invoices to all tenants...' });
          await axios.post('/api/trigger-notifications');

          setBillingProgress({ current: 0, total: 0, status: '✅ All invoices sent!' });
          showToast('EB bills saved & invoices sent to all tenants! 🎉');
          setBulkEB({});
          fetchData();

          setTimeout(() => {
            setBillingLoading(false);
            setBillingProgress({ current: 0, total: 0, status: '' });
          }, 2000);

        } catch (err) {
          setBillingLoading(false);
          setBillingProgress({ current: 0, total: 0, status: '' });
          showToast('Failed: ' + (err.response?.data?.error || err.message), 'error');
        }
      }
    });
  };

  const handleSingleBillNotify = async (tenant) => {
    try {
      // Update EB if modified
      const newEB = bulkEB[tenant.Phone];
      if (newEB !== undefined) {
        await axios.post('/api/update-bill', {
          phone: tenant.Phone,
          name: tenant.Name,
          rent: tenant['Monthly Rent'],
          eb: newEB.toString()
        });
      }
      // Send notification
      await axios.post('/api/notify-tenant', { phone: tenant.Phone, name: tenant.Name });
      showToast(`Invoice sent to ${tenant.Name}! ✅`);
      fetchData();
    } catch (err) {
      showToast('Failed to notify ' + tenant.Name, 'error');
    }
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
    if (!announceForm && !announceFile) return;
    try {
      const formData = new FormData();
      formData.append('message', announceForm);
      if (announceFile) {
        formData.append('file', announceFile);
      }

      await axios.post('/api/announcement', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      showToast('Announcement sent to WhatsApp group!');
      setAnnounceForm('');
      setAnnounceFile(null);
    } catch (err) {
      const errorMsg = err.response?.data?.error || err.message;
      showToast(`Announcement failed: ${errorMsg}`, 'error');
    }
  };

  const renderDashboard = () => {
    const unpaidTenants = activeTenants.filter(t => t.Status !== 'PAID' && t.Status !== 'VALID');
    const paidTenants = activeTenants.filter(t => t.Status === 'PAID' || t.Status === 'VALID');
    const collectionRate = activeTenants.length > 0 ? Math.round((paidTenants.length / activeTenants.length) * 100) : 0;

    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
        {/* Stats Grid - 5 cards aligned */}
        <div className="stats-grid">
          {stats.map((stat, idx) => (
            <SpotlightCard key={idx}>
              <div className="stat-icon-wrap" style={{ backgroundColor: stat.bg, color: stat.color }}>
                <stat.icon size={20} />
              </div>
              <p className="stat-label">{stat.label}</p>
              <p className="stat-value">{stat.value}</p>
            </SpotlightCard>
          ))}
        </div>

        {/* Main Content */}
        <div className="content-grid">
          {/* Recent Activity Table */}
          <div className="panel">
            <div className="panel-header">
              <h3 className="panel-title">Recent Activity</h3>
              <ShinyButton className="btn-small" onClick={handleNotifyAll}>
                <Bell size={14} /> Notify All
              </ShinyButton>
            </div>
            <div className="table-scroll">
              <table className="custom-table">
                <thead>
                  <tr>
                    <th>Resident</th>
                    <th>Room</th>
                    <th>Rent / EB</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {activeTenants.slice(0, 8).map((t, i) => (
                    <tr key={i} className="table-row">
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{
                            width: 30, height: 30, borderRadius: 8,
                            background: (t.Status === 'PAID' || t.Status === 'VALID') ? 'var(--secondary-soft)' : 'var(--primary-soft)',
                            color: (t.Status === 'PAID' || t.Status === 'VALID') ? 'var(--secondary)' : 'var(--primary)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontWeight: 700, fontSize: '0.75rem'
                          }}>{t.Name?.[0] || '?'}</div>
                          <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>{t.Name}</span>
                        </div>
                      </td>
                      <td><span style={{ background: 'var(--primary-soft)', color: 'var(--primary)', padding: '3px 8px', borderRadius: 6, fontSize: '0.78rem', fontWeight: 600 }}>{t.Room}</span></td>
                      <td style={{ fontSize: '0.82rem', color: 'var(--text-dim)' }}>₹{t['Monthly Rent']} / ₹{t['EB Amount'] || '0'}</td>
                      <td>
                        <span className={`status-badge ${(t.Status || 'active').toLowerCase()}`}>
                          {(t.Status === 'PAID' || t.Status === 'VALID') ? <CheckCircle size={10} /> : <Clock size={10} />}
                          {t.Status || 'ACTIVE'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Right Panel - Payment Overview */}
          <div className="panel" style={{ display: 'flex', flexDirection: 'column' }}>
            <h3 className="panel-title" style={{ marginBottom: 20 }}>Payment Status</h3>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={chartData} innerRadius={55} outerRadius={80} paddingAngle={4} dataKey="value" strokeWidth={0}>
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ background: 'var(--bg-elevated)', border: '1px solid var(--glass-border)', borderRadius: 8, fontSize: '0.8rem' }} />
              </PieChart>
            </ResponsiveContainer>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 20, marginTop: 12 }}>
              {chartData.map((d, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: COLORS[i] }} />
                  <span style={{ color: 'var(--text-dim)', fontSize: '0.78rem', fontWeight: 600 }}>{d.name}: {d.value}</span>
                </div>
              ))}
            </div>

            {/* Collection Rate */}
            <div style={{ marginTop: 20, padding: 16, background: 'rgba(255,255,255,0.02)', borderRadius: 12, border: '1px solid var(--glass-border)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.8px' }}>Collection Rate</span>
                <span style={{ fontSize: '0.85rem', fontWeight: 700, color: collectionRate >= 80 ? 'var(--secondary)' : collectionRate >= 50 ? 'var(--warning)' : 'var(--accent)' }}>{collectionRate}%</span>
              </div>
              <div style={{ height: 6, background: 'rgba(255,255,255,0.05)', borderRadius: 3, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${collectionRate}%`, background: collectionRate >= 80 ? 'var(--secondary)' : collectionRate >= 50 ? 'var(--warning)' : 'var(--accent)', borderRadius: 3, transition: 'width 0.5s ease' }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 12, fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                <span>Total Rooms: {uniqueRooms.length}</span>
                <span>{paidTenants.length}/{activeTenants.length} Paid</span>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    );
  };

  const renderTenants = () => {
    const membersList = filteredData.filter(t =>
      t.Name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.Room.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.Phone.includes(searchQuery)
    );

    return (
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="panel">
        <div className="panel-header" style={{ flexWrap: 'wrap', gap: 12 }}>
          <h3 className="panel-title">Resident Directory</h3>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flex: 1, justifyContent: 'flex-end' }}>
            <div style={{ position: 'relative', maxWidth: 240, flex: 1 }}>
              <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                type="text"
                placeholder="Search name, room, phone..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  paddingLeft: 32, width: '100%', padding: '9px 12px 9px 32px',
                  borderRadius: 'var(--radius-s)', border: '1px solid var(--glass-border)',
                  background: 'rgba(255,255,255,0.03)', color: 'var(--text-main)',
                  fontSize: '0.825rem', outline: 'none'
                }}
              />
            </div>
            <ShinyButton onClick={() => { setSelectedTenant(null); setEditData({}); setShowModal(true); }}>
              <Plus size={16} /> New Registration
            </ShinyButton>
          </div>
        </div>

        {/* Summary bar */}
        <div style={{ display: 'flex', gap: 16, marginBottom: 16, fontSize: '0.78rem', color: 'var(--text-muted)' }}>
          <span>Total: <strong style={{ color: 'var(--text-main)' }}>{membersList.length}</strong></span>
          <span>Paid: <strong style={{ color: 'var(--secondary)' }}>{membersList.filter(t => t.Status === 'PAID' || t.Status === 'VALID').length}</strong></span>
          <span>Pending: <strong style={{ color: 'var(--warning)' }}>{membersList.filter(t => t.Status === 'PENDING').length}</strong></span>
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
                <th>Reg</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {membersList.map((t, i) => (
                <tr key={i} className="table-row">
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{
                        width: 28, height: 28, borderRadius: 7,
                        background: (t.Status === 'PAID' || t.Status === 'VALID') ? 'var(--secondary-soft)' : 'var(--primary-soft)',
                        color: (t.Status === 'PAID' || t.Status === 'VALID') ? 'var(--secondary)' : 'var(--primary)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontWeight: 700, fontSize: '0.7rem', flexShrink: 0,
                      }}>{t.Name?.[0] || '?'}</div>
                      <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>{t.Name}</span>
                    </div>
                  </td>
                  <td style={{ fontSize: '0.82rem', color: 'var(--text-dim)' }}>{t.Phone}</td>
                  <td><span style={{ background: 'var(--primary-soft)', color: 'var(--primary)', padding: '2px 8px', borderRadius: 6, fontSize: '0.78rem', fontWeight: 600 }}>{t.Room}</span></td>
                  <td style={{ fontSize: '0.82rem' }}>₹{t['Monthly Rent']} / ₹{t['EB Amount'] || '0'}</td>
                  <td style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>{t['Join Date'] || 'N/A'}</td>
                  <td>
                    <span className={`status-badge ${(t.Status || 'active').toLowerCase()}`}>
                      {(t.Status === 'PAID' || t.Status === 'VALID') ? <CheckCircle size={10} /> : <Clock size={10} />}
                      {t.Status || 'ACTIVE'}
                    </span>
                  </td>
                  <td>
                    {t['Aadhaar Image'] ? (
                      <button className="btn btn-glass btn-small" onClick={() => window.open(getFullUrl(`/api/media/${t['Aadhaar Image']}?key=${ADMIN_API_KEY}`), '_blank')} title="View Document">
                        <Camera size={12} /> View
                      </button>
                    ) : <span style={{ color: 'var(--text-faint)', fontSize: '0.78rem' }}>N/A</span>}
                  </td>
                  <td>
                    {t['Registration Form'] ? (
                      <button className="btn btn-glass btn-small" onClick={() => window.open(getFullUrl(`/api/media/${t['Registration Form']}?key=${ADMIN_API_KEY}`), '_blank')} title="View Registration" style={{ color: 'var(--primary)' }}>
                        <FileText size={12} /> Reg
                      </button>
                    ) : <span style={{ color: 'var(--text-faint)', fontSize: '0.78rem' }}>N/A</span>}
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button className="btn btn-glass btn-small" onClick={() => handleDownloadReceipt(t)} title="Download Receipt" style={{ padding: '5px 8px' }}><CreditCard size={13} /></button>
                      <button className="btn btn-glass btn-small" onClick={() => handleNotifyIndividual(t)} title="Send Bill" style={{ padding: '5px 8px' }}><Bell size={13} /></button>
                      {t.Status !== 'PAID' && t.Status !== 'VALID' && (
                        <button className={`btn btn-glass btn-small ${t.Status === 'PENDING' ? 'pulse-border' : ''}`} onClick={() => handleRecordPayment(t)} title={t.Status === 'PENDING' ? "Verify Payment" : "Mark Paid"} style={{ padding: '5px 8px', color: 'var(--secondary)' }}><CheckCircle size={13} /></button>
                      )}
                      <button className="btn btn-glass btn-small" onClick={() => { setSelectedTenant(t); setEditData({}); setShowModal(true); }} style={{ padding: '5px 8px' }}><Edit3 size={13} /></button>
                      <button className="btn btn-glass btn-small" style={{ color: 'var(--accent)', padding: '5px 8px' }} onClick={() => handleDelete(t)}><Trash2 size={13} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {membersList.length === 0 && (
            <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)' }}>
              <Users size={32} style={{ marginBottom: 12, opacity: 0.4 }} />
              <p style={{ fontSize: '0.9rem', fontWeight: 600 }}>No residents found</p>
              <p style={{ fontSize: '0.78rem', marginTop: 4 }}>Try a different search term or add a new registration.</p>
            </div>
          )}
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

  // ========== RENDER MONTHLY BILLING ==========
  const renderBilling = () => {
    const billingTenants = filteredData.filter(t => t.Status !== 'VACATED');
    const modifiedCount = Object.keys(bulkEB).length;
    const totalExpected = billingTenants.reduce((sum, t) => {
      const rent = parseFloat((t['Monthly Rent'] || '0').toString().replace(/[^\d.]/g, ''));
      const eb = bulkEB[t.Phone] !== undefined
        ? parseFloat(bulkEB[t.Phone] || 0)
        : parseFloat((t['EB Amount'] || '0').toString().replace(/[^\d.]/g, ''));
      return sum + rent + eb;
    }, 0);

    return (
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        {/* Summary Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginBottom: 24 }}>
          <div className="stat-card">
            <div className="stat-icon-wrap" style={{ backgroundColor: 'rgba(99, 102, 241, 0.1)', color: '#6366f1' }}>
              <Users size={22} />
            </div>
            <p className="stat-label">Active Tenants</p>
            <p className="stat-value">{billingTenants.length}</p>
          </div>
          <div className="stat-card">
            <div className="stat-icon-wrap" style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)', color: '#10b981' }}>
              <Wallet size={22} />
            </div>
            <p className="stat-label">Expected Collection</p>
            <p className="stat-value">₹{totalExpected.toLocaleString()}</p>
          </div>
          <div className="stat-card">
            <div className="stat-icon-wrap" style={{ backgroundColor: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b' }}>
              <Edit3 size={22} />
            </div>
            <p className="stat-label">EB Modified</p>
            <p className="stat-value">{modifiedCount}</p>
          </div>
          <div className="stat-card">
            <div className="stat-icon-wrap" style={{ backgroundColor: 'rgba(244, 63, 94, 0.1)', color: '#f43f5e' }}>
              <Clock size={22} />
            </div>
            <p className="stat-label">Unpaid</p>
            <p className="stat-value">{billingTenants.filter(t => t.Status !== 'PAID' && t.Status !== 'VALID').length}</p>
          </div>
        </div>

        {/* Progress Bar */}
        {billingLoading && (
          <div style={{
            background: 'rgba(99, 102, 241, 0.08)', border: '1px solid rgba(99, 102, 241, 0.2)',
            borderRadius: 16, padding: '16px 24px', marginBottom: 24,
            display: 'flex', alignItems: 'center', gap: 16
          }}>
            <div style={{
              width: 24, height: 24, borderRadius: '50%', border: '3px solid rgba(99,102,241,0.2)',
              borderTopColor: '#6366f1', animation: 'spin 0.8s linear infinite'
            }} />
            <div>
              <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-main)' }}>{billingProgress.status}</div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-dim)', marginTop: 2 }}>Please wait, do not close this page.</div>
            </div>
          </div>
        )}

        {/* Main Billing Panel */}
        <div className="panel">
          <div className="panel-header" style={{ flexWrap: 'wrap', gap: 16 }}>
            <div>
              <h3 className="panel-title">
                <Zap size={18} style={{ marginRight: 8 }} />
                Monthly Billing — {new Date().toLocaleString('default', { month: 'long', year: 'numeric' })}
              </h3>
              <p style={{ color: 'var(--text-dim)', fontSize: '0.8rem', marginTop: 4 }}>
                Update EB amounts below (rent is fixed). Click "Save & Notify All" to send invoices.
              </p>
            </div>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              {modifiedCount > 0 && (
                <button
                  className="btn btn-glass btn-small"
                  onClick={() => setBulkEB({})}
                  style={{ color: 'var(--text-dim)' }}
                >
                  <RefreshCw size={14} /> Reset Changes
                </button>
              )}
              <button
                className="btn btn-primary"
                onClick={handleBulkSaveAndNotify}
                disabled={billingLoading}
                style={{
                  background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
                  padding: '12px 24px',
                  fontSize: '0.9rem',
                  fontWeight: 700,
                  boxShadow: '0 8px 20px -4px rgba(99, 102, 241, 0.4)'
                }}
              >
                <Send size={16} />
                {modifiedCount > 0 ? `Save ${modifiedCount} EB & Notify All` : 'Send Invoices to All'}
              </button>
            </div>
          </div>

          <div className="table-scroll">
            <table className="custom-table">
              <thead>
                <tr>
                  <th style={{ width: '5%' }}>#</th>
                  <th style={{ width: '18%' }}>Tenant</th>
                  <th style={{ width: '8%' }}>Room</th>
                  <th style={{ width: '12%' }}>Rent (₹)</th>
                  <th style={{ width: '15%' }}>EB Bill (₹)</th>
                  <th style={{ width: '12%' }}>Total (₹)</th>
                  <th style={{ width: '10%' }}>Status</th>
                  <th style={{ width: '20%' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {billingTenants.map((t, i) => {
                  const rent = parseFloat((t['Monthly Rent'] || '0').toString().replace(/[^\d.]/g, ''));
                  const currentEB = bulkEB[t.Phone] !== undefined
                    ? parseFloat(bulkEB[t.Phone] || 0)
                    : parseFloat((t['EB Amount'] || '0').toString().replace(/[^\d.]/g, ''));
                  const total = rent + currentEB;
                  const isModified = bulkEB[t.Phone] !== undefined;
                  const isPaid = t.Status === 'PAID' || t.Status === 'VALID';

                  return (
                    <tr key={i} className="table-row" style={{
                      background: isModified ? 'rgba(245, 158, 11, 0.04)' : 'transparent',
                      borderLeft: isModified ? '3px solid #f59e0b' : '3px solid transparent'
                    }}>
                      <td style={{ color: 'var(--text-dim)', fontSize: '0.8rem' }}>{i + 1}</td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{
                            width: 32, height: 32, borderRadius: 8,
                            background: isPaid ? 'var(--secondary)' : 'var(--primary)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontWeight: 'bold', fontSize: '0.8rem'
                          }}>{t.Name?.[0] || 'T'}</div>
                          <div>
                            <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>{t.Name}</div>
                            <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)' }}>{t.Phone?.slice(-10)}</div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span style={{
                          background: 'rgba(99, 102, 241, 0.1)', color: 'var(--primary)',
                          padding: '4px 10px', borderRadius: 8, fontSize: '0.8rem', fontWeight: 600
                        }}>{t.Room}</span>
                      </td>
                      <td style={{ fontWeight: 600 }}>₹{rent.toLocaleString()}</td>
                      <td>
                        <div style={{ position: 'relative' }}>
                          <input
                            type="number"
                            value={bulkEB[t.Phone] !== undefined ? bulkEB[t.Phone] : (t['EB Amount'] || '0')}
                            onChange={e => {
                              const val = e.target.value;
                              setBulkEB(prev => {
                                const next = { ...prev };
                                if (val === (t['EB Amount'] || '0').toString()) {
                                  delete next[t.Phone];
                                } else {
                                  next[t.Phone] = val;
                                }
                                return next;
                              });
                            }}
                            style={{
                              width: '100%', padding: '8px 12px', borderRadius: 10,
                              border: isModified ? '2px solid #f59e0b' : '1px solid var(--glass-border)',
                              background: isModified ? 'rgba(245, 158, 11, 0.08)' : 'rgba(255,255,255,0.04)',
                              color: 'white', fontSize: '0.9rem', fontWeight: 600,
                              transition: 'all 0.2s'
                            }}
                          />
                          {isModified && (
                            <div style={{
                              position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
                              width: 8, height: 8, borderRadius: '50%', background: '#f59e0b'
                            }} />
                          )}
                        </div>
                      </td>
                      <td>
                        <span style={{
                          fontWeight: 800, fontSize: '1rem',
                          color: isModified ? '#f59e0b' : 'var(--text-main)'
                        }}>₹{total.toLocaleString()}</span>
                      </td>
                      <td>
                        <span className={`status-badge ${(t.Status || 'active').toLowerCase()}`}>
                          {isPaid ? <CheckCircle size={12} /> : <Clock size={12} />}
                          {t.Status || 'ACTIVE'}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button
                            className="btn btn-glass btn-small"
                            onClick={() => handleSingleBillNotify(t)}
                            title="Send invoice to this tenant"
                            style={{ color: 'var(--primary)' }}
                          >
                            <Send size={13} /> Notify
                          </button>
                          <button
                            className="btn btn-glass btn-small"
                            onClick={() => handleDownloadReceipt(t)}
                            title="Preview invoice PDF"
                            style={{ color: 'var(--text-dim)' }}
                          >
                            <FileText size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Bottom action bar */}
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '20px 24px', borderTop: '1px solid var(--glass-border)',
            background: 'rgba(255,255,255,0.01)', borderRadius: '0 0 20px 20px'
          }}>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-dim)' }}>
              {modifiedCount > 0 && (
                <span style={{ color: '#f59e0b' }}>
                  ⚠️ {modifiedCount} unsaved EB change(s)
                </span>
              )}
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
              <button
                className="btn btn-glass"
                onClick={handleNotifyAll}
                style={{ padding: '10px 20px' }}
              >
                <Bell size={16} /> Notify Without EB Changes
              </button>
              <button
                className="btn btn-primary"
                onClick={handleBulkSaveAndNotify}
                disabled={billingLoading}
                style={{
                  padding: '10px 24px',
                  background: 'linear-gradient(135deg, #10b981, #059669)',
                  boxShadow: '0 8px 20px -4px rgba(16, 185, 129, 0.4)'
                }}
              >
                <Save size={16} />
                Save All & Send Invoices
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    );
  };

  const renderTools = () => (
    <div className="content-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0 }} className="panel">
        <h3 className="panel-title" style={{ marginBottom: 6 }}><Zap size={16} /> EB Auto Split Tool</h3>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginBottom: 20 }}>Calculate and split electricity bills for a specific room automatically.</p>
        <div className="input-group">
          <label>Room Number</label>
          <input type="text" placeholder="e.g. G1" value={ebForm.room} onChange={e => setEbForm({ ...ebForm, room: e.target.value })} />
        </div>
        <div className="input-group">
          <label>Units Consumed</label>
          <input type="number" placeholder="100" value={ebForm.amount} onChange={e => setEbForm({ ...ebForm, amount: e.target.value })} />
        </div>
        <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }} onClick={handleUpdateEB}>
          <Zap size={14} /> Calculate & Notify Residents
        </button>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="panel">
        <h3 className="panel-title" style={{ marginBottom: 6 }}><Megaphone size={16} /> Smart Announcements</h3>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginBottom: 20 }}>Send important updates to all active residents on WhatsApp.</p>
        <div className="input-group">
          <label>Message</label>
          <textarea rows="4" placeholder="Type your announcement here..." value={announceForm} onChange={e => setAnnounceForm(e.target.value)} style={{ resize: 'vertical' }} />
        </div>
        <div className="input-group">
          <label>Attach Media</label>
          <div style={{
            position: 'relative', padding: '12px 16px', borderRadius: 'var(--radius-s)',
            border: '1px dashed var(--glass-border)', background: 'rgba(255,255,255,0.02)',
            display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer'
          }}>
            <input type="file" onChange={(e) => setAnnounceFile(e.target.files[0])} style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer' }} />
            <Camera size={14} style={{ color: announceFile ? 'var(--secondary)' : 'var(--text-muted)' }} />
            <span style={{ fontSize: '0.8rem', color: announceFile ? 'var(--secondary)' : 'var(--text-muted)' }}>
              {announceFile ? announceFile.name : 'Click to attach photo, video, or document'}
            </span>
          </div>
        </div>
        <button className="btn" style={{ width: '100%', justifyContent: 'center', background: 'var(--secondary)', color: 'white', boxShadow: '0 4px 12px rgba(16,185,129,0.3)' }} onClick={handleAnnounce}>
          <Send size={14} /> Send WhatsApp Announcement
        </button>
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

  const renderSettings = () => (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <div className="panel">
        <div className="panel-header">
          <h3 className="panel-title"><Settings size={16} /> Application Configuration</h3>
        </div>
        <p style={{ color: 'var(--text-dim)', fontSize: '0.82rem', marginBottom: 24 }}>
          View current environment settings. To update these, please modify your server environment variables.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
          {/* Business Identity */}
          <div style={{ padding: 20, background: 'rgba(255,255,255,0.02)', borderRadius: 'var(--radius-m)', border: '1px solid var(--glass-border)' }}>
            <h4 style={{ color: 'var(--primary)', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 700, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Users size={14} /> Business Identity
            </h4>
            <div className="input-group">
              <label>Business Name</label>
              <input type="text" value={configData?.businessName || ''} readOnly style={{ opacity: 0.7 }} />
            </div>
            <div className="input-group">
              <label>Owner Phone</label>
              <input type="text" value={configData?.ownerPhone || ''} readOnly style={{ opacity: 0.7 }} />
            </div>
            <div className="input-group" style={{ marginBottom: 0 }}>
              <label>Owner UPI ID</label>
              <input type="text" value={configData?.upiId || ''} readOnly style={{ opacity: 0.7 }} />
            </div>
          </div>

          {/* Billing & Policy */}
          <div style={{ padding: 20, background: 'rgba(255,255,255,0.02)', borderRadius: 'var(--radius-m)', border: '1px solid var(--glass-border)' }}>
            <h4 style={{ color: 'var(--secondary)', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 700, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 6 }}>
              <CreditCard size={14} /> Billing & Policy
            </h4>
            <div className="input-group">
              <label>Rent Due Date (Monthly)</label>
              <input type="text" value={`${configData?.rentDueDate || 5}th of every month`} readOnly style={{ opacity: 0.7 }} />
            </div>
            <div className="input-group">
              <label>Electricity Rate (₹ / Unit)</label>
              <input type="text" value={`₹${configData?.ebUnitRate || 15}`} readOnly style={{ opacity: 0.7 }} />
            </div>
            <div className="input-group" style={{ marginBottom: 0 }}>
              <label>Registration Link</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <input type="text" value={configData?.googleFormUrl || ''} readOnly style={{ opacity: 0.7, flex: 1 }} />
                <button className="btn btn-glass btn-small" onClick={() => window.open(configData?.googleFormUrl, '_blank')}>Open</button>
              </div>
            </div>
          </div>
        </div>

        {/* Warning */}
        <div style={{ marginTop: 24, padding: '14px 18px', background: 'var(--warning-soft)', borderRadius: 'var(--radius-s)', border: '1px solid rgba(245,158,11,0.15)' }}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <AlertCircle size={16} style={{ color: 'var(--warning)', flexShrink: 0 }} />
            <div>
              <span style={{ fontWeight: 700, fontSize: '0.8rem', color: 'var(--warning)' }}>Read-Only Mode</span>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 2, lineHeight: 1.4 }}>
                Settings are currently pulled from server environment variables for security. To change these values, please update your Render/Deployment dashboard environment variables and restart the service.
              </p>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );

  const renderArchive = () => (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="panel">
      <div className="panel-header">
        <h3 className="panel-title">MongoDB Archive (Historical Data)</h3>
        <button
          className="btn btn-glass"
          onClick={handleSyncToMongo}
          disabled={syncing}
        >
          {syncing ? 'Syncing...' : <><Zap size={16} /> Sync Current to Mongo</>}
        </button>
      </div>
      <p style={{ color: 'var(--text-dim)', fontSize: '0.9rem', marginBottom: 20, padding: '0 24px' }}>
        This data is stored permanently in MongoDB. It includes all past and current residents.
      </p>
      <div className="table-scroll">
        <table className="custom-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Phone</th>
              <th>Room</th>
              <th>Sharing</th>
              <th>Status</th>
              <th>Archived At</th>
            </tr>
          </thead>
          <tbody>
            {archivedTenants.map((t, i) => (
              <tr key={i} className="table-row">
                <td><span style={{ fontWeight: 600 }}>{t.name}</span></td>
                <td>{t.phone}</td>
                <td>{t.room}</td>
                <td>{t.sharingType}</td>
                <td>
                  <span className={`status-badge ${t.status?.toLowerCase() || ''}`}>
                    {t.status}
                  </span>
                </td>
                <td>{new Date(t.archivedAt).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </motion.div>
  );

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
    <div className={`dashboard-container ${sidebarOpen ? 'sidebar-open' : ''}`}>
      <InteractiveGrid />
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="sidebar-backdrop"
            onClick={() => setSidebarOpen(false)}
          />
        )}
      </AnimatePresence>

      <div className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <div className="logo-section">
            <img src="/logo.svg" alt="StayFlow Logo" style={{ width: 32, height: 32 }} />
            <span className="logo-text">StayFlow</span>
          </div>
          <button className="sidebar-close" onClick={() => setSidebarOpen(false)}>
            <X size={24} />
          </button>
        </div>
        <nav className="nav-links">
          <div className={`nav-link ${activeTab === 'dashboard' ? 'active' : ''}`} onClick={() => { setActiveTab('dashboard'); setSidebarOpen(false); }}><LayoutDashboard size={20} /> Dashboard</div>
          <div className={`nav-link ${activeTab === 'billing' ? 'active' : ''}`} onClick={() => { setActiveTab('billing'); setSidebarOpen(false); }}><CreditCard size={20} /> Monthly Billing</div>
          <div className={`nav-link ${activeTab === 'tenants' ? 'active' : ''}`} onClick={() => { setActiveTab('tenants'); setSidebarOpen(false); }}><Users size={20} /> Members</div>
          <div className={`nav-link ${activeTab === 'map' ? 'active' : ''}`} onClick={() => { setActiveTab('map'); setSidebarOpen(false); }}><MapPin size={20} /> Room Map</div>
          <div className={`nav-link ${activeTab === 'locations' ? 'active' : ''}`} onClick={() => { setActiveTab('locations'); setSidebarOpen(false); }}><MapPin size={20} /> Locations</div>
          <div className={`nav-link ${activeTab === 'archive' ? 'active' : ''}`} onClick={() => { setActiveTab('archive'); setSidebarOpen(false); }}><Settings size={20} /> Archive</div>
          <div className={`nav-link ${activeTab === 'tools' ? 'active' : ''}`} onClick={() => { setActiveTab('tools'); setSidebarOpen(false); }}><Zap size={20} /> Auto-Tools</div>
          <div className={`nav-link ${activeTab === 'settings' ? 'active' : ''}`} onClick={() => { setActiveTab('settings'); setSidebarOpen(false); }}><Settings size={20} /> App Settings</div>
        </nav>
        <div style={{ marginTop: 'auto', padding: '14px 16px', background: 'rgba(255,255,255,0.02)', borderRadius: 'var(--radius-m)', border: '1px solid var(--glass-border)' }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--secondary)', boxShadow: '0 0 8px rgba(16,185,129,0.5)' }} />
            <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--secondary)', letterSpacing: '0.5px' }}>SERVER ACTIVE</span>
          </div>
          <p style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: 4 }}>Last sync: moments ago</p>
        </div>
      </div>

      {/* Toast Notification */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, x: 40, y: 0 }}
            animate={{ opacity: 1, x: 0, y: 0 }}
            exit={{ opacity: 0, x: 40 }}
            style={{
              position: 'fixed', top: 24, right: 24, zIndex: 10000,
              background: toast.type === 'error' ? 'var(--accent)' : 'var(--secondary)',
              color: '#fff', padding: '12px 20px', borderRadius: 'var(--radius-m)',
              boxShadow: 'var(--shadow-md)',
              display: 'flex', alignItems: 'center', gap: 10,
              fontSize: '0.85rem', fontWeight: 600, maxWidth: 400,
            }}
          >
            {toast.type === 'error' ? <AlertCircle size={16} /> : <CheckCircle size={16} />}
            {toast.message}
          </motion.div>
        )}
      </AnimatePresence>

      <main className="main-viewport">
        <header>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <button className="mobile-menu-btn" onClick={() => setSidebarOpen(true)}>
              <Menu size={20} />
            </button>
            <div className="header-meta">
              <h1>{activeTab === 'dashboard' ? 'Dashboard' : activeTab === 'billing' ? 'Monthly Billing' : activeTab === 'tenants' ? 'Members' : activeTab === 'map' ? 'Room Map' : activeTab === 'locations' ? 'Locations' : activeTab === 'archive' ? 'Archive' : activeTab === 'tools' ? 'Auto-Tools' : activeTab === 'settings' ? 'App Settings' : activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}</h1>
              <p>Welcome back, Owner. Here's what's happening at StayFlow.</p>
            </div>
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
              <Search style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} size={14} />
              <input
                type="text"
                placeholder="Search anything..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  padding: '9px 12px 9px 32px', borderRadius: 'var(--radius-s)',
                  border: '1px solid var(--glass-border)', background: 'rgba(255,255,255,0.03)',
                  color: 'var(--text-main)', fontSize: '0.825rem', width: 200, outline: 'none',
                  transition: 'var(--transition)',
                }}
              />
            </div>
            <button className="btn btn-glass btn-small" style={{ padding: 9 }}><Bell size={16} /></button>
          </div>
        </header>

        {loading ? (
          <div style={{ height: '50vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
            <div style={{
              width: 40, height: 40, borderRadius: '50%',
              border: '3px solid var(--glass-border)', borderTopColor: 'var(--primary)',
              animation: 'spin 0.8s linear infinite'
            }} />
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 500 }}>Loading data...</span>
          </div>
        ) : (
          <>
            {activeTab === 'dashboard' && renderDashboard()}
            {activeTab === 'billing' && renderBilling()}
            {activeTab === 'tenants' && renderTenants()}
            {activeTab === 'map' && renderMap()}
            {activeTab === 'locations' && renderLocations()}
            {activeTab === 'archive' && renderArchive()}
            {activeTab === 'tools' && renderTools()}
            {activeTab === 'settings' && renderSettings()}
          </>
        )}
        {renderActionPanel()}
      </main>

      {showModal && (
        <div className="modal-backdrop" onClick={() => { setShowModal(false); setEditData({}); setSelectedTenant(null); }}>
          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 10 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
            className="modal-content"
            onClick={e => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <div>
                <h2 style={{ fontSize: '1.15rem', fontWeight: 700 }}>{selectedTenant ? 'Edit Resident' : 'Add New Resident'}</h2>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 2 }}>{selectedTenant ? 'Update resident information' : 'Register a new resident'}</p>
              </div>
              <button className="btn btn-glass btn-small" onClick={() => { setShowModal(false); setEditData({}); setSelectedTenant(null); }} style={{ padding: 8 }}>
                <X size={16} />
              </button>
            </div>

            {/* Form Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <div className="input-group">
                <label>Full Name</label>
                <input type="text" defaultValue={selectedTenant?.Name} onChange={(e) => handleEditChange('Name', e.target.value)} placeholder="Enter full name" />
              </div>
              <div className="input-group">
                <label>Phone Number</label>
                <input type="text" defaultValue={selectedTenant?.Phone} onChange={(e) => handleEditChange('Phone', e.target.value)} placeholder="10-digit mobile" />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <div className="input-group">
                <label>Room Number</label>
                <input type="text" defaultValue={selectedTenant?.Room} onChange={(e) => handleEditChange('Room', e.target.value)} placeholder="e.g. 101" />
              </div>
              <div className="input-group">
                <label>Sharing Type</label>
                <select
                  defaultValue={selectedTenant?.['Sharing Type'] || '1 Sharing'}
                  onChange={(e) => handleEditChange('Sharing Type', e.target.value)}
                >
                  <option value="1 Sharing">1 Sharing</option>
                  <option value="2 Sharing">2 Sharing</option>
                  <option value="3 Sharing">3 Sharing</option>
                  <option value="4 Sharing">4 Sharing</option>
                </select>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <div className="input-group">
                <label>Rent (₹)</label>
                <input type="number" defaultValue={selectedTenant?.['Monthly Rent']} onChange={(e) => handleEditChange('Monthly Rent', e.target.value)} placeholder="Monthly rent" />
              </div>
              <div className="input-group">
                <label>EB Bill (₹)</label>
                <input type="number" defaultValue={selectedTenant?.['EB Amount']} onChange={(e) => handleEditChange('EB Amount', e.target.value)} placeholder="Electricity bill" />
              </div>
            </div>

            <div className="input-group">
              <label>PG Location</label>
              <input type="text" defaultValue={selectedTenant?.Location} onChange={(e) => handleEditChange('Location', e.target.value)} placeholder="e.g. Main Branch" />
            </div>

            {/* Aadhaar Upload */}
            <div className="input-group">
              <label>Aadhaar Card Upload</label>
              <div style={{
                position: 'relative', padding: '14px 16px', borderRadius: 'var(--radius-s)',
                border: '1px dashed var(--glass-border)', background: 'rgba(255,255,255,0.02)',
                display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer'
              }}>
                <input
                  type="file" accept="image/*"
                  onChange={(e) => setEditData({ ...editData, aadhaarFile: e.target.files[0] })}
                  style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer' }}
                />
                <Camera size={16} style={{ color: editData.aadhaarFile ? 'var(--secondary)' : 'var(--text-muted)' }} />
                <span style={{ fontSize: '0.82rem', color: editData.aadhaarFile ? 'var(--secondary)' : 'var(--text-muted)' }}>
                  {editData.aadhaarFile ? editData.aadhaarFile.name : 'Click to upload Aadhaar image'}
                </span>
              </div>
            </div>

            {/* Payment Status - Only for existing tenants */}
            {selectedTenant && (
              <div style={{ padding: 16, background: 'rgba(255,255,255,0.02)', borderRadius: 'var(--radius-m)', border: '1px solid var(--glass-border)', marginBottom: 16 }}>
                <h4 style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 700, color: 'var(--primary)', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Wallet size={14} /> Payment Status
                </h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                  <div className="input-group" style={{ marginBottom: 0 }}>
                    <label>Status</label>
                    <select
                      value={editData.Status !== undefined ? editData.Status : (selectedTenant?.Status || 'ACTIVE')}
                      onChange={(e) => handleEditChange('Status', e.target.value)}
                    >
                      <option value="PAID">PAID</option>
                      <option value="VALID">VALID</option>
                      <option value="PENDING">PENDING</option>
                      <option value="ACTIVE">UNPAID / ACTIVE</option>
                    </select>
                  </div>
                  <div className="input-group" style={{ marginBottom: 0 }}>
                    <label>Payment Mode</label>
                    <select
                      value={editData['Payment Mode'] !== undefined ? editData['Payment Mode'] : (selectedTenant?.['Payment Mode'] || 'CASH')}
                      onChange={(e) => handleEditChange('Payment Mode', e.target.value)}
                    >
                      <option value="CASH">Cash</option>
                      <option value="UPI">UPI / GPay</option>
                      <option value="RAZORPAY">Razorpay</option>
                      <option value="BANK">Bank Transfer</option>
                    </select>
                  </div>
                </div>
                {(editData.Status === 'PAID' || editData.Status === 'VALID') && editData.Status !== selectedTenant?.Status && (
                  <p style={{ fontSize: '0.75rem', color: 'var(--secondary)', marginTop: 10, display: 'flex', alignItems: 'center', gap: 4 }}>
                    <CheckCircle size={12} /> Payment will be recorded and receipt sent via WhatsApp
                  </p>
                )}
                {(editData.Status === 'ACTIVE' || editData.Status === 'PENDING') && (selectedTenant?.Status === 'PAID' || selectedTenant?.Status === 'VALID') && (
                  <p style={{ fontSize: '0.75rem', color: 'var(--warning)', marginTop: 10, display: 'flex', alignItems: 'center', gap: 4 }}>
                    <AlertCircle size={12} /> Status will be changed to {editData.Status}
                  </p>
                )}
              </div>
            )}

            {selectedTenant && (
              <div className="input-group">
                <label>Join Date</label>
                <input type="text" defaultValue={selectedTenant?.['Join Date']} disabled style={{ opacity: 0.6 }} />
              </div>
            )}

            {/* Actions */}
            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              <button className="btn btn-primary" style={{ flex: 1, justifyContent: 'center' }} onClick={handleSave}>
                <Save size={16} /> {selectedTenant ? 'Update Resident' : 'Save & Register'}
              </button>
              <button className="btn btn-glass" onClick={() => { setShowModal(false); setEditData({}); setSelectedTenant(null); }}>Cancel</button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
};

export default App;
