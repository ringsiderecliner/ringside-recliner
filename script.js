
document.querySelectorAll('[data-year]').forEach((el) => {
  el.textContent = new Date().getFullYear();
});

const cards = [...document.querySelectorAll('[data-archive-card]')];
const search = document.querySelector('[data-archive-search]');
const filterButtons = [...document.querySelectorAll('[data-filter]')];
const count = document.querySelector('[data-archive-count]');
const emptyState = document.querySelector('[data-empty-state]');
let activeFilter = 'all';

function updateArchive() {
  if (!cards.length) return;
  const query = (search?.value || '').trim().toLowerCase();
  let visible = 0;

  cards.forEach((card) => {
    const matchesType = activeFilter === 'all' || card.dataset.type === activeFilter;
    const matchesText = !query || card.textContent.toLowerCase().includes(query);
    const show = matchesType && matchesText;
    card.hidden = !show;
    if (show) visible += 1;
  });

  if (count) count.textContent = `Showing ${visible} post${visible === 1 ? '' : 's'}`;
  if (emptyState) emptyState.hidden = visible !== 0;
}

search?.addEventListener('input', updateArchive);
filterButtons.forEach((button) => {
  button.addEventListener('click', () => {
    activeFilter = button.dataset.filter;
    filterButtons.forEach((item) => item.classList.toggle('active', item === button));
    updateArchive();
  });
});
