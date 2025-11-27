const myIdInput = document.getElementById('myId');
const otherIdInput = document.getElementById('otherId');
const registerBtn = document.getElementById('registerBtn');
const callBtn = document.getElementById('callBtn');
const localVideo = document.getElementById('localVideo');
const remoteVideo = document.getElementById('remoteVideo');
const statusDiv = document.getElementById('status');

let localStream;
let peerConnection;
let ws;
let myId;
let targetId;

// Configuration will be fetched from server
let rtcConfig = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' }
    ]
};

async function init() {
    try {
        // Fetch ICE servers
        const response = await fetch('/getIceServers');
        const data = await response.json();
        rtcConfig = { iceServers: data.iceServers };
        console.log('ICE Servers fetched:', rtcConfig);

        // Get User Media
        localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        localVideo.srcObject = localStream;

        // Connect WebSocket
        connectWebSocket();
    } catch (error) {
        console.error('Error initializing:', error);
        statusDiv.textContent = 'Error: ' + error.message;
    }
}

function connectWebSocket() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    ws = new WebSocket(`${protocol}//${host}`);

    ws.onopen = () => {
        console.log('Connected to signaling server');
        statusDiv.textContent = 'Status: Connected to server. Register your ID.';
    };

    ws.onmessage = async (event) => {
        const data = JSON.parse(event.data);
        console.log('Received:', data.type);

        switch (data.type) {
            case 'registered':
                statusDiv.textContent = `Status: Registered as ${data.userId}`;
                callBtn.disabled = false;
                registerBtn.disabled = true;
                myIdInput.disabled = true;
                break;

            case 'offer':
                await handleOffer(data.offer, data.senderId);
                break;

            case 'answer':
                await handleAnswer(data.answer);
                break;

            case 'candidate':
                await handleCandidate(data.candidate);
                break;
        }
    };

    ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        statusDiv.textContent = 'Status: WebSocket error';
    };
}

registerBtn.addEventListener('click', () => {
    myId = myIdInput.value.trim();
    if (myId) {
        ws.send(JSON.stringify({
            type: 'register',
            userId: myId
        }));
    }
});

callBtn.addEventListener('click', async () => {
    targetId = otherIdInput.value.trim();
    if (targetId) {
        await startCall();
    }
});

async function startCall() {
    statusDiv.textContent = `Status: Calling ${targetId}...`;
    createPeerConnection();

    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);

    ws.send(JSON.stringify({
        type: 'offer',
        offer: offer,
        targetId: targetId,
        userId: myId
    }));
}

async function handleOffer(offer, senderId) {
    targetId = senderId;
    otherIdInput.value = senderId;
    statusDiv.textContent = `Status: Incoming call from ${senderId}`;

    createPeerConnection();
    await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));

    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);

    ws.send(JSON.stringify({
        type: 'answer',
        answer: answer,
        targetId: targetId,
        userId: myId
    }));
}

async function handleAnswer(answer) {
    statusDiv.textContent = 'Status: Call connected';
    await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
}

async function handleCandidate(candidate) {
    if (peerConnection) {
        await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
    }
}

function createPeerConnection() {
    if (peerConnection) return;

    peerConnection = new RTCPeerConnection(rtcConfig);

    peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
            ws.send(JSON.stringify({
                type: 'candidate',
                candidate: event.candidate,
                targetId: targetId,
                userId: myId
            }));
        }
    };

    peerConnection.ontrack = (event) => {
        remoteVideo.srcObject = event.streams[0];
    };

    localStream.getTracks().forEach(track => {
        peerConnection.addTrack(track, localStream);
    });
}

// Start initialization
init();
