const { Server } = require('socket.io');

function initChatServer(httpServer) {
  const io = new Server(httpServer, { cors: { origin: "*" } });

  io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);

    socket.on('join_room', (room) => socket.join(room));

    socket.on('chat_message', (data) => {
      const { room, message, sender } = data;
      io.to(room).emit('chat_message', { message, sender, timestamp: new Date() });
    });

    socket.on('disconnect', () => console.log('Client disconnected'));
  });

  return io;
}

module.exports = { initChatServer };
