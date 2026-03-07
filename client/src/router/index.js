
import { createRouter, createWebHistory } from 'vue-router'
import Party from '../views/Party.vue'
import Intro from '../views/Intro.vue'
import RoomSelect from '../views/RoomSelect.vue'

const routes = [
  { path: '/', component: RoomSelect },
  { path: '/party/:roomId', component: Party },
  { path: '/intro/:roomId', component: Intro }
]

export default createRouter({
  history: createWebHistory('/nanodesu/'),
  routes
})
