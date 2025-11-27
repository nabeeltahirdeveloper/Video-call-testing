const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('../client')); // Serve client files

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const users = {}; // userId -> ws

// WebSocket Connection
wss.on('connection', (ws) => {
    console.log('New client connected');

    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);
            const { type, userId, targetId, offer, answer, candidate } = data;

            switch (type) {
                case 'register':
                    if (userId) {
                        users[userId] = ws;
                        ws.userId = userId;
                        console.log(`User registered: ${userId}`);
                        ws.send(JSON.stringify({ type: 'registered', userId }));
                    }
                    break;

                case 'offer':
                    if (targetId && users[targetId]) {
                        console.log(`Sending offer from ${userId} to ${targetId}`);
                        users[targetId].send(JSON.stringify({
                            type: 'offer',
                            offer,
                            senderId: userId
                        }));
                    } else {
                        console.log(`Target user ${targetId} not found for offer`);
                    }
                    break;

                case 'answer':
                    if (targetId && users[targetId]) {
                        console.log(`Sending answer from ${userId} to ${targetId}`);
                        users[targetId].send(JSON.stringify({
                            type: 'answer',
                            answer,
                            senderId: userId
                        }));
                    } else {
                        console.log(`Target user ${targetId} not found for answer`);
                    }
                    break;

                case 'candidate':
                    if (targetId && users[targetId]) {
                        console.log(`Sending candidate from ${userId} to ${targetId}`);
                        users[targetId].send(JSON.stringify({
                            type: 'candidate',
                            candidate,
                            senderId: userId
                        }));
                    } else {
                        console.log(`Target user ${targetId} not found for candidate`);
                    }
                    break;

                default:
                    console.log('Unknown message type:', type);
            }
        } catch (error) {
            console.error('Error parsing message:', error);
        }
    });

    ws.on('close', () => {
        if (ws.userId && users[ws.userId]) {
            console.log(`User disconnected: ${ws.userId}`);
            delete users[ws.userId];
        }
    });
});

// ICE Servers Endpoint
app.get('/getIceServers', (req, res) => {
    const iceServers = [
        { urls: 'stun:stun.l.google.com:19302' },
    ];

    if (process.env.TURN_URL && process.env.TURN_USERNAME && process.env.TURN_PASSWORD) {
        iceServers.push({
            urls: process.env.TURN_URL,
            username: process.env.TURN_USERNAME,
            credential: process.env.TURN_PASSWORD
        });
    }

    res.json({ iceServers });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
