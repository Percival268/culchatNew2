document.addEventListener('DOMContentLoaded', function() {
    // DOM Elements
    const formJoin = document.querySelector('.form-join');
    const formMessage = document.querySelector('.form-message');
    const chatDisplay = document.querySelector('.chat-display');
    const userList = document.querySelector('.user-list');
    const activity = document.querySelector('.activity');
    const userCount = document.querySelector('.user-count');
    const chatInterface = document.querySelector('.chat-interface');
    const currentRoomElement = document.getElementById('current-room');

    // WebSocket connection
    const socket = new WebSocket('ws://localhost:8080');
    let currentNickname = '';
    const currentRoom = "Global Community"; // Fixed room name for global chat

    // Connection handlers
    socket.onopen = function() {
        console.log('Connected to WebSocket server');
        displaySystemMessage('Connected to global chat');
    };

    socket.onclose = function() {
        displaySystemMessage('Disconnected from server');
    };

    socket.onerror = function(error) {
        console.error('WebSocket error:', error);
        displaySystemMessage('Connection error: ' + error.message);
    };

    // Join room form submission
    formJoin.addEventListener('submit', function(e) {
        e.preventDefault();
        
        const nameInput = document.getElementById('name');
        const name = nameInput.value.trim();
        
        if (name) {
            currentNickname = name;
            
            // Show chat interface
            formJoin.style.display = 'none';
            chatInterface.style.display = 'block';
            currentRoomElement.textContent = currentRoom;
            
            // Join the room
            socket.send(JSON.stringify({
                type: 'join-room',
                room: currentRoom
            }));
            
            // Set nickname
            socket.send(JSON.stringify({
                type: 'set-nickname',
                nickname: name
            }));
            
            // Add welcome message
            const welcomeMsg = {
                name: 'CulChat Bot',
                text: `Welcome to the Global Community, ${name}! Start chatting with food lovers worldwide.`,
                time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                isBot: true
            };
            displayMessage(welcomeMsg);
        }
    });

    // Message form submission
    formMessage.addEventListener('submit', function(e) {
        e.preventDefault();
        
        const messageInput = document.getElementById('message');
        const message = messageInput.value.trim();
        
        if (message) {
            socket.send(JSON.stringify({
                type: 'chat-message',
                message: message
            }));
            messageInput.value = '';
            messageInput.focus();
        }
    });

    // Handle incoming messages
    socket.onmessage = function(event) {
        try {
            const data = JSON.parse(event.data);
            handleServerMessage(data);
        } catch (e) {
            console.error('Error parsing message:', e);
        }
    };

    function handleServerMessage(data) {
        if (!data || !data.type) return;
        
        switch(data.type) {
            case 'message':
                displayUserMessage(data.sender, data.content);
                chatDisplay.scrollTop = chatDisplay.scrollHeight;
                break;
                
            case 'user-list':
                if (data.room === currentRoom) {
                    displayUsers(data.users);
                    userCount.textContent = `${data.users.length} ${data.users.length === 1 ? 'chef' : 'chefs'} cooking here`;
                }
                break;
                
            case 'system':
                displaySystemMessage(data.content);
                break;
                
            default:
                console.warn("Unknown message type:", data.type);
        }
    }

    function displaySystemMessage(text) {
        displayMessage({
            name: 'System',
            text: text,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            isSystem: true
        });
    }

    function displayUserMessage(sender, text) {
        displayMessage({
            name: sender,
            text: text,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        });
    }

    function displayUsers(users) {
        userList.innerHTML = `
            <h4>Culinary Companions:</h4>
            <ul>
                ${users.map(user => `<li>👨‍🍳 ${user}</li>`).join('')}
            </ul>
        `;
    }

    function displayMessage(data) {
        try {
            const li = document.createElement('li');
            li.classList.add('message');
            
            if (data.isBot) {
                li.classList.add('bot-message');
            } else if (data.isSystem) {
                li.classList.add('system-message');
            }
            
            const time = data.time || new Date().toLocaleTimeString();
            const name = data.name || 'Anonymous';
            const text = data.text || '';
            
            li.innerHTML = `
                <div class="message-info">
                    <span class="message-sender">${name}</span>
                    <span class="message-time">${time}</span>
                </div>
                <div class="message-text">${text}</div>
            `;
            
            if (chatDisplay) {
                chatDisplay.appendChild(li);
                chatDisplay.scrollTop = chatDisplay.scrollHeight;
            }
        } catch (err) {
            console.error('Error displaying message:', err);
        }
    }

    // Typing indicator
    const messageInput = document.getElementById('message');
    let typingTimeout;
    
    messageInput.addEventListener('input', function() {
        // You can implement typing indicators here if needed
        clearTimeout(typingTimeout);
        typingTimeout = setTimeout(() => {
            // Typing stopped
        }, 2000);
    });
});