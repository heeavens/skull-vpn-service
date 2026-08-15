<script lang="ts">
  interface Props {
    title: string;
    id?: string;
  }

  let { title, id }: Props = $props();
</script>

<div class="section-heading">
  <h2 {id}>{title}</h2>
  <span aria-hidden="true"></span>
</div>
