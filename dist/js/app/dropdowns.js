let wired = false;

function resetMenu(menu) {
  if (!menu) return;
  menu.classList.remove('is-fixed');
  menu.style.left = '';
  menu.style.top = '';
  menu.style.minWidth = '';
  menu.style.maxHeight = '';
  menu.style.overflowY = '';
}

function positionMenu(dropdown) {
  const trigger = dropdown?.querySelector?.('[data-dropdown-trigger]');
  const menu = dropdown?.querySelector?.('.dropdown-menu');
  if (!trigger || !menu) return;

  // Ensure menu is not clipped by overflow containers.
  menu.classList.add('is-fixed');

  const triggerRect = trigger.getBoundingClientRect();

  // Make menu at least as wide as the trigger.
  const triggerWidth = Math.ceil(triggerRect.width);
  menu.style.minWidth = `${Math.max(180, triggerWidth)}px`;

  // Measure after minWidth applies.
  const menuWidth = Math.ceil(menu.offsetWidth);
  const menuHeight = Math.ceil(menu.offsetHeight);

  const margin = 8;
  let left = triggerRect.right - menuWidth;
  left = Math.max(margin, Math.min(left, window.innerWidth - margin - menuWidth));

  let top = triggerRect.bottom + margin;
  const wouldOverflowBottom = top + menuHeight > window.innerHeight - margin;
  if (wouldOverflowBottom) {
    top = triggerRect.top - margin - menuHeight;
  }

  // Clamp into viewport and enable internal scrolling if needed.
  const maxTop = window.innerHeight - margin - menuHeight;
  top = Math.max(margin, Math.min(top, Math.max(margin, maxTop)));

  const availableBelow = window.innerHeight - margin - top;
  menu.style.maxHeight = `${Math.max(160, availableBelow)}px`;
  menu.style.overflowY = 'auto';

  menu.style.left = `${Math.round(left)}px`;
  menu.style.top = `${Math.round(top)}px`;
}

function positionOpenMenus() {
  document.querySelectorAll('.dropdown.is-open').forEach((dropdown) => {
    positionMenu(dropdown);
  });
}

function closeAll(exceptDropdown = null) {
  document.querySelectorAll('.dropdown.is-open').forEach((d) => {
    if (exceptDropdown && d === exceptDropdown) return;
    d.classList.remove('is-open');
    const trigger = d.querySelector('[data-dropdown-trigger]');
    if (trigger) trigger.setAttribute('aria-expanded', 'false');

    resetMenu(d.querySelector('.dropdown-menu'));
  });
}

function toggleDropdown(trigger) {
  const dropdown = trigger.closest('.dropdown');
  if (!dropdown) return;

  const willOpen = !dropdown.classList.contains('is-open');
  closeAll(dropdown);

  dropdown.classList.toggle('is-open', willOpen);
  trigger.setAttribute('aria-expanded', willOpen ? 'true' : 'false');

  if (willOpen) {
    // Defer positioning/focus until after styles apply.
    queueMicrotask(() => {
      positionMenu(dropdown);
      const firstItem = dropdown.querySelector('.dropdown-menu .dropdown-item');
      if (firstItem) firstItem.focus();
    });
  } else {
    resetMenu(dropdown.querySelector('.dropdown-menu'));
  }
}

export function setupDropdowns() {
  if (wired) return;
  wired = true;

  document.addEventListener('click', (e) => {
    const trigger = e.target?.closest?.('[data-dropdown-trigger]');
    if (trigger) {
      e.preventDefault();
      toggleDropdown(trigger);
      return;
    }

    const item = e.target?.closest?.('.dropdown-item');
    if (item) {
      const dropdown = item.closest('.dropdown');
      if (dropdown) {
        dropdown.classList.remove('is-open');
        const t = dropdown.querySelector('[data-dropdown-trigger]');
        if (t) t.setAttribute('aria-expanded', 'false');

        resetMenu(dropdown.querySelector('.dropdown-menu'));
      }
      return;
    }

    // Click outside closes everything.
    if (!e.target?.closest?.('.dropdown')) closeAll();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeAll();
      return;
    }

    // Simple keyboard navigation inside open menus.
    const open = document.querySelector('.dropdown.is-open');
    if (!open) return;

    const items = Array.from(open.querySelectorAll('.dropdown-menu .dropdown-item'));
    if (items.length === 0) return;

    const active = document.activeElement;
    const idx = items.indexOf(active);

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      const next = items[(idx + 1 + items.length) % items.length];
      next.focus();
      return;
    }

    if (e.key === 'ArrowUp') {
      e.preventDefault();
      const prev = items[(idx - 1 + items.length) % items.length];
      prev.focus();
      return;
    }

    if (e.key === 'Enter' && idx >= 0) {
      e.preventDefault();
      items[idx].click();
    }
  });

  window.addEventListener('blur', () => closeAll());
  window.addEventListener('resize', () => positionOpenMenus());
  window.addEventListener('scroll', () => positionOpenMenus(), true);
}
