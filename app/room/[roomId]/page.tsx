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

    await peerRef.current.setRemoteDescription(
      new RTCSessionDescription(offer)
    );

    const answer = await peerRef.current.createAnswer();

    await peerRef.current.setLocalDescription(answer);

    socket.emit("answer", {
      senderSocketId,
      answer: answer,
      targetSocketId: senderSocketId,
      roomName: roomId,
    });
  };

  return (
    <div className="bg-gray-950 min-h-screen text-white p-4 sm:p-8 flex flex-col items-center justify-center font-sans antialiased">
      <div className="max-w-5xl w-full mx-auto p-6 bg-gray-900 rounded-3xl shadow-2xl ring-2 ring-purple-600/50">
        <div className="text-center mb-8">
          <h1 className="text-4xl sm:text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-fuchsia-600 mb-2">
            Video Call
          </h1>
          <p className="text-gray-400 text-lg">
            A seamless connection, in style.
          </p>
        </div>

        {/* Video container grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
          {/* Local Video */}
          <div className="flex flex-col items-center">
            <h3 className="text-xl font-bold mb-2 text-purple-300">
              Your Video
            </h3>
            <div className="relative w-full aspect-video rounded-2xl overflow-hidden shadow-2xl">
              <video
                ref={localVideoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
              />
              {!localVideoRef.current?.srcObject && (
                <div className="absolute inset-0 bg-gray-800 flex items-center justify-center text-gray-500 text-lg">
                  Loading Local Video...
                </div>
              )}
            </div>
          </div>

          {/* Remote Video */}
          <div className="flex flex-col items-center">
            <h3 className="text-xl font-bold mb-2 text-purple-300">
              Remote Video
            </h3>
            <div className="relative w-full aspect-video rounded-2xl overflow-hidden shadow-2xl transition-transform duration-300 ease-in-out transform hover:scale-105">
              <video
                ref={remoteVideoRef}
                autoPlay
                playsInline
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gray-800 flex items-center justify-center text-gray-500 text-lg">
                Loading Remote Video...
              </div>
            </div>
          </div>
        </div>

        {/* Status Indicators */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 text-center mt-8">
          <div className="bg-gray-800 p-4 rounded-xl shadow-inner border border-gray-700">
            <p className="text-gray-400 font-medium">Room ID</p>
            <p className="text-purple-300 font-bold text-lg">
              <span>
                {" "}
                https://frontend-kappa-navy-15.vercel.app/room/{roomId ||
                  "N/A"}{" "}
              </span>
            </p>
          </div>
          <div className="bg-gray-800 p-4 rounded-xl shadow-inner border border-gray-700">
            <p className="text-gray-400 font-medium">Socket Connection</p>
            <p
              className={`font-bold text-lg ${
                isSocketConnected ? "text-green-400" : "text-red-400"
              }`}
            >
              {isSocketConnected ? "Connected" : "Disconnected"}
            </p>
          </div>
        </div>

        {/* Control buttons can go here */}
        <div className="flex items-center justify-center mt-12">
          <button className="px-8 py-4 bg-purple-600 text-white font-bold rounded-full shadow-lg hover:bg-purple-700 transition-all duration-300 ease-in-out transform hover:-translate-y-1 hover:scale-105 focus:outline-none focus:ring-4 focus:ring-purple-500 focus:ring-opacity-50">
            End Call
          </button>
        </div>
      </div>
    </div>
  );
};

export default Room;
