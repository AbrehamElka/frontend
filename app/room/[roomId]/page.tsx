"use client";

import React, { useEffect, useRef } from "react";
import { useParams } from "next/navigation";
import socket from "@/lib/socket";

const pcConfig: RTCConfiguration = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
};

const Room = () => {
  const { id } = useParams();
  const peerRef = useRef<RTCPeerConnection | null>(null);
  useEffect(() => {
    socket.connect();

    socket.on("connect", () => {
      socket.emit("join-room", { roomId: id, userId: "123" });
    });

    socket.on("user-joined", async (data) => {
      console.log(data);
      await startCall(data.targetSocketId);
    });

    socket.on("offer", async ({ offer, senderSocketId }) => {
      await createAnswer(offer, senderSocketId);
    });

    socket.on("answer", () => {});
  }, []);

  const startCall = async (targetSocketId: string) => {
    peerRef.current = new RTCPeerConnection(pcConfig);
    const stream = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: true,
    });

    const offer = await peerRef.current?.createOffer();
    await peerRef.current?.setLocalDescription(offer);

    socket.emit("offer", {
      targetSocketId,
      offer,
      senderSocketId: socket.id,
      roomName: id,
    });
  };
  const createAnswer = async (
    offer: RTCSessionDescriptionInit,
    senderSocketId: string
  ) => {
    peerRef.current = new RTCPeerConnection(pcConfig);
    const stream = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: true,
    });

    await peerRef.current.setRemoteDescription(
      new RTCSessionDescription(offer)
    );

    const answer = await peerRef.current.createAnswer();
    await peerRef.current.setLocalDescription(answer);

    socket.emit("answer", {
      senderSocketId,
      offer: answer,
      targetSocketId: senderSocketId,
      roomName: id,
    });
  };

  return <div>Room {id}</div>;
};

export default Room;
