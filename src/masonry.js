// Keep source order, placing each successive card in the shortest column.
export const masonryPositions = (heights, columns, gap) => {
  const bottoms = Array(columns).fill(0);
  const positions = heights.map(height => {
    const top = Math.min(...bottoms);
    const column = bottoms.indexOf(top);
    bottoms[column] = top + height + gap;
    return { column, top };
  });
  return { positions, height: Math.max(0, ...bottoms) - (heights.length ? gap : 0) };
};

export const setupMasonry = list => {
  let frame;
  let lastWidth = 0;
  const cards = [...list.children];
  const render = () => {
    frame = undefined;
    if (list.dataset.layout !== 'masonry') {
      list.classList.remove('masonry-ready');
      list.style.removeProperty('height');
      list.style.removeProperty('--card-width');
      cards.forEach(card => { card.style.removeProperty('left'); card.style.removeProperty('top'); });
      return;
    }
    const styles = getComputedStyle(list);
    const padding = parseFloat(styles.paddingLeft);
    const gap = parseFloat(styles.gap);
    const width = list.clientWidth - padding - parseFloat(styles.paddingRight);
    if (width <= 0) return;
    const columns = Math.max(1, Math.floor((width + gap) / (260 + gap)));
    const cardWidth = (width - gap * (columns - 1)) / columns;
    list.style.setProperty('--card-width', `${cardWidth}px`);
    list.classList.add('masonry-ready');
    const visible = [...list.children].filter(card => !card.hidden);
    const layout = masonryPositions(visible.map(card => card.getBoundingClientRect().height), columns, gap);
    visible.forEach((card, index) => {
      const { column, top } = layout.positions[index];
      card.style.left = `${padding + column * (cardWidth + gap)}px`;
      card.style.top = `${parseFloat(styles.paddingTop) + top}px`;
    });
    list.style.height = `${layout.height + parseFloat(styles.paddingTop) + parseFloat(styles.paddingBottom)}px`;
  };
  const schedule = () => { frame ??= requestAnimationFrame(render); };
  const observer = new ResizeObserver(changes => {
    const changed = changes.some(({ target, contentRect }) => {
      if (target !== list) return true;
      const resized = contentRect.width !== lastWidth;
      lastWidth = contentRect.width;
      return resized;
    });
    if (changed && list.dataset.layout === 'masonry') schedule();
  });
  observer.observe(list);
  cards.forEach(card => observer.observe(card));
  return schedule;
};
