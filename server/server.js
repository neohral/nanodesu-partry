
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

  socket.on("join-room", ({ roomId, name }) => {
    socket.join(roomId)

    if (!roomState[roomId]) {
      roomState[roomId] = {
        members: [],
        leader: socket.id,
        currentVideoId: null,
        currentVideoUser: null,
        currentVideoStartTime: null,
        currentVideoStatus: "waiting",
        currentVideoChangeTime: null,
        gameStatus: "waiting",
        gameMaster: null,
        gameAnswerQueue: [],
        queue: [],
        gameQueue: [],
        historyQueue: [],
        loadingUsers: [],
        expectedUsers: [],
        timeoutId: "",
        opacity: 0,
        hideQueue: true
      }
    }
    if(roomState[roomId].gameStatus==="prepared"){
      roomState[roomId].gameStatus="waiting"
    }
    roomState[roomId].members.push({id: socket.id, name: name, videoId: null, score: 0})
    socket.emit("room-init", roomState[roomId])
    io.to(roomId).emit("sync-stats", roomState[roomId])
  })

  socket.on("add-video", async ({ roomId, videoId }) => {
    if(roomState[roomId].gameStatus !== "waiting") return
    const room = roomState[roomId]
    const info = await fetchVideoInfo(videoId)
    if (!info) return

    const username = room.members.find(m => m.id === socket.id)?.name

    const video = {
      id: crypto.randomUUID(),
      user: socket.id,
      userName: username ? username : "anonymous",
      ...info
    }

    let loadedCnt = 0;
    //TODO: ループではなく、Findして更新するようにする
    for (const member of roomState[roomId].members) {
      if (member.id === socket.id) {
        member.video = video
      }
      if (member.video) {
        loadedCnt++
      }
    }
    if (loadedCnt === roomState[roomId].members.length) {
      roomState[roomId].gameStatus = "prepared"
    }
    io.to(roomId).emit("sync-stats", roomState[roomId])
  })

  socket.on("answer-question", ({ roomId, userId }) => {
    const room = roomState[roomId]
    const member = room.members.find(m => m.id === userId)
    if (member) {
      if (room.gameAnswerQueue.find(m => m.id === member.id)) return
      room.gameStatus = "answered"
      room.gameAnswerQueue.push(member)
      io.to(roomId).emit("user-answered", { users: room.gameAnswerQueue })
      videoStateChange(roomId, "pausing")
    }
  })

  socket.on("gamemaster-answer", ({ roomId, correct, score }) => {
    const room = roomState[roomId]
    const answeredUser = room.gameAnswerQueue.shift()
    if (!answeredUser) return

    if (correct) {
      correctuser = room.members.find(m => m.id === answeredUser.id)
      if(correctuser) correctuser.score += score
      roomState[roomId].opacity = 1
      io.to(roomId).emit("sync-opacity", {opacity : roomState[roomId].opacity})
      room.gameAnswerQueue = []
      io.to(roomId).emit("user-answered-result", { user: answeredUser, correct })
      videoStateChange(roomId, "playing")
    }else{
      io.to(roomId).emit("user-answered", { users: room.gameAnswerQueue })
      if(room.gameAnswerQueue.length === 0){
        videoStateChange(roomId, "playing")
      }
      io.to(roomId).emit("user-answered-result", { user: answeredUser, correct })
    }
    io.to(roomId).emit("sync-stats", roomState[roomId])

    
  });

  socket.on("start-game", ({ roomId }) => {
    if (socket.id != roomState[roomId].leader) return
    roomState[roomId].queue = []
    roomState[roomId].gameQueue = []
    roomState[roomId].gameStatus = "playing"
    roomState[roomId].hideQueue = true
    io.to(roomId).emit("sync-hide-queue", {hideQueue : roomState[roomId].hideQueue})
    
    for (const member of roomState[roomId].members) {
      if (member.video) {
          roomState[roomId].gameQueue.push(member.video)
          member.video = null
      }
    }
    roomState[roomId].queue = [...roomState[roomId].gameQueue]
    io.to(roomId).emit("sync-stats", roomState[roomId])
    prepareVideo(roomId)
  })

  socket.on("reorder-queue", ({ roomId, queue }) => {
    const room = roomState[roomId]
    room.queue = queue
    io.to(roomId).emit("queue-updated", { queue: room.queue, historyQueue: room.historyQueue })
  })

  socket.on("video-ended", ({ roomId }) => {
    if (socket.id != roomState[roomId].leader || socket.id != roomState[roomId].gameMaster) return
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
    videoStateChange(roomId, states)
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

  socket.on("next-question", ({ roomId }) => {
    prepareVideo(roomId)
  })
})

function prepareVideo(roomId) {
  const room = roomState[roomId]
  const next = room.queue.shift()
  room.historyQueue.push(next)
  if (!next) {
    room.currentVideoId = null
    room.currentVideoStatus = "waiting"
    room.gameStatus = "waiting"
    room.queue = room.gameQueue
    room.hideQueue = false
    io.to(roomId).emit("sync-hide-queue", {hideQueue : room.hideQueue})
    io.to(roomId).emit("queue-updated", room.queue)
    io.to(roomId).emit("sync-stats", roomState[roomId])
    return
  }
  room.currentVideoId = next.videoId
  room.gameMaster = next.user
  const clients = io.sockets.adapter.rooms.get(roomId) || new Set()
  room.expectedUsers = Array.from(clients)
  room.loadingUsers = []
  room.currentVideoPauseStacks = 0
  room.opacity = 0
  io.to(roomId).emit("sync-opacity", {opacity : room.opacity})
  io.to(roomId).emit("prepare-video", { videoId: next.videoId, user: next.user })
  io.to(roomId).emit("queue-updated", room.queue)
  room.timeoutId = setTimeout(() => startPlayback(roomId), 5000)
}

function videoStateChange(roomId, states) {
  if (states === "playing") {
      roomState[roomId].currentVideoStartTime+=(Date.now()-roomState[roomId].currentVideoChangeTime);
      roomState[roomId].currentVideoChangeTime = null
    }
    if (states === "pausing") {
      // 一時停止を複数回行った場合に、開始時間を更新する
      if(roomState[roomId].currentVideoChangeTime){
        roomState[roomId].currentVideoStartTime+=(Date.now()-roomState[roomId].currentVideoChangeTime);
      }
      roomState[roomId].currentVideoChangeTime = Date.now()
    }
    
    io.to(roomId).emit("video-sync-state", {states,fixedStartTime:roomState[roomId].currentVideoStartTime})
    roomState[roomId].currentVideoStatus = states
}

function startPlayback(roomId) {
  io.to(roomId).emit("start-playback", { timestamp: Date.now() })
  roomState[roomId].currentVideoStatus = "playing"
  roomState[roomId].currentVideoStartTime = Date.now()
}

server.listen(3000, () => {
  console.log("Server running on http://localhost:3000")
})
