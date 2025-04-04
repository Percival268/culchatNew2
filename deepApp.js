document.addEventListener('DOMContentLoaded', function() {
    // DOM Elements
    const formJoin = document.querySelector('.form-join');
    const formMessage = document.querySelector('.form-message');
    const chatDisplay = document.querySelector('.chat-display');
    const userList = document.querySelector('.user-list');
    const activity = document.querySelector('.activity');
    const currentRoom = document.getElementById('current-room');
    const userCount = document.querySelector('.user-count');
    const roomSelect = document.getElementById('room');
    const customRoomInput = document.getElementById('custom-room');
    const roomSelection = document.querySelector('.room-selection');
    const chatInterface = document.querySelector('.chat-interface');
    const messageInput = document.getElementById('message');
    const nameInput = document.getElementById('name');

    // WebSocket connection
    let socket;
    let currentNickname = '';
    let currentRoomName = '';
    let reconnectAttempts = 0;
    const maxReconnectAttempts = 5;
    const reconnectDelay = 3000; // 3 seconds

    // Replace the initWebSocket function with this:
function initWebSocket() {
    const wsUrl = 'ws://localhost:8080';
    console.log(`Connecting to ${wsUrl}...`);
    
    socket = new WebSocket(wsUrl);

    socket.onopen = function() {
        console.log('WebSocket connected');
        displaySystemMessage('Connected to chat server');
        reconnectAttempts = 0;
        
        // Send initial join information
        socket.send(JSON.stringify({
            type: 'join',
            nickname: currentNickname,
            room: currentRoomName
        }));
    };

    socket.onmessage = function(event) {
        console.log('Received:', event.data);
        try {
            const data = JSON.parse(event.data);
            handleServerMessage(data);
        } catch (e) {
            console.error('Error parsing message:', e);
        }
    };

    socket.onclose = function() {
        console.log('WebSocket closed');
        if (reconnectAttempts < maxReconnectAttempts) {
            displaySystemMessage(`Connection lost. Reconnecting (${reconnectAttempts + 1}/${maxReconnectAttempts})...`);
            setTimeout(initWebSocket, reconnectDelay);
            reconnectAttempts++;
        } else {
            displaySystemMessage('Failed to connect to chat server. Please refresh the page.');
        }
    };

    socket.onerror = function(error) {
        console.error('WebSocket error:', error);
        displaySystemMessage('Connection error: ' + error.message);
    };
}

    // Handle messages from server
    // Modify handleServerMessage to handle new message types:
function handleServerMessage(data) {
    try {
        if (!data || !data.type) {
            // Try to handle raw messages from Java server
            if (typeof data === 'string') {
                if (data.startsWith("MSG ")) {
                    const content = data.substring(4);
                    const colonPos = content.indexOf(':');
                    const sender = colonPos > 0 ? content.substring(0, colonPos) : 'System';
                    const msgContent = colonPos > 0 ? content.substring(colonPos + 2) : content;
                    displayUserMessage(sender, msgContent);
                } else {
                    displaySystemMessage(data);
                }
            }
            return;
        }
        
        switch(data.type) {
            case 'message':
                displayUserMessage(data.sender || 'Unknown', data.content || '');
                break;
            case 'system':
                displaySystemMessage(data.content || '');
                break;
            case 'user-list':
                updateUserList(data.users || []);
                break;
            case 'nickname-request':
                if (currentNickname) {
                    socket.send(JSON.stringify({
                        type: 'set-nickname',
                        nickname: currentNickname
                    }));
                }
                break;
            default:
                console.warn("Unknown message type:", data.type);
        }
    } catch (error) {
        console.error("Error handling message:", error);
    }
}

    // Send nickname to server
    function sendNickname(nickname) {
        if (socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({
                type: 'set-nickname',
                nickname: nickname,
                room: currentRoomName
            }));
            currentNickname = nickname;
        }
    }

    // Send chat message to server
    function sendChatMessage(message) {
        if (socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({
                type: 'chat-message',
                message: message
            }));
        }
    }

    // Join a chat room
    function joinRoom(room) {
        currentRoomName = room;
        if (socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({
                type: 'join-room',
                room: room
            }));
        }
    }

    // Display system messages
    function displaySystemMessage(text) {
        displayMessage({
            name: 'System',
            text: text,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            isSystem: true
        });
    }

    // Display user messages
    function displayUserMessage(sender, text) {
        displayMessage({
            name: sender,
            text: text,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            isBot: sender === 'CulChat Bot'
        });
    }

    // Update user list
    function updateUserList(users) {
        userList.innerHTML = `
            <h4>Culinary Companions:</h4>
            <ul>
                ${users.map(user => `<li>👨‍🍳 ${user}</li>`).join('')}
            </ul>
        `;
    }

    // Original displayMessage function with enhancements
    function displayMessage(data) {
        console.log("Displaying message:", data); // Debug log
        
        // Create message element
        const messageElement = document.createElement('li');
        messageElement.classList.add('message');
        
        // Add special classes for bot/system messages
        if (data.isBot) {
            messageElement.classList.add('bot-message');
        } else if (data.isSystem) {
            messageElement.classList.add('system-message');
        }
    
        // Format timestamp if not provided
        const time = data.time || new Date().toLocaleTimeString([], { 
            hour: '2-digit', 
            minute: '2-digit'
        });
    
        // Set message HTML
        messageElement.innerHTML = `
            <div class="message-info">
                <span class="message-sender">${data.name || 'Unknown'}</span>
                <span class="message-time">${time}</span>
            </div>
            <div class="message-text">${data.text || ''}</div>
        `;
        
        // Append to chat display
        const chatDisplay = document.querySelector('.chat-display');
        if (chatDisplay) {
            chatDisplay.appendChild(messageElement);
            // Auto-scroll to bottom
            chatDisplay.scrollTop = chatDisplay.scrollHeight;
        } else {
            console.error("Chat display element not found!");
        }
    }

    // Room selection change handler
    roomSelect.addEventListener('change', function(e) {
        if (e.target.value === 'custom') {
            customRoomInput.style.display = 'block';
            customRoomInput.setAttribute('required', '');
        } else {
            customRoomInput.style.display = 'none';
            customRoomInput.removeAttribute('required');
        }
    });

    // Join room form submission
    formJoin.addEventListener('submit', function(e) {
        e.preventDefault();
        
        const name = nameInput.value.trim();
        let room;
        
        if (roomSelect.value === 'custom') {
            room = customRoomInput.value.trim().toLowerCase();
        } else {
            room = roomSelect.value.trim().toLowerCase();
        }
        
        if (name && room) {
            currentNickname = name;
            currentRoomName = room;
            
            // Show chat interface
            roomSelection.style.display = 'none';
            chatInterface.style.display = 'block';
            
            // Initialize WebSocket connection
            initWebSocket();
            
            // Add welcome message
            displaySystemMessage(`Welcome to ${roomSelect.options[roomSelect.selectedIndex].text}, ${name}!`);
        }
    });

    // Message form submission
    formMessage.addEventListener('submit', function(e) {
        e.preventDefault();
        const message = messageInput.value.trim();
        
        if (message) {
            sendChatMessage(message);
            messageInput.value = '';
            messageInput.focus();
        }
    });

    // Typing indicator
    let typingTimeout;
    messageInput.addEventListener('input', function() {
        if (socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({
                type: 'typing-indicator',
                isTyping: true
            }));
            
            clearTimeout(typingTimeout);
            typingTimeout = setTimeout(() => {
                if (socket.readyState === WebSocket.OPEN) {
                    socket.send(JSON.stringify({
                        type: 'typing-indicator',
                        isTyping: false
                    }));
                }
            }, 2000);
        }
    });

    // Handle beforeunload to notify server
    window.addEventListener('beforeunload', function() {
        if (socket && socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({
                type: 'leave-room'
            }));
        }
    });

    // Random cooking tips for bot messages
    function getRandomCookingTip() {
        const tips = [
            "Tip: Always taste your food while cooking to adjust seasoning as needed.",
            "Did you know? Letting meat rest after cooking allows juices to redistribute.",
            "Pro tip: Use a microplane for finely grated garlic, ginger, or citrus zest.",
            "Kitchen hack: Place a damp paper towel under your cutting board to prevent slipping.",
            "Remember: Sharp knives are safer than dull ones - they require less force.",
            "Baking tip: Bring ingredients to room temperature for more even mixing.",
            "Secret: Add a pinch of salt to sweet dishes to enhance their flavor.",
            "Technique: 'Mise en place' (having everything in place) makes cooking smoother.",
            "Healthy tip: Steam vegetables instead of boiling to retain more nutrients.",
            "Flavor boost: Toast spices before using to intensify their aroma."
        ];
        return tips[Math.floor(Math.random() * tips.length)];
    }

    // Initialize Swiper when DOM is loaded
    const swiper = new Swiper('.mySwiper', {
        loop: true,
        autoplay: {
            delay: 6000,
            disableOnInteraction: false,
        },
        effect: 'fade',
        fadeEffect: {
            crossFade: true
        },
        speed: 1000,
        pagination: {
            el: '.swiper-pagination',
            clickable: true,
        },
        navigation: {
            nextEl: '.swiper-button-next',
            prevEl: '.swiper-button-prev',
        },
    });
});