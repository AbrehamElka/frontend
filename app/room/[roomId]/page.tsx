"use client";

import React, { useEffect } from "react";
import { useParams } from "next/navigation";
import socket from "@/lib/socket";
const Room = () => {
  const { roomId } = useParams();
  useEffect(() => {
    socket.connect();

    socket.on("connect", () => {
      socket.emit("join-room", { roomId, userId: "123" });
    });

    socket.on("user-joined", (data) => {
      console.log(data);
    });
  }, []);
  return <div>Room {roomId}</div>;
};

export default Room;
