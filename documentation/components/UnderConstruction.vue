<template>
  <div id="canvasContainer">
    <canvas id="constructionCanvas" ref="canvas" />
    <div id="constructionText">
      <h1>Under Construction</h1>
    </div>
  </div>
</template>

<script lang="ts">
import { onMounted, onUnmounted, ref } from 'vue';

export default {
  /**
   * Setup the component
   * @returns the Construction component
   */
  setup() {
    // for intro motion
    let mouseMoved = false;
    const canvas = ref<HTMLCanvasElement | null>();
    const pointer = { x: 0, y: 0 };

    /** Setup the canvas */
    function setupCanvas(): void {
      if (canvas.value === undefined || canvas.value === null) return;
      canvas.value.width = window.innerWidth;
      canvas.value.height = window.innerHeight;
    }

    /**
     * @param eX
     * @param eY
     */
    function updateMousePosition(eX: number, eY: number): void {
      pointer.x = eX;
      pointer.y = eY;
    }

    /**
     * @param e
     */
    const clickEvent = (e: MouseEvent): void => {
      updateMousePosition(e.pageX, e.pageY);
    };
    /**
     * @param e
     */
    const mouseMoveEvent = (e: MouseEvent): void => {
      mouseMoved = true;
      updateMousePosition(e.pageX, e.pageY);
    };
    /**
     * @param e
     */
    const touchMoveEvent = (e: TouchEvent): void => {
      mouseMoved = true;
      updateMousePosition(e.targetTouches[0].pageX, e.targetTouches[0].pageY);
    };

    onMounted(() => {
      const params = {
        pointsNumber: 40,
        widthFactor: 0.3,
        mouseThreshold: 0.6,
        spring: 0.4,
        friction: 0.5,
      };
      const trail: Array<{ x: number; y: number; dx: number; dy: number }> = [];
      for (let i = 0; i < params.pointsNumber; i++) {
        trail.push({
          x: pointer.x,
          y: pointer.y,
          dx: 0,
          dy: 0,
        });
      }
      window.addEventListener('click', clickEvent);
      window.addEventListener('mousemove', mouseMoveEvent);
      window.addEventListener('touchmove', touchMoveEvent);

      const ctx = canvas.value?.getContext('2d');
      if (ctx !== null && ctx !== undefined) {
        ctx.font = '48px serif';
        ctx.fillText('Under Construction', 10, 50);
      }

      setupCanvas();
      update(0);
      window.addEventListener('resize', setupCanvas);

      /**
       * @param t
       */
      function update(t: number): void {
        if (ctx === null || ctx === undefined) return;
        // for intro motion
        if (!mouseMoved) {
          pointer.x = (0.5 + 0.3 * Math.cos(0.002 * t) * Math.sin(0.005 * t)) * window.innerWidth;
          pointer.y =
            (0.5 + 0.2 * Math.cos(0.005 * t) + 0.1 * Math.cos(0.01 * t)) * window.innerHeight;
        }

        ctx?.clearRect(0, 0, canvas.value?.width ?? 0, canvas.value?.height ?? 0);
        trail.forEach((p, pIdx) => {
          const prev = pIdx === 0 ? pointer : trail[pIdx - 1];
          const spring = pIdx === 0 ? 0.4 * params.spring : params.spring;
          p.dx += (prev.x - p.x) * spring;
          p.dy += (prev.y - p.y) * spring;
          p.dx *= params.friction;
          p.dy *= params.friction;
          p.x += p.dx;
          p.y += p.dy;
        });

        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(trail[0].x, trail[0].y);

        for (let i = 1; i < trail.length - 1; i++) {
          const xc = 0.5 * (trail[i].x + trail[i + 1].x);
          const yc = 0.5 * (trail[i].y + trail[i + 1].y);
          ctx.quadraticCurveTo(trail[i].x, trail[i].y, xc, yc);
          ctx.lineWidth = params.widthFactor * (params.pointsNumber - i);
          ctx.stroke();
        }
        ctx.lineTo(trail[trail.length - 1].x, trail[trail.length - 1].y);
        ctx.stroke();

        window.requestAnimationFrame(update);
      }
    });

    onUnmounted(() => {
      window.removeEventListener('resize', setupCanvas);
      window.removeEventListener('click', clickEvent);
      window.removeEventListener('mousemove', mouseMoveEvent);
      window.removeEventListener('touchmove', touchMoveEvent);
      canvas.value = null;
    });

    return { canvas };
  },
};
</script>

<style scoped>
#canvasContainer {
  position: relative;
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100vh;
  width: 100vw;
}
#constructionCanvas {
  width: 100%;
  height: 100%;
}
#constructionText {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
}
</style>
