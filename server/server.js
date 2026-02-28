
require("dotenv").config()
const express = require("express")
const http = require("http")
const { Server } = require("socket.io")
const axios = require("axios")
const crypto = require("crypto")

const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY

const app = express()
const server = http.createServer(app)

const io = new Server(server, {
  cors: { origin: "*" }
})

const roomState = {}

async function fetchVideoInfo(videoId) {
  const url = "https://www.googleapis.com/youtube/v3/videos"
  const res = await axios.get(url, {
    params: {
      part: "snippet",
      id: videoId,
      key: YOUTUBE_API_KEY
    }
  })

  const item = res.data.items[0]
  if (!item) return null

  return {
    videoId,
    title: item.snippet.title,
    thumbnail: item.snippet.thumbnails.medium.url
  }
}

io.on("connection", (socket) => {

  socket.on("join-room", ({ roomId }) => {
    socket.join(roomId)

    if (!roomState[roomId]) {
      roomState[roomId] = {
        members: [],
        leader: socket.id,
        currentVideoId: null,
        currentVideoStartTime: null,
        currentVideoStatus: "waiting",
        currentVideoChangeTime: null,
        queue: [],
        loadingUsers: [],
        expectedUsers: [],
        timeoutId: "",
        opacity: 1,
        hideQueue: false
      }
    }
    roomState[roomId].members.push(socket.id)
    socket.emit("room-init", roomState[roomId])
    io.to(roomId).emit("sync-stats", roomState[roomId])
  })

  socket.on("add-video", async ({ roomId, videoId }) => {
    const info = await fetchVideoInfo(videoId)
    if (!info) return

    const video = {
      id: crypto.randomUUID(),
      user: socket.id,
      ...info
    }

    roomState[roomId].queue.push(video)
    io.to(roomId).emit("queue-updated", roomState[roomId].queue)

    if(!roomState[roomId].currentVideoId){
      prepareVideo(roomId)
    }
  })

  socket.on("reorder-queue", ({ roomId, queue }) => {
    roomState[roomId].queue = queue
    io.to(roomId).emit("queue-updated", queue)
  })

  socket.on("video-ended", ({ roomId }) => {
    if (socket.id != roomState[roomId].leader) return
    prepareVideo(roomId)
  })

  socket.on("video-loaded", ({ roomId }) => {
    const room = roomState[roomId]
    if (!room.loadingUsers.includes(socket.id)) {
      room.loadingUsers.push(socket.id)
    }

    if (room.loadingUsers.length === room.expectedUsers.length) {
      clearTimeout(roomState[roomId].timeoutId)
      startPlayback(roomId)
    }
  })

   socket.on("video-state-change", ({ roomId,states }) => {
    if (states === "playing") {
      roomState[roomId].currentVideoStartTime+=(Date.now()-roomState[roomId].currentVideoChangeTime);
    }
    if (states === "pausing") {
      roomState[roomId].currentVideoChangeTime = Date.now()
    }
    
    io.to(roomId).emit("video-sync-state", {states,fixedStartTime:roomState[roomId].currentVideoStartTime})
    roomState[roomId].currentVideoStatus = states
   })

  socket.on("toggle-opacity", ({ roomId }) => {
    if (roomState[roomId].opacity == 0){
      roomState[roomId].opacity = 1
    }else{
      roomState[roomId].opacity = 0
    }

    io.to(roomId).emit("sync-opacity", {opacity : roomState[roomId].opacity})
  })

  socket.on("toggle-hide-queue", ({ roomId }) => {
    roomState[roomId].hideQueue=!roomState[roomId].hideQueue
    io.to(roomId).emit("sync-hide-queue", {hideQueue : roomState[roomId].hideQueue})
  })

  socket.on("disconnect", () => {
    for (const roomId in roomState) {
      const room = roomState[roomId]
      room.members = room.members.filter(id => id !== socket.id)
      if (room.leader === socket.id) {
        room.leader = room.members[0] || null
      }
      room.members.length === 0 && delete roomState[roomId]
      if (roomState[roomId]) {
        io.to(roomId).emit("sync-stats", roomState[roomId])
      }
    }
  });
})

function prepareVideo(roomId) {
  const room = roomState[roomId]
  const next = room.queue.shift()
  if (!next) {
    room.currentVideoId = null
    room.currentVideoStatus = "waiting"
    io.to(roomId).emit("queue-updated", room.queue)
    return
  }
  room.currentVideoId = next.videoId
  const clients = io.sockets.adapter.rooms.get(roomId) || new Set()
  room.expectedUsers = Array.from(clients)
  room.loadingUsers = []
  room.currentVideoPauseStacks = 0
  io.to(roomId).emit("prepare-video", { videoId: next.videoId })
  io.to(roomId).emit("queue-updated", room.queue)
  room.timeoutId = setTimeout(() => startPlayback(roomId), 5000)
}

function startPlayback(roomId) {
  io.to(roomId).emit("start-playback", { timestamp: Date.now() })
  roomState[roomId].currentVideoStatus = "playing"
  roomState[roomId].currentVideoStartTime = Date.now()
}

server.listen(3000, () => {
  console.log("Server running on http://localhost:3000")
})
