const {videoStateChange } =
  require("../common/videoSync")
const {prepareVideo } =
  require("../mode/intro")

module.exports = function (io, socket, roomState) {
    socket.on("start-game", ({ roomId }) => {
        if (socket.id != roomState[roomId].leader) return
        roomState[roomId].queue = []
        roomState[roomId].historyQueue = []
        roomState[roomId].gameStatus = "playing"
        roomState[roomId].hideQueue = true
        io.to(roomId).emit("change-game-status", roomState[roomId].gameStatus)
        io.to(roomId).emit("sync-hide-queue", { hideQueue: roomState[roomId].hideQueue })

        for (const member of roomState[roomId].members) {
            if (member.video) {
                roomState[roomId].queue.push(member.video)
                member.video = null
            }
        }
        io.to(roomId).emit("sync-stats", roomState[roomId])
        prepareVideo(io, roomId, roomState,)
    })

    socket.on("answer-question", ({ roomId, userId }) => {
        const room = roomState[roomId]
        const member = room.members.find(m => m.id === userId)
        if (member) {
            if (room.gameAnswerQueue.find(m => m.id === member.id)) return
            room.gameAnswerQueue.push(member)
            io.to(roomId).emit("user-answered", { users: room.gameAnswerQueue, isAddAnswered: true })
            videoStateChange(io, roomId, roomState, "pausing")
        }
    })

    socket.on("gamemaster-answer", ({ roomId, correct, score }) => {
        const room = roomState[roomId]
        const answeredUser = room.gameAnswerQueue.shift()
        if (!answeredUser) return

        if (correct) {
            correctuser = room.members.find(m => m.id === answeredUser.id)
            if (correctuser) correctuser.score += score
            roomState[roomId].opacity = 1
            room.gameAnswerQueue = []
            room.gameStatus = "corrected"
            videoStateChange(io, roomId, roomState, "playing")
            io.to(roomId).emit("user-answered-result", { user: answeredUser, correct })
            io.to(roomId).emit("sync-opacity", { opacity: roomState[roomId].opacity })
            io.to(roomId).emit("change-game-status", roomState[roomId].gameStatus)
            io.to(roomId).emit("user-answered", { users: room.gameAnswerQueue, isAddAnswered: false })
        } else {
            io.to(roomId).emit("user-answered", { users: room.gameAnswerQueue, isAddAnswered: false })
            if (room.gameAnswerQueue.length === 0) {
                videoStateChange(io, roomId, roomState, "playing")
            }
            io.to(roomId).emit("user-answered-result", { user: answeredUser, correct })
        }
        io.to(roomId).emit("sync-stats", roomState[roomId])


    });

    socket.on("user-answered-skip", ({ roomId }) => {
        io.to(roomId).emit("user-answered-skip")
        videoStateChange(io, roomId, roomState, "playing")
    })

    socket.on("pre-game-start", ({ roomId }) => {
        io.to(roomId).emit("pre-game-start")
    })

    socket.on("next-question", ({ roomId }) => {
        prepareVideo(io, roomId, roomState)
    })
}