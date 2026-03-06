const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const cors = require('cors');
const fs = require('fs');

const app = express();

// 1. MIDDLEWARE: Allow the server to read JSON data from Python and React
app.use(express.json());
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*", // Allows your Vite React app to connect without CORS errors
        methods: ["GET", "POST"]
    }
});


// --- PARKING LOGIC & MATH ALGORITHMS ---

// Helper: Euclidean Distance Math for POI routing
function calculateEuclideanDistance(nodeA, nodeB) {
    return Math.sqrt(Math.pow(nodeA.x - nodeB.x, 2) + Math.pow(nodeA.y - nodeB.y, 2));
}

// 1. Find which Graph Nodes are inside Vacant YOLO Spots
function getAvailableDestinationNodes(graphNodes, yoloSpots) {
    const vacantSpots = yoloSpots.filter(spot => spot.status === 'vacant');
    let vacantNodeIds = [];

    graphNodes.forEach(node => {
        vacantSpots.forEach(spot => {
            if (node.x >= spot.x && node.x <= spot.x + spot.w &&
                node.y >= spot.y && node.y <= spot.y + spot.h) {
                vacantNodeIds.push(node.id);
            }
        });
    });
    return vacantNodeIds;
}

// 2. Build an Adjacency List from the directed edges
function buildAdjacencyList(edges) {
    const adjList = {};
    edges.forEach(edge => {
        if (!adjList[edge.from]) adjList[edge.from] = [];
        if (!adjList[edge.to]) adjList[edge.to] = [];

        adjList[edge.from].push(edge.to);
        adjList[edge.to].push(edge.from);
    });
    return adjList;
}

// 3. The Breadth-First Search (BFS) Algorithm
function calculateBestRoute(graphData, startNodeId, targetNodeIds) {
    if (!graphData.edges || graphData.edges.length === 0) return null;
    if (targetNodeIds.length === 0) return null; // No empty spots!

    const adjList = buildAdjacencyList(graphData.edges);
    let queue = [[startNodeId]];
    let visited = new Set();
    visited.add(startNodeId);

    while (queue.length > 0) {
        let currentPath = queue.shift();
        let currentNode = currentPath[currentPath.length - 1];

        if (targetNodeIds.includes(currentNode)) {
            return currentPath;
        }

        let neighbors = adjList[currentNode] || [];
        for (let neighbor of neighbors) {
            if (!visited.has(neighbor)) {
                visited.add(neighbor);
                queue.push([...currentPath, neighbor]);
            }
        }
    }
    return null;
}


// --- VARIABLES ---
const DB_FILE = './parking_spots.json';
const GRAPH_FILE = './graph_config.json';

// --- SOCKET CONNECTION (Frontend to Backend Bridge) ---
io.on('connection', (socket) => {
    console.log(`✅ User Connected: ${socket.id}`);

    // A. Frontend asks for data
    socket.on('get_parking_data', () => {
        fs.readFile(DB_FILE, 'utf8', (err, data) => {
            if (!err) socket.emit('update_map', JSON.parse(data));
        });
    });

    // B. Admin saves new spots
    socket.on('save_map_config', (newSpots) => {
        console.log(`💾 ADMIN SAVE: Updating ${newSpots.length} spots...`);
        fs.writeFile(DB_FILE, JSON.stringify(newSpots, null, 2), (err) => {
            if (!err) io.emit('update_map', newSpots);
        });
    });

    // C. Frontend/Admin asks for the Navigation Graph
    socket.on('get_graph_data', () => {
        fs.readFile(GRAPH_FILE, 'utf8', (err, data) => {
            if (!err && data) {
                socket.emit('update_graph', JSON.parse(data));
            } else {
                socket.emit('update_graph', { nodes: [], edges: [] });
            }
        });
    });

    // D. Admin saves the new Navigation Graph
    socket.on('save_graph_config', (graphData) => {
        console.log(`🔗 ADMIN SAVE: Updating Navigation Graph (${graphData.nodes.length} nodes)...`);
        fs.writeFile(GRAPH_FILE, JSON.stringify(graphData, null, 2), (err) => {
            if (!err) {
                io.emit('update_graph', graphData);
            } else {
                console.error("❌ Error saving graph:", err);
            }
        });
    });

    // E. When a driver's screen asks for directions (Now supports POI!)
    socket.on('request_route', (selectedPoiId = null) => {
        fs.readFile(DB_FILE, 'utf8', (err1, spotData) => {
            fs.readFile(GRAPH_FILE, 'utf8', (err2, graphData) => {
                if (err1 || err2) return;

                const yoloSpots = JSON.parse(spotData);
                const graph = JSON.parse(graphData);

                if (graph.nodes.length === 0) return;

                // 1. Find the Entrance Node
                const entranceNode = graph.nodes.find(node => node.isSpot === false);
                if (!entranceNode) {
                    console.log("⚠️ No entrance node found! Draw a regular path node first.");
                    return;
                }

                // 2. Get all vacant spots
                let vacantDestinations = getAvailableDestinationNodes(graph.nodes, yoloSpots);

                // 3. THE NEW LOGIC: Filter by POI using Euclidean Distance
                if (selectedPoiId && vacantDestinations.length > 0) {
                    const poiNode = graph.nodes.find(n => n.id === selectedPoiId);

                    if (poiNode) {
                        console.log(`🎯 POI Selected. Calculating Euclidean distances to node ${selectedPoiId}...`);

                        let minDistance = Infinity;
                        let bestNodeId = null;

                        // Check distance from POI to every vacant spot
                        vacantDestinations.forEach(vacantId => {
                            const vacantNode = graph.nodes.find(n => n.id === vacantId);
                            // Ensure the vacantNode actually exists before doing math on it
                            if (vacantNode) {
                                const distance = calculateEuclideanDistance(poiNode, vacantNode);

                                if (distance < minDistance) {
                                    minDistance = distance;
                                    bestNodeId = vacantId;
                                }
                            }
                        });

                        // Select Minimum Distance Node (Overriding the default list)
                        if (bestNodeId) {
                            vacantDestinations = [bestNodeId];
                        }
                    }
                }

                // 4. Execute BFS Pathfinding Algorithm
                const bestPath = calculateBestRoute(graph, entranceNode.id, vacantDestinations);

                if (bestPath) {
                    console.log(`🛣️ Route calculated! Sending path to driver:`, bestPath);
                    socket.emit('route_calculated', bestPath);
                } else {
                    console.log("Lot is full or no path exists.");
                    // Optional: emit an event to tell React the lot is full
                    socket.emit('route_failed', { message: "Lot is full or no path exists" });
                }
            });
        });
    });

}); // <--- THIS BRACKET CLOSES THE SOCKET CONNECTION! 


// -------------------------------------------------------------------
// --- THE API BRIDGE (This is where Python YOLOv11 connects) ---
// -------------------------------------------------------------------

// 1. Python calls this to see where the spots are (GET)
app.get('/api/map-config', (req, res) => {
    fs.readFile(DB_FILE, 'utf8', (err, data) => {
        if (err) return res.status(500).json([]);
        res.json(JSON.parse(data));
    });
});

// 2. Python calls this to tell the server what it detected (POST)
app.post('/api/update', (req, res) => {
    const aiData = req.body;
    console.log("🤖 AI UPDATE RECEIVED:", aiData);

    fs.readFile(DB_FILE, 'utf8', (err, fileData) => {
        if (err) return res.status(500).send("Database Error");

        let currentSpots = JSON.parse(fileData);

        currentSpots.forEach(spot => {
            if (aiData[spot.id]) {
                spot.status = aiData[spot.id];
            }
        });

        fs.writeFile(DB_FILE, JSON.stringify(currentSpots, null, 2), () => {
            io.emit('update_map', currentSpots);
            // After updating spots, tell all screens to instantly recalculate the route!
            io.emit('request_route');
            res.send({ status: "success", message: "Map updated" });
        });
    });
});

// --- START SERVER ---
server.listen(3001, () => {
    console.log("🚀 PARKVISION BACKEND RUNNING ON PORT 3001");
    console.log("📡 Ready for Python AI Connection...");
});