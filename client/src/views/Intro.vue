<template>
  <div class="container">
    <div class="main-content">
      <div class="player-wrapper">
        <div ref="playerContainer" class="player"></div>
        <!-- 出題者または回答ユーザー表示 -->
        <div v-if="answeringUser.length === 0 && currentGamemaster && gameStarted" class="answering-overlay">
          <div class="answering-card">
            <p class="answering-label">出題者📺</p>
            <p class="answering-name">{{ currentGamemaster.name || 'Anonymous' }}</p>
          </div>
        </div>
        <div v-else-if="answeringUser.length > 0" class="answering-overlay">
          <div class="answering-card">
            <p class="answering-label">回答中...⏰</p>
            <p class="answering-name">{{ answeringUser[0].name || 'Anonymous' }}</p>
          </div>
        </div>
        <!-- ゲーム開始カウントダウン -->
        <div v-if="preGameCountdown > 0" class="pregame-overlay">
          <div class="pregame-card">
            <p class="pregame-label">ゲーム開始まで</p>
            <p class="pregame-countdown">{{ preGameCountdown }}</p>
            <div class="countdown-bar">
              <div class="countdown-progress" :style="{ width: (preGameCountdown / 10 * 100) + '%' }"></div>
            </div>
          </div>
        </div>
        <!-- 正解者表示 -->
        <div v-if="correctAnswerUser" class="correct-answer-overlay">
          <div class="correct-answer-card">
            <p class="correct-label">🎉 正解!</p>
            <p class="correct-name">{{ correctAnswerUser.name || 'Anonymous' }}</p>
            <div class="countdown">
              <p class="countdown-text">{{ countdown }}秒後に次へ</p>
              <div class="countdown-bar">
                <div class="countdown-progress" :style="{ width: (countdown / 5 * 100) + '%' }"></div>
              </div>
            </div>
          </div>
        </div>
        <!-- ゲーム終了画面 -->
        <div v-if="gameEnded" class="game-end-overlay" @click="gameEnded = false">
          <div class="game-end-card" @click.stop>
            <button class="game-end-close" @click="gameEnded = false">✕</button>
            <h2 class="game-end-title">🏆 ゲーム終了!</h2>
            <div class="final-scores">
              <div v-for="(member, index) in sortedMembers" :key="member.id" class="score-item">
                <span class="score-rank">{{ index + 1 }}位</span>
                <span class="score-name">{{ member.name || 'Anonymous' }}</span>
                <span class="score-value">{{ member.score || 0 }}点</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Toggle Button -->
    <button class="toggle-button" @click="sidebarOpen = !sidebarOpen">
      {{ sidebarOpen ? '✕' : '☰' }}
    </button>

    <!-- Name Input Modal -->
    <div v-if="showNameModal" class="modal-overlay">
      <div class="modal-dialog">
        <h3>あなたの名前を入力してください</h3>
        <input v-model="userName" type="text" placeholder="名前を入力" class="name-input" @keyup.enter="joinRoom" />
        <button @click="joinRoom" class="modal-button">参加</button>
      </div>
    </div>

    <!-- Sidebar -->
    <div class="sidebar" :class="{ open: sidebarOpen }">
      <div class="sidebar-header">
        <h3>{{ roomId }} intro party<span v-if="userId === roomState.leader">👑</span></h3>
      </div>

      <!-- Tabs -->
      <div class="sidebar-tabs">
        <button @click="activeTab = 'queue'" :class="{ active: activeTab === 'queue' }" class="tab-button">
          Queue
        </button>
        <button @click="activeTab = 'settings'" :class="{ active: activeTab === 'settings' }" class="tab-button">
          Settings
        </button>
        <button v-if="userId === roomState.leader" @click="activeTab = 'leader'"
          :class="{ active: activeTab === 'leader' }" class="tab-button leader-tab">
          Commands
        </button>
      </div>

      <div class="sidebar-content">
        <!-- Queue Tab -->
        <div v-if="activeTab === 'queue'" class="tab-content">
          <div class="input-section">
            <input v-model="videoUrl" placeholder="YouTube URL" class="url-input" />
            <button @click="addVideo" class="add-button">Add</button>
          </div>
          <div v-if="!hideQueue" class="queue-display">
            <draggable v-model="roomState.queue" item-key="id" @end="onReorder" class="queue-container">
              <template #item="{ element }">
                <div class="queue-item">
                  <img :src="element.thumbnail" width="80" />
                  <div class="queue-item-info">
                    <div class="queue-item-title">{{ element.title }}</div>
                    <div class="queue-item-user">{{ element.userName }}</div>
                  </div>
                </div>
              </template>
            </draggable>

            <div v-if="roomState.historyQueue.length > 0" class="history-section">
              <h4>再生済み</h4>
              <div class="history-queue-container">
                <div v-for="element in roomState.historyQueue" :key="`history-${element.id}`" class="queue-item">
                  <img :src="element.thumbnail" width="80" />
                  <div class="queue-item-info">
                    <div class="queue-item-title">{{ element.title }}</div>
                    <div class="queue-item-user">{{ element.userName }}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div v-else class="queue-hidden-message">
            <p>⚠️ Queue is hidden by the leader</p>
          </div>
        </div>

        <!-- Settings Tab -->
        <div v-if="activeTab === 'settings'" class="tab-content">
          <div class="player-section">
            <h4>Youtube Player</h4>
            <div v-if="gamemaster">
              <div class="setting-item">
                <label>
                  <input type="checkbox" v-model="hideVideo" @change="toggleOpacity" />
                  Hide video
                </label>
              </div>
              <button @click="togglePlayPause" class="control-button">
                {{ partyState === "pausing" ? '▶ 再生' : '⏸ 一時停止' }}
              </button>
            </div>
            <div class="volume-control">
              <label for="volume-slider">音量:</label>
              <input id="volume-slider" v-model.number="volume" type="range" min="0" max="100" @input="setVolume"
                class="volume-slider" />
              <span class="volume-value">{{ volume }}</span>
            </div>
          </div>
          <div class="settings-section">
            <h4>Intro</h4>
            <div v-if="gamemaster" class="gamemaster-buttons">
              <div class="answer-buttons">
                <button @click="correctAnswer" :disabled="answeringUser.length === 0"
                  class="intro-button gamemaster-correct-button">正解</button>
                <button @click="incorrectAnswer" :disabled="answeringUser.length === 0"
                  class="intro-button gamemaster-correct-button">不正解</button>
              </div>
              <button @click="skipToNextVideo" class="intro-button gamemaster-incorrect-button">スキップ</button>
            </div>
            <button v-else @click="answerQuestion"
              :disabled="!gameStarted || answeringUser && answeringUser.find(m => m.id === userId) || answerCooldown > 0"
              class="intro-button player-button">早押し{{ answerCooldown > 0 ? ` (${answerCooldown}s)` : '' }}</button>
          </div>

          <div class="members-section">
            <h4>Members ({{ roomState.members.length }})</h4>
            <div class="members-list">
              <div v-for="member in roomState.members" :key="member.id" class="member-item"
                :class="{ 'has-video': member.video }">
                <div class="member-name-wrapper">
                  <span>{{ member.name || 'Anonymous' }}</span>
                  <span class="member-score">{{ member.score || 0 }}</span>
                  <!-- <span v-if="member.video" class="video-indicator"></span> -->
                </div>
                <span v-if="member.id === roomState.leader" class="leader-badge">Leader</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Leader Commands Tab -->
        <div v-if="activeTab === 'leader' && userId === roomState.leader" class="tab-content">
          <div class="leader-commands">
            <h4>Leader Commands</h4>
            <button @click="startGame" :disabled="!allMembersHaveVideo" class="command-button success-button">
              game start
            </button>
            <button @click="leaderSkipToNextVideo" class="command-button danger-button">
              Skip to next video
            </button>
          </div>

          <div class="leader-settings">
            <h4>Leader Settings</h4>
            <div class="setting-item">
              <label>
                <input type="checkbox" v-model="hideQueue" @change="toggleHideQueue" />
                Hide queue
              </label>
            </div>
            <div class="setting-item">
              <label>
                <input type="checkbox" v-model="hideVideo" @change="toggleOpacity" />
                Hide video
              </label>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from "vue"
import { useRoute } from "vue-router"
import { io } from "socket.io-client"
import draggable from "vuedraggable"

const route = useRoute()
const roomId = route.params.roomId
const socket = io(import.meta.env.VITE_SOCKET_INTRO_URL)

const roomState = ref({
  members: [],
  leader: null,
  currentVideoId: null,
  queue: [],
  historyQueue: [],
})
const videoUrl = ref("")
const playerContainer = ref(null)
const sidebarOpen = ref(true)
const userId = ref("")
const activeTab = ref("queue")
const hideQueue = ref(false)
const hideVideo = ref(false)
const userName = ref("")
const showNameModal = ref(false)
const gamemaster = ref(false)
const gameStarted = ref(false)
const answeringUser = ref([])
const correctAnswerUser = ref(null)
const countdown = ref(0)
const answerCooldown = ref(0)
const volume = ref(1)
const playerPaused = ref(false)
const partyState = ref("waiting") // waiting, preparing, playing, pausing, catching-up
const gameEnded = ref(false)
const preGameCountdown = ref(0)

let player = null
let currentVideoStartTime = null

const allMembersHaveVideo = computed(() => {
  return roomState.value.members.length > 0 &&
    roomState.value.members.every(member => member.video)
})

const sortedMembers = computed(() => {
  return [...roomState.value.members].sort((a, b) => (b.score || 0) - (a.score || 0))
})

const currentGamemaster = computed(() => {
  return roomState.value.members.find(m => m.id === roomState.value.gameMaster)
})

function extractVideoId(url) {
  const reg = /(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&]+)/
  const match = url.match(reg)
  return match ? match[1] : null
}

function addVideo() {
  const id = extractVideoId(videoUrl.value)
  if (!id) return
  socket.emit("add-video", { roomId, videoId: id })
  videoUrl.value = ""
}

function onReorder() {
  socket.emit("reorder-queue", { roomId, queue: roomState.value.queue })
}

function skipToNextVideo() {
  if (partyState.value === "playing") {
    socket.emit("user-answered-skip", { roomId })
    partyState.value = "waiting"
  }
}

function leaderSkipToNextVideo() {
  socket.emit("video-ended", { roomId })
}

function toggleOpacity() {
  socket.emit("toggle-opacity", { roomId })
}

socket.on("sync-hide-queue", (state) => {
  hideQueue.value = state.hideQueue
})

function toggleHideQueue() {
  socket.emit("toggle-hide-queue", { roomId })
}

socket.on("sync-opacity", (state) => {
  hideVideo.value = state.opacity === 0
  changeOpacity(state.opacity)
})

function changeOpacity(opacity) {
  if (hideVideo.value && gamemaster.value) {
    opacity = 0.1
  }
  const iframe = player.getIframe()
  iframe.style.opacity = opacity
}

function joinRoom() {
  const name = userName.value.trim() || "Anonymous"
  socket.emit("join-room", { roomId, name })
  showNameModal.value = false
}

function startPlayback(timestamp) {
  const latency = (Date.now() - timestamp) / 1000
  player.seekTo(latency)
  player.playVideo()
  partyState.value = "willplay"
}

function answerQuestion() {
  socket.emit("answer-question", { roomId, userId: userId.value })
}

function correctAnswer() {
  const score = Math.round((100 - (player.getCurrentTime() / player.getDuration() * 100)) * 10) / 10
  socket.emit("gamemaster-answer", { roomId, correct: true, score })
}

function incorrectAnswer() {
  socket.emit("gamemaster-answer", { roomId, correct: false, score: 0 })
}

function startGame() {
  socket.emit("pre-game-start", { roomId })
}

function togglePlayPause() {
  if (partyState.value === "pausing") {
    socket.emit("video-state-change", { roomId, states: "playing" })
  } else {
    socket.emit("video-state-change", { roomId, states: "pausing" })
  }
}

function setVolume() {
  if (player) {
    player.setVolume(volume.value)
  }
}

socket.on("room-init", (state) => {
  userId.value = socket.id
  hideQueue.value = state.hideQueue
  hideVideo.value = state.opacity === "0" || state.opacity === 0
  changeOpacity(state.opacity)
  if (state.currentVideoId) {
    partyState.value = "catching-up"
    currentVideoStartTime = state.currentVideoStartTime
    player.cueVideoById(state.currentVideoId)
  }
})

socket.on("sync-stats", (state) => {
  gameStarted.value = state.gameStatus === "playing" ? true : false
  roomState.value = state
})

socket.on("user-answered", ({ users }) => {
  answeringUser.value = users
})

socket.on("queue-updated", (obj) => {
  roomState.value.queue = obj.queue
  roomState.value.historyQueue = obj.historyQueue
})

socket.on("prepare-video", ({ videoId, user }) => {
  roomState.value.gameMaster = user
  gamemaster.value = (user === userId.value)
  changeOpacity(roomState.value.opacity)
  partyState.value = "preparing"
  player.cueVideoById(videoId)
})

socket.on("start-playback", ({ timestamp }) => {
  startPlayback(timestamp)
})

socket.on("video-sync-state", ({ states, fixedStartTime }) => {
  roomState.value.currentVideoStartTime = fixedStartTime
  if (states === "pausing") {
    partyState.value = "willpausing"
    player.pauseVideo()
  } else if (states === "playing") {
    startPlayback(fixedStartTime)
  }
})
socket.on("user-answered-skip", () => {
  correctAnswerUser.value = { name: "正解者無し" }
  countdown.value = 10
  const countdownInterval = setInterval(() => {
    countdown.value--
    if (countdown.value <= 0) {
      clearInterval(countdownInterval)
      correctAnswerUser.value = null
      // 次の問題へ
      if (socket.id === roomState.value.leader) {
        socket.emit("video-ended", { roomId })
      }
    }
  }, 1000)
})
socket.on("user-answered-result", ({ user, correct }) => {
  if (correct) {
    correctAnswerUser.value = user
    answeringUser.value = []
    countdown.value = 10
    const countdownInterval = setInterval(() => {
      countdown.value--
      if (countdown.value <= 0) {
        clearInterval(countdownInterval)
        correctAnswerUser.value = null
        // 次の問題へ
        if (socket.id === roomState.value.leader) {
          socket.emit("next-question", { roomId })
        }
      }
    }, 1000)
  } else {
    // 不正解の場合は3秒間早押しボタンを押せないようにする
    if (user.id === userId.value) {
      answerCooldown.value = 3
      const cooldownInterval = setInterval(() => {
        answerCooldown.value--
        if (answerCooldown.value <= 0) {
          clearInterval(cooldownInterval)
        }
      }, 1000)
    }
  }
})

socket.on("end-game", () => {
  gameEnded.value = true
  partyState.value = "waiting"
})

socket.on("pre-game-start", () => {
  preGameCountdown.value = 5
  const countdownInterval = setInterval(() => {
    preGameCountdown.value--
    if (preGameCountdown.value <= 0) {
      clearInterval(countdownInterval)
      if (userId.value === roomState.value.leader) {
        socket.emit("start-game", { roomId })
      }
    }
  }, 1000)

})

onMounted(() => {
  const tag = document.createElement("script")
  tag.src = "https://www.youtube.com/iframe_api"
  document.body.appendChild(tag)

  window.onYouTubeIframeAPIReady = () => {
    player = new YT.Player(playerContainer.value, {
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
          showNameModal.value = true
        },
        onStateChange: (event) => {
          if (event.data === YT.PlayerState.ENDED) {
            //socket.emit("video-ended", { roomId })
            //partyState.value = "waiting"
          }
          if (event.data === YT.PlayerState.CUED) {
            if (partyState.value === "catching-up") {
              partyState.value = roomState.value.currentVideoStatus
              if (partyState.value === "playing") {
                startPlayback(currentVideoStartTime)
              }
            } else if (partyState.value === "preparing") {
              socket.emit("video-loaded", { roomId })
            }
          }
          if (event.data === YT.PlayerState.PAUSED) {
            playerPaused.value = true
            if (partyState.value === "playing") {
              if (userId.value === roomState.value.leader) {
                socket.emit("video-state-change", { roomId, states: "pausing" })
              }
              player.playVideo()
            }
            if (partyState.value === "willpausing") {
              partyState.value = "pausing"
            }
          }
          if (event.data === YT.PlayerState.PLAYING) {
            playerPaused.value = false
            if (partyState.value === "pausing") {
              if (userId.value === roomState.value.leader) {
                socket.emit("video-state-change", { roomId, states: "playing" })
              }
              player.pauseVideo()
            }
            if (partyState.value === "willplay") {
              partyState.value = "playing"
            }
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
})
</script>

<style scoped>
.container {
  display: flex;
  height: min(98vh);
  /* 縦幅の計算 */
  overflow: hidden;
  background: #fff;
}

/* -------- MAIN -------- */

.main-content {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  gap: 15px;
}

.main-content h2 {
  margin: 0;
  padding: 0;
  font-size: 1.5rem;
  flex-shrink: 0;
}

/* Responsive Player */

.player-wrapper {
  position: relative;
  flex: 1;

  /* 横は最大100% */
  width: 100%;

  /* 16:9維持 */
  aspect-ratio: 16 / 9;

  background: black;
  overflow: hidden;

  /* 中央寄せ */
  margin: 0 auto;
}

.player {
  width: 100%;
  height: 100%;
}

/* -------- ANSWERING OVERLAY -------- */

.answering-overlay {
  position: fixed;
  top: 20px;
  left: 20px;
  background: white;
  border: 2px solid #2196F3;
  border-radius: 12px;
  padding: 16px 24px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  z-index: 10;
  animation: slideInLeft 0.3s ease-out;
  max-width: 250px;
}

.answering-card {
  display: flex;
  flex-direction: column;
  gap: 0;
}

.answering-label {
  margin: 0 0 8px 0;
  font-size: 12px;
  color: #2196F3;
  font-weight: 600;
  text-transform: uppercase;
}

.answering-name {
  margin: 0;
  font-size: 20px;
  color: #333;
  font-weight: 700;
}

/* -------- CORRECT ANSWER OVERLAY -------- */

.correct-answer-overlay {
  position: fixed;
  top: 20px;
  left: 20px;
  background: white;
  border: 2px solid #4CAF50;
  border-radius: 12px;
  padding: 16px 24px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  z-index: 10;
  animation: slideInLeft 0.3s ease-out;
  max-width: 250px;
}

.correct-answer-card {
  display: flex;
  flex-direction: column;
  gap: 0;
}

.correct-label {
  margin: 0 0 8px 0;
  font-size: 14px;
  color: #4CAF50;
  font-weight: 700;
}

.correct-name {
  margin: 0 0 12px 0;
  font-size: 22px;
  color: #333;
  font-weight: 700;
}

.countdown {
  margin-top: 0;
}

.countdown-text {
  margin: 0 0 8px 0;
  font-size: 12px;
  color: #666;
}

.countdown-bar {
  width: 100%;
  height: 4px;
  background: #eee;
  border-radius: 2px;
  overflow: hidden;
}

.countdown-progress {
  height: 100%;
  background: #4CAF50;
  transition: width 1s linear;
}

/* -------- PREGAME OVERLAY -------- */

.pregame-overlay {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background: white;
  border: 3px solid #2196F3;
  border-radius: 16px;
  padding: 40px 50px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
  z-index: 10;
  animation: fadeIn 0.3s ease-out;
  text-align: center;
}

.pregame-card {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.pregame-label {
  margin: 0;
  font-size: 18px;
  color: #2196F3;
  font-weight: 600;
}

.pregame-countdown {
  margin: 0;
  font-size: 72px;
  font-weight: 700;
  color: #2196F3;
  line-height: 1;
}

/* -------- TOGGLE -------- */

.toggle-button {
  position: fixed;
  right: 0px;
  top: 10px;
  z-index: 1001;
  width: 40px;
  height: 40px;
  background: #333;
  color: white;
  border: none;
  border-radius: 4px;
  font-size: 20px;
  cursor: pointer;
}

.toggle-button:hover {
  background: #555;
}

/* -------- SIDEBAR -------- */

.sidebar {
  position: fixed;
  right: 0;
  top: 0;
  width: 350px;
  height: 100vh;
  background: #f9f9f9;
  border-left: 1px solid #ddd;
  display: flex;
  flex-direction: column;
  transition: transform 0.3s ease-in-out;
  z-index: 1000;
  transform: translateX(100%);
}

.sidebar.open {
  transform: translateX(0);
}

.sidebar-header {
  padding: 15px 20px;
  border-bottom: 1px solid #ddd;
  text-align: center;
}

/* -------- TABS -------- */

.sidebar-tabs {
  display: flex;
  border-bottom: 1px solid #ddd;
  background: #fff;
}

.tab-button {
  flex: 1;
  padding: 12px;
  background: none;
  border: none;
  border-bottom: 3px solid transparent;
  cursor: pointer;
  font-size: 13px;
  font-weight: 500;
  color: #666;
  transition: all 0.2s;
}

.tab-button:hover {
  background: #f0f0f0;
  color: #333;
}

.tab-button.active {
  color: #4CAF50;
  border-bottom-color: #4CAF50;
}

.tab-button.leader-tab {
  color: #ff9800;
}

.tab-button.leader-tab.active {
  color: #ff9800;
  border-bottom-color: #ff9800;
}

.sidebar-content {
  flex: 1;
  overflow-y: auto;
  padding: 15px;
}

/* -------- TAB CONTENT -------- */

.tab-content {
  animation: fadeIn 0.2s;
}

@keyframes fadeIn {
  from {
    opacity: 0;
  }

  to {
    opacity: 1;
  }
}

@keyframes slideInLeft {
  from {
    transform: translateX(-100%);
    opacity: 0;
  }

  to {
    transform: translateX(0);
    opacity: 1;
  }
}

/* -------- SETTINGS -------- */

.settings-section,
.members-section,
.leader-commands {
  margin-bottom: 20px;
}

.settings-section h4,
.members-section h4,
.leader-commands h4 {
  margin: 0 0 15px 0;
  font-size: 14px;
  color: #333;
}

.setting-item {
  padding: 10px;
  margin-bottom: 8px;
  background: white;
  border: 1px solid #eee;
  border-radius: 4px;
  display: flex;
  align-items: center;
}

.setting-item label {
  display: flex;
  align-items: center;
  cursor: pointer;
  gap: 8px;
  width: 100%;
}

.setting-item input[type="checkbox"] {
  cursor: pointer;
}

/* -------- MEMBERS -------- */

.members-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.member-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px;
  background: white;
  border: 1px solid #eee;
  border-radius: 4px;
  font-size: 13px;
  transition: border-left-color 0.2s;
}

.member-item.has-video {
  border-left: 4px solid #4CAF50;
}

.member-name-wrapper {
  display: flex;
  align-items: center;
  gap: 8px;
}

.member-score {
  font-size: 12px;
  color: #666;
  font-weight: 600;
  margin-left: 8px;
}

.video-indicator {
  display: inline-block;
  width: 8px;
  height: 8px;
  background: #4CAF50;
  border-radius: 50%;
  flex-shrink: 0;
}

.leader-badge {
  background: #ff9800;
  color: white;
  padding: 3px 8px;
  border-radius: 3px;
  font-size: 11px;
  font-weight: 600;
}

/* -------- LEADER COMMANDS -------- */

.command-button {
  width: 100%;
  padding: 12px;
  margin-bottom: 8px;
  border: none;
  border-radius: 4px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.command-button:hover {
  transform: translateY(-2px);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
}

.success-button {
  background: #4CAF50;
  color: white;
}

.success-button:hover:not(:disabled) {
  background: #45a049;
}

.success-button:disabled {
  background: #ccc;
  color: #666;
  cursor: not-allowed;
  opacity: 0.6;
}

.danger-button {
  background: #f44336;
  color: white;
}

.danger-button:hover {
  background: #da190b;
}

.warning-button {
  background: #ff9800;
  color: white;
}

.warning-button:hover {
  background: #e68900;
}

/* -------- LEADER SETTINGS -------- */

.leader-settings {
  margin-top: 30px;
  padding-top: 20px;
  border-top: 1px solid #ddd;
}

.leader-settings h4 {
  margin: 0 0 15px 0;
  font-size: 14px;
  color: #333;
}

/* -------- QUEUE DISPLAY -------- */

.queue-hidden-message {
  text-align: center;
  padding: 40px 20px;
  color: #999;
}

.queue-hidden-message p {
  margin: 0;
  font-size: 14px;
}

/* -------- INPUT -------- */

.input-section {
  display: flex;
  gap: 8px;
  margin-bottom: 20px;
}

.url-input {
  flex: 1;
  padding: 10px;
  border: 1px solid #ddd;
  border-radius: 4px;
}

.add-button {
  padding: 10px 15px;
  background: #4CAF50;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.add-button:hover {
  background: #45a049;
}

/* -------- PLAYER SECTION -------- */

.player-section {
  margin-bottom: 20px;
}

.player-controls {
  background: white;
  border: 1px solid #ddd;
  border-radius: 4px;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.control-button {
  width: 100%;
  padding: 10px;
  background: #2196F3;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 13px;
  font-weight: 500;
  transition: all 0.2s;
}

.control-button:hover {
  background: #0b7dda;
  transform: translateY(-2px);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
}

.volume-control {
  display: flex;
  align-items: center;
  gap: 10px;
}

.volume-control label {
  font-size: 12px;
  font-weight: 500;
  color: #333;
  min-width: 40px;
}

.volume-slider {
  flex: 1;
  height: 4px;
  cursor: pointer;
  border-radius: 2px;
}

.volume-value {
  font-size: 12px;
  color: #666;
  min-width: 30px;
  text-align: right;
}

/* -------- INTRO BUTTON -------- */

.gamemaster-buttons {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.answer-buttons {
  display: flex;
  gap: 8px;
}

.intro-button {
  flex: 1;
  padding: 12px;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  transition: all 0.2s;
}

.intro-button:hover {
  transform: translateY(-2px);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
}

.gamemaster-correct-button {
  background: #4CAF50;
}

.gamemaster-correct-button:hover {
  background: #45a049;
}

.gamemaster-correct-button:disabled {
  background: #ccc;
  color: #666;
  cursor: not-allowed;
  opacity: 0.6;
}

.gamemaster-incorrect-button {
  background: #f44336;
}

.gamemaster-incorrect-button:hover {
  background: #da190b;
}

.player-button {
  background: #2196F3;
  width: 100%;
}

.player-button:hover:not(:disabled) {
  background: #0b7dda;
}

.player-button:disabled {
  background: #ccc;
  color: #666;
  cursor: not-allowed;
  opacity: 0.6;
}

/* -------- QUEUE -------- */

.queue-container {
  padding: 0;
  margin: 0;
}

.history-section {
  margin-top: 30px;
  padding-top: 20px;
  border-top: 1px solid #ddd;
}

.history-section h4 {
  margin: 0 0 15px 0;
  font-size: 14px;
  color: #333;
}

.history-queue-container {
  padding: 0;
  margin: 0;
}

.queue-item {
  display: flex;
  gap: 10px;
  padding: 12px;
  margin: 8px 0;
  background: white;
  border: 1px solid #eee;
  border-radius: 4px;
  cursor: grab;
}

.queue-item:hover {
  background: #f5f5f5;
}

.queue-item img {
  border-radius: 3px;
}

.queue-item-info {
  flex: 1;
  min-width: 0;
}

.queue-item-title {
  font-size: 13px;
  word-break: break-word;
}

.queue-item-user {
  font-size: 11px;
  color: #999;
  margin-top: 4px;
}

/* -------- MOBILE -------- */

/* -------- MODAL -------- */

.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
}

.modal-dialog {
  background: white;
  border-radius: 8px;
  padding: 30px;
  max-width: 400px;
  width: 90%;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
  animation: slideUp 0.3s ease-out;
}

.modal-dialog h3 {
  margin: 0 0 20px 0;
  font-size: 18px;
  color: #333;
  text-align: center;
}

.name-input {
  width: 100%;
  padding: 12px;
  margin-bottom: 20px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 14px;
  box-sizing: border-box;
}

.name-input:focus {
  outline: none;
  border-color: #4CAF50;
  box-shadow: 0 0 0 2px rgba(76, 175, 80, 0.1);
}

.modal-button {
  width: 100%;
  padding: 12px;
  background: #4CAF50;
  color: white;
  border: none;
  border-radius: 4px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.2s;
}

.modal-button:hover {
  background: #45a049;
}

@keyframes slideUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* -------- GAME END -------- */

.game-end-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
  animation: fadeIn 0.3s ease-out;
}

.game-end-card {
  background: white;
  border-radius: 16px;
  padding: 40px;
  max-width: 500px;
  width: 90%;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
  animation: slideUp 0.3s ease-out;
}

.game-end-close {
  position: absolute;
  top: 15px;
  right: 15px;
  width: 32px;
  height: 32px;
  background: #f0f0f0;
  border: none;
  border-radius: 50%;
  font-size: 18px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}

.game-end-close:hover {
  background: #e0e0e0;
}

.game-end-card {
  position: relative;
}

.game-end-title {
  margin: 0 0 30px 0;
  font-size: 32px;
  text-align: center;
  color: #333;
  font-weight: 700;
}

.final-scores {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.score-item {
  display: flex;
  align-items: center;
  padding: 15px;
  background: #f9f9f9;
  border-radius: 8px;
  font-size: 16px;
  border-left: 4px solid #4CAF50;
}

.score-item:nth-child(2) {
  border-left-color: #c0c0c0;
}

.score-item:nth-child(3) {
  border-left-color: #cd7f32;
}

.score-rank {
  font-weight: 700;
  font-size: 14px;
  color: #ff9800;
  min-width: 50px;
}

.score-name {
  flex: 1;
  font-weight: 600;
  color: #333;
  margin-left: 15px;
}

.score-value {
  font-weight: 700;
  font-size: 18px;
  color: #4CAF50;
  text-align: right;
  min-width: 60px;
}

@media (max-width: 768px) {
  .sidebar {
    width: 100%;
  }

  .toggle-button {
    right: 15px;
    top: 15px;
  }
}
</style>