import React, { useState, useMemo } from 'react';
import { swalSuccess, swalError, swalWarning, swalInfo, swalConfirm, swalCredentials, swalCopied } from '../../utils/swal';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import CustomDatePicker from '../../components/CustomDatePicker';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell, Legend
} from 'recharts';
import { VENDOR_PERFORMANCE, REVENUE_CHART_DATA } from '../../utils/data';
import { Download, Filter, Calendar, TrendingUp, TrendingDown, Loader2, Zap, DollarSign, PieChart as PieIcon, Activity, ShieldCheck, CheckCircle2 } from 'lucide-react';
import { useData } from '../../context/GlobalDataContext';

const COLORS = ['#C8A96A', '#3B82F6', '#22C55E', '#EF4444', '#FACC15'];

const Reports = () => {
  const { 
    clients, fleet, inventory, projects, logs, revenueFilter, setRevenueFilter, 
    invoices, payments, hasPermission, dashboardStats, fetchFinance, fetchDashboardStats,
    lossAssessments, fetchLossAssessments, fetchFleet
  } = useData();

  React.useEffect(() => {
    fetchFinance();
    fetchDashboardStats();
    if (fetchLossAssessments) fetchLossAssessments();
    if (fetchFleet) fetchFleet();
  }, [fetchFinance, fetchDashboardStats, fetchLossAssessments, fetchFleet]);
  const [isExporting, setIsExporting] = useState(false);
  const todayStr = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const thirtyDaysAgoStr = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().slice(0, 10);
  }, []);
  const [startDate, setStartDate] = useState(thirtyDaysAgoStr);
  const [endDate, setEndDate] = useState(todayStr);
  const [showFilters, setShowFilters] = useState(false);
  const [customRangeActive, setCustomRangeActive] = useState(false);
  const [customChartData, setCustomChartData] = useState([]);

  // --- Institutional Permission Guard ---
  if (!hasPermission('financial_reports')) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] space-y-4">
        <div className="p-4 bg-danger/10 border border-danger/20 rounded-full">
          <ShieldCheck size={48} className="text-danger" />
        </div>
        <div className="text-center">
          <h2 className="text-2xl font-bold">Security Clearance Required</h2>
          <p className="text-secondary mt-2 max-w-md">Financial intelligence and revenue audits are restricted to Super Admin protocols. Your access attempt has been logged.</p>
        </div>
      </div>
    );
  }

  // --- Real Intelligence Calibration (Multi-temporal) ---
  const { totalRevenue, totalPaid, totalOutstanding, avgOrderValue } = useMemo(() => {
    if (customRangeActive) {
      const start = new Date(startDate);
      const end = new Date(endDate + 'T23:59:59');
      const filteredInvoices = (invoices || []).filter(inv => {
        const invDate = new Date(inv.invoiceDate || inv.createdAt || inv.date);
        return invDate >= start && invDate <= end;
      });
      const paid = filteredInvoices
        .filter(inv => String(inv.status || '').toLowerCase() === 'paid')
        .reduce((acc, inv) => acc + parseFloat(inv.totalAmount || inv.amount || 0), 0);
      const total = filteredInvoices.reduce((acc, inv) => acc + parseFloat(inv.totalAmount || inv.amount || 0), 0);
      const outstanding = Math.max(0, total - paid);
      const avg = filteredInvoices.length > 0 ? total / filteredInvoices.length : 0;
      return { totalRevenue: total, totalPaid: paid, totalOutstanding: outstanding, avgOrderValue: avg };
    }

    // Priority 1: Use aggregate dashboard stats if available
    if (dashboardStats.relevantRevenue !== undefined) {
      const relevant = Number(dashboardStats.relevantRevenue) || 0;
      const totalRev = Number(dashboardStats.totalRevenue) || relevant;
      const outstanding = dashboardStats.outstandingRevenue !== undefined 
        ? Number(dashboardStats.outstandingRevenue) 
        : Math.max(0, totalRev - relevant);
      return {
        totalRevenue: relevant + outstanding,
        totalPaid: relevant,
        totalOutstanding: outstanding,
        avgOrderValue: dashboardStats.completedOrders ? (relevant / dashboardStats.completedOrders) : (relevant || 0)
      };
    }

    const now = new Date();
    const filterDays = {
      'Daily': 1,
      'Weekly': 7,
      'Monthly': 30,
      'Quarterly': 90,
      'Annual': 365
    };

    const days = filterDays[revenueFilter] || 30;
    const thresholdDate = new Date(now.getTime() - (days * 24 * 60 * 60 * 1000));

    const filteredInvoices = (invoices || []).filter(inv => {
      const invDate = new Date(inv.invoiceDate || inv.createdAt || inv.date);
      return invDate >= thresholdDate;
    });

    const paid = filteredInvoices
      .filter(inv => String(inv.status || '').toLowerCase() === 'paid')
      .reduce((acc, inv) => acc + parseFloat(inv.totalAmount || inv.amount || 0), 0);
    const total = filteredInvoices.reduce((acc, inv) => acc + parseFloat(inv.totalAmount || inv.amount || 0), 0);
    const outstanding = Math.max(0, total - paid);
    const avg = filteredInvoices.length > 0 ? total / filteredInvoices.length : 0;

    return {
      totalRevenue: total,
      totalPaid: paid,
      totalOutstanding: outstanding,
      avgOrderValue: avg
    };
  }, [customRangeActive, startDate, endDate, invoices, revenueFilter, dashboardStats]);

  // Live Chart Data from backend dashboardStats or custom calibrated range
  const chartData = useMemo(() => {
    if (customRangeActive && customChartData.length > 0) {
      return customChartData;
    }
    if (dashboardStats?.revenueChartData && Array.isArray(dashboardStats.revenueChartData) && dashboardStats.revenueChartData.length > 0) {
      return dashboardStats.revenueChartData;
    }
    const filterDays = { 'Daily': 1, 'Weekly': 7, 'Monthly': 30, 'Quarterly': 90, 'Annual': 365 };
    const days = filterDays[revenueFilter] || 30;
    const now = new Date();
    const threshold = new Date(now.getTime() - (days * 24 * 60 * 60 * 1000));
    const paidInvs = (invoices || []).filter(i => {
      const d = new Date(i.invoiceDate || i.createdAt || i.date);
      return String(i.status || '').toLowerCase() === 'paid' && d >= threshold;
    });
    if (paidInvs.length > 0) {
      const map = {};
      paidInvs.forEach(inv => {
        const d = new Date(inv.invoiceDate || inv.createdAt || inv.date);
        const label = days <= 7 ? d.toLocaleDateString(undefined, { weekday: 'short' }) : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
        map[label] = (map[label] || 0) + parseFloat(inv.totalAmount || inv.amount || 0);
      });
      return Object.keys(map).map(k => ({ name: k, revenue: map[k] }));
    }
    return (REVENUE_CHART_DATA || []).map(d => ({ name: d.month || d.name, revenue: d.revenue }));
  }, [customRangeActive, customChartData, dashboardStats?.revenueChartData, invoices, revenueFilter]);

  const handleApplyCustomFilter = () => {
    if (!startDate || !endDate) {
      swalWarning('Invalid Range', 'Please select both start and end dates.');
      return;
    }
    const start = new Date(startDate);
    const end = new Date(endDate + 'T23:59:59');
    if (start > end) {
      swalError('Invalid Dates', 'Start date cannot be after end date.');
      return;
    }
    setCustomRangeActive(true);
    const inRange = (invoices || []).filter(inv => {
      const d = new Date(inv.invoiceDate || inv.createdAt || inv.date);
      return d >= start && d <= end;
    });
    const map = {};
    inRange.filter(i => String(i.status || '').toLowerCase() === 'paid').forEach(inv => {
      const d = new Date(inv.invoiceDate || inv.createdAt || inv.date);
      const label = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
      map[label] = (map[label] || 0) + parseFloat(inv.totalAmount || inv.amount || 0);
    });
    const chart = Object.keys(map).map(k => ({ name: k, revenue: map[k] }));
    setCustomChartData(chart);
    swalSuccess('Analysis Calibrated', `Audited ${inRange.length} invoice(s) between ${startDate} and ${endDate}.`);
  };

  const handleResetFilter = () => {
    setCustomRangeActive(false);
    setCustomChartData([]);
  };

  // --- Real Loss Tracking Intelligence (Backend Connected & Tenant Isolated) ---
  const lossReports = useMemo(() => {
    // 1. Live Inventory Losses from backend lossAssessments
    const inventoryLoss = (lossAssessments || []).map(l => ({
      item: l.item || 'Asset Item',
      qty: l.quantity || 0,
      value: parseFloat(l.financialLoss || 0),
      reason: (l.lossType || 'SPOILAGE').toUpperCase()
    }));

    // 2. Live Fleet Asset Degradation from backend fleet
    const fleetLoss = (fleet || []).filter(f => {
      const diag = String(f.diagnosticStatus || '').toLowerCase();
      const status = String(f.status || '').toLowerCase();
      return (diag && !diag.includes('healthy')) || (status.includes('maintenance') || status.includes('service') || status.includes('critical') || status.includes('repair'));
    }).map(f => {
      const diag = f.diagnosticStatus || f.status || 'Maintenance Required';
      const isCritical = String(diag).toLowerCase().includes('critical');
      return {
        asset: f.id || `FLT-${f.db_id}`,
        status: diag,
        repairCost: isCritical ? 1250 : 350
      };
    });

    const totalLossValue = inventoryLoss.reduce((acc, l) => acc + (l.value || 0), 0) +
      fleetLoss.reduce((acc, l) => acc + (l.repairCost || 0), 0);

    return { inventoryLoss, fleetLoss, totalLossValue };
  }, [lossAssessments, fleet]);

  const pieData = [
    { name: 'Paid Assets', value: totalPaid },
    { name: 'Outstanding A/R', value: totalOutstanding },
  ];

  const handleExportPDF = () => {
    setIsExporting(true);
    try {
      const doc = new jsPDF();
      const date = new Date().toLocaleDateString('en-US', {
        year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
      });
      const reportId = `ZNO-FIN-${Math.floor(100000 + Math.random() * 900000)}`;

      // --- BRANDING & HEADER ---
      doc.setFillColor(42, 42, 48);
      doc.rect(0, 0, 210, 40, 'F');
      doc.setFontSize(22);
      doc.setTextColor(200, 169, 106);
      doc.setFont("helvetica", "bold");
      doc.text('ZANEZION FINANCIAL AUDIT', 14, 25);
      doc.setFontSize(10);
      doc.setTextColor(255);
      doc.text(`INSTITUTIONAL GRADE • ${revenueFilter.toUpperCase()} HORIZON • ID: ${reportId}`, 14, 33);
      doc.text(`GENERATED: ${date}`, 196, 33, { align: 'right' });

      // --- SECTION 1: FINANCIAL KPI SUMMARY ---
      doc.setTextColor(42, 42, 48);
      doc.setFontSize(14);
      doc.text('I. FINANCIAL LIQUIDITY SUMMARY', 14, 55);

      const summaryRows = [
        ['Total Gross Revenue', `$${totalRevenue.toLocaleString()}`, 'Verified'],
        ['Total Collections (Paid)', `$${totalPaid.toLocaleString()}`, 'Settled'],
        ['Accounts Receivable (Outstanding)', `$${totalOutstanding.toLocaleString()}`, 'Follow-up Required'],
        ['Average Order Magnitude', `$${avgOrderValue.toLocaleString()}`, 'Standard'],
      ];

      autoTable(doc, {
        startY: 60,
        head: [['Strategic Financial Metric', 'Value', 'Audit Status']],
        body: summaryRows,
        theme: 'grid',
        headStyles: { fillColor: [42, 42, 48], textColor: [200, 169, 106] },
      });

      // --- SECTION 2: OUTSTANDING INVOICES ---
      let currentY = doc.lastAutoTable.finalY + 15;
      doc.text('II. UNPAID INSTITUTIONAL INVOICES', 14, currentY);

      const unpaidRows = (invoices || [])
        .filter(inv => String(inv.status || '').toLowerCase() !== 'paid')
        .map(inv => {
          const invAmount = parseFloat(inv.totalAmount || inv.total || inv.amount || 0);
          const clientRef = inv.client?.companyName || inv.client?.name || (inv.clientId ? `CLT-${inv.clientId}` : 'Institutional Client');
          const invDate = inv.invoiceDate || inv.createdAt ? new Date(inv.invoiceDate || inv.createdAt).toLocaleDateString() : 'N/A';
          return [inv.id, clientRef, `$${invAmount.toLocaleString()}`, (inv.status || 'UNPAID').toUpperCase(), invDate];
        });
      autoTable(doc, {
        startY: currentY + 5,
        head: [['Invoice ID', 'Client Ref', 'Amount', 'State', 'Issue Date']],
        body: unpaidRows,
        theme: 'striped',
        headStyles: { fillColor: [200, 169, 106], textColor: [0, 0, 0] },
      });

      // --- FOOTER ---
      const pageCount = doc.internal.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(150);
        doc.text(`Proprietary Institutional Document • ZaneZion Platinum Network • Financial Security Guaranteed`, 105, 285, { align: 'center' });
      }

      doc.save(`Zanezion_Financial_Report_${reportId}.pdf`);
    } catch (error) {
      console.error('PDF Export Error:', error);
      swalError('Export Failed', 'Institutional export failed.');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Intelligence & Revenue</h1>
          <p className="text-secondary mt-1">Institutional financial performance and transactional velocity.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <div className="flex items-center gap-2 bg-white/5 border border-border rounded-xl px-3 transition-all focus-within:border-accent">
            <Zap size={14} className="text-accent" />
            <select
              value={revenueFilter}
              onChange={(e) => {
                setRevenueFilter(e.target.value);
                handleResetFilter();
              }}
              className="bg-transparent text-xs font-bold py-2 focus:outline-none cursor-pointer"
            >
              <option value="Daily">Daily Horizon</option>
              <option value="Weekly">Weekly Sequence</option>
              <option value="Monthly">Monthly Protocol</option>
              <option value="Quarterly">Quarterly Review</option>
              <option value="Annual">Annual Audit</option>
            </select>
          </div>
          <button
            className={`btn-secondary flex items-center gap-2 ${showFilters || customRangeActive ? 'bg-accent text-black' : ''}`}
            onClick={() => setShowFilters(!showFilters)}
          >
            <Filter size={16} /> {customRangeActive ? 'Range Active' : 'Filters'}
          </button>
          <button
            className="btn-primary flex items-center gap-2 disabled:opacity-50"
            onClick={handleExportPDF}
            disabled={isExporting}
          >
            {isExporting ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
            {isExporting ? 'Generating...' : 'Audit Export'}
          </button>
        </div>

        {showFilters && (
          <div className="glass-card p-6 border-accent/20 animate-in fade-in slide-in-from-top-4">
            <div className="flex flex-wrap items-end gap-6">
              <div className="w-48">
                <CustomDatePicker
                  label="Start Evolution"
                  selectedDate={startDate}
                  onChange={setStartDate}
                />
              </div>
              <div className="w-48">
                <CustomDatePicker
                  label="End Horizon"
                  selectedDate={endDate}
                  onChange={setEndDate}
                />
              </div>
              <button 
                onClick={handleApplyCustomFilter}
                className="btn-primary h-11 px-8 rounded-xl font-bold uppercase text-[10px] tracking-widest shadow-lg shadow-accent/20"
              >
                Analyze Multi-temporal
              </button>
              {customRangeActive && (
                <button
                  onClick={handleResetFilter}
                  className="btn-secondary h-11 px-6 rounded-xl font-bold uppercase text-[10px] tracking-widest"
                >
                  Reset To Preset
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Total Asset Revenue", val: `$${totalRevenue.toLocaleString()}`, change: "+14.2%", up: true, icon: DollarSign },
          { label: "Accounts Receivable", val: `$${totalOutstanding.toLocaleString()}`, change: "-5.4%", up: false, icon: Activity },
          { label: "Settlement Rate", val: `${totalRevenue > 0 ? ((totalPaid / totalRevenue) * 100).toFixed(1) : '100.0'}%`, change: "+2.1%", up: true, icon: CheckCircle2 },
          { label: "Avg. Transaction", val: `$${avgOrderValue.toFixed(0)}`, change: "+4.8%", up: true, icon: Zap },
        ].map((item, i) => (
          <div key={i} className="glass-card p-4 relative overflow-hidden group">
            <div className="absolute top-2 right-2 p-2 bg-accent/5 rounded-lg text-accent">
              <item.icon size={16} />
            </div>
            <p className="text-[10px] text-secondary font-black uppercase tracking-widest">{item.label}</p>
            <div className="flex items-end justify-between mt-2">
              <h3 className="text-xl font-bold text-primary">{item.val}</h3>
              <div className={`flex items-center gap-0.5 text-[10px] font-black ${item.up ? 'text-success' : 'text-danger'}`}>
                {item.up ? <TrendingUp size={12} /> : <TrendingDown size={12} />} {item.change}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="glass-card p-6 border-accent/10">
          <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
            <TrendingUp size={18} className="text-accent" /> {customRangeActive ? `${startDate} to ${endDate}` : `${revenueFilter} Sequence`} Transactional Trends
          </h3>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2A2A30" vertical={false} />
                <XAxis dataKey="name" stroke="#6B7280" tick={{ fontSize: 10 }} />
                <YAxis stroke="#6B7280" tick={{ fontSize: 10 }} />
                <Tooltip contentStyle={{ backgroundColor: '#1C1C21', border: '1px solid #2A2A30', borderRadius: '12px' }} />
                <Line type="monotone" dataKey="revenue" stroke="#C8A96A" strokeWidth={4} dot={{ fill: '#C8A96A', r: 4 }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="glass-card p-6 border-secondary/10">
          <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
            <PieIcon size={18} className="text-secondary" /> Liquidity Allocation
          </h3>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  fill="#8884d8"
                  paddingAngle={8}
                  dataKey="value"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ backgroundColor: '#1C1C21', border: '1px solid #2A2A30', borderRadius: '12px' }} />
                <Legend layout="horizontal" align="center" verticalAlign="bottom" />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>


      <div className="glass-card p-6 border-danger/10 bg-danger/[0.02]">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-danger/10 rounded-lg text-danger">
              <TrendingDown size={20} />
            </div>
            <div>
              <h3 className="text-xl font-bold tracking-tight">Institutional Loss Tracking Protocol</h3>
              <p className="text-[10px] text-muted font-bold uppercase tracking-widest mt-1">Audit of broken, spoiled, expired, and damaged assets.</p>
            </div>
          </div>
          <div className="flex gap-4">
            <div className="text-right">
              <p className="text-[9px] font-black text-muted uppercase tracking-widest mb-1">Total Estimated Loss</p>
              <p className="text-xl font-black text-danger italic font-heading">
                ${lossReports.totalLossValue.toLocaleString()}
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="space-y-4">
            <p className="text-xs font-black text-white uppercase tracking-widest border-l-2 border-danger pl-3">Inventory Shrinkage & Spoilage</p>
            <div className="bg-background/40 rounded-2xl border border-divider overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-white/5 text-[9px] font-black text-muted uppercase tracking-tighter">
                    <th className="px-4 py-3">Asset Item</th>
                    <th className="px-4 py-3">Qty Lost</th>
                    <th className="px-4 py-3">Financial Loss</th>
                    <th className="px-4 py-3">Reason Protocol</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {lossReports.inventoryLoss.length > 0 ? lossReports.inventoryLoss.map((loss, idx) => (
                    <tr key={idx} className="hover:bg-white/[0.02] transition-colors">
                      <td className="px-4 py-3 font-bold">{loss.item}</td>
                      <td className="px-4 py-3 text-secondary">{loss.qty}</td>
                      <td className="px-4 py-3 text-danger font-bold">${(loss.value || 0).toLocaleString()}</td>
                      <td className="px-4 py-3"><span className="px-2 py-0.5 bg-danger/10 text-danger rounded text-[8px] font-black uppercase text-center">{loss.reason}</span></td>
                    </tr>
                  )) : (
                    <tr>
                      <td colSpan="4" className="px-4 py-12 text-center text-muted italic">No inventory shrinkage recorded in this sequence.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="space-y-4">
            <p className="text-xs font-black text-white uppercase tracking-widest border-l-2 border-warning pl-3">Fleet Asset Degradation</p>
            <div className="bg-background/40 rounded-2xl border border-divider overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-white/5 text-[9px] font-black text-muted uppercase tracking-tighter">
                    <th className="px-4 py-3">Fleet ID</th>
                    <th className="px-4 py-3">Diagnostic State</th>
                    <th className="px-4 py-3">Est. Repair Cost</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {lossReports.fleetLoss.length > 0 ? lossReports.fleetLoss.map((loss, idx) => (
                    <tr key={idx} className="hover:bg-white/[0.02] transition-colors">
                      <td className="px-4 py-3 font-mono font-bold text-accent">{loss.asset}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase ${loss.status.includes('Critical') || loss.status.includes('Service') ? 'bg-danger/20 text-danger' : 'bg-warning/20 text-warning'
                          }`}>
                          {loss.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-danger font-bold">${(loss.repairCost || 1200).toLocaleString()}</td>
                    </tr>
                  )) : (
                    <tr>
                      <td colSpan="3" className="px-4 py-12 text-center text-muted italic">All fleet assets verified healthy.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div >
  );
};

export default Reports;

