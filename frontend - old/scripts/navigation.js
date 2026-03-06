
// Grab our new canvas and the background image
const navCanvas = document.getElementById('navigationCanvas');
const navCtx = navCanvas.getContext('2d');
const parkingImg = document.getElementById('parking-image');

// This will store the exact (X, Y) coordinates of our map dots
let savedGraphNodes = [];

// 1. Resize canvas to match the image exactly once it loads
function initializeNavigationCanvas() {
    // Set internal resolution of canvas to match the image resolution
    navCanvas.width = parkingImg.naturalWidth;
    navCanvas.height = parkingImg.naturalHeight;

    // Ask the server for the graph data
    socket.emit('get_graph_data');
}

// Check if image is already loaded from cache, otherwise wait for it
if (parkingImg.complete) {
    initializeNavigationCanvas();
} else {
    parkingImg.onload = initializeNavigationCanvas;
}
// 2. Receive the map data from the server
// In scripts/navigation.js

socket.on('update_graph', (graphData) => {
    console.log("🗺️ Navigation Graph Loaded:", graphData.nodes.length, "nodes");
    savedGraphNodes = graphData.nodes;

    socket.emit('request_route');
});

// 3. Listen for the server sending the "Best Route"
// It will look like this: ['node_123', 'node_456', 'Spot-2']
socket.on('route_calculated', (pathArray) => {
    console.log("🚗 Drawing route for driver:", pathArray);
    drawNavigationLine(pathArray);
});

// 4. Function to draw the glowing line on the user's screen
function drawNavigationLine(pathArray) {
    // Clear any old lines first
    navCtx.clearRect(0, 0, navCanvas.width, navCanvas.height);

    if (!pathArray || pathArray.length < 2) return;

    // Styling the navigation line
    navCtx.strokeStyle = '#30D158'; // ParkVision Green
    navCtx.lineWidth = 8;           // Thick enough to see easily
    navCtx.lineCap = 'round';       // Rounded ends
    navCtx.lineJoin = 'round';      // Smooth corners when turning

    // Optional: Add a subtle glow effect to the line
    navCtx.shadowColor = '#30D158';
    navCtx.shadowBlur = 15;

    navCtx.beginPath();

    // Loop through the path array and connect the dots
    pathArray.forEach((nodeId, index) => {
        // Look up the exact X,Y coordinates of this node from our saved list
        const nodeData = savedGraphNodes.find(n => n.id === nodeId);

        if (nodeData) {
            if (index === 0) {
                navCtx.moveTo(nodeData.x, nodeData.y); // Start line here
            } else {
                navCtx.lineTo(nodeData.x, nodeData.y); // Draw line to here
            }
        }
    });

    navCtx.stroke(); // Render the line on the screen
}