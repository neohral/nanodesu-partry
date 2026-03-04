function videoStateChange(io, roomId, roomState, states) {
  if (states === "playing") {
    roomState[roomId].currentVideoStartTime += (Date.now() - roomState[roomId].currentVideoChangeTime);
    roomState[roomId].currentVideoChangeTime = null
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

function startPlayback(roomId) {
  io.to(roomId).emit("start-playback", { timestamp: Date.now() })
  roomState[roomId].currentVideoStatus = "playing"
  roomState[roomId].currentVideoStartTime = Date.now()
}

module.exports = {
  videoStateChange,
  startPlayback
}