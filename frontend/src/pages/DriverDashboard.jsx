import React, { useState, useEffect, useRef } from 'react';
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
        padding: '12px 24px',
        fontFamily: NEU.fontBody,
        fontWeight: '700',
        fontSize: '15px',
        cursor: 'pointer',
        transition: 'all 0.2s ease',
        boxShadow: active
            ? `0 4px 14px ${color}66`
            : `4px 4px 10px ${NEU.shadowDark}, -4px -4px 10px ${NEU.shadowLight}`,
        letterSpacing: '0.5px',
    }),
};

const DriverDashboard = () => {
    const [socket, setSocket] = useState(null);
    const canvasRef = useRef(null);
    const containerRef = useRef(null);

    // Core Data State
    const [spots, setSpots] = useState([]);
    const [graph, setGraph] = useState({ nodes: [], edges: [] });
    const [scale, setScale] = useState(1);

    // Routing State
    const [currentPath, setCurrentPath] = useState([]);
    const [selectedPoi, setSelectedPoi] = useState('');

    const CANVAS_W = 800;
    const CANVAS_H = 600;

    // --- 1. CONNECT TO SERVER & LISTEN FOR ROUTES ---
    useEffect(() => {
        const s = io(SOCKET_URL);
        setSocket(s);

        s.emit('get_parking_data');
        s.emit('get_graph_data');

        s.on('update_map', setSpots);
        s.on('update_graph', setGraph);

        s.on('route_calculated', (bestPath) => {
            setCurrentPath(bestPath);
        });

        s.on('route_failed', (data) => {
            alert(data.message);
            setCurrentPath([]);
        });

        return () => s.disconnect();
    }, []);

    // --- 2. RESPONSIVE SCALING ---
    useEffect(() => {
        if (!containerRef.current) return;
        const ro = new ResizeObserver((entries) => {
            for (const entry of entries) {
                const available = entry.contentRect.width;
                if (available > 0) setScale(Math.min(1, available / CANVAS_W));
            }
        });
        ro.observe(containerRef.current);
        return () => ro.disconnect();
    }, []);

    // --- 3. DRAW THE MAP & BFS PATH ---
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // A. Draw Parking Spots
        spots.forEach((spot) => {
            const isOccupied = spot.status === 'occupied';
            const color = isOccupied ? NEU.danger : NEU.success;

            ctx.fillStyle = isOccupied ? 'rgba(224, 92, 92, 0.4)' : 'rgba(76, 175, 142, 0.4)';
            ctx.fillRect(spot.x, spot.y, spot.w, spot.h);
            ctx.strokeStyle = color;
            ctx.lineWidth = 3;
            ctx.strokeRect(spot.x, spot.y, spot.w, spot.h);

            ctx.fillStyle = '#fff';
            ctx.font = `bold 14px 'DM Sans', sans-serif`;
            ctx.shadowColor = 'rgba(0,0,0,0.8)';
            ctx.shadowBlur = 4;
            ctx.fillText(spot.id, spot.x + 8, spot.y + 20);
            ctx.shadowBlur = 0;
        });

        // B. Draw Routing Path (If one exists)
        if (currentPath && currentPath.length > 0 && graph.nodes.length > 0) {
            ctx.beginPath();
            ctx.strokeStyle = NEU.accent;
            ctx.lineWidth = 6;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';

            // Add a cool neon glow to the path
            ctx.shadowColor = NEU.accent;
            ctx.shadowBlur = 12;

            const startNode = graph.nodes.find(n => n.id === currentPath[0] || n.id === String(currentPath[0]));
            if (startNode) ctx.moveTo(startNode.x, startNode.y);

            for (let i = 1; i < currentPath.length; i++) {
                const node = graph.nodes.find(n => n.id === currentPath[i] || n.id === String(currentPath[i]));
                if (node) ctx.lineTo(node.x, node.y);
            }
            ctx.stroke();
            ctx.shadowBlur = 0; // Reset shadow
        }
    }, [spots, graph, currentPath]);

    // --- 4. CALCULATE LIVE AVAILABILITY ---
    const totalSpots = spots.length;
    const availableSpots = spots.filter(spot => spot.status === 'vacant').length;
    const isFull = totalSpots > 0 && availableSpots === 0;

    // --- 5. EXTRACT POIs FOR DROPDOWN ---
    const availablePois = graph.nodes
        .filter(n => n.poiLabel)
        .map(n => n.poiLabel);

    // --- 6. ROUTE REQUEST HANDLER ---
    const handleRequestRoute = () => {
        if (socket) {
            socket.emit('request_route', selectedPoi || null);
        }
    };

    return (
        <div style={{ minHeight: '100vh', background: NEU.bg, fontFamily: NEU.fontBody, padding: '20px' }}>
            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=Syne:wght@600;800&family=DM+Sans:wght@400;500;600&display=swap');
                * { box-sizing: border-box; }
                select:focus { outline: none; border-color: ${NEU.accent}; }
            `}</style>

            <div style={{ maxWidth: '900px', margin: '0 auto' }}>

                {/* ─── LIVE COUNTER HEADER ─── */}
                <div style={{ ...css.neuFlat, padding: '30px', marginBottom: '20px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <h1 style={{ fontFamily: NEU.fontDisplay, color: NEU.text, fontSize: '32px', margin: '0 0 15px 0' }}>
                        ParkVision Live
                    </h1>

                    <div style={{
                        ...css.neuInset,
                        padding: '15px 40px',
                        borderRadius: '20px',
                        border: `2px solid ${isFull ? NEU.danger : NEU.success}`,
                        background: isFull ? 'rgba(224, 92, 92, 0.1)' : 'rgba(76, 175, 142, 0.1)'
                    }}>
                        <div style={{ fontSize: '48px', fontWeight: '800', color: isFull ? NEU.danger : NEU.success, lineHeight: '1' }}>
                            {availableSpots} <span style={{ fontSize: '24px', color: NEU.textMuted }}>/ {totalSpots}</span>
                        </div>
                        <div style={{ fontSize: '14px', fontWeight: '600', color: NEU.textMuted, marginTop: '5px', textTransform: 'uppercase', letterSpacing: '2px' }}>
                            {isFull ? 'Lot Full' : 'Spots Available'}
                        </div>
                    </div>
                </div>

                {/* ─── NAVIGATION CONTROLS (BFS) ─── */}
                <div style={{ ...css.neuFlat, padding: '20px', marginBottom: '20px', display: 'flex', flexWrap: 'wrap', gap: '15px', alignItems: 'center', justifyContent: 'center' }}>
                    <div style={{ ...css.neuInset, padding: '5px 15px', borderRadius: '10px', flex: '1 1 250px' }}>
                        <select
                            value={selectedPoi}
                            onChange={(e) => setSelectedPoi(e.target.value)}
                            style={{
                                width: '100%', padding: '10px 0', background: 'transparent', border: 'none',
                                fontFamily: NEU.fontBody, fontSize: '15px', color: NEU.text, fontWeight: '600'
                            }}
                        >
                            <option value="">Park Nearest to Entrance</option>
                            {availablePois.map((poi, idx) => (
                                <option key={idx} value={poi}>Park near {poi}</option>
                            ))}
                        </select>
                    </div>

                    <button
                        onClick={handleRequestRoute}
                        style={{ ...css.neuButton(true, NEU.accent), flex: '1 1 200px' }}
                        disabled={isFull}
                    >
                        {isFull ? 'Lot is Full' : (selectedPoi ? `Route to ${selectedPoi}` : 'Find Nearest Spot')}
                    </button>

                    {currentPath.length > 0 && (
                        <button
                            onClick={() => setCurrentPath([])}
                            style={{ ...css.neuButton(false, NEU.danger), flex: '0 1 auto' }}
                        >
                            Clear Route
                        </button>
                    )}
                </div>

                {/* ─── LIVE VIEW MAP ─── */}
                <div style={{ ...css.neuFlat, padding: '20px' }}>
                    <div style={{ display: 'flex', gap: '15px', justifyContent: 'center', marginBottom: '15px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', color: NEU.text, fontWeight: '600' }}>
                            <div style={{ width: '16px', height: '16px', borderRadius: '4px', background: NEU.success }}></div> Vacant
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', color: NEU.text, fontWeight: '600' }}>
                            <div style={{ width: '16px', height: '16px', borderRadius: '4px', background: NEU.danger }}></div> Occupied
                        </div>
                    </div>

                    <div ref={containerRef} style={{ width: '100%', display: 'flex', justifyContent: 'center', overflow: 'hidden' }}>
                        <div style={{
                            position: 'relative',
                            width: `${CANVAS_W}px`,
                            height: `${CANVAS_H}px`,
                            borderRadius: '12px',
                            overflow: 'hidden',
                            ...css.neuInset,
                            transformOrigin: 'top center',
                            transform: `scale(${scale})`
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
                                style={{ position: 'absolute', top: 0, left: 0, zIndex: 10 }}
                            />
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
};

export default DriverDashboard;