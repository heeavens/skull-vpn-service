<script lang="ts">
  import type { Snippet } from 'svelte';
  import { clampSectionIndex, sectionOrder, type SectionId } from './navigation';

  interface Props {
    activeSection: SectionId;
    onChange: (section: SectionId) => void;
    support: Snippet;
    home: Snippet;
    profile: Snippet;
  }

  interface GestureStart {
    x: number;
    y: number;
  }

  const swipeThreshold = 56;
  const horizontalDominance = 1.25;

  let { activeSection, onChange, support, home, profile }: Props = $props();
  let gestureStart: GestureStart | null = null;

  const activeIndex = $derived(sectionOrder.indexOf(activeSection));

  function handleTouchStart(event: TouchEvent): void {
    const touch = event.touches.item(0);
    if (!touch) return;
    gestureStart = { x: touch.clientX, y: touch.clientY };
  }

  function handleTouchEnd(event: TouchEvent): void {
    const start = gestureStart;
    gestureStart = null;
    if (!start) return;

    const touch = event.changedTouches.item(0);
    if (!touch) return;

    const distanceX = touch.clientX - start.x;
    const distanceY = touch.clientY - start.y;
    const horizontalDistance = Math.abs(distanceX);

    if (
      horizontalDistance < swipeThreshold ||
      horizontalDistance <= Math.abs(distanceY) * horizontalDominance
    ) {
      return;
    }

    const direction = distanceX < 0 ? 1 : -1;
    onChange(sectionOrder[clampSectionIndex(activeIndex + direction)]);
  }
</script>

<div
  class="swipe-pager"
  role="group"
  aria-label="Секции приложения"
  data-testid="pager"
  ontouchstart={handleTouchStart}
  ontouchend={handleTouchEnd}
  ontouchcancel={() => (gestureStart = null)}
>
  <div class="swipe-pager__track" style:transform={`translate3d(-${activeIndex * 100}%, 0, 0)`}>
    <section
      id="section-support"
      class="swipe-pager__section"
      aria-labelledby="support-title"
      aria-hidden={activeSection !== 'support'}
      inert={activeSection !== 'support'}
      data-testid="section-support"
    >
      <div class="swipe-pager__scroll">{@render support()}</div>
    </section>
    <section
      id="section-home"
      class="swipe-pager__section"
      aria-labelledby="home-title"
      aria-hidden={activeSection !== 'home'}
      inert={activeSection !== 'home'}
      data-testid="section-home"
    >
      <div class="swipe-pager__scroll">{@render home()}</div>
    </section>
    <section
      id="section-profile"
      class="swipe-pager__section"
      aria-labelledby="profile-title"
      aria-hidden={activeSection !== 'profile'}
      inert={activeSection !== 'profile'}
      data-testid="section-profile"
    >
      <div class="swipe-pager__scroll">{@render profile()}</div>
    </section>
  </div>
</div>
