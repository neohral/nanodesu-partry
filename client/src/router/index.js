
import { createRouter, createWebHistory } from 'vue-router'
import Party from '../views/Party.vue'
import Intro from '../views/Intro.vue'

const routes = [
  { path: '/party/:roomId', component: Party },
  { path: '/intro/:roomId', component: Intro },
  { path: '/', redirect: to => ({ path: `/intro/default` }) }
]

export default createRouter({
  history: createWebHistory('/nanodesu/'),
  routes
})
