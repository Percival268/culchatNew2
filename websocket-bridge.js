const WebSocket = require('ws');
const net = require('net');

const wss = new WebSocket.Server({ port: 8080 });
const JAVA_SERVER_HOST = 'localhost';
const JAVA_SERVER_PORT = 8887;

// Track all connected clients
const clients = new Map(); // Key: WebSocket, Value: {nickname, room}

console.log(`WebSocket bridge running on port 8080, forwarding to ${JAVA_SERVER_HOST}:${JAVA_SERVER_PORT}`);

wss.on('connection', (ws) => {
    console.log('New WebSocket client connected');
    
    const javaSocket = new net.Socket();
    let clientInfo = {
        nickname: '',
        room: 'Global Community',
        javaConnected: false
    };

    // Add to clients map
    clients.set(ws, clientInfo);

    javaSocket.connect(JAVA_SERVER_PORT, JAVA_SERVER_HOST, () => {
        console.log('Connected to Java server');
        clientInfo.javaConnected = true;
        
        ws.send(JSON.stringify({ 
            type: 'connection-status', 
            connected: true,
            server: 'Java Chat Server'
        }));

        // Notify others in the same room
        broadcastUserList(clientInfo.room);
    });

    // Forward Java server messages to WebSocket client
    javaSocket.on('data', (data) => {
        const message = data.toString().trim();
        console.log('From Java:', message);
        
        try {
            if (message.startsWith("MSG ")) {
                const content = message.substring(4);
                const colonPos = content.indexOf(':');
                const sender = colonPos > 0 ? content.substring(0, colonPos).trim() : 'System';
                const msgContent = colonPos > 0 ? content.substring(colonPos + 1).trim() : content;
                
                // Broadcast to all clients in the same room
                clients.forEach((info, client) => {
                    if (info.room === clientInfo.room && client.readyState === WebSocket.OPEN) {
                        client.send(JSON.stringify({
                            type: 'message',
                            sender: sender,
                            content: msgContent,
                            room: clientInfo.room,
                            timestamp: new Date().toISOString()
                        }));
                    }
                });
            } 
            else if (message.startsWith("USERLIST ")) {
                const users = message.substring(9).split(',').filter(u => u.trim() !== '');
                
                // Update all clients in this room
                broadcastUserList(clientInfo.room);
            }
            else if (message.startsWith("NICK")) {
                ws.send(JSON.stringify({
                    type: 'nickname-request'
                }));
            }
            else {
                // System messages
                clients.forEach((info, client) => {
                    if (info.room === clientInfo.room && client.readyState === WebSocket.OPEN) {
                        client.send(JSON.stringify({
                            type: 'system',
                            content: message,
                            room: clientInfo.room
                        }));
                    }
                });
            }
        } catch (e) {
            console.error('Failed to process message:', e);
            ws.send(JSON.stringify({
                type: 'error',
                message: 'Failed to process server message',
                detail: e.message
            }));
        }
    });

    javaSocket.on('close', () => {
        console.log('Disconnected from Java server');
        clientInfo.javaConnected = false;
        ws.send(JSON.stringify({ 
            type: 'connection-status', 
            connected: false,
            message: 'Disconnected from chat server'
        }));
        
        // Remove from clients map
        clients.delete(ws);
        broadcastUserList(clientInfo.room);
    });

    javaSocket.on('error', (err) => {
        console.error('Java socket error:', err);
        ws.send(JSON.stringify({ 
            type: 'error',
            message: 'Connection to chat server failed',
            detail: err.message
        }));
    });

    // Handle WebSocket messages from client
    ws.on('message', (message) => {
        console.log('From client:', message);
        try {
            const data = JSON.parse(message);
            
            switch(data.type) {
                case 'set-nickname':
                    clientInfo.nickname = data.nickname || "";
                    javaSocket.write(data.nickname + '\n');
                    broadcastUserList(clientInfo.room);
                    break;
                    
                case 'chat-message':
                    javaSocket.write(data.message + '\n');
                    break;
                    
                case 'join-room':
                    const oldRoom = clientInfo.room;
                    clientInfo.room = data.room || "Global Community";
                    javaSocket.write("ROOM " + clientInfo.room + '\n');
                    
                    // Notify room change
                    if (oldRoom !== clientInfo.room) {
                        broadcastUserList(oldRoom);
                        broadcastUserList(clientInfo.room);
                    }
                    break;
                    
                case 'request-userlist':
                    javaSocket.write("USERLIST\n");
                    break;
                    
                default:
                    console.warn('Unknown message type:', data.type);
                    ws.send(JSON.stringify({
                        type: 'error',
                        message: 'Unsupported message type',
                        requestedType: data.type
                    }));
            }
        } catch (e) {
            console.error('Error parsing client message:', e);
            ws.send(JSON.stringify({
                type: 'error',
                message: 'Invalid message format',
                detail: e.message
            }));
        }
    });

    ws.on('close', () => {
        console.log('WebSocket client disconnected');
        javaSocket.end();
        clients.delete(ws);
        broadcastUserList(clientInfo.room);
    });

    ws.on('error', (err) => {
        console.error('WebSocket error:', err);
        javaSocket.end();
        clients.delete(ws);
        broadcastUserList(clientInfo.room);
    });
});

// Helper function to broadcast user list to a room
function broadcastUserList(room) {
    const users = [];
    clients.forEach((info, client) => {
        if (info.room === room && info.nickname && client.readyState === WebSocket.OPEN) {
            users.push(info.nickname);
        }
    });

    clients.forEach((info, client) => {
        if (info.room === room && client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({
                type: 'user-list',
                users: users,
                room: room,
                count: users.length
            }));
        }
    });
}

// Periodic cleanup of disconnected clients
setInterval(() => {
    clients.forEach((info, client) => {
        if (client.readyState !== WebSocket.OPEN) {
            clients.delete(client);
            broadcastUserList(info.room);
        }
    });
}, 30000); // Every 30 seconds