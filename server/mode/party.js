const crypto = require("crypto")
const { fetchVideoInfo } = require("../common/youtube")

const mode = "party"
const initroom = {
    members: [],
    currentVideoId: null,
    currentVideoStartTime: null,
    currentVideoTotalPauseTime: null,
    currentVideoStatus: "waiting",
    currentVideoChangeTime: null,
    currentVideoSeekTo: 0,
    queue: [],
    historyQueue: [],
    loadingUsers: [],
    expectedUsers: [],
    timeoutId: "",
    opacity: 1,
    hideQueue: false
}
function videoRegister(io, socket, roomState) {
    socket.on("add-video", async ({ roomId, videoId, seekTo }) => {
        const room = roomState[roomId]
        const info = await fetchVideoInfo(videoId)
        if (!info) return

        const member = room.members.find(m => m.id === socket.id)
        if (!member) return

        const video = {
            id: crypto.randomUUID(),
            user: socket.id,
            userName: member.name,
            seekTo: seekTo,
            ...info
        }

        room.queue.push(video)
        io.to(roomId).emit("queue-updated", { queue: room.queue, historyQueue: room.historyQueue })

        if (!room.currentVideoId) {
            prepareVideo(io, roomId, roomState)
        }
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
        room.currentVideoSeekTo = 0
        io.to(roomId).emit("queue-updated", { queue: room.queue, historyQueue: room.historyQueue })
        return
    }
    room.historyQueue.push(next)
    room.currentVideoId = next.videoId
    const clients = io.sockets.adapter.rooms.get(roomId) || new Set()
    room.expectedUsers = Array.from(clients)
    room.loadingUsers = []
    room.currentVideoPauseStacks = 0
    room.currentVideoSeekTo = next.seekTo
    io.to(roomId).emit("prepare-video", { videoId: next.videoId, seekTo: room.currentVideoSeekTo, })
    io.to(roomId).emit("queue-updated", { queue: room.queue, historyQueue: room.historyQueue })

    room.timeoutId = setTimeout(() => startPlayback(roomId), 5000)
}

module.exports = {
    initroom,
    mode,
    videoRegister,
    prepareVideo
}