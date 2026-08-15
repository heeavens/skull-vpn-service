<script lang="ts">
  import type { LayoutProps } from './$types';
  import { AppShell } from '$lib/features/navigation';

  let { data, children }: LayoutProps = $props();
</script>

<AppShell user={data.user}>{@render children()}</AppShell>
