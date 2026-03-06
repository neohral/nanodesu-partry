import { ref } from "vue";
export function useRoom(socket, roomId, roomStateRef, playerRef) {
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
    socket.on("video-sync-state", ({ states, totalPauseTime  }) => {
    currentVideoPauseTime = totalPauseTime 
      if (states === "pausing") {
        partyState.value = "willpausing";
        player.pauseVideo();
      } else if (states === "playing") {
        startPlayback(currentVideoStartTime + currentVideoPauseTime );
      }
    });
    socket.on("start-playback", ({ timestamp }) => {
      currentVideoStartTime = Date.now();
      currentVideoPauseTime = 0;
      startPlayback(timestamp);
    });
  }

  return {
    userName,
    videoUrl,
    showNameModal,
    partyState,
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
