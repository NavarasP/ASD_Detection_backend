const { Server } = require('socket.io');

function initChatServer(httpServer) {
  const io = new Server(httpServer, { cors: { origin: "*" } });

  io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);

    socket.on('join_room', (payload) => {
      try {
        const room = typeof payload === 'string' ? payload : payload?.room;
        if (room && typeof room === 'string') {
          socket.join(room);
        } else {
          console.warn('join_room called without valid room:', payload);
        }
      } catch (e) {
        console.error('Error handling join_room:', e);
      }
    });

    socket.on('chat_message', (data) => {
      const { room, message, sender } = data;
      io.to(room).emit('chat_message', { message, sender, timestamp: new Date(), room });
    });

    socket.on('disconnect', () => console.log('Client disconnected'));
  });

  return io;
}

module.exports = { initChatServer };
