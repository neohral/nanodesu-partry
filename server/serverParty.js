
const express = require("express")
const http = require("http")
const { Server } = require("socket.io")
require("dotenv").config()
const app = express()
const server = http.createServer(app)
const { videoSyncRegister } = require("./common/videoSync")
const { initroom,mode,videoRegister,prepareVideo } = require("./mode/party")
const io = new Server(server, {
  cors: { origin: "*" }
})

const roomState = {}

io.on("connection", (socket) => {
  videoSyncRegister(io,socket,roomState)
  videoRegister(io,socket,roomState)

  socket.on("join-room", ({ roomId, name }) => {
    socket.join(roomId)

    if (!roomState[roomId]) {
      roomState[roomId] = structuredClone(initroom)
      roomState[roomId].leader = socket.id
      roomState[roomId].id = roomId
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

server.listen(process.env.PORT_PARTY || 3003, () => {
  console.log(`Server running on http://localhost:${process.env.PORT_PARTY || 3003}`)
  console.log(mode)
})
