let wired = false;

let selectWired = false;
let selectValueSetterPatched = false;
let typeaheadBuffer = '';
let typeaheadTimer = null;

function patchSelectValueSetter() {
  if (selectValueSetterPatched) return;
  selectValueSetterPatched = true;

  const desc = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value');
  if (!desc?.set || !desc?.get) return;

  Object.defineProperty(HTMLSelectElement.prototype, 'value', {
    configurable: true,
    enumerable: desc.enumerable,
    get() {
      return desc.get.call(this);
    },
    set(next) {
      desc.set.call(this, next);
      // Notify custom select UI without triggering app change handlers.
      try {
        this.dispatchEvent(new CustomEvent('player0:selectValueSet', { bubbles: true }));
      } catch {
        // ignore
      }
    }
  });
}

function getSelectedOption(select) {
  if (!select) return null;
  const idx = typeof select.selectedIndex === 'number' ? select.selectedIndex : -1;
  return select.selectedOptions?.[0] || select.options?.[idx] || select.options?.[0] || null;
}

function syncCustomSelectUI(select, trigger, menu) {
  const opt = getSelectedOption(select);
  trigger.textContent = opt?.textContent || 'Select';

  const isDisabled = Boolean(select.disabled);
  trigger.disabled = isDisabled;
  trigger.setAttribute('aria-disabled', isDisabled ? 'true' : 'false');

  const value = String(select.value ?? '');
  menu.querySelectorAll('.dropdown-item[data-value]').forEach((btn) => {
    btn.classList.toggle('is-selected', btn.dataset.value === value);
    btn.setAttribute('aria-checked', btn.dataset.value === value ? 'true' : 'false');
  });
}

function rebuildCustomSelectMenu(select, trigger, menu) {
  menu.innerHTML = '';

  const options = Array.from(select.options || []);

  // Add an inline search box for long lists.
  const enableSearch = options.length >= 10;
  let searchInput = null;
  if (enableSearch) {
    searchInput = document.createElement('input');
    searchInput.type = 'text';
    searchInput.className = 'select-dropdown-search';
    searchInput.placeholder = 'Search…';
    searchInput.autocomplete = 'off';
    searchInput.spellcheck = false;
    searchInput.setAttribute('aria-label', 'Filter options');

    const wrap = document.createElement('div');
    wrap.className = 'select-dropdown-search-wrap';
    wrap.appendChild(searchInput);
    menu.appendChild(wrap);

    const normalize = (v) => String(v || '').toLowerCase().trim();
    const applyFilter = () => {
      const q = normalize(searchInput.value);
      menu.querySelectorAll('.dropdown-item[data-value]').forEach((btn) => {
        const text = normalize(btn.textContent);
        btn.style.display = !q || text.includes(q) ? '' : 'none';
      });
    };

    searchInput.addEventListener('input', applyFilter);
    // ArrowDown from the filter jumps into the list.
    searchInput.addEventListener('keydown', (e) => {
      if (e.key !== 'ArrowDown') return;
      const firstVisible = Array.from(menu.querySelectorAll('.dropdown-item[data-value]'))
        .find((b) => !b.disabled && b.style.display !== 'none');
      if (firstVisible) {
        e.preventDefault();
        firstVisible.focus();
      }
    });
  }

  for (const opt of options) {
    const item = document.createElement('button');
    item.type = 'button';
    item.className = 'dropdown-item';
    item.textContent = opt.textContent || '';
    item.dataset.value = String(opt.value ?? '');
    item.setAttribute('role', 'menuitemradio');
    item.setAttribute('aria-checked', 'false');

    if (opt.disabled) {
      item.disabled = true;
    }

    item.addEventListener('click', () => {
      if (opt.disabled) return;

      select.value = opt.value;
      select.dispatchEvent(new Event('change', { bubbles: true }));
      syncCustomSelectUI(select, trigger, menu);
    });

    menu.appendChild(item);
  }

  syncCustomSelectUI(select, trigger, menu);

  // Focus search when menu opens.
  if (searchInput) {
    // Keep a handle for keyboard helpers.
    menu.dataset.hasSearch = '1';
  } else {
    delete menu.dataset.hasSearch;
  }
}

function upgradeSelect(select) {
  if (!select || !(select instanceof HTMLSelectElement)) return;
  if (select.dataset.customized === '1') return;
  if (select.closest('.select-dropdown')) {
    select.dataset.customized = '1';
    return;
  }

  // Only upgrade our app selects.
  const isControl = select.classList.contains('control-select');
  const isSettings = select.classList.contains('settings-select');
  if (!isControl && !isSettings) return;

  select.dataset.customized = '1';

  const wrapper = document.createElement('div');
  wrapper.className = 'select-dropdown dropdown';
  if (isControl) wrapper.classList.add('select-dropdown--control');
  if (isSettings) wrapper.classList.add('select-dropdown--settings');

  const trigger = document.createElement('button');
  trigger.type = 'button';
  trigger.className = `${select.className} select-dropdown-trigger`;
  trigger.setAttribute('data-dropdown-trigger', '');
  trigger.setAttribute('aria-haspopup', 'menu');
  trigger.setAttribute('aria-expanded', 'false');

  const label = select.getAttribute('aria-label') || select.name || 'Select';
  trigger.setAttribute('aria-label', label);

  const menu = document.createElement('div');
  menu.className = 'dropdown-menu';
  menu.setAttribute('role', 'menu');

  // Wire menu id for accessibility.
  const baseId = select.id ? `select-${select.id}` : `select-${Math.random().toString(16).slice(2)}`;
  menu.id = `${baseId}-menu`;
  trigger.setAttribute('aria-controls', menu.id);

  const parent = select.parentNode;
  if (!parent) return;

  parent.insertBefore(wrapper, select);
  wrapper.appendChild(select);
  wrapper.appendChild(trigger);
  wrapper.appendChild(menu);

  // Keep the native select for existing JS, but remove it from layout.
  select.classList.add('select-dropdown-native');
  select.tabIndex = -1;
  select.setAttribute('aria-hidden', 'true');

  rebuildCustomSelectMenu(select, trigger, menu);

  // Sync on user-driven changes.
  select.addEventListener('change', () => syncCustomSelectUI(select, trigger, menu));
  // Sync on programmatic value changes.
  select.addEventListener('player0:selectValueSet', () => syncCustomSelectUI(select, trigger, menu));

  // Options can be added dynamically (settings view). Keep menu fresh.
  const mo = new MutationObserver(() => rebuildCustomSelectMenu(select, trigger, menu));
  mo.observe(select, { childList: true, subtree: true, characterData: true, attributes: true });
}

function upgradeSelectsIn(root) {
  const scope = root && root.querySelectorAll ? root : document;
  scope.querySelectorAll('select.control-select, select.settings-select').forEach(upgradeSelect);
}

function setupSelectDropdowns() {
  if (selectWired) return;
  selectWired = true;

  patchSelectValueSetter();
  upgradeSelectsIn(document);

  // Views swap innerHTML; watch for new selects to upgrade.
  const container = document.getElementById('viewContainer') || document.body;
  const observer = new MutationObserver((mutations) => {
    for (const m of mutations) {
      for (const node of Array.from(m.addedNodes || [])) {
        if (node?.nodeType !== 1) continue;
        upgradeSelectsIn(node);
      }
    }
  });
  observer.observe(container, { childList: true, subtree: true });
}

function resetMenu(menu) {
  if (!menu) return;
  menu.classList.remove('is-fixed');
  menu.style.display = '';
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

  // Force menu to be visible for measurement
  menu.style.display = 'block';
  
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
    // Position immediately so the menu is clickable right away.
    positionMenu(dropdown);

    // Use double RAF to ensure styles have applied before positioning
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        positionMenu(dropdown);
        const firstItem = dropdown.querySelector('.dropdown-menu .dropdown-item');
        if (firstItem) firstItem.focus();
      });
    });
  } else {
    resetMenu(dropdown.querySelector('.dropdown-menu'));
  }
}

export function setupDropdowns() {
  if (wired) return;
  wired = true;

  // Custom selects use the same dropdown plumbing.
  setupSelectDropdowns();

  // Pointer-first interaction fixes cases where menus only respond after mouse movement.
  document.addEventListener(
    'pointerdown',
    (e) => {
      const trigger = e.target?.closest?.('[data-dropdown-trigger]');
      if (trigger) {
        e.preventDefault();
        toggleDropdown(trigger);
        return;
      }

      // Allow menu items to receive click (selection) before we close.
      if (e.target?.closest?.('.dropdown-menu')) return;

      // Tap/click outside closes everything.
      if (!e.target?.closest?.('.dropdown')) closeAll();
    },
    true
  );

  // Close after an item is activated.
  document.addEventListener('click', (e) => {
    const item = e.target?.closest?.('.dropdown-item');
    if (!item) return;

    const dropdown = item.closest('.dropdown');
    if (!dropdown) return;

    dropdown.classList.remove('is-open');
    const t = dropdown.querySelector('[data-dropdown-trigger]');
    if (t) t.setAttribute('aria-expanded', 'false');
    resetMenu(dropdown.querySelector('.dropdown-menu'));
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeAll();
      return;
    }

    // Simple keyboard navigation inside open menus.
    const open = document.querySelector('.dropdown.is-open');
    if (!open) return;

    const menu = open.querySelector('.dropdown-menu');
    const items = Array.from(open.querySelectorAll('.dropdown-menu .dropdown-item'))
      .filter((btn) => btn.style.display !== 'none' && !btn.disabled);
    if (items.length === 0) return;

    const active = document.activeElement;
    const idx = items.indexOf(active);

    // If the dropdown has a filter input (custom select), allow focusing it with Ctrl+F.
    const isSelectDropdown = open.classList.contains('select-dropdown');
    const filterInput = isSelectDropdown ? open.querySelector('.dropdown-menu .select-dropdown-search') : null;

    if (isSelectDropdown && (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f' && filterInput) {
      e.preventDefault();
      filterInput.focus();
      return;
    }

    // Type-to-search for custom selects.
    if (isSelectDropdown && !e.ctrlKey && !e.metaKey && !e.altKey && e.key.length === 1) {
      const ch = e.key;
      const isPrintable = /[\w\s\-\.]/.test(ch);
      if (isPrintable) {
        typeaheadBuffer += ch.toLowerCase();
        if (typeaheadTimer) clearTimeout(typeaheadTimer);
        typeaheadTimer = setTimeout(() => {
          typeaheadBuffer = '';
          typeaheadTimer = null;
        }, 650);

        const normalize = (v) => String(v || '').toLowerCase().trim();
        const match = items.find((btn) => normalize(btn.textContent).startsWith(typeaheadBuffer));
        if (match) {
          match.focus();
          e.preventDefault();
          return;
        }
      }
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      const base = idx >= 0 ? idx : -1;
      const next = items[(base + 1 + items.length) % items.length];
      next?.focus?.();
      return;
    }

    if (e.key === 'ArrowUp') {
      e.preventDefault();
      const base = idx >= 0 ? idx : 0;
      const prev = items[(base - 1 + items.length) % items.length];
      prev?.focus?.();
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
