import { useState, useEffect } from 'react';
import { io } from 'socket.io-client';

// Replace 3000 with whatever port your Node.js server runs on
const SOCKET_URL = 'http://localhost:3000';

const useSocket = () => {
    const [parkingData, setParkingData] = useState(null);
    const [isConnected, setIsConnected] = useState(false);

    useEffect(() => {
        // 1. Initialize the connection
        const socket = io(SOCKET_URL);

        // 2. Handle connection status
        socket.on('connect', () => {
            console.log('Connected to ParkVision Node.js Server');
            setIsConnected(true);
        });

        socket.on('disconnect', () => {
            console.log('Disconnected from server');
            setIsConnected(false);
        });

        // 3. Listen for your specific ParkVision occupancy updates
        // Make sure 'MAP_UPDATE' matches the event name your Node server emits
        socket.on('MAP_UPDATE', (data) => {
            setParkingData(data);
        });

        // 4. Cleanup: disconnect when the component unmounts (user leaves the app)
        return () => {
            socket.disconnect();
        };
    }, []); // The empty array ensures this only connects once when the app loads

    return { parkingData, isConnected };
};

export default useSocket;