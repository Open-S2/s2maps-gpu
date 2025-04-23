<script setup lang="ts">
let slug = useRoute().params.slug
if (Array.isArray(slug)) slug = slug.join('/')
const { data: examples } = await useAsyncData(() => queryCollection('examples').path(`/examples/${slug}`).first())

useSeoMeta({
  title: examples.value?.title,
  description: examples.value?.description
})
</script>

<template>
  <ContentRenderer v-if="examples" :value="examples" />
  <div v-else>Home not found</div>
</template>
