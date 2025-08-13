"use client";

import React from "react";
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
    <div className="min-h-screen flex flex-col items-center justify-center">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-semibold mb-2">Google Meet Clone</h2>
        <p>A simple clone of Google Meet for video conferencing.</p>
      </div>
      <div className="p-8 bg-purple-500 rounded-lg shadow-md w-96">
        <h1 className="text-xl font-semibold mb-4 text-white">
          Welcome to the Room
        </h1>
        <p className="text-white">User Email: {user?.email}</p>
        <button
          onClick={handleCreateRoom}
          className="bg-white text-purple-500 w-full py-2 rounded-lg hover:bg-purple-600 transition-colors duration-200 mt-4"
        >
          Create New Room
        </button>
      </div>
    </div>
  );
};

export default Room;
