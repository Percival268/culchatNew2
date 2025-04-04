import java.net.*;
import java.io.*;
import java.util.*;
import java.util.concurrent.*;

public class ChatServer {
    private static final int PORT = 8887;
    private static Map<String, Set<ClientHandler>> rooms = new ConcurrentHashMap<>();
    
    public static void main(String[] args) {
        System.out.println("Chat Server is running...");
        try (ServerSocket listener = new ServerSocket(PORT)) {
            while (true) {
                new ClientHandler(listener.accept()).start();
            }
        } catch (IOException e) {
            System.err.println("Server exception: " + e.getMessage());
        }
    }
    
    private static class ClientHandler extends Thread {
        private Socket socket;
        private BufferedReader in;
        private PrintWriter out;
        private String nickname;
        private String currentRoom;
        
        public ClientHandler(Socket socket) {
            this.socket = socket;
        }
        
        public void run() {
            try {
                in = new BufferedReader(new InputStreamReader(socket.getInputStream()));
                out = new PrintWriter(socket.getOutputStream(), true);
                
                // Get nickname
                out.println("NICK");
                nickname = in.readLine();
                if (nickname == null || nickname.isEmpty()) {
                    return;
                }
                
                // Get room
                out.println("ROOM");
                currentRoom = in.readLine();
                if (currentRoom == null || currentRoom.isEmpty()) {
                    currentRoom = "default";
                }
                
                // Add to room
                rooms.computeIfAbsent(currentRoom, k -> Collections.synchronizedSet(new HashSet<>())).add(this);
                
                // Notify room
                broadcast(currentRoom, nickname + " joined the chat");
                sendUserList(currentRoom);
                
                // Handle messages
                String input;
                while ((input = in.readLine()) != null) {
                    if (input.startsWith("/nick ")) {
                        String newNick = input.substring(6).trim();
                        if (!newNick.isEmpty()) {
                            broadcast(currentRoom, nickname + " changed name to " + newNick);
                            nickname = newNick;
                            out.println("NICK_OK " + newNick);
                            sendUserList(currentRoom);
                        }
                    } else if (input.equals("/quit")) {
                        break;
                    } else {
                        broadcast(currentRoom, nickname + ": " + input);
                    }
                }
            } catch (IOException e) {
                System.out.println("Client handler error: " + e.getMessage());
            } finally {
                try {
                    socket.close();
                } catch (IOException e) {}
                
                if (nickname != null && currentRoom != null) {
                    rooms.get(currentRoom).remove(this);
                    broadcast(currentRoom, nickname + " left the chat");
                    sendUserList(currentRoom);
                }
            }
        }
        
        private void broadcast(String room, String message) {
            Set<ClientHandler> roomClients = rooms.get(room);
            if (roomClients != null) {
                synchronized (roomClients) {
                    for (ClientHandler client : roomClients) {
                        try {
                            client.out.println("MSG " + message);
                        } catch (Exception e) {
                            // Client disconnected
                        }
                    }
                }
            }
        }
        
        private void sendUserList(String room) {
            Set<ClientHandler> roomClients = rooms.get(room);
            if (roomClients != null) {
                StringBuilder userList = new StringBuilder();
                for (ClientHandler client : roomClients) {
                    if (userList.length() > 0) {
                        userList.append(",");
                    }
                    userList.append(client.nickname);
                }
                
                synchronized (roomClients) {
                    for (ClientHandler client : roomClients) {
                        try {
                            client.out.println("USERLIST " + userList.toString());
                        } catch (Exception e) {
                            // Client disconnected
                        }
                    }
                }
            }
        }
    }
}