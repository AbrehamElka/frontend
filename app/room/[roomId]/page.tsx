"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import socket from "@/lib/socket";
import { useSession } from "next-auth/react";
import {
  Copy,
  PhoneOff,
  Mic,
  MicOff,
  Video,
  VideoOff,
  Info,
  X,
} from "lucide-react";

const pcConfig: RTCConfiguration = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
};

const Room = () => {
  const { roomId } = useParams();
  const router = useRouter();
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
  const [showRoomInfo, setShowRoomInfo] = useState(false);

  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);

  const [remotePersonName, setRemotePersonName] = useState("");

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

  const handleMute = () => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !isMuted;
        setIsMuted(!isMuted);
      }
    }
  };

  // Function to handle turning the camera on/off
  const handleToggleCamera = () => {
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = isCameraOff;
        setIsCameraOff(!isCameraOff);
      }
    }
  };

  const handleEndCall = useCallback(() => {
    console.log("Ending call...");

    // Stop all media tracks to turn off the camera and microphone
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
    }

    // Close the peer connection
    if (peerRef.current) {
      peerRef.current.close();
    }

    // Disconnect from the socket server
    socket.disconnect();

    // Navigate back to the home page
    router.push("/room");
  }, [router]);

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
    async (targetSocketId: string, userName: string | null | undefined) => {
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
        userName,
      });
      console.log("I am calling", userName);
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
      if (!session?.user) return;
      console.log("[Socket] User joined:", data);
      setRemotePersonName(data.userId);
      await startCall(data.socketId, session.user.name);
    };

    const handleOffer = async ({
      offer,
      senderSocketId,
      senderUserName,
    }: {
      offer: RTCSessionDescriptionInit;
      senderSocketId: string;
      senderUserName: string;
    }) => {
      console.log(
        "[Socket] Received offer from:",
        senderSocketId,
        "by",
        senderUserName
      );
      setRemotePersonName(senderUserName);
      await createAnswer(offer, senderSocketId);
    };

    const handleExistingUsers = (
      users: { socketId: string; userName: string }[]
    ) => {
      console.log("[Socket] Existing users:", users);
      // The new client receives this list and can set the remote name.
      if (users.length > 0) {
        // Find the first user that is not the current user
        setRemotePersonName(users[0].userName);
      }
    };

    const handleUserLeft = (data: { socketId: string; userId: string }) => {
      console.log("[Socket] User left:", data);
      // Clear remote person name when the other user leaves
      setRemotePersonName("");
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
    socket.on("user-left", handleUserLeft);
    socket.on("offer", handleOffer);
    socket.on("answer", handleAnswer);
    socket.on("ice-candidate", handleIceCandidate);
    socket.on("existing-users", handleExistingUsers);

    return () => {
      socket.off("connect", handleConnect);
      socket.off("user-joined", handleUserJoined);
      socket.off("user-left", handleUserLeft);
      socket.off("offer", handleOffer);
      socket.off("answer", handleAnswer);
      socket.off("ice-candidate", handleIceCandidate);
      socket.off("existing-users", handleExistingUsers);
      socket.disconnect();
    };
  }, [startCall, createAnswer]);

  // Join room when socket is ready
  // Join room safely when session and socket are ready
  useEffect(() => {
    if (!session?.user || !roomId || !isSocketConnected) return;

    const userName = session.user.name;
    console.log("[Room] Joining room:", roomId, "with user:", userName);

    socket.emit("join-room", {
      roomId,
      userId: userName,
    });

    // Cleanup: leave room when component unmounts
    return () => {
      socket.emit("leave-room", {
        roomId,
        userId: userName,
      });
    };
  }, [session?.user, roomId, isSocketConnected]);

  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-white">Please sign in to view this page.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen text-white flex flex-col font-sans bg-cover bg-center bg-no-repeat bg-[url('/background.jpg')] bg-fixed px-2 sm:px-6">
      <div className="relative flex-1 flex items-center justify-center p-2 sm:p-6">
        {/* Remote Video */}
        <div className="relative w-full max-w-5xl h-[600px] sm:h-[500px] md:h-[600px] rounded-2xl overflow-hidden shadow-2xl">
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            className="w-full h-full object-cover rounded-2xl"
          />
          {!isRemoteVideoReady && (
            <div className="absolute inset-0 flex items-center justify-center text-gray-500 text-base sm:text-lg rounded-2xl bg-gray-900/50 backdrop-blur-sm">
              Waiting for remote video...
            </div>
          )}

          {/* Local Video Overlay */}
          <div className="absolute bottom-4 right-2 sm:right-4 w-32 sm:w-48 aspect-video rounded-xl overflow-hidden shadow-lg border-2 border-purple-500/70">
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
            />
            {!isLocalVideoReady && (
              <div className="absolute inset-0 bg-gray-800 flex items-center justify-center text-gray-400 text-xs sm:text-sm">
                Loading...
              </div>
            )}
          </div>

          {/* Name tag */}
          <div className="absolute top-4 sm:top-8 left-2 sm:left-8 bg-black/50 backdrop-blur-md px-3 sm:px-4 py-1 sm:py-2 rounded-lg shadow-lg border border-purple-500/50">
            <span className="text-white font-semibold text-sm sm:text-lg tracking-wide">
              {remotePersonName ? remotePersonName : "Name"}
            </span>
          </div>

          {/* Floating Control Buttons (Top Center) */}
          <div className="absolute top-2 sm:top-4 left-1/2 -translate-x-1/2 flex gap-2 sm:gap-4 bg-black/40 backdrop-blur-md p-2 sm:p-3 rounded-full shadow-lg">
            <button
              onClick={handleEndCall}
              className="p-3 sm:p-4 bg-red-600 rounded-full text-white shadow-lg hover:scale-110 hover:bg-red-700 transition-all duration-200"
              aria-label="End Call"
            >
              <PhoneOff size={20} />
            </button>
            <button
              onClick={handleMute}
              className={`p-3 sm:p-4 rounded-full text-white shadow-lg hover:scale-110 transition-all duration-200 ${
                isMuted
                  ? "bg-blue-600 hover:bg-blue-700"
                  : "bg-gray-700 hover:bg-gray-800"
              }`}
              aria-label={isMuted ? "Unmute" : "Mute"}
            >
              {isMuted ? <MicOff size={20} /> : <Mic size={20} />}
            </button>
            <button
              onClick={handleToggleCamera}
              className={`p-3 sm:p-4 rounded-full text-white shadow-lg hover:scale-110 transition-all duration-200 ${
                isCameraOff
                  ? "bg-purple-600 hover:bg-purple-700"
                  : "bg-gray-700 hover:bg-gray-800"
              }`}
              aria-label={isCameraOff ? "Turn camera on" : "Turn camera off"}
            >
              {isCameraOff ? <VideoOff size={20} /> : <Video size={20} />}
            </button>
          </div>

          {/* Room Info (Bottom Center Overlay) */}
          <div className="hidden sm:flex absolute bottom-2  sm:bottom-4 left-1/2 -translate-x-1/2  flex-col sm:flex-row items-center gap-1 sm:gap-3 bg-black/40 backdrop-blur-md px-3 sm:px-4 py-1 sm:py-2 rounded-full shadow-lg text-sm sm:text-base">
            <span className="text-purple-300 font-bold">Code: {roomId}</span>
            <div className="flex items-center gap-2">
              <button
                onClick={handleCopy}
                className="p-2 rounded-full bg-purple-700 hover:bg-purple-600 transition-colors duration-200"
                aria-label="Copy room URL"
              >
                <Copy size={16} />
              </button>
              {isCopied && (
                <span className="text-green-400 font-semibold text-xs sm:text-sm">
                  Copied!
                </span>
              )}
            </div>
          </div>

          {/* Toggle Button for small screens */}
          <button
            className="sm:hidden absolute bottom-4 left-4 bg-purple-700 hover:bg-purple-600 text-white p-3 rounded-full shadow-lg transition-transform duration-200"
            onClick={() => setShowRoomInfo(!showRoomInfo)}
            aria-label="Toggle room info"
          >
            {showRoomInfo ? <X size={20} /> : <Info size={20} />}
          </button>

          {/* Room Info for small screens */}
          {showRoomInfo && (
            <div className="sm:hidden absolute bottom-16 left-4 flex flex-col items-start gap-2 bg-black/50 backdrop-blur-md px-4 py-2 rounded-lg shadow-lg text-sm text-white">
              <span className="text-purple-300 font-bold">Code: {roomId}</span>
              <button
                onClick={handleCopy}
                className="p-2 rounded-full bg-purple-700 hover:bg-purple-600 transition-colors duration-200"
                aria-label="Copy room URL"
              >
                <Copy size={16} />
              </button>
              {isCopied && (
                <span className="text-green-400 font-semibold text-xs">
                  Copied!
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Room;
