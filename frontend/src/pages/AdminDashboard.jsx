import React, { useState, useEffect, useRef, useCallback } from 'react';
import { io } from 'socket.io-client';
import parkingLotImage from '../assets/parking_lot.png';

const SOCKET_URL = 'http://localhost:3001';

// ─── NEUMORPHISM DESIGN TOKENS ────────────────────────────────────────────────
const NEU = {
    bg: '#e0e5ec',
    shadowLight: '#ffffff',
    shadowDark: '#a3b1c6',
    accent: '#4f8ef7',
    danger: '#e05c5c',
    success: '#4caf8e',
    text: '#3d4f6e',
    textMuted: '#7a8ba8',
    fontDisplay: "'Syne', sans-serif",
    fontBody: "'DM Sans', sans-serif",
};

const css = {
    neuFlat: {
        background: NEU.bg,
        boxShadow: `6px 6px 14px ${NEU.shadowDark}, -6px -6px 14px ${NEU.shadowLight}`,
        borderRadius: '16px',
    },
    neuInset: {
        background: NEU.bg,
        boxShadow: `inset 4px 4px 10px ${NEU.shadowDark}, inset -4px -4px 10px ${NEU.shadowLight}`,
        borderRadius: '12px',
    },
    neuButton: (active, color = NEU.accent) => ({
        background: active ? color : NEU.bg,
        color: active ? '#fff' : NEU.text,
        border: 'none',
        borderRadius: '10px',
        padding: '10px 18px',
        fontFamily: NEU.fontBody,
        fontWeight: '600',
        fontSize: '13px',
        cursor: 'pointer',
        transition: 'all 0.2s ease',
        boxShadow: active
            ? `0 4px 14px ${color}66`
            : `4px 4px 10px ${NEU.shadowDark}, -4px -4px 10px ${NEU.shadowLight}`,
        letterSpacing: '0.3px',
        flex: '1 1 auto',
        textAlign: 'center',
    }),
};

// ─── LINE-DRAWING CANVAS HOOK ─────────────────────────────────────────────────
function useCanvasDraw({ canvasRef, spots, graph, mode, tempStart }) {
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        spots.forEach((spot) => {
            ctx.save();
            ctx.strokeStyle = spot.status === 'occupied' ? '#e05c5c' : '#4f8ef7';
            ctx.lineWidth = 2;
            ctx.setLineDash([6, 3]);
            ctx.strokeRect(spot.x, spot.y, spot.w, spot.h);
            ctx.setLineDash([]);

            const corners = [
                [spot.x, spot.y],
                [spot.x + spot.w, spot.y],
                [spot.x, spot.y + spot.h],
                [spot.x + spot.w, spot.y + spot.h],
            ];
            ctx.fillStyle = spot.status === 'occupied' ? '#e05c5c' : '#4f8ef7';
            corners.forEach(([cx, cy]) => {
                ctx.beginPath();
                ctx.arc(cx, cy, 3, 0, Math.PI * 2);
                ctx.fill();
            });

            ctx.fillStyle = '#3d4f6e';
            ctx.font = `bold 12px 'DM Sans', sans-serif`;
            ctx.fillText(spot.id, spot.x + 5, spot.y + 14);
            ctx.restore();
        });

        graph.nodes.forEach((node) => {
            ctx.save();
            const color = node.isSpot === false ? NEU.accent : node.poiLabel ? '#9c5fe0' : '#f4a14a';
            ctx.beginPath();
            ctx.arc(node.x, node.y, 7, 0, 2 * Math.PI);
            ctx.fillStyle = color;
            ctx.shadowColor = color;
            ctx.shadowBlur = 8;
            ctx.fill();
            if (node.poiLabel) {
                ctx.shadowBlur = 0;
                ctx.fillStyle = NEU.text;
                ctx.font = `12px 'DM Sans', sans-serif`;
                ctx.fillText(node.poiLabel, node.x + 10, node.y - 8);
            }
            ctx.restore();
        });

        graph.edges?.forEach((edge) => {
            const from = graph.nodes.find((n) => n.id === edge.from);
            const to = graph.nodes.find((n) => n.id === edge.to);
            if (!from || !to) return;
            ctx.save();
            ctx.strokeStyle = 'rgba(79,142,247,0.5)';
            ctx.lineWidth = 1.5;
            ctx.setLineDash([4, 4]);
            ctx.beginPath();
            ctx.moveTo(from.x, from.y);
            ctx.lineTo(to.x, to.y);
            ctx.stroke();
            ctx.restore();
        });

        if (tempStart && mode === 'SPOTS') {
            ctx.save();
            ctx.strokeStyle = 'rgba(79,142,247,0.5)';
            ctx.lineWidth = 1.5;
            ctx.setLineDash([4, 4]);
            ctx.beginPath();
            ctx.arc(tempStart.x, tempStart.y, 5, 0, Math.PI * 2);
            ctx.stroke();
            ctx.restore();
        }
    }, [spots, graph, mode, tempStart, canvasRef]);
}

// ─── LOGIN SCREEN ─────────────────────────────────────────────────────────────
function LoginScreen({ onAuth }) {
    const [pin, setPin] = useState('');
    const [shake, setShake] = useState(false);

    const attempt = () => {
        if (pin === '1234') {
            onAuth();
        } else {
            setShake(true);
            setTimeout(() => setShake(false), 500);
            setPin('');
        }
    };

    return (
        <div style={{ minHeight: '100vh', background: NEU.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: NEU.fontBody, padding: '20px' }}>
            <style>{`
                @keyframes shake { 0%,100%{transform:translateX(0)} 25%{transform:translateX(-8px)} 75%{transform:translateX(8px)} }
            `}</style>
            <div style={{ ...css.neuFlat, padding: '48px 40px', width: '100%', maxWidth: '360px', textAlign: 'center' }}>
                <div style={{ fontSize: '40px', marginBottom: '12px' }}>🅿️</div>
                <h1 style={{ fontFamily: NEU.fontDisplay, color: NEU.text, fontSize: '24px', margin: '0 0 6px' }}>ParkVision</h1>
                <p style={{ color: NEU.textMuted, fontSize: '13px', marginBottom: '32px' }}>Admin Calibration</p>
                <div style={{ ...css.neuInset, animation: shake ? 'shake 0.4s ease' : 'none', marginBottom: '16px' }}>
                    <input
                        type="password"
                        placeholder="PIN"
                        value={pin}
                        onChange={(e) => setPin(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && attempt()}
                        style={{
                            width: '100%',
                            border: 'none',
                            background: 'transparent',
                            padding: '14px',
                            fontFamily: NEU.fontBody,
                            fontSize: '18px',
                            // Only apply the 6px spacing if the user has typed something
                            letterSpacing: pin.length > 0 ? '6px' : 'normal',
                            textIndent: pin.length > 0 ? '6px' : '0px',
                            color: NEU.text,
                            outline: 'none',
                            textAlign: 'center'
                        }}
                    />
                </div>
                <button onClick={attempt} style={{ ...css.neuButton(true), width: '100%', padding: '14px' }}>Unlock</button>
            </div>
        </div>
    );
}

// ─── SPOT LIST ITEM ───────────────────────────────────────────────────────────
function SpotItem({ spot, onRemove }) {
    return (
        <div style={{ ...css.neuFlat, padding: '10px 14px', marginBottom: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderRadius: '10px', boxShadow: `3px 3px 8px ${NEU.shadowDark}, -3px -3px 8px ${NEU.shadowLight}` }}>
            <div>
                <span style={{ fontWeight: '600', color: NEU.text, fontSize: '13px' }}>{spot.id}</span>
                <div style={{ fontSize: '11px', color: NEU.textMuted, marginTop: '2px' }}>{Math.round(spot.w)} × {Math.round(spot.h)} px</div>
            </div>
            <button onClick={() => onRemove(spot.id)} style={{ ...css.neuButton(true, NEU.danger), padding: '6px 12px', fontSize: '12px' }}>✕</button>
        </div>
    );
}

// ─── MAIN DASHBOARD ───────────────────────────────────────────────────────────
const AdminDashboard = () => {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [socket, setSocket] = useState(null);
    const canvasRef = useRef(null);

    const [spots, setSpots] = useState([]);
    const [graph, setGraph] = useState({ nodes: [], edges: [] });
    const [mode, setMode] = useState('SPOTS');
    const [tempStart, setTempStart] = useState(null);
    const [toast, setToast] = useState(null);

    const CANVAS_W = 800;
    const CANVAS_H = 600;

    useEffect(() => {
        const s = io(SOCKET_URL);
        setSocket(s);
        s.emit('get_parking_data');
        s.emit('get_graph_data');
        s.on('update_map', setSpots);
        s.on('update_graph', setGraph);
        return () => s.disconnect();
    }, []);

    useCanvasDraw({ canvasRef, spots, graph, mode, tempStart });

    const showToast = (msg, type = 'success') => {
        setToast({ msg, type });
        setTimeout(() => setToast(null), 2500);
    };

    // --- BULLETPROOF COORDINATE EXTRACTION ---
    const getCoordinates = (e) => {
        const canvas = canvasRef.current;
        const rect = canvas.getBoundingClientRect();

        // Calculate the ratio between actual display size and internal 800x600 size
        const scaleX = CANVAS_W / rect.width;
        const scaleY = CANVAS_H / rect.height;

        let clientX, clientY;

        // Handle Touch Events for Mobile
        if (e.changedTouches && e.changedTouches.length > 0) {
            clientX = e.changedTouches[0].clientX;
            clientY = e.changedTouches[0].clientY;
        } else {
            // Handle Mouse Events for Desktop
            clientX = e.clientX;
            clientY = e.clientY;
        }

        return {
            x: (clientX - rect.left) * scaleX,
            y: (clientY - rect.top) * scaleY,
        };
    };

    const handleInteraction = useCallback((e) => {
        if (e.type === 'touchend') e.preventDefault(); // Prevent scrolling while tapping

        const { x, y } = getCoordinates(e);

        if (mode === 'SPOTS') {
            if (!tempStart) {
                setTempStart({ x, y });
            } else {
                const newSpot = {
                    id: `spot_${spots.length + 1}`,
                    x: Math.min(tempStart.x, x),
                    y: Math.min(tempStart.y, y),
                    w: Math.abs(x - tempStart.x),
                    h: Math.abs(y - tempStart.y),
                    status: 'vacant',
                };
                setSpots((prev) => [...prev, newSpot]);
                setTempStart(null);
            }
        } else if (mode === 'NODES') {
            const isEntrance = window.confirm('Is this an Entrance Node?');
            let poiLabel = null;
            if (!isEntrance) {
                poiLabel = window.prompt('POI label (leave blank if none):') || null;
            }
            setGraph((prev) => ({
                ...prev,
                nodes: [...prev.nodes, { id: prev.nodes.length + 1, x, y, isSpot: !isEntrance, poiLabel }],
            }));
        }
    }, [mode, tempStart, spots]);

    const saveSpots = () => { socket?.emit('save_map_config', spots); showToast('Spots saved ✓'); };
    const saveGraph = () => { socket?.emit('save_graph_config', graph); showToast('Nodes saved ✓'); };
    const clearCanvas = () => {
        if (window.confirm('Reset all unsaved changes?')) {
            socket?.emit('get_parking_data');
            socket?.emit('get_graph_data');
            setTempStart(null);
            showToast('Canvas reset', 'danger');
        }
    };

    if (!isAuthenticated) return <LoginScreen onAuth={() => setIsAuthenticated(true)} />;

    return (
        <div style={{ minHeight: '100vh', background: NEU.bg, fontFamily: NEU.fontBody, padding: '16px', overflowX: 'hidden' }}>
            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=Syne:wght@600;800&family=DM+Sans:wght@400;500;600&display=swap');
                * { box-sizing: border-box; }
                
                .pv-grid-layout {
                    display: grid;
                    grid-template-columns: 1fr;
                    gap: 20px;
                    max-width: 1200px;
                    margin: 0 auto;
                }
                
                @media (min-width: 900px) {
                    .pv-grid-layout {
                        grid-template-columns: 1fr 320px;
                        align-items: start;
                    }
                }

                ::-webkit-scrollbar { width: 6px; }
                ::-webkit-scrollbar-track { background: transparent; }
                ::-webkit-scrollbar-thumb { background: ${NEU.shadowDark}; border-radius: 4px; }
                button:active { transform: scale(0.96); }
            `}</style>

            <div style={{ maxWidth: '1200px', margin: '0 auto 24px', display: 'flex', flexWrap: 'wrap', gap: '10px', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <h1 style={{ fontFamily: NEU.fontDisplay, color: NEU.text, fontSize: 'clamp(20px,5vw,28px)', margin: 0 }}>⚙️ ParkVision Admin</h1>
                    <p style={{ color: NEU.textMuted, fontSize: '12px', margin: '4px 0 0' }}>Calibration & Mapping Panel</p>
                </div>
                <div style={{ ...css.neuFlat, padding: '8px 16px', fontSize: '12px', color: NEU.textMuted, borderRadius: '20px' }}>
                    {spots.length} spots · {graph.nodes?.length ?? 0} nodes
                </div>
            </div>

            <div className="pv-grid-layout">
                <div style={{ ...css.neuFlat, padding: 'clamp(10px, 3vw, 20px)' }}>

                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginBottom: '10px' }}>
                        <button onClick={() => { setMode('SPOTS'); setTempStart(null); }} style={css.neuButton(mode === 'SPOTS')}>🅿️ Draw Spots</button>
                        <button onClick={() => { setMode('NODES'); setTempStart(null); }} style={css.neuButton(mode === 'NODES')}>🔵 Plot Nodes</button>
                    </div>

                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginBottom: '16px' }}>
                        <button onClick={saveSpots} style={css.neuButton(false, NEU.success)}>💾 Spots</button>
                        <button onClick={saveGraph} style={css.neuButton(false, NEU.success)}>💾 Nodes</button>
                        <button onClick={clearCanvas} style={css.neuButton(false, NEU.danger)}>🗑 Reset</button>
                    </div>

                    <div style={{ ...css.neuInset, padding: '9px 14px', marginBottom: '14px', fontSize: '12px', color: NEU.textMuted, display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ color: NEU.accent, fontSize: '16px' }}>ℹ</span>
                        {mode === 'SPOTS' ? (tempStart ? '📍 Click/Tap second corner' : '📍 Click/Tap first corner') : '🔵 Click/Tap to place node'}
                    </div>

                    {/* NATIVE RESPONSIVE CANVAS CONTAINER */}
                    <div style={{
                        position: 'relative',
                        width: '100%',
                        maxWidth: '800px',
                        aspectRatio: '4 / 3',
                        borderRadius: '12px',
                        overflow: 'hidden',
                        ...css.neuInset,
                        cursor: 'crosshair',
                        touchAction: 'none'
                    }}>
                        <img
                            src={parkingLotImage}
                            alt="Lot"
                            style={{ width: '100%', height: '100%', position: 'absolute', top: 0, left: 0 }}
                            draggable="false"
                        />
                        <canvas
                            ref={canvasRef}
                            width={CANVAS_W}
                            height={CANVAS_H}
                            style={{
                                position: 'absolute',
                                top: 0,
                                left: 0,
                                width: '100%',
                                height: '100%',
                                zIndex: 10,
                                touchAction: 'none'
                            }}
                            onClick={handleInteraction}
                            onTouchEnd={handleInteraction}
                        />
                    </div>
                </div>

                <div style={{ ...css.neuFlat, padding: '20px', maxHeight: '70vh', display: 'flex', flexDirection: 'column' }}>
                    <h3 style={{ fontFamily: NEU.fontDisplay, color: NEU.text, fontSize: '16px', margin: '0 0 16px' }}>
                        🅿️ Drawn Spots
                        <span style={{ marginLeft: '10px', ...css.neuInset, padding: '2px 10px', fontSize: '12px', color: NEU.accent, borderRadius: '20px' }}>{spots.length}</span>
                    </h3>

                    <div style={{ overflowY: 'auto', flex: 1, paddingRight: '4px' }}>
                        {spots.length === 0 ? (
                            <div style={{ textAlign: 'center', color: NEU.textMuted, fontSize: '13px', padding: '30px 0' }}>
                                <div style={{ fontSize: '28px', marginBottom: '8px' }}>🗺️</div>
                                No spots drawn yet.
                            </div>
                        ) : (
                            spots.map((spot) => <SpotItem key={spot.id} spot={spot} onRemove={(id) => setSpots(spots.filter(s => s.id !== id))} />)
                        )}
                    </div>
                </div>
            </div>

            {toast && (
                <div style={{ position: 'fixed', bottom: '24px', left: '50%', transform: 'translateX(-50%)', background: toast.type === 'danger' ? NEU.danger : NEU.success, color: 'white', padding: '12px 24px', borderRadius: '30px', fontSize: '13px', fontWeight: '600', boxShadow: '0 8px 24px rgba(0,0,0,0.15)', zIndex: 999 }}>
                    {toast.msg}
                </div>
            )}
        </div>
    );
};

export default AdminDashboard;