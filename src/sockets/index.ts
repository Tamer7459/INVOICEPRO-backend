import { Server, Socket } from "socket.io";

export const setupSockets = (io: Server): void => {
  io.on("connection", (socket: Socket) => {
    console.log("Client connected:", socket.id);

    socket.on("join-user", (userId: string) => {
      socket.join(`user:${userId}`);
      console.log(`User ${userId} joined`);
    });

    socket.on("disconnect", () => console.log("Client disconnected:", socket.id));
  });
};

export const sendEvent = (io: Server, userId: string, event: string, data: any): void => {
  io.to(`user:${userId}`).emit(event, data);
};
