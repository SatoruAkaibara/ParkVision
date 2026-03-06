import React, { useEffect, useRef } from 'react';
// Make sure you place your parking lot image inside the src/assets/ folder
import parkingLotImage from '../assets/parking_lot.png';

const MapRenderer = ({ spots, graph, currentPath }) => {
    const canvasRef = useRef(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');

        // 1. Clear the canvas before every new frame
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // 2. Draw Parking Spots (Red/Green Boxes)
        if (spots && spots.length > 0) {
            spots.forEach(spot => {
                ctx.beginPath();
                ctx.rect(spot.x, spot.y, spot.w, spot.h);

                // Fill color based on YOLOv11 occupancy status
                ctx.fillStyle = spot.status === 'occupied'
                    ? 'rgba(255, 0, 0, 0.4)' // Red
                    : 'rgba(0, 255, 0, 0.4)'; // Green
                ctx.fill();

                ctx.lineWidth = 2;
                ctx.strokeStyle = spot.status === 'occupied' ? '#cc0000' : '#00cc00';
                ctx.stroke();
            });
        }

        // 3. Draw the BFS Navigation Route (if a path exists)
        if (currentPath && currentPath.length > 0 && graph.nodes) {
            ctx.beginPath();
            ctx.lineWidth = 5;
            ctx.strokeStyle = '#007bff'; // Blue route line
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';

            currentPath.forEach((nodeId, index) => {
                const node = graph.nodes.find(n => n.id === nodeId);
                if (node) {
                    if (index === 0) {
                        ctx.moveTo(node.x, node.y);
                    } else {
                        ctx.lineTo(node.x, node.y);
                    }
                }
            });
            ctx.stroke();
        }
    }, [spots, graph, currentPath]); // Re-draws anytime these 3 variables change!

    return (
        <div style={{ position: 'relative', width: '800px', height: '600px', border: '2px solid #333' }}>
            <img
                src={parkingLotImage}
                alt="Parking Lot Layout"
                style={{
                    width: '800px',
                    height: '600px',
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    objectFit: 'fill' // This ensures the pixels map 1:1 to the 800x600 canvas
                }}
            />
            <canvas
                ref={canvasRef}
                width={800}
                height={600}
                style={{ position: 'absolute', top: 0, left: 0, zIndex: 10 }}
            />
        </div>
    );
};

export default MapRenderer;