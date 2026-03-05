import { ref, computed } from "vue"
import { io } from "socket.io-client"

export function useGameRoom(roomId) {
  const socket = io("http://localhost:3000")

  const roomState = ref({
    members: [],
    leader: null,
    currentVideoId: null,
    queue: [],
    historyQueue: [],
  })

  const userId = ref("")
  const volume = ref(1)
  const playerPaused = ref(false)
  const partyState = ref("waiting") // waiting, preparing, playing, pausing, catching-up
  
  let player = null

  // YouTube Player初期化
  const initializePlayer = (playerContainer) => {
    const tag = document.createElement("script")
    tag.src = "https://www.youtube.com/iframe_api"
    document.body.appendChild(tag)

    window.onYouTubeIframeAPIReady = () => {
      player = new YT.Player(playerContainer, {
        videoId: "",
        playerVars: {
          rel: 0,
          modestbranding: 1
        },
        events: {
          onReady: () => {
            const iframe = player.getIframe()
            iframe.style.width = "100%"
            iframe.style.height = "100%"
            iframe.style.position = "absolute"
            iframe.style.top = "0"
            iframe.style.left = "0"
            iframe.style.pointerEvents = "none"
            volume.value = player.getVolume()
          },
          onStateChange: (event) => {
            console.log("Player state changed:", event.data)
            if (event.data === YT.PlayerState.PAUSED) {
              playerPaused.value = true
            }
            if (event.data === YT.PlayerState.PLAYING) {
              playerPaused.value = false
            }
          }
        }
      })
    }

    window.addEventListener("resize", () => {
      if (player) {
        const iframe = player.getIframe()
        iframe.style.width = "100%"
        iframe.style.height = "100%"
      }
    })
  }

  const getPlayer = () => player

  const setVolume = () => {
    if (player) {
      player.setVolume(volume.value)
    }
  }

  const changeOpacity = (opacity) => {
    if (!player) return
    const iframe = player.getIframe()
    iframe.style.opacity = opacity
  }

  const joinRoom = (name) => {
    const displayName = name.trim() || "Anonymous"
    socket.emit("join-room", { roomId, name: displayName })
  }

  // 共通のsocket.onイベント
  socket.on("room-init", (state) => {
    userId.value = socket.id
    roomState.value = state
    if (state.currentVideoId && player) {
      partyState.value = "catching-up"
      player.cueVideoById(state.currentVideoId)
    }
  })

  socket.on("sync-stats", (state) => {
    roomState.value = state
  })

  socket.on("queue-updated", (obj) => {
    roomState.value.queue = obj.queue
    roomState.value.historyQueue = obj.historyQueue
  })

  socket.on("prepare-video", ({ videoId, user }) => {
    partyState.value = "preparing"
    if (player) {
      player.cueVideoById(videoId)
    }
  })

  socket.on("start-playback", ({ timestamp }) => {
    if (player) {
      const latency = (Date.now() - timestamp) / 1000
      player.seekTo(latency)
      player.playVideo()
      partyState.value = "willplay"
    }
  })

  socket.on("video-sync-state", ({ states, fixedStartTime }) => {
    roomState.value.currentVideoStartTime = fixedStartTime
    if (states === "pausing") {
      partyState.value = "willpausing"
      if (player) player.pauseVideo()
    } else if (states === "playing") {
      if (player) {
        const latency = (Date.now() - fixedStartTime) / 1000
        player.seekTo(latency)
        player.playVideo()
        partyState.value = "willplay"
      }
    }
  })

  const sortedMembers = computed(() => {
    return [...roomState.value.members].sort((a, b) => (b.score || 0) - (a.score || 0))
  })

  const currentGamemaster = computed(() => {
    return roomState.value.members.find(m => m.id === roomState.value.gameMaster)
  })

  return {
    socket,
    roomState,
    userId,
    volume,
    playerPaused,
    partyState,
    initializePlayer,
    getPlayer,
    setVolume,
    changeOpacity,
    joinRoom,
    sortedMembers,
    currentGamemaster
  }
}
