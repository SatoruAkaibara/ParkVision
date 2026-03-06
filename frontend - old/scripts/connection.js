const socket = io("http://localhost:3001");

const parkingImg = document.getElementById('parking-image');
const overlayLayer = document.getElementById('overlay-layer');
const vacantCountEl = document.getElementById('vacant-count');
const occupiedCountEl = document.getElementById('occupied-count');

// Store data globally so we can redraw on window resize
let currentParkingData = [];
// Ensure map renders as soon as the image is physically loaded
parkingImg.onload = () => {
    if (currentParkingData.length > 0) renderMap(currentParkingData);
};
// 1. Initial Connection
socket.on("connect", () => {
    console.log("✅ CONNECTED!");
    socket.emit("get_parking_data");
});

// 2. Handle Resize (Responsive)
window.addEventListener('resize', () => {
    renderMap(currentParkingData);
});

// 3. Receive Data
socket.on("update_map", (data) => {
    console.log("📦 Map Update:", data);
    currentParkingData = data;
    renderMap(data);
    // Inside socket.on("update_map")
    const badge = document.querySelector('.status-badge');
    badge.style.background = "rgba(48, 209, 88, 0.4)"; // Brief flash
    setTimeout(() => {
        badge.style.background = "rgba(48, 209, 88, 0.15)";
    }, 500);
});

// 4. The Rendering Function
function renderMap(spots) {
    if (!overlayLayer || !parkingImg) return;

    // Clear old spots
    overlayLayer.innerHTML = "";

    let vacant = 0;
    let occupied = 0;

    // Calculate Scale Factor
    // (Current Display Width / Original Image Width)
    // Note: This assumes Admin saved spots on the FULL size image.
    // If Admin saved on a scaled image, we might need a fixed reference.
    // For now, we use naturalWidth as the "Truth".
    const scaleX = parkingImg.clientWidth / parkingImg.naturalWidth;
    const scaleY = parkingImg.clientHeight / parkingImg.naturalHeight;

    // Safety: If image isn't loaded yet, try again in 100ms
    if (parkingImg.naturalWidth === 0) {
        setTimeout(() => renderMap(spots), 100);
        return;
    }

    spots.forEach(spot => {
        // Update Stats
        if (spot.status === 'vacant') vacant++; else occupied++;

        // Create Element
        const div = document.createElement("div");
        div.classList.add("spot-overlay", spot.status);

        // APPLY SCALED COORDINATES
        div.style.left = (spot.x * scaleX) + "px";
        div.style.top = (spot.y * scaleY) + "px";
        div.style.width = (spot.w * scaleX) + "px";
        div.style.height = (spot.h * scaleY) + "px";

        // Add Label
        div.innerHTML = `<span class="spot-label">${spot.id}</span>`;

        overlayLayer.appendChild(div);
    });

    // Update Footer
    if (vacantCountEl) vacantCountEl.innerText = vacant;
    if (occupiedCountEl) occupiedCountEl.innerText = occupied;
}