const crypto = require("crypto")
const {fetchVideoInfo} = require("../common/youtube")

const mode = "party"
function videoRegister(io, socket, roomState) {
    socket.on("add-video", async ({ roomId, videoId }) => {
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

        room.queue.push(video)
        io.to(roomId).emit("queue-updated", { queue: room.queue, historyQueue: room.historyQueue })

        if (!room.currentVideoId) {
            prepareVideo(io,roomId,roomState)
        }
    })
}

function prepareVideo(io, roomId, roomState) {
  const room = roomState[roomId]
  const next = room.queue.shift()
  if (!next) {
    room.currentVideoId = null
    room.currentVideoStatus = "waiting"
    io.to(roomId).emit("queue-updated", { queue: room.queue, historyQueue: room.historyQueue })
    return
  }
  room.historyQueue.push(next)
  room.currentVideoId = next.videoId
  const clients = io.sockets.adapter.rooms.get(roomId) || new Set()
  room.expectedUsers = Array.from(clients)
  room.loadingUsers = []
  room.currentVideoPauseStacks = 0
  io.to(roomId).emit("prepare-video", { videoId: next.videoId })
  io.to(roomId).emit("queue-updated", { queue: room.queue, historyQueue: room.historyQueue })
  
  room.timeoutId = setTimeout(() => startPlayback(roomId), 5000)
}

module.exports = {
    mode,
    videoRegister,
    prepareVideo
}