// Socket.IO server (D-02, api-spec หัวข้อ 12): ส่งราคา เวลาที่ถูกต่อ การปิดประมูล และการแจ้งเตือนแบบ real-time
// ห้อง:
//   listing:<listingId>  ทุกคนที่เปิดหน้ารายละเอียดสินค้านั้น (client ส่ง listing:join / listing:leave)
//   user:<userId>        การแจ้งเตือนส่วนตัว — server join ให้อัตโนมัติเมื่อ client ส่ง token มา
// client เชื่อมต่อ: io({ auth: { token } }) (Guest ไม่ต้องส่ง token)
// event ที่ server ส่ง: server:time, bid:new, bid:leader, auction:extended, auction:closed, notification:new
const { Server } = require('socket.io');

let io = null;

function initSocket(httpServer) {
  io = new Server(httpServer);
  // require ตอนใช้งาน เพื่อเลี่ยงวงจร require (auth → db, notify → socket)
  const { findUserByToken } = require('../middlewares/auth');

  io.on('connection', async (socket) => {
    // ส่งเวลา server ให้ client ใช้คำนวณ countdown (ห้ามใช้นาฬิกาเครื่อง client)
    socket.emit('server:time', { now: Date.now() });

    socket.on('listing:join', (listingId) => socket.join(`listing:${listingId}`));
    socket.on('listing:leave', (listingId) => socket.leave(`listing:${listingId}`));

    try {
      const user = await findUserByToken(socket.handshake.auth && socket.handshake.auth.token);
      if (user) {
        socket.data.userId = user.id;
        socket.join(`user:${user.id}`);
      }
    } catch (err) {
      console.error('[socket] auth failed:', err.message);
    }
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
