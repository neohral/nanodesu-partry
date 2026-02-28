
import { createRouter, createWebHistory } from 'vue-router'
import WatchRoom from '../views/WatchRoom.vue'

const routes = [
  { path: '/:roomId', component: WatchRoom }
]

export default createRouter({
  history: createWebHistory(),
  routes
})
