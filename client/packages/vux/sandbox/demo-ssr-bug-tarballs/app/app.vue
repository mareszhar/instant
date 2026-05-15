<script setup lang="ts">
import { init } from '@mszr/idb-vux'
import schema from '../instant.schema'

const db = init({ appId: useRuntimeConfig().public.instantAppId, schema })
</script>

<template>
  <p>type of db: {{ typeof db }}</p>
</template>
