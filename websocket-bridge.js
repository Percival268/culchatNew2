const WebSocket = require('ws');
const net = require('net');

const wss = new WebSocket.Server({ port: 8080 });
const JAVA_SERVER_HOST = 'localhost';
const JAVA_SERVER_PORT = 8887;

console.log(`WebSocket bridge running on port 8080, forwarding to ${JAVA_SERVER_HOST}:${JAVA_SERVER_PORT}`);

wss.on('connection', (ws) => {
    console.log('New WebSocket client connected');
    
    const javaSocket = new net.Socket();
    let currentRoom = "default";
    let nickname = "";

    javaSocket.connect(JAVA_SERVER_PORT, JAVA_SERVER_HOST, () => {
        console.log('Connected to Java server');
        ws.send(JSON.stringify({ 
            type: 'connection-status', 
            connected: true,
            server: 'Java Chat Server'
        }));
    });

    javaSocket.on('data', (data) => {
        const message = data.toString().trim();
        console.log('From Java:', message);
        
        try {
            if (message.startsWith("MSG ")) {
                const content = message.substring(4);
                const colonPos = content.indexOf(':');
                const sender = colonPos > 0 ? content.substring(0, colonPos).trim() : 'System';
                const msgContent = colonPos > 0 ? content.substring(colonPos + 1).trim() : content;
                
                ws.send(JSON.stringify({
                    type: 'message',
                    sender: sender,
                    content: msgContent,
                    room: currentRoom,
                    timestamp: new Date().toISOString()
                }));
            } 
            else if (message.startsWith("USERLIST ")) {
                const users = message.substring(9).split(',').filter(u => u.trim() !== '');
                ws.send(JSON.stringify({
                    type: 'user-list',
                    users: users,
                    room: currentRoom,
                    count: users.length
                }));
            }
            else if (message.startsWith("NICK")) {
                ws.send(JSON.stringify({
                    type: 'nickname-request'
                }));
            }
            else if (message.startsWith("ROOM ")) {
                currentRoom = message.substring(5).trim() || "default";
                ws.send(JSON.stringify({
                    type: 'room-joined',
                    room: currentRoom,
                    message: `Joined room: ${currentRoom}`
                }));
            }
            else {
                // System messages and other notifications
                ws.send(JSON.stringify({
                    type: 'system',
                    content: message,
                    room: currentRoom
                }));
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
        ws.send(JSON.stringify({ 
            type: 'connection-status', 
            connected: false,
            message: 'Disconnected from chat server'
        }));
        ws.close();
    });

    javaSocket.on('error', (err) => {
        console.error('Java socket error:', err);
        ws.send(JSON.stringify({ 
            type: 'error',
            message: 'Connection to chat server failed',
            detail: err.message
        }));
    });

    ws.on('message', (message) => {
        console.log('From client:', message);
        try {
            const data = JSON.parse(message);
            
            switch(data.type) {
                case 'set-nickname':
                    nickname = data.nickname || "";
                    javaSocket.write(nickname + '\n');
                    break;
                    
                case 'chat-message':
                    javaSocket.write(data.message + '\n');
                    break;
                    
                case 'join-room':
                    currentRoom = data.room || "default";
                    javaSocket.write("ROOM " + currentRoom + '\n');
                    break;
                    
                case 'request-userlist':
                    // Java server automatically sends USERLIST on room join
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
    });

    ws.on('error', (err) => {
        console.error('WebSocket error:', err);
        javaSocket.end();
    });
});