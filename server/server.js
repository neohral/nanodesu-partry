
const express = require("express")
const http = require("http")
const { Server } = require("socket.io")
const app = express()
const server = http.createServer(app)
const quiz = require("./intro/quiz")
const { videoStateChange,startPlayback } = require("./common/videoSync")
const { mode,videoRegister,prepareVideo } = require("./mode/intro")
const io = new Server(server, {
  cors: { origin: "*" }
})

const roomState = {}

io.on("connection", (socket) => {
  quiz(io,socket,roomState)
  videoRegister(io,socket,roomState)

  socket.on("join-room", ({ roomId, name }) => {
    socket.join(roomId)

    if (!roomState[roomId]) {
      roomState[roomId] = {
        id: roomId,
        members: [],
        leader: socket.id,
        currentVideoId: null,
        currentVideoUser: null,
        currentVideoStartTime: null,
        currentVideoStatus: "waiting",
        currentVideoChangeTime: null,
        queue: [],
        historyQueue: [],
        loadingUsers: [],
        expectedUsers: [],
        timeoutId: "",
        opacity: 0,
        hideQueue: true,
        gameStatus: "waiting",
        gameMaster: null,
        gameAnswerQueue: [],
      }
    }
    if (roomState[roomId].gameStatus === "prepared") {
      roomState[roomId].gameStatus = "waiting"
    }
    roomState[roomId].members.push({ id: socket.id, name: name, videoId: null, score: 0 })
    socket.emit("room-init", roomState[roomId])
    io.to(roomId).emit("sync-stats", roomState[roomId])
  })

  socket.on("reorder-queue", ({ roomId, queue }) => {
    const room = roomState[roomId]
    room.queue = queue
    io.to(roomId).emit("queue-updated", { queue: room.queue, historyQueue: room.historyQueue })
  })

  socket.on("video-ended", ({ roomId }) => {
    if (socket.id != roomState[roomId].leader || socket.id != roomState[roomId].gameMaster) return
    prepareVideo(io,roomId, roomState)
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

  socket.on("video-state-change", ({ roomId, states }) => {
    videoStateChange(io, roomId, roomState, states)
  })

  socket.on("toggle-opacity", ({ roomId }) => {
    if (roomState[roomId].opacity == 0) {
      roomState[roomId].opacity = 1
    } else {
      roomState[roomId].opacity = 0
    }

    io.to(roomId).emit("sync-opacity", { opacity: roomState[roomId].opacity })
  })

  socket.on("toggle-hide-queue", ({ roomId }) => {
    roomState[roomId].hideQueue = !roomState[roomId].hideQueue
    io.to(roomId).emit("sync-hide-queue", { hideQueue: roomState[roomId].hideQueue })
  })

  socket.on("disconnect", () => {
    for (const roomId in roomState) {
      const room = roomState[roomId]
      room.members = room.members.filter(member => member.id !== socket.id)
      if (room.leader === socket.id) {
        room.leader = room.members[0] ? room.members[0].id : null
      }
      room.members.length === 0 && delete roomState[roomId]
      if (roomState[roomId]) {
        io.to(roomId).emit("sync-stats", roomState[roomId])
      }
    }
  });
})

server.listen(3000, () => {
  console.log("Server running on http://localhost:3000")
  console.log(mode)
})
