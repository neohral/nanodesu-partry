import { ref } from "vue";
export function useRoom(socket, roomId, roomStateRef, playerRef) {
  const userId = ref("");
  const hideQueue = ref(false);
  const hideVideo = ref(false);
  const userName = ref("");
  const videoUrl = ref("");
  const showNameModal = ref(false);
  const partyState = ref("waiting");
  const currentVideoStartTime = ref(0);
  const currentVideoPauseTime = ref(0);

  function joinRoom() {
    const name = userName.value.trim() || "Anonymous";
    socket.emit("join-room", { roomId, name });
    showNameModal.value = false;
  }

  function onReorder() {
    socket.emit("reorder-queue", { roomId, queue: roomStateRef.value.queue });
  }

  function addVideo() {
    console.log("add");
    const id = extractVideoId(videoUrl.value);
    if (!id) return;
    socket.emit("add-video", { roomId, videoId: id });
    videoUrl.value = "";
  }

  function extractVideoId(url) {
    const reg = /(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&]+)/;
    const match = url.match(reg);
    return match ? match[1] : null;
  }

  function startPlayback(timestamp) {
    const latency = (Date.now() - timestamp) / 1000;
    console.log("st", Date.now() - timestamp, latency);
    const player = playerRef.value;
    player.seekTo(latency);
    player.playVideo();
    partyState.value = "willplay";
  }

  function skipToNextVideo() {
    socket.emit("video-ended", { roomId });
    partyState.value = "waiting";
  }

  function toggleOpacity() {
    socket.emit("toggle-opacity", { roomId });
  }

  function toggleHideQueue() {
    socket.emit("toggle-hide-queue", { roomId });
  }

  function eventRegister(io, socket, roomState) {
    socket.on("sync-stats", (state) => {
      roomState.value = state;
    });
    
    socket.on("room-init", (state, serverTime) => {
      const dateTimeDiff = Date.now() - serverTime;
      console.log("lag", dateTimeDiff);
      userId.value = socket.id;
      hideQueue.value = state.hideQueue;
      hideVideo.value = state.opacity === "0" || state.opacity === 0;
      changeOpacity(state.opacity);
      if (state.currentVideoId) {
        partyState.value = "catching-up";
        currentVideoStartTime.value =
          state.currentVideoStartTime + dateTimeDiff;
        currentVideoPauseTime.value = state.currentVideoTotalPauseTime;
        player.cueVideoById(state.currentVideoId);
      }
    });
    socket.on("queue-updated", (obj) => {
      roomState.value.queue = obj.queue;
      roomState.value.historyQueue = obj.historyQueue;
    });
    socket.on("sync-hide-queue", (state) => {
      hideQueue.value = state.hideQueue;
    });
    socket.on("sync-opacity", (state) => {
      hideVideo.value = state.opacity === 0;
      changeOpacity(state.opacity);
    });
    socket.on("video-sync-state", ({ states, totalPauseTime }) => {
      currentVideoPauseTime.value = totalPauseTime;
      if (states === "pausing") {
        partyState.value = "willpausing";
        playerRef.value.pauseVideo();
      } else if (states === "playing") {
        startPlayback(
          currentVideoStartTime.value + currentVideoPauseTime.value,
        );
      }
    });
    socket.on("start-playback", ({ timestamp }) => {
      currentVideoStartTime.value = Date.now();
      currentVideoPauseTime.value = 0;
      startPlayback(currentVideoStartTime.value);
    });
  }

  return {
    userId,
    userName,
    hideQueue,
    hideVideo,
    videoUrl,
    showNameModal,
    partyState,
    currentVideoStartTime,
    currentVideoPauseTime,
    joinRoom,
    onReorder,
    addVideo,
    extractVideoId,
    startPlayback,
    skipToNextVideo,
    eventRegister,
    toggleOpacity,
    toggleHideQueue,
  };
}
