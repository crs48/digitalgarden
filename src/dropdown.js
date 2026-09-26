// Enhance the native controls while keeping them as the filtering source of truth.
export const setupDropdown = select => {
  const wrapper = select.closest('[data-dropdown]');
  const trigger = wrapper.querySelector('.dropdown-trigger');
  const value = wrapper.querySelector('.dropdown-value');
  const menu = wrapper.querySelector('.dropdown-menu');
  const options = [...select.options];
  const rows = [...menu.querySelectorAll('[role=option]')];
  let activeIndex = 0;
  let typed = '';
  let typedAt = 0;

  // A fixed menu outside the toolbar cannot be clipped by its horizontal scroll area.
  document.body.append(menu);
  const close = () => {
    menu.hidden = true;
    trigger.setAttribute('aria-expanded', 'false');
    trigger.removeAttribute('aria-activedescendant');
    typed = '';
  };
  const highlight = index => {
    activeIndex = Math.max(0, Math.min(rows.length - 1, index));
    rows.forEach((row, i) => { row.dataset.active = String(i === activeIndex); });
    trigger.setAttribute('aria-activedescendant', rows[activeIndex].id);
    rows[activeIndex].scrollIntoView({ block: 'nearest' });
  };
  const sync = () => {
    const selected = options[select.selectedIndex];
    if (!selected) return;
    const label = document.createElement('span');
    label.textContent = selected.dataset.label;
    value.replaceChildren(label);
    if (selected.dataset.count !== undefined) {
      const count = document.createElement('span');
      count.className = 'dropdown-count';
      count.textContent = selected.dataset.count;
      value.append(count);
    }
    wrapper.dataset.filtered = String(select.id === 'category' && Boolean(select.value));
    rows.forEach((row, index) => {
      row.setAttribute('aria-selected', String(options[index].selected));
      const count = row.querySelector('.dropdown-count');
      if (count) count.textContent = options[index].dataset.count;
    });
  };
  const open = () => {
    trigger.focus({ preventScroll: true });
    trigger.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    const bounds = trigger.getBoundingClientRect();
    const width = Math.min(Math.max(bounds.width, 220), document.documentElement.clientWidth - 24);
    const below = window.innerHeight - bounds.bottom - 12;
    const above = bounds.top - 12;
    const opensUp = below < 220 && above > below;
    menu.style.width = `${width}px`;
    menu.style.maxHeight = `${Math.max(60, Math.min(320, (opensUp ? above : below) - 6))}px`;
    menu.style.left = `${Math.max(12, Math.min(bounds.left, document.documentElement.clientWidth - width - 12))}px`;
    menu.hidden = false;
    menu.style.top = `${opensUp ? bounds.top - menu.offsetHeight - 6 : bounds.bottom + 6}px`;
    trigger.setAttribute('aria-expanded', 'true');
    highlight(select.selectedIndex);
  };
  const choose = index => {
    select.value = options[index].value;
    close();
    select.dispatchEvent(new Event('change', { bubbles: true }));
    trigger.focus({ preventScroll: true });
  };

  trigger.addEventListener('click', () => menu.hidden ? open() : close());
  trigger.addEventListener('keydown', event => {
    if (event.key === 'Tab' || event.key === 'Escape') {
      if (!menu.hidden && event.key === 'Escape') event.preventDefault();
      close();
      return;
    }
    if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
      event.preventDefault();
      const wasOpen = !menu.hidden;
      if (!wasOpen) open();
      if (event.key === 'Home') highlight(0);
      else if (event.key === 'End') highlight(rows.length - 1);
      else if (wasOpen) highlight(activeIndex + (event.key === 'ArrowDown' ? 1 : -1));
      return;
    }
    if ((event.key === 'Enter' || event.key === ' ') && !menu.hidden) {
      event.preventDefault();
      choose(activeIndex);
      return;
    }
    if (event.key.length === 1 && event.key !== ' ' && !event.metaKey && !event.ctrlKey && !event.altKey) {
      event.preventDefault();
      event.stopPropagation();
      if (menu.hidden) open();
      typed = Date.now() - typedAt < 600 ? typed + event.key.toLowerCase() : event.key.toLowerCase();
      typedAt = Date.now();
      const index = options.findIndex(option => option.dataset.label.toLowerCase().startsWith(typed));
      if (index !== -1) highlight(index);
    }
  });
  menu.addEventListener('mousedown', event => event.preventDefault());
  rows.forEach((row, index) => {
    row.addEventListener('click', () => choose(index));
    row.addEventListener('pointermove', event => { if (event.pointerType === 'mouse') highlight(index); });
  });
  document.addEventListener('pointerdown', event => {
    if (!wrapper.contains(event.target) && !menu.contains(event.target)) close();
  });
  trigger.addEventListener('blur', close);
  window.addEventListener('resize', close);
  window.addEventListener('scroll', event => {
    if (!menu.contains(event.target)) close();
  }, true);
  select.addEventListener('change', sync);
  select.hidden = true;
  trigger.hidden = false;
  sync();
  return sync;
};
