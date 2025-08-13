"use client";

import React, { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import socket from "@/lib/socket";
import { useSession } from "next-auth/react";

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

  const user = session?.user;

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

    const handleConnect = () => setSocketConnected(true);

    const handleUserJoined = async (data: { socketId: string }) => {
      console.log("User joined:", data);
      await startCall(data.socketId);
    };

    const handleOffer = async ({
      offer,
      senderSocketId,
    }: {
      offer: RTCSessionDescriptionInit;
      senderSocketId: string;
    }) => {
      await createAnswer(offer, senderSocketId);
    };

    const handleAnswer = async ({
      answer,
    }: {
      answer: RTCSessionDescriptionInit;
    }) => {
      if (peerRef.current) {
        await peerRef.current.setRemoteDescription(
          new RTCSessionDescription(answer)
        );
      }
    };

    const handleIceCandidate = async ({
      candidate,
    }: {
      candidate: RTCIceCandidateInit;
    }) => {
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
  }, []);

  // Join room when socket is ready
  useEffect(() => {
    if (roomId && isSocketConnected) {
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

  // Bind peer events
  const bindPeerEvents = (targetSocketId: string) => {
    if (!peerRef.current) return;

    peerRef.current.ontrack = (event) => {
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = event.streams[0];
        setIsRemoteVideoReady(true);
      }
    };

    peerRef.current.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit("ice-candidate", {
          candidate: event.candidate,
          targetSocketId,
          senderSocketId: socket.id,
        });
      }
    };
  };

  // Start a call
  const startCall = async (targetSocketId: string) => {
    if (!localStreamRef.current) {
      console.error("Local stream not ready");
      return;
    }

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

    socket.emit("offer", { targetSocketId, offer, senderSocketId: socket.id });
  };

  // Create answer to an incoming offer
  const createAnswer = async (
    offer: RTCSessionDescriptionInit,
    senderSocketId: string
  ) => {
    if (!localStreamRef.current) {
      console.error("Local stream not ready");
      return;
    }

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
