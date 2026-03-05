function videoSyncRegister(io, socket, roomState){
  socket.on("video-loaded", ({ roomId }) => {
    const room = roomState[roomId]
    if (!room.loadingUsers.includes(socket.id)) {
      room.loadingUsers.push(socket.id)
    }

    if (room.loadingUsers.length === room.expectedUsers.length) {
      clearTimeout(roomState[roomId].timeoutId)
      startPlayback(io,roomId,roomState)
    }
  })

  socket.on("video-state-change", ({ roomId, states }) => {
    videoStateChange(io, roomId, roomState, states)
  })
}

function videoStateChange(io, roomId, roomState, states) {
  if (states === "playing") {
    if(roomState[roomId].currentVideoChangeTime != null){
      roomState[roomId].currentVideoStartTime += (Date.now() - roomState[roomId].currentVideoChangeTime);
      roomState[roomId].currentVideoChangeTime = null
    }
  }
  if (states === "pausing") {
    // 一時停止を複数回行った場合に、開始時間を更新する
    if (roomState[roomId].currentVideoChangeTime) {
      roomState[roomId].currentVideoStartTime += (Date.now() - roomState[roomId].currentVideoChangeTime);
    }
    roomState[roomId].currentVideoChangeTime = Date.now()
  }

  io.to(roomId).emit("video-sync-state", { states, fixedStartTime: roomState[roomId].currentVideoStartTime })
  roomState[roomId].currentVideoStatus = states
}

function startPlayback(io,roomId,roomState) {
  io.to(roomId).emit("start-playback", { timestamp: Date.now() })
  roomState[roomId].currentVideoStatus = "playing"
  roomState[roomId].currentVideoStartTime = Date.now()
}

module.exports = {
  videoStateChange,
  startPlayback,
  videoSyncRegister
}