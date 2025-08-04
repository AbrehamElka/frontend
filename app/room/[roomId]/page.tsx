"use client";

import React, { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import socket from "@/lib/socket";

const pcConfig: RTCConfiguration = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
};

const Room = () => {
  const { roomId } = useParams();
  const peerRef = useRef<RTCPeerConnection | null>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const targetSocketRef = useRef<string | null>(null);
  const [isSocketConnected, setSocketConnected] = useState(false);

  useEffect(() => {
    if (!socket.connected) {
      socket.connect();
    }

    socket.on("connect", () => {
      setSocketConnected(true);
    });

    socket.on("user-joined", async (data) => {
      console.log(data);
      await startCall(data.socketId);
    });

    socket.on("offer", async ({ offer, senderSocketId }) => {
      await createAnswer(offer, senderSocketId);
    });

    socket.on("answer", async ({ answer }) => {
      await peerRef.current?.setRemoteDescription(
        new RTCSessionDescription(answer)
      );
    });

    socket.on("ice-candidate", async ({ candidate }) => {
      try {
        await peerRef.current?.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (e) {
        console.error("Failed to add ICE candidate", e);
      }
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  useEffect(() => {
    if (roomId && isSocketConnected) {
      socket.emit("join-room", {
        roomId: roomId,
        userId: "123", // replace with real user ID
      });
    }
  }, [roomId, isSocketConnected]);

  const bindPeerEvents = (targetSocketId: string, stream: MediaStream) => {
    if (!peerRef.current) return;

    peerRef.current.ontrack = (event) => {
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = event.streams[0];
      }
    };

    peerRef.current.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit("ice-candidate", {
          candidate: event.candidate,
          targetSocketId,
          senderSocketId: socket.id,
          roomName: roomId,
        });
      }
    };
  };

  const startCall = async (targetSocketId: string) => {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: true,
    });

    // Set local video stream
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = stream;
    }

    peerRef.current = new RTCPeerConnection(pcConfig);

    bindPeerEvents(targetSocketId, stream);

    stream.getTracks().forEach((track) => {
      peerRef.current!.addTrack(track, stream);
    });

    const offer = await peerRef.current?.createOffer();
    await peerRef.current?.setLocalDescription(offer);

    socket.emit("offer", {
      targetSocketId,
      offer,
      senderSocketId: socket.id,
      roomName: roomId,
    });
  };

  const createAnswer = async (
    offer: RTCSessionDescriptionInit,
    senderSocketId: string
  ) => {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: true,
    });

    // Set local video stream
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = stream;
    }

    peerRef.current = new RTCPeerConnection(pcConfig);

    bindPeerEvents(senderSocketId, stream);

    stream.getTracks().forEach((track) => {
      peerRef.current!.addTrack(track, stream);
    });

    const answer = await peerRef.current.createAnswer();
    await peerRef.current.setRemoteDescription(
      new RTCSessionDescription(offer)
    );

    await peerRef.current.setLocalDescription(answer);

    socket.emit("answer", {
      senderSocketId,
      answer: answer,
      targetSocketId: senderSocketId,
      roomName: roomId,
    });
  };

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <h3 className="text-lg font-semibold mb-2">Local Video</h3>
          <video
            ref={localVideoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-64 bg-gray-900 rounded-lg"
          />
        </div>
        <div>
          <h3 className="text-lg font-semibold mb-2">Remote Video</h3>
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            className="w-full h-64 bg-gray-900 rounded-lg"
          />
        </div>
      </div>
      <div className="text-center">
        <p>Room ID: {roomId}</p>
        <p>Socket Connected: {isSocketConnected ? "Yes" : "No"}</p>
      </div>
    </div>
  );
};

export default Room;
