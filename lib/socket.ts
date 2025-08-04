import { io } from "socket.io-client";

const socket = io("https://backend-signaling.onrender.com", {
  transports: ["websocket"],
  autoConnect: false,
});

export default socket;
