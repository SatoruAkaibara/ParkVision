const socket = io("http://localhost:3001");
const canvas = document.getElementById('parkingCanvas');
const ctx = canvas.getContext('2d');
const spotList = document.getElementById('spot-list');
const spotCountSpan = document.getElementById('spot-count');
const placeholder = document.getElementById('placeholder-text');

// Mode Toggle Elements
const modeSpotsBtn = document.getElementById('modeSpotsBtn');
const modePathsBtn = document.getElementById('modePathsBtn');

// Load Image
const img = new Image();
img.src = './assets/parking_lot.jpg';

// --- STATE ---
let currentMode = 'spots'; // 'spots' or 'paths'

// Spots State (YOLO Boxes)
let spots = [];
let isDrawing = false;
let startX, startY;

// Paths State (Navigation Graph)
let nodes = [];
let edges = [];
let selectedNodeId = null;

// 1. Load & Responsive Resize
img.onload = () => {
    if (placeholder) placeholder.style.display = 'none';
    canvas.style.opacity = '0';
    setTimeout(() => { canvas.style.opacity = '1'; }, 50);
    canvas.width = img.width;
    canvas.height = img.height;

    draw();
    socket.emit('get_parking_data');
    socket.emit('get_graph_data'); // 👈 ADD THIS: Ask server for the saved graph
};

// Listen for YOLO Spots loading
socket.on('update_map', (data) => {
    if (spots.length === 0 && data.length > 0) {
        spots = data;
        draw();
        updateList();
    }
});

socket.on('update_graph', (data) => {
    if (nodes.length === 0 && data.nodes) {
        console.log("📥 Loaded existing graph from server.");
        nodes = data.nodes || [];
        edges = data.edges || [];
        draw();
    }
});
// --- UI TOGGLE LOGIC ---
modeSpotsBtn.addEventListener('click', () => {
    currentMode = 'spots';
    modeSpotsBtn.style.background = 'var(--primary-color)'; // Active
    modePathsBtn.style.background = '#333'; // Inactive
    selectedNodeId = null; // Clear selections
    draw();
});

modePathsBtn.addEventListener('click', () => {
    currentMode = 'paths';
    modePathsBtn.style.background = 'var(--primary-color)'; // Active
    modeSpotsBtn.style.background = '#333'; // Inactive
});

// 2. HELPER: Get Mouse Position
function getCursorPosition(canvas, event) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
        x: (event.clientX - rect.left) * scaleX,
        y: (event.clientY - rect.top) * scaleY
    };
}

// 3. Mouse Logic (Handles BOTH Modes)
canvas.addEventListener('mousedown', (e) => {
    const pos = getCursorPosition(canvas, e);

    if (currentMode === 'spots') {
        // Start dragging a bounding box
        startX = pos.x;
        startY = pos.y;
        isDrawing = true;
    }
    else if (currentMode === 'paths') {
        // Click logic for Nodes and Edges
        const clickedNode = nodes.find(node =>
            Math.abs(node.x - pos.x) < 20 && Math.abs(node.y - pos.y) < 20
        );

        if (clickedNode) {
            if (selectedNodeId && selectedNodeId !== clickedNode.id) {
                // Connect two nodes
                edges.push({ from: selectedNodeId, to: clickedNode.id });
                selectedNodeId = null;
            } else {
                // Select a node
                selectedNodeId = clickedNode.id;
            }
        } else {
            // Create a new node
            nodes.push({
                id: `node_${Date.now()}`,
                x: pos.x,
                y: pos.y,
                isSpot: false
            });
        }
        draw();
    }
});

canvas.addEventListener('mouseup', (e) => {
    if (currentMode === 'spots' && isDrawing) {
        const pos = getCursorPosition(canvas, e);
        let w = pos.x - startX;
        let h = pos.y - startY;

        if (Math.abs(w) > 10 && Math.abs(h) > 10) {
            spots.push({
                id: `Spot-${spots.length + 1}`,
                x: startX,
                y: startY,
                w: w,
                h: h,
                status: 'vacant'
            });
            updateList();
        }
        isDrawing = false;
        draw();
    }
});

// 5. Draw Loop (Draws Image -> Spots -> Graph)
function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    // A. Draw YOLO Spots
    spots.forEach(spot => {
        ctx.strokeStyle = '#30D158';
        ctx.lineWidth = 4;
        ctx.strokeRect(spot.x, spot.y, spot.w, spot.h);
        ctx.fillStyle = 'rgba(48, 209, 88, 0.2)';
        ctx.fillRect(spot.x, spot.y, spot.w, spot.h);
        ctx.fillStyle = 'rgba(0,0,0,0.7)';
        ctx.fillRect(spot.x, spot.y, 60, 20);
        ctx.fillStyle = 'white';
        ctx.font = 'bold 12px Arial';
        ctx.fillText(spot.id, spot.x + 5, spot.y + 14);
    });

    // B. Draw Graph Edges (Lines)
    ctx.strokeStyle = '#00FF00';
    ctx.lineWidth = 4;
    edges.forEach(edge => {
        const fromNode = nodes.find(n => n.id === edge.from);
        const toNode = nodes.find(n => n.id === edge.to);
        if (fromNode && toNode) {
            ctx.beginPath();
            ctx.moveTo(fromNode.x, fromNode.y);
            ctx.lineTo(toNode.x, toNode.y);
            ctx.stroke();
        }
    });

    // C. Draw Graph Nodes (Dots)
    nodes.forEach(node => {
        ctx.beginPath();
        ctx.arc(node.x, node.y, 12, 0, 2 * Math.PI);
        ctx.fillStyle = node.id === selectedNodeId ? '#FF453A' : '#0A84FF'; // Red if selected, Blue otherwise
        ctx.fill();
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 2;
        ctx.stroke();
    });
}

// 6. Sidebar Logic (Unchanged)
function updateList() {
    spotList.innerHTML = '';
    spotCountSpan.innerText = spots.length;

    if (spots.length === 0) {
        spotList.innerHTML = `<div style="text-align:center; color: var(--text-secondary); margin-top: 20px; font-size: 13px;">No zones created.<br>Click and drag on map to draw.</div>`;
        return;
    }

    spots.forEach((spot, index) => {
        const div = document.createElement('div');
        div.className = 'list-item';
        div.innerHTML = `
            <div style="display:flex; align-items:center; gap:10px;">
                <span style="color:#30D158; font-size:10px;">●</span>
                <span>${spot.id}</span>
            </div>
            <button class="delete-btn" onclick="deleteSpot(${index})" title="Remove Spot">
                <span class="material-symbols-rounded" style="font-size: 18px;">remove</span>
            </button>
        `;
        spotList.appendChild(div);
    });
}

window.deleteSpot = (index) => {
    spots.splice(index, 1);
    draw();
    updateList();
};

// 7. Save Logic (Now saves both!)
document.getElementById('saveBtn').addEventListener('click', () => {
    if (spots.length === 0 && nodes.length === 0) return alert("Nothing to save!");

    // Send YOLO spots to server
    socket.emit('save_map_config', spots);

    // NEW: Send Graph data to server
    socket.emit('save_graph_config', { nodes, edges });

    alert("✅ Map & Graph Saved!");
});

document.getElementById('clearBtn').addEventListener('click', () => {
    if (confirm("Clear all spots and paths?")) {
        spots = [];
        nodes = [];
        edges = [];
        selectedNodeId = null;
        draw();
        updateList();

        socket.emit('save_map_config', []);
        socket.emit('save_graph_config', { nodes: [], edges: [] });
    }
});
// --- PRO-DEVELOPER TOOL: Auto-Generate Nodes inside YOLO Spots ---
// You can run this by typing autoGenerateSpotNodes() in your browser console!
window.autoGenerateSpotNodes = () => {
    if (spots.length === 0) return alert("Draw your YOLO spots first!");

    let addedCount = 0;

    spots.forEach(spot => {
        // Find the exact center of the YOLO box
        const centerX = spot.x + (spot.w / 2);
        const centerY = spot.y + (spot.h / 2);

        // Check if a node already exists near this center so we don't double-create
        const exists = nodes.some(n => Math.abs(n.x - centerX) < 10 && Math.abs(n.y - centerY) < 10);

        if (!exists) {
            nodes.push({
                id: `node_spot_${spot.id}`, // Link the node ID to the Spot ID
                x: centerX,
                y: centerY,
                isSpot: true
            });
            addedCount++;
        }
    });

    draw();
    console.log(`✅ Auto-generated ${addedCount} nodes inside parking spots!`);
    alert(`Added ${addedCount} destination nodes. Now just connect them to your main driving path!`);
};