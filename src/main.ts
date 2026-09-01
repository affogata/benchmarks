import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from '@/app/App.vue'
import { createAppRouter } from '@/app/router'
import '@/app/styles/base.css'

createApp(App).use(createPinia()).use(createAppRouter()).mount('#app')
