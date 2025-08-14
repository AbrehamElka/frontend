"use client";

import React, { useRef } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

const generateRoomString = () => {
  const parts = [];
  // Generates a random string of 3 characters
  const generatePart = () => Math.random().toString(36).substring(2, 5);

  parts.push(generatePart());
  parts.push(generatePart());
  parts.push(generatePart());

  return parts.join("-");
};

const Room = () => {
  // Use the useSession hook to get session data and status
  const { data: session, status } = useSession();
  const router = useRouter();
  const roomInputRef = useRef<HTMLInputElement>(null);

  // Show a loading state while the session is being fetched
  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-white">Loading...</p>
      </div>
    );
  }

  // If there's no session, redirect to the sign-in page or show a message
  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-white">Please sign in to view this page.</p>
      </div>
    );
  }

  const handleCreateRoom = () => {
    // Generate a new room ID
    const newRoomId = generateRoomString();
    // Redirect to the new room's dynamic URL
    router.push(`/room/${newRoomId}`);
  };

  // Access the user's email from the session object
  const user = session.user;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-cover bg-center bg-no-repeat bg-[url('/background_1.jpg')] px-4">
      {/* Title Section */}
      <div className="text-center mb-6 sm:mb-8">
        <h2 className="text-3xl sm:text-4xl font-extrabold text-white drop-shadow-lg tracking-wide">
          Google Meet Clone
        </h2>
        <p className="text-purple-200 text-base sm:text-lg mt-1 sm:mt-2">
          A simple clone of Google Meet for video conferencing.
        </p>
      </div>

      {/* Glassy Card */}
      <div className="p-6 sm:p-8 rounded-2xl shadow-2xl w-full max-w-sm sm:w-96 backdrop-blur-md bg-purple-500/20 border border-purple-400/30">
        <h1 className="text-xl sm:text-2xl font-bold mb-3 sm:mb-4 text-white drop-shadow-sm">
          Welcome to the Room
        </h1>
        <p className="text-purple-100 mb-5 sm:mb-6 text-sm sm:text-base truncate">
          User Email: {user?.email}
        </p>

        {/* Create Room Button */}
        <button
          onClick={handleCreateRoom}
          className="w-full py-3 rounded-lg font-semibold bg-gradient-to-r from-purple-500 via-purple-600 to-purple-700 text-white shadow-lg hover:scale-105 transition-transform duration-200 text-sm sm:text-base"
        >
          Create New Room
        </button>

        {/* Join Room Section */}
        <div className="mt-6 sm:mt-8">
          <h2 className="text-lg sm:text-xl font-semibold mb-3 sm:mb-4 text-white drop-shadow-sm">
            Join a Room
          </h2>
          <div className="flex flex-col sm:flex-row items-center sm:items-stretch gap-3">
            <input
              ref={roomInputRef}
              type="text"
              placeholder="Enter Room Code"
              className="p-3 rounded-lg bg-white/90 text-purple-700 w-full sm:flex-1 outline-none focus:ring-2 focus:ring-purple-400 text-sm sm:text-base"
            />
            <button
              onClick={() => {
                const roomCode = roomInputRef.current?.value;
                if (roomCode) router.push(`/room/${roomCode}`);
              }}
              className="w-full sm:w-auto px-5 py-3 rounded-lg font-semibold bg-gradient-to-r from-green-500 to-green-600 text-white shadow-lg hover:scale-105 transition-transform duration-200 text-sm sm:text-base"
            >
              Join
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Room;
