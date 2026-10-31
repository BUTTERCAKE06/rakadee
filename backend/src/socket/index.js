// Socket.IO server (D-02): ส่งราคา เวลาที่ถูกต่อ การปิดประมูล และการแจ้งเตือนแบบ real-time
// ห้อง:
//   listing:<listingId>  ทุกคนที่เปิดหน้ารายละเอียดสินค้านั้น
//   user:<userId>        การแจ้งเตือนส่วนตัว (ผูกหลังมีระบบ login)
// event ที่ server ส่ง: bid:new, auction:extended, auction:closed, notification:new
const { Server } = require('socket.io');

let io = null;

function initSocket(httpServer) {
  io = new Server(httpServer);

  io.on('connection', (socket) => {
    // ส่งเวลา server ให้ client ใช้คำนวณ countdown (ห้ามใช้นาฬิกาเครื่อง client)
    socket.emit('server:time', { now: Date.now() });

    socket.on('listing:join', (listingId) => socket.join(`listing:${listingId}`));
    socket.on('listing:leave', (listingId) => socket.leave(`listing:${listingId}`));

    // TODO(SA): ตรวจ token แล้วให้ socket.join(`user:${userId}`)
  });

  return io;
}

function emitToListing(listingId, event, payload) {
  if (io) io.to(`listing:${listingId}`).emit(event, payload);
}

function emitToUser(userId, event, payload) {
  if (io) io.to(`user:${userId}`).emit(event, payload);
}

module.exports = { initSocket, emitToListing, emitToUser };
