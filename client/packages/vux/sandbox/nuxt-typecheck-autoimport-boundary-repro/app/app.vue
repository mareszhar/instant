<!--
no linter warnings here
linter correctly infers `doSomething` in the shape of the app util, not the server util with the same name
-->

<script setup lang="ts">
const result = doSomething('hello world!')
</script>

<template>
  <h1>length: {{ result.length }}</h1>
</template>
