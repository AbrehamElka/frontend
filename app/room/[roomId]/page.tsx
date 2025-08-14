"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import socket from "@/lib/socket";
import { useSession } from "next-auth/react";
import { Copy } from "lucide-react";

const pcConfig: RTCConfiguration = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
};

const Room = () => {
  const { roomId } = useParams();
  const { data: session } = useSession();

  const localStreamRef = useRef<MediaStream | null>(null);
  const peerRef = useRef<RTCPeerConnection | null>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const targetSocketRef = useRef<string | null>(null);

  const [isSocketConnected, setSocketConnected] = useState(false);
  const [isLocalVideoReady, setIsLocalVideoReady] = useState(false);
  const [isRemoteVideoReady, setIsRemoteVideoReady] = useState(false);
  const [isCopied, setIsCopied] = useState(false);

  const user = session?.user;

  const handleCopy = async () => {
    const roomUrl = `${roomId}`;

    try {
      await navigator.clipboard.writeText(roomUrl);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy URL:", err);
      // Fallback for older browsers
      const tempTextArea = document.createElement("textarea");
      tempTextArea.value = roomUrl;
      document.body.appendChild(tempTextArea);
      tempTextArea.select();
      document.execCommand("copy");
      document.body.removeChild(tempTextArea);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    }
  };

  // Bind peer events
  const bindPeerEvents = useCallback((targetSocketId: string) => {
    if (!peerRef.current) return;

    peerRef.current.ontrack = (event) => {
      console.log("[Peer] Received remote track:", event.streams[0]);
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = event.streams[0];
        setIsRemoteVideoReady(true);
      }
    };

    peerRef.current.onicecandidate = (event) => {
      if (event.candidate) {
        console.log("[Peer] Sending ICE candidate to:", targetSocketId);
        socket.emit("ice-candidate", {
          candidate: event.candidate,
          targetSocketId,
          senderSocketId: socket.id,
        });
      }
    };

    peerRef.current.onconnectionstatechange = () => {
      console.log("[Peer] Connection state:", peerRef.current?.connectionState);
    };

    peerRef.current.oniceconnectionstatechange = () => {
      console.log(
        "[Peer] ICE connection state:",
        peerRef.current?.iceConnectionState
      );
    };
  }, []);

  // Start a call
  const startCall = useCallback(
    async (targetSocketId: string) => {
      if (!localStreamRef.current) {
        console.error("Local stream not ready");
        return;
      }

      console.log("[Call] Starting call with:", targetSocketId);
      targetSocketRef.current = targetSocketId;

      if (!peerRef.current) {
        peerRef.current = new RTCPeerConnection(pcConfig);
        bindPeerEvents(targetSocketId);
        localStreamRef.current.getTracks().forEach((track) => {
          peerRef.current!.addTrack(track, localStreamRef.current!);
        });
      }

      const offer = await peerRef.current.createOffer();
      await peerRef.current.setLocalDescription(offer);

      socket.emit("offer", {
        targetSocketId,
        offer,
        senderSocketId: socket.id,
        roomName: roomId,
      });
    },
    [bindPeerEvents, roomId]
  );

  // Create answer to an incoming offer
  const createAnswer = useCallback(
    async (offer: RTCSessionDescriptionInit, senderSocketId: string) => {
      if (!localStreamRef.current) {
        console.error("Local stream not ready");
        return;
      }

      console.log("[Call] Creating answer for:", senderSocketId);
      targetSocketRef.current = senderSocketId;

      if (!peerRef.current) {
        peerRef.current = new RTCPeerConnection(pcConfig);
        bindPeerEvents(senderSocketId);
        localStreamRef.current.getTracks().forEach((track) => {
          peerRef.current!.addTrack(track, localStreamRef.current!);
        });
      }

      await peerRef.current.setRemoteDescription(
        new RTCSessionDescription(offer)
      );
      const answer = await peerRef.current.createAnswer();
      await peerRef.current.setLocalDescription(answer);

      socket.emit("answer", {
        senderSocketId: socket.id,
        answer,
        targetSocketId: senderSocketId,
        roomName: roomId,
      });
    },
    [bindPeerEvents, roomId]
  );

  // Initialize local video
  useEffect(() => {
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        });
        localStreamRef.current = stream;
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
          setIsLocalVideoReady(true);
        }
        console.log("[Local] Preview stream ready");
      } catch (err) {
        console.error("[Local] Failed to get media:", err);
      }
    })();
  }, []);

  // Socket event listeners
  useEffect(() => {
    if (!socket.connected) socket.connect();

    const handleConnect = () => {
      setSocketConnected(true);
      console.log("[Socket] Connected with ID:", socket.id);
    };

    const handleUserJoined = async (data: {
      socketId: string;
      userId: string;
    }) => {
      console.log("[Socket] User joined:", data);
      await startCall(data.socketId);
    };

    const handleOffer = async ({
      offer,
      senderSocketId,
    }: {
      offer: RTCSessionDescriptionInit;
      senderSocketId: string;
    }) => {
      console.log("[Socket] Received offer from:", senderSocketId);
      await createAnswer(offer, senderSocketId);
    };

    const handleAnswer = async ({
      answer,
      senderSocketId,
    }: {
      answer: RTCSessionDescriptionInit;
      senderSocketId: string;
    }) => {
      console.log("[Socket] Received answer from:", senderSocketId);
      if (peerRef.current) {
        await peerRef.current.setRemoteDescription(
          new RTCSessionDescription(answer)
        );
      }
    };

    const handleIceCandidate = async ({
      candidate,
      senderSocketId,
    }: {
      candidate: RTCIceCandidateInit;
      senderSocketId: string;
    }) => {
      console.log("[Socket] Received ICE candidate from:", senderSocketId);
      if (peerRef.current && candidate) {
        try {
          await peerRef.current.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (e) {
          console.error("Failed to add ICE candidate", e);
        }
      }
    };

    socket.on("connect", handleConnect);
    socket.on("user-joined", handleUserJoined);
    socket.on("offer", handleOffer);
    socket.on("answer", handleAnswer);
    socket.on("ice-candidate", handleIceCandidate);

    return () => {
      socket.off("connect", handleConnect);
      socket.off("user-joined", handleUserJoined);
      socket.off("offer", handleOffer);
      socket.off("answer", handleAnswer);
      socket.off("ice-candidate", handleIceCandidate);
      socket.disconnect();
    };
  }, [startCall, createAnswer]);

  // Join room when socket is ready
  useEffect(() => {
    if (roomId && isSocketConnected) {
      console.log("[Room] Joining room:", roomId, "with user:", user?.name);
      socket.emit("join-room", {
        roomId,
        userId: user?.name,
      });
    }
  }, [roomId, isSocketConnected, user?.name]);

  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-white">Please sign in to view this page.</p>
      </div>
    );
  }

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
          <div className="mt-4 space-y-2">
            <div
              className={`inline-flex items-center px-3 py-1 rounded-full text-sm ${
                isSocketConnected
                  ? "bg-green-500/20 text-green-400"
                  : "bg-red-500/20 text-red-400"
              }`}
            >
              <div
                className={`w-2 h-2 rounded-full mr-2 ${
                  isSocketConnected ? "bg-green-400" : "bg-red-400"
                }`}
              ></div>
              Socket: {isSocketConnected ? "Connected" : "Disconnected"}
            </div>
            <div
              className={`inline-flex items-center px-3 py-1 rounded-full text-sm ${
                isLocalVideoReady
                  ? "bg-green-500/20 text-green-400"
                  : "bg-yellow-500/20 text-yellow-400"
              }`}
            >
              <div
                className={`w-2 h-2 rounded-full mr-2 ${
                  isLocalVideoReady ? "bg-green-400" : "bg-yellow-400"
                }`}
              ></div>
              Local Video: {isLocalVideoReady ? "Ready" : "Loading..."}
            </div>
            <div
              className={`inline-flex items-center px-3 py-1 rounded-full text-sm ${
                isRemoteVideoReady
                  ? "bg-green-500/20 text-green-400"
                  : "bg-gray-500/20 text-gray-400"
              }`}
            >
              <div
                className={`w-2 h-2 rounded-full mr-2 ${
                  isRemoteVideoReady ? "bg-green-400" : "bg-gray-400"
                }`}
              ></div>
              Remote Video: {isRemoteVideoReady ? "Connected" : "Waiting..."}
            </div>
          </div>
        </div>

        <div className="bg-gray-800 p-4 rounded-xl shadow-inner border border-gray-700">
          <p className="text-gray-400 font-medium">Room ID</p>
          <div className="flex items-center gap-2">
            <span className="text-purple-300 font-bold text-lg">{roomId}</span>
            <button
              onClick={handleCopy}
              className="p-2 rounded-full bg-purple-700 hover:bg-purple-600 transition-colors duration-200"
              aria-label="Copy room URL"
            >
              <Copy size={20} className="text-white" />
            </button>
            {isCopied && (
              <span className="text-green-400 text-sm font-semibold">
                Copied!
              </span>
            )}
          </div>
        </div>

        {/* Video grid */}
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
              {!isLocalVideoReady && (
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
            <div className="relative w-full aspect-video rounded-2xl overflow-hidden shadow-2xl">
              <video
                ref={remoteVideoRef}
                autoPlay
                playsInline
                className="w-full h-full object-cover"
              />
              {!isRemoteVideoReady && (
                <div className="absolute inset-0 bg-gray-800 flex items-center justify-center text-gray-500 text-lg">
                  Loading Remote Video...
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Room;
