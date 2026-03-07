<template>
  <div class="container">
    <div class="room-select-wrapper">
      <h1>nanodesu</h1>
      <p class="subtitle">部屋名を選択して参加しましょう</p>
      
      <div class="input-section">
        <input
          v-model="roomId"
          type="text"
          placeholder="部屋名を入力"
          class="room-input"
          @keyup.enter="handleSelect('party')"
        />
      </div>

      <div class="button-section">
        <button class="btn btn-primary" @click="handleSelect('party')">
          Party に参加
        </button>
        <button class="btn btn-secondary" @click="handleSelect('intro')">
          Intro に参加
        </button>
      </div>

      <div class="info-section">
        <p class="default-room">デフォルト: <code>default</code></p>
      </div>
    </div>
  </div>
</template>

<script>
import { ref } from 'vue'
import { useRouter } from 'vue-router'

export default {
  name: 'RoomSelect',
  setup() {
    const router = useRouter()
    const roomId = ref('')

    const handleSelect = (mode) => {
      const room = roomId.value.trim() || 'default'
      router.push(`/${mode}/${room}`)
    }

    return {
      roomId,
      handleSelect
    }
  }
}
</script>

<style scoped>
.container {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 100vh;
  
  padding: 20px;
}

.room-select-wrapper {
  background: white;
  border-radius: 12px;
  padding: 40px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
  max-width: 500px;
  width: 100%;
}

h1 {
  font-size: 2.5em;
  color: #333;
  margin: 0 0 10px 0;
  text-align: center;
}

.subtitle {
  text-align: center;
  color: #666;
  font-size: 1em;
  margin: 0 0 30px 0;
}

.input-section {
  margin-bottom: 30px;
}

.room-input {
  width: 100%;
  padding: 12px 16px;
  font-size: 16px;
  border: 2px solid #e0e0e0;
  border-radius: 8px;
  box-sizing: border-box;
  transition: border-color 0.3s;
}

.room-input:focus {
  outline: none;
  border-color: #667eea;
}

.button-section {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  margin-bottom: 20px;
}

.btn {
  padding: 12px 20px;
  font-size: 16px;
  font-weight: 600;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.3s;
}

.btn-primary {
  background: #e28048;
  color: white;
}

.btn-primary:hover {
  transform: translateY(-2px);
  box-shadow: 0 5px 20px rgba(102, 126, 234, 0.4);
}

.btn-primary:active {
  transform: translateY(0);
}

.btn-secondary {
  background: #4c6e8d;
  color: white;
}

.btn-secondary:hover {
  transform: translateY(-2px);
  box-shadow: 0 5px 20px rgba(245, 87, 108, 0.4);
}

.btn-secondary:active {
  transform: translateY(0);
}

.info-section {
  text-align: center;
  color: #999;
  font-size: 0.9em;
}

.default-room {
  margin: 0;
}

code {
  background: #f0f0f0;
  padding: 2px 6px;
  border-radius: 4px;
  font-family: 'Courier New', monospace;
}
</style>
