import { button, el, icon } from './dom';
export interface DropdownItem { value: string; label: string; description?: string; content?: () => HTMLElement; select: () => void }
let nextId = 0;
let active: { element: HTMLElement; close: (focus?: boolean) => void } | undefined;
export function closeDropdown() { active?.close(); }
document.addEventListener('pointerdown', event => { if (active && !active.element.contains(event.target as Node)) active.close(); });
document.addEventListener('keydown', event => { if (event.key === 'Escape' && active) { event.preventDefault(); active.close(true); } });
export function dropdown(label: string, value: string, items: DropdownItem[], content?: () => HTMLElement, extras?: () => HTMLElement) {
  const wrapper = el('div', undefined, 'dropdown');
  const id = 'dropdown-' + ++nextId;
  const trigger = button('', () => menu.hidden ? show() : hide(), 'dropdown-trigger');
  trigger.setAttribute('role', 'combobox'); trigger.setAttribute('aria-label', label); trigger.setAttribute('aria-haspopup', 'listbox'); trigger.setAttribute('aria-controls', id); trigger.setAttribute('aria-expanded', 'false');
  const selected = el('span', undefined, 'dropdown-value');
  selected.append(content ? content() : el('span', items.find(item => item.value === value)?.label ?? items[0]?.label));
  trigger.append(selected, icon('chevron'));
  const menu = el('div', undefined, 'dropdown-menu'); menu.hidden = true;
  const options = el('div', undefined, 'dropdown-options'); options.id = id; options.setAttribute('role', 'listbox'); options.setAttribute('aria-label', label);
  const controls = items.map(item => {
    const option = button('', () => {
      value = item.value;
      controls.forEach((control, index) => control.setAttribute('aria-selected', String(items[index].value === value)));
      if (!content) selected.replaceChildren(el('span', item.label));
      hide(true); item.select();
    }, 'dropdown-option');
    option.setAttribute('role', 'option'); option.setAttribute('aria-selected', String(item.value === value)); option.setAttribute('aria-label', item.label); option.tabIndex = -1;
    const copy = el('span', undefined, 'dropdown-option-copy');
    if (item.content) copy.append(item.content()); else { copy.append(el('span', item.label)); if (item.description) copy.append(el('span', item.description, 'muted')); }
    option.append(copy, icon('check')); options.append(option); return option;
  });
  menu.append(options); if (extras) menu.append(extras());
  function hide(focus = false) { menu.hidden = true; trigger.setAttribute('aria-expanded', 'false'); if (active?.element === wrapper) active = undefined; if (focus && trigger.isConnected) trigger.focus(); }
  function show(last = false) { closeDropdown(); menu.hidden = false; trigger.setAttribute('aria-expanded', 'true'); active = { element: wrapper, close: hide }; (last ? controls.at(-1) : controls.find(control => control.getAttribute('aria-selected') === 'true') ?? controls[0])?.focus(); }
  trigger.addEventListener('keydown', event => { if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); show(event.key === 'ArrowUp'); } });
  options.addEventListener('keydown', event => {
    const index = controls.indexOf(document.activeElement as HTMLButtonElement);
    const target = event.key === 'Home' ? 0 : event.key === 'End' ? controls.length - 1 : event.key === 'ArrowDown' ? (index + 1) % controls.length : event.key === 'ArrowUp' ? (index + controls.length - 1) % controls.length : undefined;
    if (target !== undefined) { event.preventDefault(); controls[target]?.focus(); }
  });
  wrapper.addEventListener('focusout', event => { if (event.relatedTarget instanceof Node && !wrapper.contains(event.relatedTarget)) hide(); });
  wrapper.append(trigger, menu); return { element: wrapper, trigger };
}
