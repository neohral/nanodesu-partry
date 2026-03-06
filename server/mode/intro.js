const crypto = require("crypto")
const { fetchVideoInfo } = require("../common/youtube")

const mode = "intro"
const initroom = {
  members: [],
  currentVideoId: null,
  currentVideoUser: null,
  currentVideoStartTime: null,
  currentVideoTotalPauseTime: null,
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
function videoRegister(io, socket, roomState) {
  socket.on("add-video", async ({ roomId, videoId }) => {
    const room = roomState[roomId]
    if (room.gameStatus !== "waiting") return

    const info = await fetchVideoInfo(videoId)
    if (!info) return

    const member = room.members.find(m => m.id === socket.id)
    if (!member) return

    const video = {
      id: crypto.randomUUID(),
      user: socket.id,
      userName: member.name,
      ...info
    }

    member.video = video;
    const loadedCnt = room.members.filter((member) => member.video)

    if (loadedCnt === roomState[roomId].members.length) {
      roomState[roomId].gameStatus = "prepared"
      io.to(roomId).emit("change-game-status", roomState[roomId].gameStatus)
    }
    io.to(roomId).emit("sync-stats", roomState[roomId])
  })
  socket.on("video-ended", ({ roomId }) => {
    if (socket.id != roomState[roomId].leader) return
    prepareVideo(io, roomId, roomState)
  })
}

function prepareVideo(io, roomId, roomState) {
  const room = roomState[roomId]
  const next = room.queue.shift()
  if (!next) {
    room.currentVideoId = null
    room.currentVideoStatus = "waiting"
    room.gameStatus = "waiting"
    room.hideQueue = false
    io.to(roomId).emit("change-game-status", roomState[roomId].gameStatus)
    io.to(roomId).emit("sync-hide-queue", { hideQueue: room.hideQueue })
    io.to(roomId).emit("queue-updated", { queue: room.queue, historyQueue: room.historyQueue })
    io.to(roomId).emit("sync-stats", roomState[roomId])
    io.to(roomId).emit("end-game")
    return
  }
  room.historyQueue.push(next)
  room.currentVideoId = next.videoId
  room.gameMaster = next.user
  const clients = io.sockets.adapter.rooms.get(roomId) || new Set()
  room.expectedUsers = Array.from(clients)
  room.loadingUsers = []
  room.currentVideoPauseStacks = 0
  room.opacity = 0
  io.to(roomId).emit("sync-opacity", { opacity: room.opacity })
  io.to(roomId).emit("prepare-video", { videoId: next.videoId, user: next.user })
  io.to(roomId).emit("queue-updated", { queue: room.queue, historyQueue: room.historyQueue })
  room.timeoutId = setTimeout(() => startPlayback(roomId), 5000)
}

module.exports = {
  initroom,
  mode,
  videoRegister,
  prepareVideo
}