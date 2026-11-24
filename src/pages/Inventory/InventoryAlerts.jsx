import React, { useState, useEffect, useMemo } from 'react';
import { AlertTriangle, Bell, Clock, Filter, CheckCircle2, PackageCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useData } from '../../context/GlobalDataContext';

const InventoryAlerts = () => {
    const { inventoryAlerts, fetchInventoryAlerts, acknowledgeInventoryAlert } = useData();
    const navigate = useNavigate();

    useEffect(() => {
        if (fetchInventoryAlerts) fetchInventoryAlerts();

        const interval = setInterval(() => {
            if (fetchInventoryAlerts) fetchInventoryAlerts();
        }, 5000);

        const onFocus = () => {
            if (fetchInventoryAlerts) fetchInventoryAlerts();
        };
        window.addEventListener('focus', onFocus);
        window.addEventListener('app:state-changed', onFocus);

        return () => {
            clearInterval(interval);
            window.removeEventListener('focus', onFocus);
            window.removeEventListener('app:state-changed', onFocus);
        };
    }, [fetchInventoryAlerts]);

    const [filter, setFilter] = useState('All');

    // Use alerts from context
    const alerts = inventoryAlerts || [];

    const filteredAlerts = filter === 'All'
        ? alerts
        : alerts.filter(a => a.status === filter);

    const criticalCount = useMemo(() => alerts.filter(a => a.status === 'Critical').length, [alerts]);
    const warningCount = useMemo(() => alerts.filter(a => a.status === 'Warning').length, [alerts]);

    // Dynamic distribution of alerts grouped by category
    const categoryDistribution = useMemo(() => {
        if (alerts.length === 0) return [];
        const counts = {};
        alerts.forEach(a => {
            const cat = a.category || 'General';
            counts[cat] = (counts[cat] || 0) + 1;
        });
        return Object.entries(counts).map(([name, count]) => ({
            name,
            count,
            percentage: Math.min(100, Math.round((count / alerts.length) * 100))
        }));
    }, [alerts]);

    return (
        <div className="space-y-8">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Active Alerts</h1>
                    <p className="text-secondary mt-1">Real-time infrastructure and stock level warnings.</p>
                </div>
                <div className="flex gap-2">
                    {['All', 'Critical', 'Warning'].map((f) => (
                        <button
                            key={f}
                            onClick={() => setFilter(f)}
                            className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${filter === f
                                    ? 'bg-accent text-white shadow-lg shadow-accent/20'
                                    : 'bg-white/5 text-secondary hover:bg-white/10'
                                }`}
                        >
                            {f}
                        </button>
                    ))}
                </div>
            </div>

            <div className="grid grid-cols-1 gap-4">
                {filteredAlerts.length > 0 ? (
                    filteredAlerts.map((alert) => (
                        <div
                            key={alert.id}
                            className={`glass-card p-6 border-l-4 flex items-center justify-between transition-all hover:translate-x-1 ${alert.status === 'Critical' ? 'border-l-danger bg-danger/5' : 'border-l-warning bg-warning/5'
                                }`}
                        >
                            <div className="flex items-center gap-6">
                                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${alert.status === 'Critical' ? 'bg-danger/20 text-danger' : 'bg-warning/20 text-warning'
                                    }`}>
                                    <AlertTriangle size={24} />
                                </div>
                                <div>
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${alert.status === 'Critical' ? 'bg-danger text-white' : 'bg-warning text-black'
                                            }`}>
                                            {alert.status}
                                        </span>
                                        <span className="text-xs text-muted">Acknowledge Required</span>
                                    </div>
                                    <h3 className="text-lg font-bold">Stock Depletion: {alert.name}</h3>
                                    <p className="text-secondary text-sm">Location: {alert.location} • Current Level: {alert.qty} (Threshold: {alert.threshold})</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-4">
                                <div className="text-right mr-4 hidden md:block">
                                    <p className="text-xs text-muted flex items-center gap-1 justify-end">
                                        <Clock size={12} /> Active Warning
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => acknowledgeInventoryAlert(alert.id)}
                                    className="p-3 bg-white/5 hover:bg-success/20 hover:text-success rounded-xl text-secondary transition-colors"
                                    title="Dismiss alert"
                                >
                                    <CheckCircle2 size={20} />
                                </button>
                            </div>
                        </div>
                    ))
                ) : (
                    <div className="glass-card p-12 flex flex-col items-center justify-center text-center opacity-70 border border-success/20 bg-success/5">
                        <div className="w-16 h-16 bg-success/10 rounded-full flex items-center justify-center mb-4">
                            <CheckCircle2 size={32} className="text-success" />
                        </div>
                        <h3 className="text-xl font-bold text-white">All Systems Clear</h3>
                        <p className="text-secondary max-w-xs mx-auto mt-2">All inventory levels are currently above reorder thresholds for your workspace.</p>
                    </div>
                )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
                <div className="glass-card p-6 border-accent/10">
                    <h3 className="text-lg font-bold mb-4">Alert Distribution</h3>
                    <div className="space-y-4">
                        {categoryDistribution.length > 0 ? (
                            categoryDistribution.map((cat) => (
                                <div key={cat.name} className="space-y-1">
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm text-secondary">{cat.name}</span>
                                        <span className="text-xs font-bold text-warning">{cat.count} Active</span>
                                    </div>
                                    <div className="h-1.5 bg-border rounded-full overflow-hidden">
                                        <div className="h-full bg-warning" style={{ width: `${cat.percentage}%` }} />
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="flex items-center gap-3 p-3 bg-white/5 rounded-xl border border-white/5">
                                <PackageCheck size={20} className="text-success shrink-0" />
                                <span className="text-xs text-secondary">All categories optimal • 0 active stock warnings</span>
                            </div>
                        )}
                    </div>
                </div>
                <div className="glass-card p-6 bg-accent/5 border-accent/20">
                    <h3 className="text-lg font-bold mb-2">Automated Provisioning</h3>
                    <p className="text-sm text-secondary">
                        {alerts.length > 0
                            ? `Based on current stock levels, ${criticalCount > 0 ? `${criticalCount} item(s) are depleted` : `${warningCount} item(s) are low`}. Stock levels require operational review.`
                            : `All inventory buffers are healthy. No automated restocking is recommended at this time.`}
                    </p>
                </div>
            </div>
        </div>
    );
};

export default InventoryAlerts;
